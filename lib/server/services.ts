import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  quotationInput,
  requestInput,
  inquiryInput,
  resourceSchemas,
  type Actor,
  type Entity,
  type Quotation,
  type Resource,
  type SalesRequest,
  type RequestStatus,
} from './contracts'
import type { Filters, Repository } from './repository'
import { ApiError, assert, conflict, missing } from './errors'
import {
  isAdminRole,
  requireActor,
  requestPermission,
  resourcePermission,
} from './policy'
import { quoteTotals } from '../frontend-model'

export {
  productInput as productSchema,
  variantInput as variantSchema,
} from './contracts'
import { productInput as productSchema, requestItem } from './contracts'
export type ProductData = z.infer<typeof productSchema>
const permit = resourcePermission

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    const fields: Record<string, string[]> = Object.create(null)
    for (const issue of result.error.issues.slice(0, 100))
      (fields[issue.path.join('.') || 'form'] ||= []).push(issue.message)
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Review the submitted fields.',
      fields,
    )
  }
  return result.data
}

export function stableHash(value: unknown): string {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : v
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
}

export function safeProduct(row: Entity) {
  if (row.status !== 'published') throw missing()
  const allowed = [
    'id',
    'slug',
    'name',
    'summary',
    'description',
    'applications',
    'benefits',
    'categoryId',
    'brandId',
    'family',
    'featured',
    'modelCode',
    'mainMediaId',
    'media',
    'sectorIds',
    'relatedIds',
    'specifications',
    'seoTitle',
    'seoDescription',
    'publishedAt',
  ]
  const result: Record<string, unknown> = {}
  for (const key of allowed) if (row[key] !== undefined) result[key] = row[key]
  result.variants = (Array.isArray(row.variants) ? row.variants : [])
    .filter((v) => v.active === true)
    .map((v) =>
      Object.fromEntries(
        [
          'id',
          'sku',
          'manufacturerPartNumber',
          'label',
          'unitId',
          'minQuantity',
          'quantityStep',
          'packQuantity',
          'packUnitId',
          'availability',
          'specifications',
          'media',
        ]
          .filter((k) => v[k] !== undefined)
          .map((k) => [k, v[k]]),
      ),
    )
  return result
}

export class BackendService {
  constructor(
    readonly repository: Repository,
    readonly now = () => new Date(),
  ) {}

  async catalog(filters: Filters) {
    const result = await this.repository.list('products', filters)
    return { ...result, data: result.data.map(safeProduct) }
  }

  async product(id: string) {
    const row = await this.repository.get('products', id)
    if (!row) throw missing()
    return safeProduct(row)
  }

  async read(resource: Resource, id: string, actor: Actor) {
    resourcePermission(actor, resource, false)
    const row = await this.repository.get(resource, id, actor)
    if (!row) throw missing()
    if (resource === 'quote_requests' || resource === 'inquiries')
      requestPermission(actor, row as SalesRequest)
    if (resource === 'quotations')
      requestPermission(
        actor,
        (await this.repository.get(
          'quote_requests',
          String(row.requestId),
          actor,
        )) as SalesRequest | null,
      )
    return row
  }

  async list(resource: Resource, filters: Filters, actor: Actor) {
    resourcePermission(actor, resource, false)
    return this.repository.list(resource, filters, actor)
  }

  async save(
    resource: keyof typeof resourceSchemas | 'products',
    input: unknown,
    actor: Actor,
    id?: string,
    version?: number,
  ) {
    permit(actor, resource)
    if (id) {
      assert(
        Number.isInteger(version) && Number(version) > 0,
        'An expected version is required.',
      )
      await this.read(resource, id, actor)
    }
    const data =
      resource === 'products'
        ? parse(productSchema, input)
        : parse(
            resourceSchemas[resource] as z.ZodType<Record<string, unknown>>,
            input,
          )
    if (
      id &&
      resource === 'products' &&
      (data as ProductData).status === 'published'
    )
      await this.validateProduct(data as ProductData, actor, id)
    if (resource === 'products' && !id)
      assert(
        (data as ProductData).status === 'draft',
        'Create products as drafts before publishing.',
      )
    if (resource === 'categories') {
      const category = data as z.infer<typeof resourceSchemas.categories>
      let parent = category.parentId
      const seen = new Set(id ? [id] : [])
      while (parent) {
        assert(!seen.has(parent), 'A category cannot contain a cycle.')
        seen.add(parent)
        const row = await this.repository.get('categories', parent, actor)
        assert(row, 'Parent category is not available.')
        parent = row.parentId as string | undefined
      }
    }
    return this.repository.command({
      resource,
      action: id ? 'update' : 'create',
      id,
      version,
      data: data as Record<string, unknown>,
      actor,
    })
  }

