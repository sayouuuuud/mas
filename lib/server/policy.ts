import type { Actor, Resource, SalesRequest, Quotation } from './contracts'
import { ApiError, missing } from './errors'
export function requireActor(actor: Actor | null): asserts actor is Actor {
  if (!actor || !actor.active)
    throw new ApiError(
      401,
      'UNAUTHENTICATED',
      'Sign in with an active staff account.',
    )
  if (
    actor.roles.some((r) => r === 'Owner' || r === 'Sales Manager') &&
    actor.aal !== 'aal2'
  )
    throw new ApiError(
      403,
      'MFA_REQUIRED',
      'Two-factor verification is required.',
    )
}
export function has(actor: Actor, ...roles: Actor['roles']): boolean {
  return (
    actor.active &&
    (actor.roles.includes('Owner') ||
      roles.some((r) => actor.roles.includes(r)))
  )
}
export function resourcePermission(
  actor: Actor,
  resource: Resource,
  write = true,
) {
  requireActor(actor)
  const catalog: Resource[] = [
    'products',
    'categories',
    'brands',
    'sectors',
    'units',
    'attributes',
  ]
  const content: Resource[] = ['content', 'navigation', 'locations']
  const sales: Resource[] = [
    'quote_requests',
    'inquiries',
    'quotations',
    'contacts',
    'organizations',
    'request_events',
    'quotation_events',
  ]
  const allowed =
    resource === 'media'
      ? has(actor, 'Catalog Manager', 'Content Editor')
      : catalog.includes(resource)
        ? has(actor, 'Catalog Manager') ||
          (!write &&
            has(actor, 'Sales Manager', 'Sales Agent', 'Content Editor'))
        : content.includes(resource)
          ? has(actor, 'Content Editor')
          : sales.includes(resource)
            ? has(actor, 'Sales Manager', 'Sales Agent')
            : has(actor, 'Owner')
  if (!allowed)
    throw new ApiError(
      403,
      'FORBIDDEN',
      'This action is not permitted for your role.',
    )
}
export function requestPermission(
  actor: Actor,
  request: Pick<SalesRequest, 'assignedTo'> | null,
) {
  requireActor(actor)
  if (
    !request ||
    (!has(actor, 'Sales Manager') &&
      (!has(actor, 'Sales Agent') || request.assignedTo !== actor.id))
  )
    throw missing()
}
export function quotationPermission(
  actor: Actor,
  quotation: Quotation | null,
  request: SalesRequest | null,
) {
  if (!quotation) throw missing()
  requestPermission(actor, request)
}
