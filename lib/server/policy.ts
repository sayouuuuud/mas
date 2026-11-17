import type { Actor, Resource, SalesRequest, Quotation } from './contracts'
import { ApiError, missing } from './errors'

export function isAdminRole(roles: readonly string[]): boolean {
  return roles.includes('Owner') || roles.includes('Admin')
}

export function requireActor(actor: Actor | null): asserts actor is Actor {
  if (!actor || !actor.active)
    throw new ApiError(
      401,
      'UNAUTHENTICATED',
      'Sign in with an active admin account.',
    )
  if (!isAdminRole(actor.roles))
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Admin permissions are required.',
    )
  if (actor.aal !== 'aal2')
    throw new ApiError(
      403,
      'MFA_REQUIRED',
      'Two-factor verification is required.',
    )
}

export function has(actor: Actor): boolean {
  return actor.active && isAdminRole(actor.roles)
}

export function resourcePermission(
  actor: Actor,
  _resource: Resource,
  _write = true,
) {
  requireActor(actor)
}

export function requestPermission(
  actor: Actor,
  request: Pick<SalesRequest, 'assignedTo'> | null,
) {
  requireActor(actor)
  if (!request) throw missing()
}

export function quotationPermission(
  actor: Actor,
  quotation: Quotation | null,
  request: SalesRequest | null,
) {
  if (!quotation) throw missing()
  requestPermission(actor, request)
}