  async remove(resource: Resource, id: string, version: number, actor: Actor) {
    permit(actor, resource)
    assert(
      resource === 'products' || resource in resourceSchemas,
      'This resource cannot be deleted.',
    )
    const row = await this.read(resource, id, actor)
    assert(
      Number.isInteger(version) && version > 0,
      'An expected version is required.',
    )
    if (resource === 'products') {
      assert(
        row.status === 'draft',
        'Only draft products without linked requests can be deleted; archive published products instead.',
      )
    }
    return this.repository.command({
      resource,
      action: 'delete',
      id,
      version,
      data: {},
      actor,
    })
  }

  async publication(
    resource: 'products' | 'categories' | 'brands' | 'sectors' | 'content',
    id: string,
    version: number,
    action: 'publish' | 'archive' | 'unpublish',
    actor: Actor,
  ) {
    permit(actor, resource)
    const row = await this.read(resource, id, actor)
    if (row.version !== version) throw conflict()
    if (resource === 'products' && action === 'publish')
      await this.validateProduct(
        parse(
          productSchema,
          Object.fromEntries(
            Object.entries(row).filter(([k]) => k in productSchema.shape),
          ),
        ),
        actor,
        id,
      )
    return this.repository.command({
      resource,
      action,
      id,
      version,
      data: {},
      actor,
    })
  }

  async validateProduct(product: ProductData, actor: Actor, id?: string) {
    assert(
      product.name.ar &&
        product.name.en &&
        product.summary.ar &&
        product.summary.en &&
        product.description.ar &&
        product.description.en,
      'Bilingual names and descriptions are required before publication.',
    )
    assert(
      product.categoryId && product.brandId,
      'Select a category and brand before publication.',
    )
    assert(
      product.variants.every((v) => !v.active || (v.unitId && v.sku.trim())),
      'Active variants require a selling unit and SKU.',
    )
    assert(
      product.variants.some((v) => v.active),
      'At least one active variant is required.',
    )
    assert(
      new Set(product.variants.map((v) => v.sku.toLowerCase())).size ===
        product.variants.length,
      'SKU values must be unique.',
    )
    assert(
      !id || !product.relatedIds.includes(id),
      'A product cannot relate to itself.',
    )
    for (const [resource, key] of [
      ['categories', product.categoryId],
      ['brands', product.brandId],
    ] as const) {
      assert(key, 'Select a category and brand before publication.')
      const row = await this.repository.get(resource, key, actor)
      assert(
        row && row.status === 'published',
        'Product references must be published.',
      )
    }
    assert(product.mainMediaId, 'A main image is required.')
    const image = await this.repository.get('media', product.mainMediaId, actor)
    assert(
      image &&
        image.status === 'ready' &&
        image.visibility === 'public' &&
        String(image.mime).startsWith('image/'),
      'Select an approved public image.',
    )
    const alt = image.alt as { ar?: string; en?: string }
    assert(
      alt?.ar?.trim() && alt?.en?.trim(),
      'The main image requires alt text in both languages.',
    )
    for (const mediaId of new Set([
      ...product.mediaIds,
      ...product.variants.flatMap((v) => v.mediaIds),
    ])) {
      const media = await this.repository.get('media', mediaId, actor)
      assert(
        media && media.status === 'ready' && media.visibility === 'public',
        'Every published attachment must be an approved public file.',
      )
    }
    const categoryIds = new Set([product.categoryId])
    let parent = product.categoryId
    while (parent) {
      const category = await this.repository.get('categories', parent, actor)
      parent = String(category?.parentId || '')
      if (parent) {
        assert(!categoryIds.has(parent), 'Invalid category hierarchy.')
        categoryIds.add(parent)
      }
    }
    const attributes = await this.repository.list(
      'attributes',
      { page: 1, pageSize: 1000 },
      actor,
    )
    const applicable = attributes.data.filter(
      (attribute) =>
        !Array.isArray(attribute.categories) ||
        !attribute.categories.length ||
        attribute.categories.some((rule) => categoryIds.has(rule.categoryId)),
    )
    const verify = (
      specs: ProductData['specifications'],
      scope: 'product' | 'variant',
    ) => {
      assert(
        new Set(specs.map((spec) => spec.attributeId)).size === specs.length,
        'A specification cannot be repeated.',
      )
      for (const spec of specs) {
        const attribute = applicable.find(
          (row) => row.id === spec.attributeId && row.scope === scope,
        )
        assert(attribute, 'Unknown specification or incorrect scope.')
        const rules = (
          Array.isArray(attribute.categories) ? attribute.categories : []
        ).filter((rule) => categoryIds.has(rule.categoryId))
        if (attribute.type === 'text')
          assert(
            typeof spec.value === 'string' && spec.value.trim().length > 0,
            'A text specification requires text.',
          )
        else if (attribute.type === 'number') {
          assert(
            typeof spec.value === 'number',
            'A numeric specification requires a number.',
          )
          for (const rule of rules) {
            if (rule.min !== undefined)
              assert(
                spec.value >= rule.min,
                'Specification is below its minimum.',
              )
            if (rule.max !== undefined)
              assert(
                spec.value <= rule.max,
                'Specification exceeds its maximum.',
              )
          }
        } else if (attribute.type === 'boolean')
          assert(
            typeof spec.value === 'boolean',
            'A boolean specification requires true or false.',
          )
        else {
          const options = Array.isArray(attribute.options)
              ? attribute.options
              : [],
            values =
              attribute.type === 'multi_option' ? spec.value : [spec.value]
          assert(
            Array.isArray(values) &&
              values.length > 0 &&
              new Set(values).size === values.length &&
              values.every(
                (value) =>
                  typeof value === 'string' &&
                  options.some((option) => option.id === value),
              ),
            'Select valid, unique specification options.',
          )
        }
      }
      for (const attribute of applicable.filter((row) => row.scope === scope)) {
        const rules = Array.isArray(attribute.categories)
          ? attribute.categories
          : []
        if (
          rules.some(
            (rule) => categoryIds.has(rule.categoryId) && rule.required,
          )
        )
          assert(
            specs.some((spec) => spec.attributeId === attribute.id),
            'A required specification is missing.',
          )
      }
    }
    verify(product.specifications, 'product')
    for (const variant of product.variants.filter((v) => v.active))
      verify(variant.specifications, 'variant')
  }

