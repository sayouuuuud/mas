import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  BackendService,
  safeProduct,
  stableHash,
} from '../../lib/server/services'
import {
  productInput,
  requestInput,
  quotationInput,
  invitationInput,
  teamUpdate,
  type Actor,
  type Entity,
} from '../../lib/server/contracts'
import type {
  Repository,
  Command,
  VariantResolution,
} from '../../lib/server/repository'
import { ApiError } from '../../lib/server/errors'
import { requireActor } from '../../lib/server/policy'
import { quotationPdf } from '../../lib/server/pdf'
import { drainJobs } from '../../lib/server/jobs'
import { PDFDocument } from 'pdf-lib'

const ids = Array.from({ length: 12 }, () => randomUUID())
const admin: Actor = {
  id: ids[0],
  active: true,
  roles: ['Owner'],
  aal: 'aal2',
}
const adminAlias: Actor = {
  id: ids[1],
  active: true,
  roles: ['Admin'],
  aal: 'aal2',
}
const bilingual = { ar: 'منتج صناعي', en: 'Industrial product' }

class FakeRepository implements Repository {
  rows = new Map<string, Entity>()
  commands: Command[] = []
  submissions: Record<string, unknown>[] = []
  replay = new Map<string, { hash: string; reference: string }>()
  lastFilters: unknown
  policy = 'v1'
  attributes: Entity[] = []
  quotationsList: Entity[] = []
  variant: VariantResolution = {
    product: { id: ids[3], name: bilingual, slug: 'product' },
    variant: {
      id: ids[4],
      sku: 'CANONICAL-SKU',
      label: bilingual,
      unitId: ids[5],
      minQuantity: 2,
      quantityStep: 2,
      active: true,
      availability: 'available',
    },
    unit: {
      id: ids[5],
      code: 'piece',
      precision: 0,
      name: { ar: 'قطعة', en: 'Piece' },
    },
  }
  async get(_resource: string, id: string) {
    return this.rows.get(id) || null
  }
  async list(resource: string, filters: unknown) {
    this.lastFilters = filters
    if (resource === 'attributes') {
      return { data: this.attributes, total: this.attributes.length }
    }
    if (resource === 'quotations') {
      return { data: this.quotationsList, total: this.quotationsList.length }
    }
    return { data: [], total: 0 }
  }
  async command(input: Command) {
    this.commands.push(input)
    return {
      id: input.id || randomUUID(),
      version: (input.version || 0) + 1,
      ...input.data,
    }
  }
  async resolveVariant(id: string) {
    return id === this.variant.variant.id ? this.variant : null
  }
  async getUnit(code: string) {
    return code === 'piece' ? this.variant.unit : null
  }
  async publicContent() {
    return { policyVersion: this.policy }
  }
  async facets() {
    return {}
  }
  async submit(
    _kind: string,
    payload: Record<string, unknown>,
    key: string,
    hash: string,
  ) {
    const prior = this.replay.get(key)
    if (prior && prior.hash !== hash)
      throw new ApiError(409, 'CONFLICT', 'Key was already used.')
    if (!prior) {
      this.submissions.push(payload)
      this.replay.set(key, { hash, reference: 'RFQ-1' })
    }
    return {
      reference: 'RFQ-1',
      receivedAt: '2026-11-16T00:00:00Z',
      replayed: !!prior,
    }
  }
  async rateLimit() {
    return { allowed: true, retryAfter: 0 }
  }
}

const rfq = () => ({
  locale: 'ar',
  customer: { name: 'محمد أحمد', phone: '01012345678' },
  items: [{ variantId: ids[4], quantity: 4, unitCode: 'piece' }],
  privacy: { accepted: true, policyVersion: 'v1' },
  source: { page: '/ar/request-quote' },
})

const quote = () => ({
  locale: 'ar',
  currency: 'EGP',
  validUntil: '2027-01-01',
  leadTime: 'أسبوع',
  terms: 'الدفع عند التوريد',
  lines: [
    {
      description: 'زيت صناعي ISO VG 46',
      sku: 'SKU-1',
      quantity: 2,
      unit: 'piece',
      price: '10.005',
      discount: '0',
      tax: '14',
    },
  ],
})

