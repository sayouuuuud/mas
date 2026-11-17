import type {
  InquiryInput,
  QuotationInput,
  RequestInput,
} from './server/contracts'
import type {
  AdminSession,
  MediaItem,
  MfaFactor,
  PageMeta,
  QuotationRecord,
} from './types'

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

export function buildApiPath(
  basePath: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return basePath
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function formatApiError(error: unknown, lang: 'ar' | 'en'): string {
  if (error instanceof BackendError) {
    const details = error.fieldErrors
      ? Object.entries(error.fieldErrors)
          .flatMap(([field, msgs]) =>
            msgs.map((m) => (field === 'form' ? m : `${field}: ${m}`)),
          )
          .slice(0, 3)
          .join(' · ')
      : ''

    if (error.status === 401) {
      if (error.code === 'INVALID_MFA_CODE') {
        return lang === 'ar'
          ? 'رمز التحقق غير صحيح أو انتهت صلاحيته.'
          : 'The verification code is invalid or expired.'
      }
      if (error.code === 'INVALID_CREDENTIALS') {
        return lang === 'ar'
          ? 'بيانات الدخول غير صحيحة أو الحساب غير مفعل.'
          : 'Invalid credentials or inactive account.'
      }
      return lang === 'ar'
        ? 'انتهت الجلسة أو يلزم تسجيل الدخول مجددًا.'
        : 'Your session expired. Please sign in again.'
    }
    if (error.code === 'MFA_REQUIRED') {
      return lang === 'ar'
        ? 'يلزم إتمام التحقق الثنائي (MFA) للمتابعة.'
        : 'Two-factor verification (MFA) is required to continue.'
    }
    if (error.status === 403) {
      return lang === 'ar'
        ? 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'
        : 'You do not have permission to perform this action.'
    }
    if (error.status === 404) {
      return lang === 'ar'
        ? 'السجل المطلوب غير موجود أو لم يعد متاحًا.'
        : 'The requested record was not found or is no longer available.'
    }
    if (error.status === 409) {
      return lang === 'ar'
        ? 'تعارض في البيانات أو تم تعديل السجل من جلسة أخرى. حدّث الصفحة وأعد المحاولة.'
        : 'Conflict detected or this record was modified elsewhere. Refresh and try again.'
    }
    if (error.code === 'POLICY_CHANGED') {
      return lang === 'ar'
        ? 'تم تحديث سياسة الخصوصية. أعد تحميل الصفحة للموافقة على النسخة الحالية.'
        : 'The privacy policy was updated. Reload the page to accept the current version.'
    }
    if (error.status === 429) {
      return lang === 'ar'
        ? 'تم تجاوز عدد المحاولات المسموح به مؤقتًا. انتظر قليلًا ثم أعد المحاولة.'
        : 'Too many attempts. Please wait a moment and try again.'
    }
    if (error.status === 503 || error.status >= 500) {
      if (error.code === 'NOT_READY') {
        return lang === 'ar'
          ? 'النظام قيد التهيئة الأولية (يلزم إعداد حساب الأدمن والوحدات والإعدادات وسياسة الخصوصية).'
          : 'Backend prerequisites are not yet initialized (Admin account, units, settings, and privacy policy).'
      }
      if (error.code === 'INVITATION_FAILED') {
        return lang === 'ar'
          ? 'تعذر إرسال الدعوة عبر خدمة البريد (تحقق من إعدادات SMTP أو وجود الحساب مسبقًا).'
          : 'Invitation delivery failed (verify SMTP settings or whether the user already exists).'
      }
      return lang === 'ar'
        ? 'الخدمة غير متاحة مؤقتًا. أعد المحاولة لاحقًا.'
        : 'The service is temporarily unavailable. Please try again later.'
    }
    if (details) {
      return lang === 'ar'
        ? `تعذر التحقق من المدخلات: ${details}`
        : `Validation error: ${details}`
    }
    return error.message
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return lang === 'ar' ? 'تم إلغاء الطلب.' : 'Request cancelled.'
  }
  return lang === 'ar'
    ? 'تعذر الاتصال بالخادم. تحقق من الشبكة وأعد المحاولة.'
    : 'Network error while contacting the server. Check your connection and retry.'
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
  meta?: PageMeta
}> {
  if (!/^\/(?!\/)[a-zA-Z0-9/_?=&%.,+-]*$/.test(path))
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

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `mas_${crypto.randomUUID().replace(/-/g, '')}`
  }
  return `mas_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`
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

export const submitInquiry = (
  input: InquiryInput,
  key: string,
  signal?: AbortSignal,
) =>
  api<{ reference: string; receivedAt: string }>('/inquiries', {
    method: 'POST',
    body: input,
    key,
    signal,
  })

export async function saveResource<T>(path: string, data: unknown, id?: string, version?: number): Promise<T> {
  if (id && (!version || !Number.isInteger(version))) {
    throw new BackendError(409, 'CONFLICT', 'Reload the record before saving.')
  }
  return (await api<T>(id ? `${path}/${id}` : path, {
    method: id ? 'PATCH' : 'POST',
    body: id ? { version, data } : data,
  })).data
}

export async function saveQuotation(
  requestId: string,
  input: QuotationInput,
  quotationId?: string,
  version?: number,
): Promise<{ data: QuotationRecord; meta?: PageMeta }> {
  if (quotationId) {
    if (!version || !Number.isInteger(version)) throw new BackendError(409, 'CONFLICT', 'Reload the quotation before saving.')
    return api<QuotationRecord>(`/admin/quotations/${quotationId}`, { method: 'PATCH', body: { version, data: input } })
  }
  return api<QuotationRecord>(`/admin/quote-requests/${requestId}/quotations`, { method: 'POST', body: input })
}

export async function downloadServerExport(
  resource:
    | 'products'
    | 'quote_requests'
    | 'contacts'
    | 'inquiries'
    | 'quotations',
  filters?: Record<string, string | number | undefined>,
) {
  const cleanFilters = filters
    ? Object.fromEntries(
        Object.entries(filters).filter(
          ([, v]) => v !== undefined && v !== null && String(v) !== '',
        ),
      )
    : undefined
  const res = await fetch('/api/v1/admin/exports', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resource,
      ...(cleanFilters && Object.keys(cleanFilters).length
        ? { filters: cleanFilters }
        : {}),
    }),
  })
  if (!res.ok) {
    let payload: any = null
    try {
      payload = await res.json()
    } catch {
      // Ignore parse error
    }
    throw new BackendError(
      res.status,
      payload?.error?.code || 'EXPORT_FAILED',
      payload?.error?.message || 'Export could not be generated.',
      payload?.error?.requestId,
      payload?.error?.fieldErrors,
    )
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resource}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function uploadAdminMedia(
  file: File,
  metadata: {
    name?: string
    alt: { ar: string; en: string }
    visibility: 'public' | 'private'
    kind: 'image' | 'TDS' | 'SDS' | 'catalog'
  },
): Promise<MediaItem> {
  const created = await api<{
    media: MediaItem
    upload: {
      url: string
      token: string
      path: string
      contentType: string
    }
  }>('/admin/media', {
    method: 'POST',
    body: {
      name: (metadata.name || file.name).trim().slice(0, 180),
      mime: file.type,
      size: file.size,
      alt: metadata.alt,
      visibility: metadata.visibility,
      kind: metadata.kind,
    },
  })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const putRes = await fetch(created.data.upload.url, {
    method: 'PUT',
    headers: {
      'content-type': created.data.upload.contentType,
      'cache-control': 'max-age=3600',
      'x-upsert': 'false',
    },
    body: bytes,
  })
  if (!putRes.ok) {
    throw new BackendError(
      503,
      'UPLOAD_FAILED',
      'Uploading the file to quarantine storage failed.',
    )
  }

  const completed = await api<MediaItem>(
    `/admin/media/${created.data.media.id}/complete`,
    {
      method: 'POST',
      body: { version: created.data.media.version || 1 },
    },
  )
  return completed.data
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ id: string; role: 'Admin'; mfaRequired: boolean }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  logout: () =>
    api<{ signedOut: boolean }>('/auth/logout', {
      method: 'POST',
      body: {},
    }),
  recover: (email: string) =>
    api<{ message: string }>('/auth/recover', {
      method: 'POST',
      body: { email },
    }),
  updatePassword: (password: string) =>
    api<{ updated: boolean; mfaRequired: boolean }>('/auth/password', {
      method: 'POST',
      body: { password },
    }),
  me: () => api<AdminSession>('/auth/me'),
  adminMe: () => api<AdminSession>('/admin/me'),
  factors: () => api<MfaFactor[]>('/auth/mfa/factors'),
  enrollTotp: () =>
    api<{
      id: string
      type: string
      totp: { qr_code: string; secret: string; uri: string }
    }>('/auth/mfa/enroll', { method: 'POST', body: {} }),
  challenge: (factorId: string) =>
    api<{ id: string; expiresAt: number }>('/auth/mfa/challenge', {
      method: 'POST',
      body: { factorId },
    }),
  verify: (factorId: string, challengeId: string, code: string) =>
    api<{ verified: boolean }>('/auth/mfa/verify', {
      method: 'POST',
      body: { factorId, challengeId, code },
    }),
  unenroll: (factorId: string) =>
    api<{ removed: boolean }>('/auth/mfa/unenroll', {
      method: 'POST',
      body: { factorId },
    }),
}