  async submit(kind: 'request' | 'inquiry', input: unknown, key: string) {
    assert(
      /^[a-zA-Z0-9_-]{16,128}$/.test(key),
      'A valid Idempotency-Key is required.',
    )
    const body =
      kind === 'request'
        ? parse(requestInput, input)
        : parse(inquiryInput, input)
    const policy = await this.repository.publicContent('privacy')
    assert(
      policy && policy.policyVersion === body.privacy.policyVersion,
      'The privacy policy changed. Reload the form.',
      'POLICY_CHANGED',
    )
    const payload = structuredClone(body) as unknown as Record<string, unknown>
    if ('items' in body) {
      const seen = new Set<string>()
      const items = []
      for (const item of body.items) {
        if ('variantId' in item) {
          const resolved = await this.repository.resolveVariant(item.variantId)
          assert(
            resolved &&
              resolved.variant.active &&
              resolved.variant.availability !== 'unavailable',
            'A selected product is no longer available.',
          )
          assert(
            resolved.unit.code === item.unitCode,
            'The sales unit changed.',
          )
          assert(
            !seen.has(item.variantId),
            'Duplicate catalog items must be merged.',
          )
          seen.add(item.variantId)
          const scale = 10 ** resolved.unit.precision
          assert(
            Math.abs(
              item.quantity * scale - Math.round(item.quantity * scale),
            ) < 0.000001,
            'Quantity does not match the sales unit.',
          )
          assert(
            item.quantity >= resolved.variant.minQuantity &&
              Math.round(
                (item.quantity - resolved.variant.minQuantity) * 1000,
              ) %
                Math.round(resolved.variant.quantityStep * 1000) ===
                0,
            'Quantity does not match the minimum or step.',
          )
          items.push({
            ...item,
            snapshot: {
              name: resolved.product.name,
              sku: resolved.variant.sku,
              label: resolved.variant.label,
              unit: resolved.unit.name,
            },
          })
        } else {
          const unit = await this.repository.getUnit(item.unitCode)
          assert(unit, 'Unknown sales unit.')
          assert(
            Math.abs(
              item.quantity * 10 ** unit.precision -
                Math.round(item.quantity * 10 ** unit.precision),
            ) < 0.000001,
            'Quantity does not match the sales unit.',
          )
          items.push(item)
        }
      }
      payload.items = items
    }
    return this.repository.submit(kind, payload, key, stableHash(body))
  }