const request = (assignedTo: string | null = admin.id) => ({
  id: ids[6],
  version: 2,
  status: 'in_progress',
  assignedTo,
  customerSnapshot: { name: 'محمد أحمد', phone: '+201012345678' },
  items: [],
})

const rejects = (fn: () => Promise<unknown>, status: number) =>
  assert.rejects(
    fn,
    (error) => error instanceof ApiError && error.status === status,
  )

test('public projection excludes internal notes, pricing and inactive variants', () => {
  const row = {
    id: ids[3],
    version: 1,
    status: 'published',
    name: bilingual,
    sourceNote: 'secret',
    cost: 123,
    variants: [
      { id: ids[4], active: true, sku: 'sku', cost: 42 },
      { active: false, sku: 'hidden' },
    ],
  }
  const safe = safeProduct(row)
  assert.equal('sourceNote' in safe, false)
  assert.equal('cost' in safe, false)
  assert.equal((safe.variants as unknown[]).length, 1)
  assert.equal('cost' in (safe.variants as Record<string, unknown>[])[0], false)
  assert.throws(() => safeProduct({ ...row, status: 'draft' }), {
    status: 404,
  })
})

test('single Admin role enforces active account, MFA aal2 and rejects separate sub-roles', () => {
  assert.throws(() => requireActor({ ...admin, aal: 'aal1' }), {
    code: 'MFA_REQUIRED',
  })
  assert.throws(() => requireActor({ ...adminAlias, aal: 'aal1' }), {
    code: 'MFA_REQUIRED',
  })
  assert.throws(() => requireActor({ ...admin, active: false }), {
    status: 401,
  })
  assert.throws(
    () =>
      requireActor({
        id: ids[9],
        active: true,
        roles: ['Sales Agent' as any],
        aal: 'aal2',
      }),
    { status: 403 },
  )
  requireActor(admin)
  requireActor(adminAlias)

  // Invitations and team updates only accept Admin/Owner and normalize internally to ['Owner']
  assert.equal(
    invitationInput.safeParse({
      email: 'staff@example.com',
      displayName: 'New Admin',
      roles: ['Sales Agent'],
    }).success,
    false,
  )
  const parsedInvite = invitationInput.parse({
    email: 'admin@example.com',
    displayName: 'Admin User',
    roles: ['Admin'],
  })
  assert.deepEqual(parsedInvite.roles, ['Owner'])
  const parsedUpdate = teamUpdate.parse({
    version: 1,
    displayName: 'Admin User',
    active: true,
    roles: ['Admin'],
  })
  assert.deepEqual(parsedUpdate.roles, ['Owner'])
})

test('non-admin or non-MFA actor cannot read, write or assign resources', async () => {
  const repo = new FakeRepository()
  repo.rows.set(ids[6], request(ids[0]))
  const service = new BackendService(repo)
  const nonMfaAdmin: Actor = { ...admin, aal: 'aal1' }
  const legacyNonAdmin: Actor = {
    id: ids[9],
    active: true,
    roles: ['Sales Agent' as any],
    aal: 'aal2',
  }
  await rejects(() => service.read('quote_requests', ids[6], nonMfaAdmin), 403)
  await rejects(
    () => service.read('quote_requests', ids[6], legacyNonAdmin),
    403,
  )
  await rejects(
    () => service.note('quote_requests', ids[6], 2, 'Private note', nonMfaAdmin),
    403,
  )
  await rejects(
    () => service.assign('quote_requests', ids[6], 2, admin.id, legacyNonAdmin),
    403,
  )
  await rejects(() => service.save('products', {}, nonMfaAdmin), 403)
  assert.equal(repo.commands.length, 0)
})

