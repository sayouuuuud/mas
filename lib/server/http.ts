import 'server-only'
import { createHmac, randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError } from './errors'
import { secret } from './environment'
import type { RequestScope } from './auth'

export async function readBody(
  request: Request,
  max = 1024 * 1024,
): Promise<unknown> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.')
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > max)
    throw new ApiError(
      413,
      'PAYLOAD_TOO_LARGE',
      'The payload exceeds the permitted size.',
    )
  const reader = request.body?.getReader()
  if (!reader)
    throw new ApiError(400, 'INVALID_JSON', 'A JSON body is required.')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > max) {
        await reader.cancel()
        throw new ApiError(
          413,
          'PAYLOAD_TOO_LARGE',
          'The payload exceeds the permitted size.',
        )
      }
      chunks.push(chunk.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.length
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON payload.')
  }
}

function isAllowedOrigin(
  incoming: string,
  originOrAllowed: string | ReadonlySet<string>,
  allowDevWorkspaceOrigin = false,
): boolean {
  if (typeof originOrAllowed === 'string') return incoming === originOrAllowed
  if (originOrAllowed.has(incoming)) return true
  if (
    allowDevWorkspaceOrigin &&
    /^https:\/\/workspace-[a-z0-9-]+\.v0\.build$/.test(incoming)
  ) {
    return true
  }
  return false
}

export function resolveTrustedOrigin(
  request: NextRequest,
  config: {
    origin: string
    allowedOrigins?: ReadonlySet<string>
    allowDevWorkspaceOrigin?: boolean
  },
): string {
  const incoming = request.headers.get('origin')
  if (
    incoming &&
    isAllowedOrigin(
      incoming,
      config.allowedOrigins || config.origin,
      config.allowDevWorkspaceOrigin,
    )
  ) {
    return incoming
  }
  return config.origin
}

export function originGuard(
  request: NextRequest,
  origin: string | ReadonlySet<string>,
  allowDevWorkspaceOrigin = false,
) {
  const incoming = request.headers.get('origin')
  if (incoming && !isAllowedOrigin(incoming, origin, allowDevWorkspaceOrigin))
    throw new ApiError(
      403,
      'INVALID_ORIGIN',
      'Cross-site requests are not allowed.',
    )
  if (!incoming && request.headers.has('cookie'))
    throw new ApiError(
      403,
      'INVALID_ORIGIN',
      'A same-origin request is required.',
    )
}

export async function limit(
  scope: RequestScope,
  request: NextRequest,
  bucket: string,
  maximum = 20,
  windowSeconds = 600,
  identity?: string,
) {
  const key = secret(scope.config.rateLimitSecret, 32)
  const network =
    process.env.VERCEL === '1'
      ? request.headers.get('x-vercel-forwarded-for') ||
        request.headers.get('x-forwarded-for') ||
        'unavailable'
      : 'development'
  const digest = createHmac('sha256', key)
    .update(`${bucket}:${identity || network.split(',')[0].trim()}`)
    .digest('hex')
  const result = await scope.repository.rateLimit(
    digest,
    maximum,
    windowSeconds,
  )
  if (!result.allowed)
    throw new ApiError(429, 'RATE_LIMITED', `Please try again later.`)
}

export function response(data: unknown, status = 200, meta?: unknown) {
  return NextResponse.json(
    { data, ...(meta ? { meta } : {}) },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}

export function failure(error: unknown, requestId = randomUUID()) {
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = Object.create(null)
    for (const issue of error.issues.slice(0, 100)) {
      const key = issue.path.join('.') || 'form'
      ;(fieldErrors[key] ||= []).push(issue.message)
    }
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Review the submitted fields.',
          fieldErrors,
          requestId,
        },
      },
      { status: 422, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  const known = error instanceof ApiError
  const status = known ? error.status : 500
  const result = NextResponse.json(
    {
      error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'An unexpected error occurred.',
        ...(known && error.fields ? { fieldErrors: error.fields } : {}),
        requestId,
      },
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(status === 429 ? { 'Retry-After': '600' } : {}),
      },
    },
  )
  if (!known)
    console.error(
      JSON.stringify({
        event: 'backend_error',
        requestId,
        code: 'INTERNAL_ERROR',
      }),
    )
  return result
}