  async assign(
    resource: 'quote_requests' | 'inquiries',
    id: string,
    version: number,
    assignedTo: string | null,
    actor: Actor,
  ) {
    requireActor(actor)
    await this.read(resource, id, actor)
    if (assignedTo) {
      const target = await this.repository.get('profiles', assignedTo, actor)
      assert(
        target &&
          target.active === true &&
          Array.isArray(target.roles) &&
          isAdminRole(target.roles),
        'Assign an active admin account.',
      )
    }
    return this.repository.command({
      resource,
      action: 'assign',
      id,
      version,
      data: { assignedTo },
      actor,
    })
  }

  async transitionRequest(
    id: string,
    version: number,
    next: RequestStatus,
    reason: string,
    actor: Actor,
  ) {
    const row = (await this.read('quote_requests', id, actor)) as SalesRequest
    if (row.version !== version) throw conflict()
    const transitions: Record<RequestStatus, RequestStatus[]> = {
      new: ['assigned', 'lost', 'cancelled'],
      assigned: ['in_progress', 'lost', 'cancelled'],
      in_progress: ['awaiting_customer', 'quoted', 'lost', 'cancelled'],
      awaiting_customer: ['in_progress', 'quoted', 'lost', 'cancelled'],
      quoted: ['in_progress', 'won', 'lost', 'cancelled'],
      won: ['in_progress'],
      lost: ['in_progress'],
      cancelled: ['in_progress'],
    }
    assert(
      transitions[row.status]?.includes(next),
      'Invalid request status transition.',
    )
    if (
      ['won', 'lost', 'cancelled', 'awaiting_customer'].includes(next) ||
      ['won', 'lost', 'cancelled'].includes(row.status)
    )
      assert(
        reason.trim().length >= 3,
        'A reason or approval reference is required.',
      )
    if (next === 'assigned')
      assert(row.assignedTo, 'Assign an admin account first.')
    if (next === 'quoted') {
      const result = await this.repository.list(
        'quotations',
        { page: 1, pageSize: 1000, q: id },
        actor,
      )
      assert(
        result.data.some(
          (q) =>
            q.requestId === id &&
            (q.status === 'sent' ||
              Boolean(q.delivery) ||
              ['accepted', 'rejected'].includes(String(q.status))),
        ),
        'Record delivery of an issued quotation first.',
      )
    }
    return this.repository.command({
      resource: 'quote_requests',
      action: 'transition',
      id,
      version,
      data: { status: next, reason },
      actor,
    })
  }

  async quotation(
    requestId: string,
    input: unknown,
    actor: Actor,
    id?: string,
    version?: number,
  ) {
    const request = (await this.read(
      'quote_requests',
      requestId,
      actor,
    )) as SalesRequest
    requestPermission(actor, request)
    const data = parse(quotationInput, input)
    if (id) {
      const existing = (await this.read('quotations', id, actor)) as Quotation
      assert(
        existing.requestId === requestId,
        'Quotation does not belong to the request.',
      )
      assert(existing.status === 'draft', 'Issued quotations cannot be edited.')
      if (existing.version !== version) throw conflict()
    }
    for (const line of data.lines) {
      if (line.requestItemId)
        assert(
          request.items.some((item) => item.id === line.requestItemId),
          'Quotation item does not belong to this request.',
        )
    }
    const totals = quoteTotals(
      data.lines.map((line, index) => ({ ...line, id: String(index) })),
    )
    assert(
      totals.valid,
      'Check quantities, prices, discounts, tax rates and total limits.',
    )
    return this.repository.command({
      resource: 'quotations',
      action: id ? 'update' : 'create',
      id,
      version,
      data: {
        ...data,
        requestId,
        totals: {
          net: totals.net,
          tax: totals.tax,
          total: totals.total,
          lines: totals.rows,
        },
      },
      actor,
    })
  }

