import type { Actor, Entity, Resource } from './contracts'
export type Filters = {
  page: number
  pageSize: number
  q?: string
  status?: string
  assignedTo?: string
  from?: string
  to?: string
  category?: string[]
  brand?: string[]
  sector?: string[]
  availability?: string[]
  pack?: string[]
  attribute?: string
  value?: string
  specification?: string[]
  sort?: string
  locale?: string
}
export type Page<T = Entity> = { data: T[]; total: number }
export type Command = {
  resource: Resource
  action: string
  id?: string
  version?: number
  data: Record<string, unknown>
  actor: Actor
}
export type VariantResolution = {
  product: { id: string; name: { ar: string; en: string }; slug: string }
  variant: {
    id: string
    sku: string
    label: { ar: string; en: string }
    unitId: string
    minQuantity: number
    quantityStep: number
    active: boolean
    availability: string
  }
  unit: {
    id: string
    code: string
    precision: number
    name: { ar: string; en: string }
  }
}
export interface Repository {
  list(resource: Resource, filters: Filters, actor?: Actor): Promise<Page>
  get(resource: Resource, id: string, actor?: Actor): Promise<Entity | null>
  command(command: Command): Promise<Entity>
  resolveVariant(id: string): Promise<VariantResolution | null>
  getUnit(code: string): Promise<VariantResolution['unit'] | null>
  publicContent(key: string): Promise<Record<string, unknown> | null>
  facets(filters: Filters): Promise<Record<string, unknown>>
  submit(
    kind: 'request' | 'inquiry',
    payload: Record<string, unknown>,
    key: string,
    hash: string,
  ): Promise<{ reference: string; receivedAt: string; replayed: boolean }>
  rateLimit(
    key: string,
    maximum: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; retryAfter: number }>
}
