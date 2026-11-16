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
function convert(value: unknown): any {
  if (Array.isArray(value)) return value.map(convert)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
        convert(val),
      ]),
    )
  return value
}
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
  if (
    text.includes('MAS_VALIDATION') ||
    ['23503', '23514', '22023', '22P02'].includes(error.code || '')
  )
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
    const urls = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(urls)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .map(([key, value]) => [key, urls(value)])
                .concat(
                  'path' in v && 'mime' in v && typeof v.path === 'string'
                    ? [
                        [
                          'url',
                          this.user.storage
                            .from('catalog-public')
                            .getPublicUrl(v.path).data.publicUrl,
                        ],
                      ]
                    : [],
                ),
            )
          : v
    return (
      !privileged &&
      !args.p_private &&
      [
        'mas_get',
        'mas_list',
        'mas_content',
        'mas_facets',
        'mas_resolve_variant',
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
