// Same-origin client for the live API. No browser service key or local password
// storage. Existing frontend previews stay explicit until their data adapter is
// switched to persisted records and verified against the connected project.
import type { RequestInput, QuotationInput } from './server/contracts'

export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
  }
}
export async function api<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    key?: string
    signal?: AbortSignal
  } = {},
): Promise<{
  data: T
  meta?: { page: number; pageSize: number; total: number; totalPages: number }
}> {
  if (!/^\/(?!\/)[a-zA-Z0-9/_?=&%.,-]*$/.test(path))
    throw new Error('Use an internal API path.')
  const result = await fetch(`/api/v1${path}`, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
    headers: {
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.key ? { 'Idempotency-Key': options.key } : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  })
  let value: any
  try {
    value = await result.json()
  } catch {
    throw new BackendError(
      result.status,
      'INVALID_RESPONSE',
      'The server returned an invalid response.',
    )
  }
  if (!result.ok)
    throw new BackendError(
      result.status,
      value.error?.code || 'REQUEST_FAILED',
      value.error?.message || 'The request failed.',
      value.error?.requestId,
      value.error?.fieldErrors,
    )
  return value
}
export const submitQuoteRequest = (
  input: RequestInput,
  key: string,
  signal?: AbortSignal,
) =>
  api<{ reference: string; receivedAt: string }>('/quote-requests', {
    method: 'POST',
    body: input,
    key,
    signal,
  })
export const saveQuotation = (requestId: string, input: QuotationInput) =>
  api(`/admin/quote-requests/${requestId}/quotations`, {
    method: 'POST',
    body: input,
  })
