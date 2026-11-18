'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { Field, ErrorState, LoadingState, useCopy } from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { authApi, formatApiError } from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import { useAdminSession } from './admin-shell'

type Enrollment = { id: string; qrCode: string; secret: string }
type Action = 'idle' | 'replace' | 'disable' | 'enable' | 'verify'

export function AccountSecurityWorkspace() {
  const c = useCopy()
  const { lang } = useLanguage()
  const session = useAdminSession()
  const [action, setAction] = useState<Action>('idle')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const query = useLiveQuery(
    '/auth/mfa/factors',
    async () => (await authApi.factors()).data,
  )
  const factors = query.data || []
  const verified = factors.filter(
    (f) => f.type === 'totp' && f.status === 'verified',
  )
  const enabled = session?.mfaEnabled !== false
  const needsStepUp = verified.length > 0 && session?.aal !== 'aal2'

  async function refresh() {
    invalidateLiveQueries('/auth/me')
    invalidateLiveQueries('/admin/me')
    invalidateLiveQueries('/admin/audit-log')
    await query.refresh()
  }

  async function startReplacement() {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    setCode('')
    try {
      const res = await authApi.enrollTotp()
      setEnrollment({
        id: res.data.id,
        qrCode: res.data.totp.qr_code,
        secret: res.data.totp.secret,
      })
      setAction('replace')
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (enrollment) {
        const current = (await authApi.factors()).data.find(
          (f) => f.id === enrollment.id,
        )
        // Never remove an already-activated replacement after a partial cleanup.
        if (current?.status === 'unverified')
          await authApi.unenroll(enrollment.id)
      }
      setEnrollment(null)
      setAction('idle')
      setCode('')
      await refresh()
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const factorId = enrollment?.id || verified[0]?.id
    if (!factorId) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action === 'verify') {
        const challenge = await authApi.challenge(factorId)
        await authApi.verify(factorId, challenge.data.id, code)
        setMessage(
          c(
            'تم تأكيد هويتك. يمكنك إدارة مفاتيح الربط الآن.',
            'Identity verified. You can now manage binding keys.',
          ),
        )
      } else {
        await authApi.setMfa({
          enabled: action !== 'disable',
          factorId,
          code,
          replace: action === 'replace',
        })
        setMessage(
          action === 'disable'
            ? c(
                'تم تعطيل MFA لحسابك. سيكفي البريد وكلمة المرور في تسجيل الدخول التالي.',
                'MFA is disabled for your account. Your next login needs only email and password.',
              )
            : action === 'replace'
              ? c(
                  'تم تفعيل مفتاح الربط الجديد وإلغاء المفاتيح القديمة. احذف الإدخال القديم من تطبيقك.',
                  'The new binding key is active and the old keys were removed. Delete the old entry from your authenticator.',
                )
              : c('تم تفعيل MFA لحسابك.', 'MFA is enabled for your account.'),
        )
      }
      setCode('')
      setEnrollment(null)
      setAction('idle')
      await refresh()
    } catch (err) {
      setCode('')
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function remove(factorId: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await authApi.unenroll(factorId)
      await refresh()
      setMessage(
        c(
          'تم إلغاء ربط المفتاح المحدد.',
          'The selected binding key was removed.',
        ),
      )
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  if (query.isLoading) return <LoadingState />
  if (query.error)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refresh()} />
    )
  const qr = enrollment?.qrCode
  const qrSrc = qr
    ? qr.startsWith('data:')
      ? qr
      : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`
    : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="admin-heading">
        <div>
          <h1>{c('أمان حسابي', 'Account security')}</h1>
          <p>
            {c(
              'إدارة التحقق الثنائي ومفتاح ربط تطبيق المصادقة لحسابك فقط.',
              'Manage two-factor authentication and your authenticator binding key for your own account.',
            )}
          </p>
        </div>
        <Shield className="size-7 text-primary" />
      </div>
      <section className="panel space-y-5 bg-white">
        <div>
          <h2 className="text-xl font-bold">
            {c('المصادقة الثنائية (MFA)', 'Two-factor authentication (MFA)')}
          </h2>
          <p className="mt-2 font-medium">
            {enabled
              ? c('الحالة: مفعّلة', 'Status: enabled')
              : c('الحالة: متوقفة', 'Status: disabled')}
          </p>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">
          {c(
            'مفتاح الربط هو السر أو QR الذي تضيفه في تطبيق المصادقة، وليس الرمز المتغير المكوّن من 6 أرقام. تغيير المفتاح يلغي الربط القديم بعد التأكد من الربط الجديد.',
            'The binding key is the secret or QR code added to your authenticator, not the changing six-digit code. Replacing it removes the old binding only after the new one is verified.',
          )}
        </p>
        {!enabled && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-7">
            {c(
              'يمكن الدخول بكلمة المرور فقط. المفتاح المرتبط يظل متاحًا لإعادة التفعيل؛ ويمكنك إلغاء ربطه أدناه. لتعديل المفاتيح يلزم إثبات امتلاك تطبيقك الحالي إذا كان مرتبطًا.',
              'Password-only login is allowed. An existing key remains available for reactivation, or you can unlink it below. Managing existing keys requires verification with your current authenticator.',
            )}
          </p>
        )}
        {action === 'idle' && (
          <div className="flex flex-wrap gap-3">
            {needsStepUp ? (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => {
                  setAction('verify')
                  setCode('')
                  setError('')
                  setMessage('')
                }}
              >
                {c('تأكيد الهوية لإدارة MFA', 'Verify identity to manage MFA')}
              </button>
            ) : (
              <>
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void startReplacement()}
                >
                  {c(
                    verified.length
                      ? 'تغيير مفتاح الربط / QR'
                      : 'تفعيل MFA وربط التطبيق',
                    verified.length
                      ? 'Change binding key / QR'
                      : 'Enable MFA and bind authenticator',
                  )}
                </button>
                {verified.length > 0 && (
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setAction(enabled ? 'disable' : 'enable')
                      setCode('')
                      setError('')
                      setMessage('')
                    }}
                  >
                    {enabled
                      ? c('تعطيل MFA', 'Disable MFA')
                      : c(
                          'تفعيل MFA بالمفتاح الحالي',
                          'Enable MFA with current key',
                        )}
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {action !== 'idle' && (
          <form onSubmit={submit} className="space-y-4 border-t pt-5">
            <h3 className="font-bold">
              {action === 'replace'
                ? c(
                    'اربط المفتاح الجديد في تطبيقك',
                    'Add the new binding key to your authenticator',
                  )
                : action === 'disable'
                  ? c('تأكيد تعطيل MFA', 'Confirm disabling MFA')
                  : c(
                      'تأكيد امتلاك تطبيق المصادقة',
                      'Confirm access to your authenticator',
                    )}
            </h3>
            {enrollment && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <p className="text-sm leading-7">
                  {c(
                    'امسح QR أو أدخل المفتاح يدويًا كحساب جديد في تطبيقك. احتفظ بالإدخال القديم حتى نجاح التحقق. لا تشارك هذا المفتاح.',
                    'Scan the QR or enter the secret as a new authenticator entry. Keep the old entry until verification succeeds. Do not share this secret.',
                  )}
                </p>
                <img
                  src={qrSrc}
                  alt={c(
                    'رمز QR لمفتاح الربط الجديد',
                    'QR code for the new binding key',
                  )}
                  className="mx-auto size-48 rounded-lg bg-white p-2"
                />
                <div>
                  <p className="mb-2 text-sm font-medium">
                    {c('مفتاح الربط اليدوي الجديد', 'New manual binding key')}
                  </p>
                  <code
                    dir="ltr"
                    className="block select-all break-all rounded bg-white p-3 text-center font-mono text-sm"
                  >
                    {enrollment.secret}
                  </code>
                </div>
              </div>
            )}
            {action === 'disable' && (
              <p className="text-sm leading-7">
                {c(
                  'سيصبح الدخول لحسابك بكلمة المرور فقط. أدخل رمزًا جديدًا من تطبيقك لتأكيد القرار.',
                  'Your account will allow password-only login. Enter a fresh code from your authenticator to confirm.',
                )}
              </p>
            )}
            <Field
              label={
                enrollment
                  ? c(
                      'رمز التطبيق بالمفتاح الجديد',
                      'Code from the new binding key',
                    )
                  : c('رمز التطبيق الحالي', 'Current authenticator code')
              }
            >
              <input
                className="control text-center font-mono tracking-widest"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              {c(
                'إذا استخدمت الرمز للتو في تسجيل الدخول، انتظر ظهور الرمز التالي.',
                'If you just used a code to sign in, wait for the next code.',
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {c('تأكيد', 'Confirm')}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => void cancel()}
              >
                {c('إلغاء', 'Cancel')}
              </button>
            </div>
          </form>
        )}
        {verified.length > 0 && action === 'idle' && (
          <ul className="space-y-3 border-t pt-4">
            {verified.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <span dir="ltr" className="break-all text-sm">
                  {f.name || c('تطبيق المصادقة', 'Authenticator')}
                </span>
                <button
                  className="text-sm text-red-700 underline disabled:opacity-40"
                  type="button"
                  disabled={
                    busy || needsStepUp || (enabled && verified.length < 2)
                  }
                  onClick={() => void remove(f.id)}
                >
                  {c('إلغاء ربط المفتاح', 'Unlink binding key')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {message && (
          <p role="status" className="text-sm leading-7 text-primary">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm leading-7 text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
