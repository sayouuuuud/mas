import 'server-only'
import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { requestScope } from './auth'
import { authController } from './auth-controller'
import { response, failure, readBody, originGuard, limit } from './http'
import { BackendService, productSchema, variantSchema } from './services'
import {
  resourceSchemas,
  listing,
  followUpInput,
  assignmentInput,
  transitionInput,
  requestStatus,
  invitationInput,
  teamUpdate,
  type Resource,
  type ListInput,
} from './contracts'
import { ApiError, missing, assert, unavailable } from './errors'
import { requireActor, has } from './policy'
import type { Filters } from './repository'
import { secret } from './environment'

const mapping: Record<string, Resource> = {
  products: 'products',
  categories: 'categories',
  brands: 'brands',
  sectors: 'sectors',
  attributes: 'attributes',
  units: 'units',
  contacts: 'contacts',
  customers: 'contacts',
  organizations: 'organizations',
  content: 'content',
  navigation: 'navigation',
  locations: 'locations',
  settings: 'settings',
  'quote-requests': 'quote_requests',
  inquiries: 'inquiries',
  quotations: 'quotations',
  media: 'media',
  team: 'profiles',
  'audit-log': 'audit_logs',
}
function normalizeFilters(input: ListInput): Filters {
  const split = (v: string | undefined) =>
    v ? v.split(',').filter(Boolean).slice(0, 20) : undefined
  return {
    ...input,
    category: split(input.category),
    brand: split(input.brand),
    sector: split(input.sector),
    availability: input.availability ? [input.availability] : undefined,
    pack: input.pack ? [input.pack] : undefined,
  }
}
function filters(request: NextRequest): Filters {
  return normalizeFilters(
    listing.parse(Object.fromEntries(request.nextUrl.searchParams)),
  )
}

const envelope = z
  .object({
    version: z.number().int().positive(),
    data: z.record(z.string(), z.unknown()),
  })
  .strict()