test('product deletion only allows drafts; published products require archiving', async () => {
  const repo = new FakeRepository()
  const service = new BackendService(repo)
  repo.rows.set(ids[3], { id: ids[3], version: 2, status: 'published' })
  await rejects(() => service.remove('products', ids[3], 2, admin), 422)
  repo.rows.set(ids[3], { id: ids[3], version: 2, status: 'draft' })
  await service.remove('products', ids[3], 2, admin)
  assert.equal(repo.commands.length, 1)
  assert.equal(repo.commands[0].action, 'delete')
})

test('RFQ resolves canonical snapshots, normalizes phone and replays the same key', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo),
    body = rfq(),
    key = randomUUID()
  const first = await service.submit('request', body, key),
    second = await service.submit('request', body, key)
  assert.equal(first.replayed, false)
  assert.equal(second.replayed, true)
  assert.equal(repo.submissions.length, 1)
  const saved = repo.submissions[0] as any
  assert.equal(saved.customer.phone, '+201012345678')
  assert.equal(saved.items[0].snapshot.sku, 'CANONICAL-SKU')
  await rejects(
    () =>
      service.submit('request', { ...body, notes: 'Different request' }, key),
    409,
  )
})

test('RFQ rejects price injection, obsolete units, fractional pieces and duplicate items', async () => {
  for (const change of [
    { ...rfq(), items: [{ ...rfq().items[0], price: '1' }] },
    { ...rfq(), items: [{ ...rfq().items[0], unitCode: 'litre' }] },
    { ...rfq(), items: [{ ...rfq().items[0], quantity: 3 }] },
    { ...rfq(), items: [...rfq().items, ...rfq().items] },
  ]) {
    const repo = new FakeRepository()
    await rejects(
      () => new BackendService(repo).submit('request', change, randomUUID()),
      422,
    )
    assert.equal(repo.submissions.length, 0)
  }
})

test('unavailable variants and stale privacy consent cannot be submitted', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.policy = 'v2'
  await rejects(() => service.submit('request', rfq(), randomUUID()), 422)
  repo.policy = 'v1'
  repo.variant.variant.availability = 'unavailable'
  await rejects(() => service.submit('request', rfq(), randomUUID()), 422)
})

test('closed requests require reason and stale versions conflict', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], { ...request(), status: 'won' })
  await rejects(
    () => service.transitionRequest(ids[6], 2, 'in_progress', '', admin),
    422,
  )
  await rejects(
    () =>
      service.transitionRequest(ids[6], 1, 'in_progress', 'Reopened', admin),
    409,
  )
  await service.transitionRequest(
    ids[6],
    2,
    'in_progress',
    'Reopened by customer',
    admin,
  )
  assert.equal(repo.commands.length, 1)
})

test('quoted status needs recorded delivery on the matching request; closure needs a reason', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], request())
  // Delivery on a different request must not satisfy quoted transition
  repo.quotationsList = [{ id: ids[7], version: 1, requestId: ids[9], status: 'sent' }]
  await rejects(
    () => service.transitionRequest(ids[6], 2, 'quoted', '', admin),
    422,
  )
  await rejects(
    () => service.transitionRequest(ids[6], 2, 'lost', '', admin),
    422,
  )
  assert.equal(repo.commands.length, 0)
  repo.quotationsList = [{ id: ids[7], version: 1, requestId: ids[6], status: 'sent' }]
  await service.transitionRequest(ids[6], 2, 'quoted', '', admin)
  assert.equal(repo.commands.length, 1)
})

test('quotation recalculates integer money and issued copies are immutable', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], request())
  const saved = await service.quotation(ids[6], quote(), admin)
  assert.equal((saved.totals as any).net, 2001)
  assert.equal((saved.totals as any).total, 2281)
  const quotation = {
    ...quotationInput.parse(quote()),
    id: ids[7],
    version: 1,
    status: 'issued',
    requestId: ids[6],
    revision: 1,
  }
  repo.rows.set(ids[7], quotation)
  await rejects(() => service.quotation(ids[6], quote(), admin, ids[7], 1), 422)
  await rejects(
    () =>
      service.quotation(ids[6], { ...quote(), totals: { total: 1 } }, admin),
    422,
  )
  await rejects(
    () =>
      service.quotation(
        ids[6],
        { ...quote(), lines: [{ ...quote().lines[0], requestItemId: ids[9] }] },
        admin,
      ),
    422,
  )
})