  async quotationAction(
    id: string,
    version: number,
    action: 'issue' | 'revise' | 'sent' | 'accepted' | 'rejected' | 'expired',
    reason: string,
    channel: string | undefined,
    actor: Actor,
  ) {
    const row = (await this.read('quotations', id, actor)) as Quotation
    if (row.version !== version) throw conflict()
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Africa/Cairo',
    }).format(this.now())
    if (action === 'issue') {
      assert(row.status === 'draft', 'Only a draft may be issued.')
      assert(
        row.validUntil >= today && row.leadTime.trim() && row.terms.trim(),
        'Complete terms, lead time and validity.',
      )
      const totals = quoteTotals(
        row.lines.map((line, index) => ({ ...line, id: String(index) })),
      )
      assert(totals.valid, 'Invalid quotation amounts.')
    } else if (action === 'revise')
      assert(
        row.status !== 'draft',
        'Edit the current draft instead of revising it.',
      )
    else if (action === 'sent')
      assert(
        row.status === 'issued' &&
          ['email', 'whatsapp', 'phone', 'in_person'].includes(channel || ''),
        'Only an issued quotation can be marked sent through a recorded channel.',
      )
    else if (action === 'accepted' || action === 'rejected') {
      assert(
        row.status === 'sent',
        'Record delivery before the customer response.',
      )
      assert(
        reason.trim().length >= 3,
        'Record an approval or response reference.',
      )
      if (action === 'accepted')
        assert(
          row.validUntil >= today,
          'Expired quotations require a new revision.',
        )
    } else
      assert(
        ['issued', 'sent'].includes(row.status) && row.validUntil < today,
        'Only overdue issued quotations may expire.',
      )
    return this.repository.command({
      resource: 'quotations',
      action,
      id,
      version,
      data: { reason, channel },
      actor,
    })
  }

  async note(
    resource: 'quote_requests' | 'inquiries',
    id: string,
    version: number,
    body: string,
    actor: Actor,
  ) {
    await this.read(resource, id, actor)
    assert(
      body.trim().length >= 2 && body.length <= 2000,
      'Write a note between 2 and 2000 characters.',
    )
    return this.repository.command({
      resource,
      action: 'note',
      id,
      version,
      data: { body: body.trim() },
      actor,
    })
  }

  async transitionInquiry(
    id: string,
    version: number,
    next: string,
    reason: string,
    actor: Actor,
  ) {
    const row = await this.read('inquiries', id, actor)
    if (row.version !== version) throw conflict()
    const allowed: Record<string, string[]> = {
      new: ['assigned', 'spam'],
      assigned: ['in_progress', 'spam'],
      in_progress: ['resolved', 'spam'],
      resolved: ['in_progress'],
      spam: ['in_progress'],
    }
    assert(
      allowed[String(row.status)]?.includes(next),
      'Invalid inquiry status transition.',
    )
    if (
      ['resolved', 'spam'].includes(next) ||
      ['resolved', 'spam'].includes(String(row.status))
    )
      assert(reason.trim().length >= 3, 'Record a reason.')
    if (next === 'assigned')
      assert(row.assignedTo, 'Assign an admin account first.')
    return this.repository.command({
      resource: 'inquiries',
      action: 'transition',
      id,
      version,
      data: { status: next, reason },
      actor,
    })
  }

  async convertInquiry(
    id: string,
    version: number,
    input: unknown,
    actor: Actor,
  ) {
    const row = await this.read('inquiries', id, actor)
    if (row.version !== version) throw conflict()
    assert(!row.convertedRequestId, 'This inquiry has already been converted.')
    assert(row.status !== 'spam', 'Reopen this inquiry before converting it.')
    const items = parse(z.array(requestItem).min(1).max(30), input)
    for (const item of items) {
      const unit =
        'variantId' in item
          ? (await this.repository.resolveVariant(item.variantId))?.unit
          : await this.repository.getUnit(item.unitCode)
      assert(
        unit && unit.code === item.unitCode,
        'Unknown or obsolete sales unit.',
      )
      assert(
        Number.isInteger(
          (Math.round(item.quantity * 1000) * 10 ** unit.precision) / 1000,
        ),
        'Quantity does not match the sales unit.',
      )
      if ('variantId' in item) {
        const resolved = await this.repository.resolveVariant(item.variantId)
        assert(
          resolved &&
            resolved.variant.active &&
            resolved.variant.availability !== 'unavailable',
          'The selected product is unavailable.',
        )
        assert(
          item.quantity >= resolved.variant.minQuantity &&
            Math.round((item.quantity - resolved.variant.minQuantity) * 1000) %
              Math.round(resolved.variant.quantityStep * 1000) ===
              0,
          'Quantity does not match the minimum or step.',
        )
      }
    }
    return this.repository.command({
      resource: 'inquiries',
      action: 'convert',
      id,
      version,
      data: { items },
      actor,
    })
  }
}
