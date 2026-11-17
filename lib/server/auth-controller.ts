import 'server-only'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { authFailure, type RequestScope } from './auth'
import { readBody, response, limit, resolveTrustedOrigin } from './http'
import { ApiError, assert } from './errors'
import { isAdminRole } from './policy'

export async function authController(
  request: NextRequest,
  path: string[],
  scope: RequestScope,
) {
  const action = path.join('/')
  const method = request.method
  if (action === 'login' && method === 'POST') {
    await limit(scope, request, 'login', 10, 600)
    const input = z
      .object({
        email: z.email().max(254),
        password: z.string().min(1).max(128),
      })
      .strict()
      .parse(await readBody(request))
    const result = await scope.user.auth.signInWithPassword(input)
    if (result.error)
      authFailure(
        result.error,
        401,
        'INVALID_CREDENTIALS',
        'Check your credentials and try again.',
      )
    try {
      const actor = await scope.actor()
      return response({
        id: actor.id,
        role: 'Admin',
        mfaRequired: actor.aal !== 'aal2',
      })
    } catch (error) {
      await scope.user.auth.signOut({ scope: 'local' })
      throw error
    }
  }
  if (action === 'logout' && method === 'POST') {
    const result = await scope.user.auth.signOut({ scope: 'local' })
    if (result.error)
      authFailure(
        result.error,
        503,
        'AUTH_UNAVAILABLE',
        'Sign-out is temporarily unavailable.',
      )
    return response({ signedOut: true })
  }
  if (action === 'recover' && method === 'POST') {
    await limit(scope, request, 'recover', 5, 600)
    const { email } = z
      .object({ email: z.email().max(254) })
      .strict()
      .parse(await readBody(request))
    const redirectOrigin = resolveTrustedOrigin(request, scope.config)
    const result = await scope.user.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectOrigin}/api/v1/auth/callback`,
    })
    if (result.error)
      authFailure(
        result.error,
        503,
        'AUTH_UNAVAILABLE',
        'Account recovery is temporarily unavailable.',
      )
    return response({
      message:
        'If this account is eligible, recovery instructions will be sent.',
    })
  }
  if (action === 'callback' && method === 'GET') {
    const code = request.nextUrl.searchParams.get('code')
    const tokenHash = request.nextUrl.searchParams.get('token_hash')
    const otpType = request.nextUrl.searchParams.get('type')

    if (code) {
      assert(code.length <= 4096, 'A valid recovery code is required.')
      const result = await scope.user.auth.exchangeCodeForSession(code)
      if (result.error)
        authFailure(
          result.error,
          400,
          'INVALID_RECOVERY_LINK',
          'This link is invalid or expired.',
        )
    } else if (
      tokenHash &&
      otpType &&
      ['recovery', 'invite', 'email'].includes(otpType)
    ) {
      assert(tokenHash.length <= 4096, 'A valid recovery token is required.')
      const result = await scope.user.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as 'recovery' | 'invite' | 'email',
      })
      if (result.error)
        authFailure(
          result.error,
          400,
          'INVALID_RECOVERY_LINK',
          'This link is invalid or expired.',
        )
    } else {
      throw new ApiError(
        400,
        'INVALID_RECOVERY_LINK',
        'A recovery code is required.',
      )
    }

    const { NextResponse } = await import('next/server')
    const redirectOrigin = resolveTrustedOrigin(request, scope.config)
    return NextResponse.redirect(
      `${redirectOrigin}/admin/reset-password?stage=update`,
    )
  }

  const actor = await scope.actor()
  if (action === 'me' && method === 'GET')
    return response({
      ...actor,
      role: 'Admin',
      mfaRequired: actor.aal !== 'aal2',
    })

  if (action === 'password' && method === 'POST') {
    if (!actor.active || !isAdminRole(actor.roles))
      throw new ApiError(403, 'FORBIDDEN', 'Admin permissions are required.')
    const factors = await scope.user.auth.mfa.listFactors()
    if (factors.error)
      authFailure(
        factors.error,
        503,
        'AUTH_UNAVAILABLE',
        'Authentication is temporarily unavailable.',
      )
    const hasVerifiedFactor = factors.data.all.some(
      (f) => f.status === 'verified',
    )
    if (hasVerifiedFactor && actor.aal !== 'aal2')
      throw new ApiError(
        403,
        'MFA_REQUIRED',
        'Two-factor verification is required before changing the password.',
      )
    await limit(scope, request, `password:${actor.id}`, 5, 600)
    const { password } = z
      .object({ password: z.string().min(12).max(128) })
      .strict()
      .parse(await readBody(request))
    const result = await scope.user.auth.updateUser({ password })
    if (result.error)
      authFailure(
        result.error,
        422,
        'PASSWORD_UPDATE_FAILED',
        'The password could not be updated. Reauthenticate and try again.',
      )
    return response({ updated: true, mfaRequired: actor.aal !== 'aal2' })
  }

  if (action === 'mfa/factors' && method === 'GET') {
    const result = await scope.user.auth.mfa.listFactors()
    if (result.error)
      authFailure(
        result.error,
        503,
        'AUTH_UNAVAILABLE',
        'Authentication is temporarily unavailable.',
      )
    return response(
      result.data.all.map((f) => ({
        id: f.id,
        type: f.factor_type,
        status: f.status,
        name: f.friendly_name,
      })),
    )
  }

  if (action === 'mfa/enroll' && method === 'POST') {
    await limit(scope, request, `mfa:${actor.id}`, 5, 600)
    const existing = await scope.user.auth.mfa.listFactors()
    if (!existing.error) {
      for (const stale of existing.data.all.filter(
        (f) => f.status === 'unverified',
      )) {
        await scope.user.auth.mfa.unenroll({ factorId: stale.id })
      }
    }
    const result = await scope.user.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `M.A.S Admin (${new Date().toISOString().slice(0, 10)})`,
    })
    if (result.error)
      authFailure(
        result.error,
        422,
        'MFA_ENROLL_FAILED',
        'Two-factor enrollment could not be started.',
      )
    return response(
      { id: result.data.id, type: result.data.type, totp: result.data.totp },
      201,
    )
  }

  if (action === 'mfa/challenge' && method === 'POST') {
    await limit(scope, request, `mfa:${actor.id}`, 10, 600)
    const input = z
      .object({ factorId: z.uuid() })
      .strict()
      .parse(await readBody(request))
    const result = await scope.user.auth.mfa.challenge(input)
    if (result.error)
      authFailure(
        result.error,
        422,
        'MFA_CHALLENGE_FAILED',
        'The verification challenge could not be created.',
      )
    return response({ id: result.data.id, expiresAt: result.data.expires_at })
  }

  if (action === 'mfa/unenroll' && method === 'POST') {
    const input = z
      .object({ factorId: z.uuid() })
      .strict()
      .parse(await readBody(request))
    const factors = await scope.user.auth.mfa.listFactors()
    if (factors.error)
      throw new ApiError(
        503,
        'AUTH_UNAVAILABLE',
        'Authentication is temporarily unavailable.',
      )
    const target = factors.data.all.find((f) => f.id === input.factorId)
    if (!target)
      throw new ApiError(404, 'NOT_FOUND', 'The factor does not exist.')
    if (target.status === 'verified') {
      const level = await scope.user.auth.mfa.getAuthenticatorAssuranceLevel()
      if (level.error || level.data.currentLevel !== 'aal2')
        throw new ApiError(
          403,
          'MFA_REQUIRED',
          'Verify two-factor authentication before removing a factor.',
        )
      const verified = factors.data.all.filter(
        (factor) => factor.status === 'verified',
      )
      assert(
        verified.some((factor) => factor.id !== input.factorId),
        'Enroll and verify a replacement before removing the last factor.',
      )
    }
    const result = await scope.user.auth.mfa.unenroll(input)
    if (result.error)
      authFailure(
        result.error,
        422,
        'MFA_UNENROLL_FAILED',
        'The factor could not be removed.',
      )
    return response({ removed: true })
  }

  if (action === 'mfa/verify' && method === 'POST') {
    await limit(scope, request, `mfa-verify:${actor.id}`, 10, 600)
    const input = z
      .object({
        factorId: z.uuid(),
        challengeId: z.uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .strict()
      .parse(await readBody(request))
    const result = await scope.user.auth.mfa.verify(input)
    if (result.error)
      authFailure(
        result.error,
        401,
        'INVALID_MFA_CODE',
        'The verification code is invalid or expired.',
      )
    return response({ verified: true })
  }

  throw new ApiError(
    404,
    'NOT_FOUND',
    'The authentication endpoint is not available.',
  )
}