test('issued quotation cannot be accepted before delivery or after expiry', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo, () => new Date('2026-11-16'))
  repo.rows.set(ids[6], request())
  repo.rows.set(ids[7], {
    ...quotationInput.parse(quote()),
    id: ids[7],
    version: 1,
    status: 'issued',
    requestId: ids[6],
    revision: 1,
  })
  await rejects(
    () =>
      service.quotationAction(
        ids[7],
        1,
        'accepted',
        'Customer email',
        undefined,
        admin,
      ),
    422,
  )
  repo.rows.get(ids[7])!.status = 'sent'
  repo.rows.get(ids[7])!.validUntil = '2026-01-01'
  await rejects(
    () =>
      service.quotationAction(
        ids[7],
        1,
        'accepted',
        'Customer email',
        undefined,
        admin,
      ),
    422,
  )
})

test('catalog cycles, unapproved images and absent bilingual content prevent publication', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[8], { id: ids[8], version: 1, parentId: ids[9] })
  repo.rows.set(ids[9], { id: ids[9], version: 1, parentId: ids[8] })
  await rejects(
    () =>
      service.save(
        'categories',
        { name: bilingual, parentId: ids[8] },
        admin,
      ),
    422,
  )
  const data = productInput.parse({
    name: bilingual,
    slug: 'product',
    summary: bilingual,
    description: bilingual,
    family: 'oils',
    categoryId: ids[8],
    brandId: ids[9],
    variants: [{ sku: 'SKU', label: bilingual, unitId: ids[5] }],
  })
  await rejects(() => service.validateProduct(data, admin), 422)
  assert.equal(repo.commands.length, 0)
})

test('strict schemas reject excessive quantities, forged roles and unsafe source URLs', () => {
  assert.equal(
    requestInput.safeParse({ ...rfq(), source: { page: '//evil.example' } })
      .success,
    false,
  )
  assert.equal(
    requestInput.safeParse({ ...rfq(), roles: ['Owner'] }).success,
    false,
  )
  assert.equal(
    requestInput.safeParse({
      ...rfq(),
      items: [{ ...rfq().items[0], quantity: 0.0001 }],
    }).success,
    false,
  )
  assert.equal(stableHash({ a: 1, b: 2 }), stableHash({ b: 2, a: 1 }))
})

test('required specification scope, type and numeric bounds are enforced', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[8], { id: ids[8], version: 1, status: 'published' })
  repo.rows.set(ids[9], { id: ids[9], version: 1, status: 'published' })
  repo.rows.set(ids[7], {
    id: ids[7],
    version: 1,
    status: 'ready',
    visibility: 'public',
    mime: 'image/webp',
    alt: bilingual,
  })
  repo.attributes = [
    {
      id: ids[0],
      version: 1,
      type: 'number',
      scope: 'product',
      categories: [{ categoryId: ids[8], required: true, min: 1, max: 100 }],
    },
  ]
  const product = productInput.parse({
    name: bilingual,
    slug: 'product',
    summary: bilingual,
    description: bilingual,
    family: 'oils',
    categoryId: ids[8],
    brandId: ids[9],
    mainMediaId: ids[7],
    variants: [{ sku: 'SKU', label: bilingual, unitId: ids[5] }],
  })
  await rejects(() => service.validateProduct(product, admin), 422)
  await rejects(
    () =>
      service.validateProduct(
        { ...product, specifications: [{ attributeId: ids[0], value: 101 }] },
        admin,
      ),
    422,
  )
  await rejects(
    () =>
      service.validateProduct(
        { ...product, specifications: [{ attributeId: ids[0], value: '10' }] },
        admin,
      ),
    422,
  )
  await service.validateProduct(
    { ...product, specifications: [{ attributeId: ids[0], value: 10 }] },
    admin,
  )
})