function page(result: { data: unknown[]; total: number }, query: Filters) {
  return response(result.data, 200, {
    page: query.page,
    pageSize: query.pageSize,
    total: result.total,
    totalPages: Math.ceil(result.total / query.pageSize),
  })
}
function safeReference(row: Record<string, unknown>) {
  return Object.fromEntries(
    [
      'id',
      'name',
      'slug',
      'description',
      'parentId',
      'family',
      'logoMediaId',
      'imageMediaId',
      'website',
      'order',
      'seoTitle',
      'seoDescription',
      'media',
    ]
      .filter((k) => row[k] !== undefined)
      .map((k) => [k, row[k]]),
  )
}
export async function handle(request: NextRequest, path: string[]) {
  let scope: ReturnType<typeof requestScope> | undefined
  try {
    if (path.length > 4 || path.some((p) => p.length > 180)) throw missing()
    const [root, part, id, action] = path
    const method = request.method
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method))
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Unsupported method.')
    if (root === 'openapi' && path.length === 1 && method === 'GET') {
      const { openapi } = await import('./openapi')
      return NextResponse.json(openapi, {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    if (root === 'health' && path.length === 1 && method === 'GET') {
      scope = requestScope(request)
      secret(scope.config.serviceKey)
      secret(scope.config.rateLimitSecret, 32)
      const health = await scope.repository.rpc<{
        ready: boolean
        version: string
      }>('mas_health', {})
      if (!health.ready)
        throw new ApiError(
          503,
          'NOT_READY',
          'Backend prerequisites are not ready.',
        )
      return scope.apply(
        response({
          status: 'ok',
          version: health.version,
          jobsConfigured: Boolean(
            scope.config.jobSecret && scope.config.jobSecret.length >= 32,
          ),
          mediaScannerConfigured: Boolean(
            scope.config.scannerUrl &&
            scope.config.scannerKey &&
            scope.config.scannerKey.length >= 32,
          ),
        }),
      )
    }
    const known =
      root === 'auth' ||
      root === 'catalog' ||
      root === 'content' ||
      root === 'quote-requests' ||
      root === 'inquiries' ||
      root === 'admin' ||
      root === 'internal'
    if (!known) throw missing()
    scope = requestScope(request)
    if (method !== 'GET') originGuard(request, scope.config.origin)
    if (root === 'auth')
      return scope.apply(await authController(request, path.slice(1), scope))
    const service = new BackendService(scope.repository)
    if (root === 'catalog' && method === 'GET') {
      const query = filters(request)
      if (part === 'products' && path.length === 2)
        return scope.apply(page(await service.catalog(query), query))
      if (part === 'products' && id && path.length === 3)
        return scope.apply(response(await service.product(id)))
      if (part === 'facets' && path.length === 2)
        return scope.apply(response(await scope.repository.facets(query)))
      if (
        ['categories', 'brands', 'sectors'].includes(part) &&
        path.length <= 3
      ) {
        const resource = part as Resource
        if (id) {
          const row = await scope.repository.get(resource, id)
          if (!row || row.status !== 'published') throw missing()
          return scope.apply(response(safeReference(row)))
        }
        const result = await scope.repository.list(resource, query)
        return scope.apply(
          page(
            {
              data: result.data
                .filter((r) => r.status === 'published')
                .map(safeReference),
              total: result.total,
            },
            query,
          ),
        )
      }
      throw missing()
    }
    if (root === 'content' && part && path.length === 2 && method === 'GET') {
      const content = await scope.repository.publicContent(part)
      if (!content) throw missing()
      return scope.apply(response(content))
    }
    if (
      ['quote-requests', 'inquiries'].includes(root) &&
      path.length === 1 &&
      method === 'POST'
    ) {
      await limit(scope, request, root, 5, 600)
      const key = request.headers.get('idempotency-key')
      assert(
        key && /^[A-Za-z0-9_-]{16,100}$/.test(key),
        'Provide an Idempotency-Key (16–100 letters, digits, underscores or hyphens).',
      )
      const result = await service.submit(
        root === 'quote-requests' ? 'request' : 'inquiry',
        await readBody(request),
        key,
      )
      return scope.apply(
        response(
          { reference: result.reference, receivedAt: result.receivedAt },
          result.replayed ? 200 : 201,
        ),
      )
    }
    if (root === 'internal') {
      const { runJobs } = await import('./jobs')
      return scope.apply(await runJobs(request, scope, path.slice(1)))
    }
    if (root !== 'admin') throw missing()
    const actor = await scope.actor()
    requireActor(actor)
    if (part === 'me' && path.length === 2 && method === 'GET')
      return scope.apply(response(actor))
    if (part === 'reports' && path.length === 2 && method === 'GET') {
      if (!has(actor, 'Sales Manager', 'Sales Agent'))
        throw new ApiError(403, 'FORBIDDEN', 'Sales permissions are required.')
      return scope.apply(
        response(
          await scope.repository.rpc('mas_reports', {
            p_filters: filters(request),
          }),
        ),
      )
    }
    if (part === 'exports' && method === 'POST' && path.length === 2) {
      const input = z
        .object({
          resource: z.enum(['products', 'quote_requests', 'contacts']),
          filters: listing.optional(),
        })
        .strict()
        .parse(await readBody(request))
      const { createExport } = await import('./exports')
      return scope.apply(
        await createExport(
          service,
          actor,
          input.resource,
          input.filters ? normalizeFilters(input.filters) : undefined,
        ),
      )
    }
    if (
      part === 'imports' &&
      method === 'POST' &&
      path.length === 3 &&
      ['preview', 'apply'].includes(id)
    ) {
      const { importController } = await import('./imports')
      return scope.apply(await importController(request, scope, actor, id))
    }
    if (
      part === 'products' &&
      id === 'bulk' &&
      method === 'POST' &&
      path.length === 3
    ) {
      if (!has(actor, 'Catalog Manager'))
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Catalog permissions are required.',
        )
      const input = z
        .object({
          operation: z.enum(['archive', 'unpublish']),
          items: z
            .array(
              z
                .object({ id: z.uuid(), version: z.number().int().positive() })
                .strict(),
            )
            .min(1)
            .max(100),
        })
        .strict()
        .parse(await readBody(request))
      return scope.apply(
        response(
          await scope.repository.rpc(
            'mas_bulk_products',
            {
              p_action: input.operation,
              p_items: input.items,
              p_actor: actor.id,
              p_aal: actor.aal,
            },
            true,
          ),
        ),
      )
    }
    const resource = mapping[part]
    if (!resource) throw missing()
    if (resource === 'media') {
      const { mediaController } = await import('./media')
      return scope.apply(
        await mediaController(request, scope, actor, path.slice(2)),
      )
    }
    if (resource === 'profiles') {
      if (!has(actor))
        throw new ApiError(403, 'FORBIDDEN', 'Only the owner can manage staff.')
      if (method === 'POST' && !id) {
        const input = invitationInput.parse(await readBody(request))
        if (!scope.service) throw unavailable()
        const pending = await scope.repository.command({
          resource: 'profiles',
          action: 'prepare_invitation',
          actor,
          data: input,
        })
        const result = await scope.service!.auth.admin.inviteUserByEmail(
          input.email,
          { redirectTo: `${scope.config.origin}/api/v1/auth/callback` },
        )
        if (result.error || !result.data.user)
          throw new ApiError(
            503,
            'INVITATION_FAILED',
            'The invitation could not be delivered.',
          )
        return scope.apply(
          response(
            await scope.repository.command({
              resource: 'profiles',
              action: 'confirm_invitation',
              actor,
              id: result.data.user.id,
              data: { ...input, invitationId: pending.id },
            }),
            201,
          ),
        )
      }
      if (method === 'PATCH' && id && !action) {
        const input = teamUpdate.parse(await readBody(request))
        return scope.apply(
          response(
            await scope.repository.command({
              resource,
              action: 'update_staff',
              id,
              version: input.version,
              data: input,
              actor,
            }),
          ),
        )
      }
    }
    if (['quote_requests', 'inquiries'].includes(resource) && id) {
      const kind = resource as 'quote_requests' | 'inquiries'
      if (action === 'assign' && method === 'POST') {
        const input = assignmentInput.parse(await readBody(request))
        return scope.apply(
          response(
            await service.assign(
              kind,
              id,
              input.version,
              input.assignedTo,
              actor,
            ),
          ),
        )
      }
      if (action === 'events' && method === 'POST') {
        const input = z
          .object({
            version: z.number().int().positive(),
            body: z.string().trim().min(2).max(2000),
          })
          .strict()
          .parse(await readBody(request))
        return scope.apply(
          response(
            await service.note(kind, id, input.version, input.body, actor),
            201,
          ),
        )
      }
      if (action === 'transitions' && method === 'POST') {
        const input = transitionInput.parse(await readBody(request))
        if (kind === 'quote_requests')
          return scope.apply(
            response(
              await service.transitionRequest(
                id,
                input.version,
                requestStatus.parse(input.status),
                input.reason,
                actor,
              ),
            ),
          )
        return scope.apply(
          response(
            await service.transitionInquiry(
              id,
              input.version,
              input.status,
              input.reason,
              actor,
            ),
          ),
        )
      }
      if (action === 'convert' && kind === 'inquiries' && method === 'POST') {
        const input = z
          .object({
            version: z.number().int().positive(),
            items: z.array(z.unknown()).min(1).max(30),
          })
          .strict()
          .parse(await readBody(request))
        return scope.apply(
          response(
            await service.convertInquiry(id, input.version, input.items, actor),
            201,
          ),
        )
      }
      if (
        action === 'quotations' &&
        resource === 'quote_requests' &&
        method === 'POST'
      )
        return scope.apply(
          response(
            await service.quotation(id, await readBody(request), actor),
            201,
          ),
        )
      if (method === 'PATCH' && !action) {
        const input = followUpInput.parse(await readBody(request))
        await service.read(kind, id, actor)
        const { version, ...data } = input
        return scope.apply(
          response(
            await scope.repository.command({
              resource,
              action: 'update_follow_up',
              id,
              version,
              data,
              actor,
            }),
          ),
        )
      }
    }
    if (resource === 'quotations' && id) {
      if (method === 'PATCH' && !action) {
        const input = envelope.parse(await readBody(request))
        const current = await service.read(resource, id, actor)
        return scope.apply(
          response(
            await service.quotation(
              String(current.requestId),
              input.data,
              actor,
              id,
              input.version,
            ),
          ),
        )
      }
      if (
        method === 'POST' &&
        ['issue', 'revise', 'transitions'].includes(action)
      ) {
        const input = transitionInput.parse(await readBody(request))
        const next =
          action === 'transitions'
            ? z
                .enum(['sent', 'accepted', 'rejected', 'expired'])
                .parse(input.status)
            : (action as 'issue' | 'revise')
        return scope.apply(
          response(
            await service.quotationAction(
              id,
              input.version,
              next,
              input.reason,
              input.channel,
              actor,
            ),
            next === 'revise' ? 201 : 200,
          ),
        )
      }
      if (action === 'download' && method === 'GET') {
        const row = await service.read(resource, id, actor)
        assert(row.pdfPath && scope.service, 'The quotation PDF is not ready.')
        const result = await scope
          .service!.storage.from('sales-private')
          .createSignedUrl(String(row.pdfPath), 60, { download: true })
        if (result.error)
          throw new ApiError(
            503,
            'DOWNLOAD_UNAVAILABLE',
            'The document is temporarily unavailable.',
          )
        return scope.apply(
          response({ url: result.data.signedUrl, expiresIn: 60 }),
        )
      }
    }
    if (
      resource === 'products' &&
      id &&
      action === 'variants' &&
      method === 'POST'
    ) {
      const input = envelope.parse(await readBody(request))
      const current = await service.read(resource, id, actor)
      const variant = variantSchema.parse(input.data)
      const picked = Object.fromEntries(
        Object.entries(current).filter(([key]) => key in productSchema.shape),
      )
      return scope.apply(
        response(
          await service.save(
            'products',
            {
              ...picked,
              variants: [...(current.variants as unknown[]), variant],
            },
            actor,
            id,
            input.version,
          ),
          201,
        ),
      )
    }
    if (
      action &&
      ['publish', 'archive', 'unpublish'].includes(action) &&
      method === 'POST' &&
      ['products', 'categories', 'brands', 'sectors', 'content'].includes(
        resource,
      )
    ) {
      const input = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(await readBody(request))
      return scope.apply(
        response(
          await service.publication(
            resource as 'products',
            id,
            input.version,
            action as 'publish',
            actor,
          ),
        ),
      )
    }
    if (action) throw missing()
    if (method === 'GET') {
      if (id)
        return scope.apply(response(await service.read(resource, id, actor)))
      const query = filters(request)
      return scope.apply(
        page(await service.list(resource, query, actor), query),
      )
    }
    if (method === 'DELETE' && id) {
      const input = z
        .object({ version: z.number().int().positive() })
        .strict()
        .parse(await readBody(request))
      return scope.apply(
        response(await service.remove(resource, id, input.version, actor)),
      )
    }
    if (resource === 'products' || resource in resourceSchemas) {
      const kind = resource as keyof typeof resourceSchemas | 'products'
      if (method === 'POST' && !id)
        return scope.apply(
          response(
            await service.save(kind, await readBody(request), actor),
            201,
          ),
        )
      if (method === 'PATCH' && id) {
        const input = envelope.parse(await readBody(request))
        return scope.apply(
          response(
            await service.save(kind, input.data, actor, id, input.version),
          ),
        )
      }
    }
    throw new ApiError(
      405,
      'METHOD_NOT_ALLOWED',
      'Unsupported method for this resource.',
    )
  } catch (error) {
    const result = failure(error)
    return scope ? scope.apply(result) : result
  }
}
