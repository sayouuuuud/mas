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
import { PDFDocument } from 'pdf-lib'

const ids = Array.from({ length: 10 }, () => randomUUID())
const owner: Actor = {
  id: ids[0],
  active: true,
  roles: ['Owner'],
  aal: 'aal2',
}
const agent: Actor = {
  id: ids[1],
  active: true,
  roles: ['Sales Agent'],
  aal: 'aal1',
}
const catalog: Actor = {
  id: ids[2],
  active: true,
  roles: ['Catalog Manager'],
  aal: 'aal1',
}
const bilingual = { ar: 'منتج صناعي', en: 'Industrial product' }

// Deliberately permissive fake: tests prove the service rejects invalid actions
// before persistence. Database authorization is verified separately against SQL.
class FakeRepository implements Repository {
  rows = new Map<string, Entity>()
  commands: Command[] = []
  submissions: Record<string, unknown>[] = []
  replay = new Map<string, { hash: string; reference: string }>()
  lastFilters: unknown
  policy = 'v1'
  attributes: Entity[] = []
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
    return {
      data: resource === 'attributes' ? this.attributes : [],
      total: resource === 'attributes' ? this.attributes.length : 0,
    }
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
      description: 'زيت صناعي',
      sku: 'SKU-1',
      quantity: 2,
      unit: 'piece',
      price: '10.005',
      discount: '0',
      tax: '14',
    },
  ],
})
const request = (assignedTo: string | null = agent.id) => ({
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
test('inactive staff and privileged sessions without MFA fail closed', () => {
  assert.throws(() => requireActor({ ...owner, aal: 'aal1' }), {
    code: 'MFA_REQUIRED',
  })
  assert.throws(() => requireActor({ ...agent, active: false }), {
    status: 401,
  })
  requireActor(agent)
})
test('cross-agent reads, writes and assignment cannot reach persistence', async () => {
  const repo = new FakeRepository()
  repo.rows.set(ids[6], request(ids[9]))
  const service = new BackendService(repo)
  await rejects(() => service.read('quote_requests', ids[6], agent), 404)
  await rejects(
    () => service.note('quote_requests', ids[6], 2, 'Private note', agent),
    404,
  )
  await rejects(
    () => service.assign('quote_requests', ids[6], 2, agent.id, agent),
    403,
  )
  await rejects(() => service.save('products', {}, agent), 403)
  assert.equal(repo.commands.length, 0)
})
test('agent list scope overrides a supplied assignee', async () => {
  const repo = new FakeRepository()
  await new BackendService(repo).list(
    'quote_requests',
    { page: 1, pageSize: 24, assignedTo: ids[9] },
    agent,
  )
  assert.equal(
    (repo.lastFilters as { assignedTo: string }).assignedTo,
    agent.id,
  )
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
test('closed requests require manager authority and stale versions conflict', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], { ...request(), status: 'won' })
  await rejects(
    () =>
      service.transitionRequest(ids[6], 2, 'in_progress', 'Reopened', agent),
    403,
  )
  await rejects(
    () =>
      service.transitionRequest(ids[6], 1, 'in_progress', 'Reopened', owner),
    409,
  )
  await service.transitionRequest(
    ids[6],
    2,
    'in_progress',
    'Reopened by customer',
    owner,
  )
  assert.equal(repo.commands.length, 1)
})
test('quoted status needs recorded delivery; closure needs a reason', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], request())
  await rejects(
    () => service.transitionRequest(ids[6], 2, 'quoted', '', agent),
    422,
  )
  await rejects(
    () => service.transitionRequest(ids[6], 2, 'lost', '', agent),
    422,
  )
  assert.equal(repo.commands.length, 0)
})
test('quotation recalculates integer money and issued copies are immutable', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], request())
  const saved = await service.quotation(ids[6], quote(), agent)
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
  await rejects(() => service.quotation(ids[6], quote(), agent, ids[7], 1), 422)
  await rejects(
    () =>
      service.quotation(ids[6], { ...quote(), totals: { total: 1 } }, agent),
    422,
  )
  await rejects(
    () =>
      service.quotation(
        ids[6],
        { ...quote(), lines: [{ ...quote().lines[0], requestItemId: ids[9] }] },
        agent,
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
        agent,
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
        agent,
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
        catalog,
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
  await rejects(() => service.validateProduct(data, catalog), 422)
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
  await rejects(() => service.validateProduct(product, catalog), 422)
  await rejects(
    () =>
      service.validateProduct(
        { ...product, specifications: [{ attributeId: ids[0], value: 101 }] },
        catalog,
      ),
    422,
  )
  await rejects(
    () =>
      service.validateProduct(
        { ...product, specifications: [{ attributeId: ids[0], value: '10' }] },
        catalog,
      ),
    422,
  )
  await service.validateProduct(
    { ...product, specifications: [{ attributeId: ids[0], value: 10 }] },
    catalog,
  )
})
test('inquiry transitions and conversion reject invalid state, duplicate conversion and quantity steps', async () => {
  const repo = new FakeRepository(),
    service = new BackendService(repo)
  repo.rows.set(ids[6], { ...request(), status: 'new' })
  await rejects(
    () => service.transitionInquiry(ids[6], 2, 'resolved', 'Complete', agent),
    422,
  )
  repo.rows.get(ids[6])!.status = 'in_progress'
  await rejects(
    () =>
      service.convertInquiry(
        ids[6],
        2,
        [{ variantId: ids[4], quantity: 3, unitCode: 'piece' }],
        agent,
      ),
    422,
  )
  await service.convertInquiry(
    ids[6],
    2,
    [{ description: 'Free item', quantity: 1, unitCode: 'piece' }],
    agent,
  )
  repo.rows.get(ids[6])!.convertedRequestId = ids[3]
  await rejects(
    () =>
      service.convertInquiry(
        ids[6],
        2,
        [{ description: 'Free item', quantity: 1, unitCode: 'piece' }],
        agent,
      ),
    422,
  )
})
test('Arabic quotation generates a readable PDF with pagination', async () => {
  const data = quotationInput.parse(quote()),
    bytes = await quotationPdf(
      {
        ...data,
        id: ids[7],
        version: 1,
        requestId: ids[6],
        status: 'issued',
        revision: 1,
        lines: Array.from({ length: 50 }, () => data.lines[0]),
      },
      { name: 'محمد أحمد' },
      { name: bilingual },
    )
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-')
  assert.ok((await PDFDocument.load(bytes)).getPageCount() > 1)
})