test('inquiry transitions and conversion reject invalid state, duplicate conversion and quantity steps', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], { ...request(), status: 'new' })
  await rejects(
    () => service.transitionInquiry(ids[6], 2, 'resolved', 'Complete', admin),
    422,
  )
  repo.rows.get(ids[6])!.status = 'in_progress'
  await rejects(
    () =>
      service.convertInquiry(
        ids[6],
        2,
        [{ variantId: ids[4], quantity: 3, unitCode: 'piece' }],
        admin,
      ),
    422,
  )
  await service.convertInquiry(
    ids[6],
    2,
    [{ description: 'Free item', quantity: 1, unitCode: 'piece' }],
    admin,
  )
  repo.rows.get(ids[6])!.convertedRequestId = ids[3]
  await rejects(
    () =>
      service.convertInquiry(
        ids[6],
        2,
        [{ description: 'Free item', quantity: 1, unitCode: 'piece' }],
        admin,
      ),
    422,
  )
})

test('Arabic and English quotations generate paginated PDFs without losing older queued jobs', async () => {
  const data = quotationInput.parse(quote())
  for (const locale of ['ar', 'en'] as const) {
    const bytes = await quotationPdf(
      {
        ...data,
        locale,
        id: ids[7],
        number: 'Q-2026-0000007',
        version: 1,
        requestId: ids[6],
        status: 'issued',
        revision: 1,
        lines: Array.from({ length: 45 }, () => data.lines[0]),
      },
      { name: 'محمد أحمد', company: 'شركة النيل', phone: '+201012345678' },
      { name: bilingual, phone: '+201004998655', email: 'info@mas.test' },
    )
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-')
    assert.ok((await PDFDocument.load(bytes)).getPageCount() > 1)
  }

  // Verify drainJobs processes past older failing jobs to complete a newer quotation_pdf job
  const uploadedPaths: string[] = []
  const finished: Array<{ id: string; error: string | null; result: unknown }> = []
  const queuedJobs = [
    { id: ids[0], leaseToken: ids[1], kind: 'scan_media', payload: {} },
    { id: ids[2], leaseToken: ids[3], kind: 'delete_media', payload: { bucket: 'catalog-public', path: 'old/file.webp' } },
    { id: ids[4], leaseToken: ids[5], kind: 'quotation_pdf', payload: {} },
  ]
  const fakeScope: any = {
    config: { scannerUrl: undefined, scannerKey: undefined },
    service: {
      storage: {
        from: () => ({
          download: async () => ({ data: new Blob([Buffer.from('test')]), error: null }),
          remove: async () => ({ error: null }),
          upload: async (path: string) => {
            uploadedPaths.push(path)
            return { error: null }
          },
        }),
      },
    },
    repository: {
      rpc: async (name: string, args: any) => {
        if (name === 'mas_claim_jobs') {
          return queuedJobs.splice(0, 2)
        }
        if (name === 'mas_job_snapshot') {
          if (args.p_id === ids[0]) {
            return { id: ids[8], storagePath: 'q/1', mime: 'image/png', size: 4 }
          }
          return {
            quotation: {
              ...data,
              id: ids[7],
              number: 'Q-2026-0000099',
              version: 2,
              requestId: ids[6],
              status: 'issued',
              revision: 1,
            },
            customer: { name: 'عميل صناعي' },
            company: { name: bilingual },
          }
        }
        if (name === 'mas_finish_job') {
          finished.push({
            id: args.p_id,
            error: args.p_error,
            result: args.p_result,
          })
          return { id: args.p_id, completed: args.p_error === null }
        }
        return null
      },
    },
  }
  const results = await drainJobs(fakeScope, { maxBatches: 4, batchSize: 2 })
  assert.equal(results.length, 3)
  assert.equal(results[0].status, 'retry_pending')
  assert.equal(results[1].status, 'completed')
  assert.equal(results[2].status, 'completed')
  assert.deepEqual(uploadedPaths, [`quotations/${ids[7]}/r1.pdf`])
  assert.equal(finished.find((f) => f.id === ids[4])?.error, null)
})
