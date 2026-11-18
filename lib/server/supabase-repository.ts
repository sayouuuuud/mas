import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Actor, Entity, Resource } from './contracts'
import type {
  Repository,
  Command,
  Filters,
  Page,
  VariantResolution,
} from './repository'
import { ApiError, unavailable } from './errors'

const PRESERVE_MAP_KEYS = new Set(['byStatus', 'bySource'])

export function convert(value: unknown, preserveDirectKeys = false): any {
  if (Array.isArray(value)) return value.map((item) => convert(item, false))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => {
        const nextKey = preserveDirectKeys
          ? key
          : key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        return [nextKey, convert(val, PRESERVE_MAP_KEYS.has(nextKey))]
      }),
    )
  return value
}

const VALIDATION_MESSAGES: Array<[string, string]> = [
  [
    'retained customer history',
    'This customer has requests or inquiries. Deactivate the customer to preserve their history.',
  ],
  ['company settings', 'Complete company settings before issuing a quotation.'],
  [
    'draft only',
    'Only draft products without linked requests can be deleted; archive published products instead.',
  ],
  [
    'dependencies',
    'This record is referenced by other records and cannot be deleted.',
  ],
  [
    'published dependency',
    'Unpublish or update dependent published records first.',
  ],
  [
    'active dependency',
    'This unit is used by published products and cannot be deactivated or modified.',
  ],
  [
    'unpublish dependent products',
    'Unpublish dependent products before changing specification rules.',
  ],
  [
    'review published products',
    'Review published products before adding required specifications.',
  ],
  [
    'immutable policy version',
    'This privacy policy version was already published with different content; choose a new version.',
  ],
  ['policy version', 'Provide a privacy policy version before publishing.'],
  [
    'self protection',
    'You cannot deactivate your own account or remove your admin access.',
  ],
  ['last owner', 'At least one active admin account must remain.'],
  [
    'delivered quotation',
    'Record delivery of an issued quotation before marking the request quoted.',
  ],
  [
    'retained history',
    'Sales requests, inquiries and quotations are permanent records and cannot be deleted.',
  ],
  [
    'use publication action',
    'Use publish, unpublish or archive actions to change publication status.',
  ],
]

export function databaseError(error: {
  code?: string
  message?: string
}): never {
  const text = error.message || ''
  if (text.includes('MAS_NOT_FOUND'))
    throw new ApiError(404, 'NOT_FOUND', 'The resource is not available.')
  if (text.includes('MAS_CONFLICT') || error.code === '23505')
    throw new ApiError(
      409,
      'CONFLICT',
      'A record with these identifiers exists or the version changed.',
    )
  if (text.includes('MAS_MFA_REQUIRED'))
    throw new ApiError(
      403,
      'MFA_REQUIRED',
      'Two-factor verification is required.',
    )
  if (text.includes('MAS_FORBIDDEN') || error.code === '42501')
    throw new ApiError(403, 'FORBIDDEN', 'This action is not permitted.')
  if (text.includes('MAS_RATE_LIMIT'))
    throw new ApiError(429, 'RATE_LIMITED', 'Please try again later.')
  if (text.includes('MAS_VALIDATION')) {
    const matched = VALIDATION_MESSAGES.find(([tag]) => text.includes(tag))
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      matched?.[1] || 'A field, dependency or workflow constraint failed.',
    )
  }
  if (['23503', '23514', '22023', '22P02'].includes(error.code || ''))
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'A field, dependency or workflow constraint failed.',
    )
  throw unavailable()
}

export class SupabaseRepository implements Repository {
  constructor(
    readonly user: SupabaseClient,
    readonly service?: SupabaseClient,
  ) {}

  async rpc<T>(
    name: string,
    args: Record<string, unknown>,
    privileged = false,
  ): Promise<T> {
    const client = privileged ? this.service : this.user
    if (!client) throw unavailable()
    const { data, error } = await client.rpc(name, args)
    if (error) databaseError(error)
    const projected = convert(data)
    const urls = (v: unknown): unknown => {
      if (Array.isArray(v)) return v.map(urls)
      if (v && typeof v === 'object') {
        const rec = v as Record<string, unknown>
        const isPublicReadyMedia =
          typeof rec.path === 'string' &&
          typeof rec.mime === 'string' &&
          rec.visibility !== 'private' &&
          (rec.status === undefined || rec.status === 'ready')
        return Object.fromEntries(
          Object.entries(rec)
            .map(([key, value]) => [key, urls(value)])
            .concat(
              isPublicReadyMedia
                ? [
                    [
                      'url',
                      this.user.storage
                        .from('catalog-public')
                        .getPublicUrl(String(rec.path)).data.publicUrl,
                    ],
                  ]
                : [],
            ),
        )
      }
      return v
    }
    return (
      [
        'mas_get',
        'mas_list',
        'mas_content',
        'mas_facets',
        'mas_resolve_variant',
        'mas_command',
        'mas_retry_job',
      ].includes(name)
        ? urls(projected)
        : projected
    ) as T
  }

  list(resource: Resource, filters: Filters, actor?: Actor) {
    return this.rpc<Page>('mas_list', {
      p_resource: resource,
      p_filters: filters,
      p_private: Boolean(actor),
    })
  }

  get(resource: Resource, id: string, actor?: Actor) {
    return this.rpc<Entity | null>('mas_get', {
      p_resource: resource,
      p_id: id,
      p_private: Boolean(actor),
    })
  }

  command(command: Command) {
    return this.rpc<Entity>(
      'mas_command',
      {
        p_resource: command.resource,
        p_action: command.action,
        p_id: command.id || null,
        p_version: command.version ?? null,
        p_data: command.data,
        p_actor: command.actor.id,
        p_aal: command.actor.aal,
      },
      true,
    )
  }

  resolveVariant(id: string) {
    return this.rpc<VariantResolution | null>('mas_resolve_variant', {
      p_id: id,
    })
  }

  getUnit(code: string) {
    return this.rpc<VariantResolution['unit'] | null>('mas_unit', {
      p_code: code,
    })
  }

  publicContent(key: string) {
    return this.rpc<Record<string, unknown> | null>('mas_content', {
      p_key: key,
    })
  }

  facets(filters: Filters) {
    return this.rpc<Record<string, unknown>>('mas_facets', {
      p_filters: filters,
    })
  }

  submit(
    kind: 'request' | 'inquiry',
    payload: Record<string, unknown>,
    key: string,
    hash: string,
  ) {
    return this.rpc<{
      reference: string
      receivedAt: string
      replayed: boolean
    }>(
      'mas_submit',
      { p_kind: kind, p_payload: payload, p_key: key, p_hash: hash },
      true,
    )
  }

  rateLimit(key: string, maximum: number, windowSeconds: number) {
    return this.rpc<{ allowed: boolean; retryAfter: number }>(
      'mas_rate_limit',
      { p_key: key, p_maximum: maximum, p_window: windowSeconds },
      true,
    )
  }
}
