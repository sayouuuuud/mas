export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export const missing = () =>
  new ApiError(404, 'NOT_FOUND', 'The requested resource is not available.')
export const conflict = (
  message = 'The record changed. Reload it before trying again.',
) => new ApiError(409, 'CONFLICT', message)
export const unavailable = () =>
  new ApiError(
    503,
    'SERVICE_UNAVAILABLE',
    'The service is not configured or temporarily unavailable.',
  )
export function assert(
  condition: unknown,
  message: string,
  code = 'VALIDATION_ERROR',
): asserts condition {
  if (!condition) throw new ApiError(422, code, message)
}
