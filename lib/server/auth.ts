import 'server-only'
import { createClient } from '@supabase/supabase-js'
import {
  createServerClient,
  parseCookieHeader,
  type CookieOptions,
} from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import { configuration } from './environment'
import { ApiError, unavailable } from './errors'
import type { Actor } from './contracts'
import { isAdminRole } from './policy'
import { SupabaseRepository } from './supabase-repository'

export function authFailure(
  error: { status?: number; name?: string },
  status: number,
  code: string,
  message: string,
): never {
  if (
    error.status === 0 ||
    (error.status || 0) >= 500 ||
    error.name === 'AuthRetryableFetchError'
  )
    throw unavailable()
  throw new ApiError(status, code, message)
}

export type CookieChange = {
  name: string
  value: string
  options: CookieOptions
}

export function requestScope(request: NextRequest) {
  const config = configuration()
  const changes: CookieChange[] = []
  const bearer = request.headers
    .get('authorization')
    ?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1]
  if (request.headers.has('authorization') && !bearer)
    throw new ApiError(
      401,
      'INVALID_AUTHORIZATION',
      'Use a valid Bearer authorization header.',
    )
  const cookieValues = new Map(
    parseCookieHeader(request.headers.get('cookie') || '').map((c) => [
      c.name,
      c.value || '',
    ]),
  )
  const secureCookie =
    process.env.NODE_ENV === 'production' ||
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'

  const user = bearer
    ? createClient(config.url, config.key, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : createServerClient(config.url, config.key, {
        cookies: {
          getAll: () =>
            Array.from(cookieValues, ([name, value]) => ({ name, value })),
          setAll: (values) => {
            for (const cookie of values) {
              cookieValues.set(cookie.name, cookie.value)
              changes.push({
                ...cookie,
                options: {
                  ...cookie.options,
                  path: '/',
                  httpOnly: true,
                  secure: secureCookie,
                  sameSite: 'lax',
                },
              })
            }
          },
        },
      })
  const service = config.serviceKey
    ? createClient(config.url, config.serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : undefined
  const repository = new SupabaseRepository(user, service)

  async function actor(): Promise<Actor & { displayName?: string }> {
    const { data, error } = await user.auth.getUser(bearer)
    if (error)
      authFailure(
        error,
        401,
        'UNAUTHENTICATED',
        'Sign in with an active admin account.',
      )
    if (!data.user)
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Sign in with an active admin account.',
      )
    const profile = await repository.rpc<{
      id: string
      active: boolean
      roles: string[]
      displayName?: string
    }>('mas_actor', {})
    if (!profile?.active || profile.id !== data.user.id)
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Sign in with an active admin account.',
      )
    // Never elevate non-admin accounts automatically.
    if (!Array.isArray(profile.roles) || !isAdminRole(profile.roles))
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Admin permissions are required.',
      )
    const level = await user.auth.mfa.getAuthenticatorAssuranceLevel()
    if (level.error)
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session verification failed.')
    return {
      id: data.user.id,
      active: true,
      roles: ['Owner'],
      aal: level.data.currentLevel === 'aal2' ? 'aal2' : 'aal1',
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
    }
  }

  function apply(response: NextResponse) {
    for (const change of changes)
      response.cookies.set(change.name, change.value, change.options)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Vary', 'Cookie, Authorization')
    return response
  }

  return { config, user, service, repository, actor, apply, bearer }
}

export type RequestScope = ReturnType<typeof requestScope>
