import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { RequestScope } from './auth'
import type { Actor, Entity } from './contracts'
import { productInput } from './contracts'
import { parseCsv } from '../csv-preview'
import { BackendService, stableHash } from './services'
import { readBody, response, limit } from './http'
import { secret } from './environment'
import { ApiError, assert, unavailable } from './errors'
import { requireActor } from './policy'

export const importHeaders = [
  'slug',
  'name_ar',
  'name_en',
  'family',
  'category',
  'brand',
  'sku',
  'unit',
  'pack_quantity',
  'pack_unit',
]

export async function importController(
  request: NextRequest,
  scope: RequestScope,
  actor: Actor,
  action: string,
) {
  requireActor(actor)
  await limit(scope, request, `import:${actor.id}`, 10, 600, actor.id)
  const input = z
    .object({
      csv: z.string().max(1024 * 1024),
      token: z.string().max(200).optional(),
    })
    .strict()
    .parse(await readBody(request, 1100000))
  let rows: string[][]
  try {
    rows = parseCsv(input.csv)
  } catch {
    throw new ApiError(422, 'INVALID_CSV', 'Use a valid UTF-8 CSV file.')
  }
  assert(
    rows.length >= 2 &&
      rows.length <= 201 &&
      rows[0].length === importHeaders.length &&
      importHeaders.every((key, i) => key === rows[0][i]),
    'Use the current CSV template, with 1–200 data rows.',
  )
  const service = new BackendService(scope.repository)
  const lookup = async (
    resource: 'categories' | 'brands' | 'units',
    key: string,
  ) => {
    const results = await service.list(
      resource,
      { page: 1, pageSize: 1000, q: key },
      actor,
    )
    const found = results.data.find(
      (row) => row.id === key || row.slug === key || row.code === key,
    )
    assert(
      found && found.status !== 'archived' && found.active !== false,
      `Unknown or inactive ${resource} reference.`,
    )
    return found
  }
  const products = []
  const slugs = new Set<string>(),
    skus = new Set<string>()
  for (const row of rows.slice(1)) {
    assert(
      row.length === importHeaders.length,
      'A CSV row has the wrong number of columns.',
    )
    const [
      slug,
      ar,
      en,
      family,
      category,
      brand,
      sku,
      unitCode,
      pack,
      packUnitCode,
    ] = row.map((value) => value.trim())
    assert(
      !slugs.has(slug) && !skus.has(sku.toLowerCase()),
      'Duplicate slug or SKU in this file.',
    )
    slugs.add(slug)
    skus.add(sku.toLowerCase())
    const categoryRow = await lookup('categories', category),
      brandRow = await lookup('brands', brand),
      unit = await lookup('units', unitCode)
    const packUnit = packUnitCode
      ? await lookup('units', packUnitCode)
      : undefined
    const existing = await service.list(
      'products',
      { page: 1, pageSize: 1000, q: slug },
      actor,
    )
    assert(
      !existing.data.some((row) => row.slug === slug),
      'A product with this slug already exists.',
    )
    products.push(
      productInput.parse({
        slug,
        name: { ar, en },
        summary: { ar: '', en: '' },
        description: { ar: '', en: '' },
        family,
        categoryId: categoryRow.id,
        brandId: brandRow.id,
        status: 'draft',
        variants: [
          {
            sku,
            label: { ar, en },
            unitId: unit.id,
            minQuantity: 1,
            quantityStep: 1,
            ...(pack || packUnitCode
              ? { packQuantity: Number(pack), packUnitId: packUnit?.id }
              : {}),
            availability: 'on_request',
          },
        ],
      }),
    )
  }
  const digest = stableHash(products),
    key = secret(scope.config.rateLimitSecret, 32)
  const sign = (expires: string) =>
    createHmac('sha256', key)
      .update(`${actor.id}:${expires}:${digest}`)
      .digest('hex')
  if (action === 'preview') {
    const expires = String(Date.now() + 15 * 60000)
    return response({
      products,
      count: products.length,
      token: `${expires}.${sign(expires)}`,
      expiresAt: new Date(Number(expires)).toISOString(),
    })
  }
  assert(
    action === 'apply' && input.token,
    'Preview the import before applying it.',
  )
  const [expires, signature] = input.token.split('.'),
    expected = sign(expires)
  assert(
    /^\d{13}$/.test(expires) &&
      Number(expires) > Date.now() &&
      Number(expires) <= Date.now() + 15 * 60000 &&
      signature?.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
    'The import preview changed or expired. Preview it again.',
  )
  if (!scope.repository.rpc) throw unavailable()
  const result = await scope.repository.rpc<Entity[]>(
    'mas_import_products',
    { p_products: products, p_actor: actor.id, p_aal: actor.aal },
    true,
  )
  return response({ products: result, count: result.length }, 201)
}
