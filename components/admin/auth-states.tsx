'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { Field, useCopy } from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { authApi, formatApiError } from '@/lib/api-client'
import type { MfaFactor } from '@/lib/types'

export function MfaVerificationPanel({
  onVerified,
  onSignOut,
}: {
  onVerified: () => Promise<void> | void
  onSignOut?: () => Promise<void> | void
}) {
  const c = useCopy()
  const { lang } = useLanguage()
  const [factors, setFactors] = useState<MfaFactor[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [enrollData, setEnrollData] = useState<{
    id: string
    qrCode: string
    secret: string
  } | null>(null)
  const [activeFactorId, setActiveFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')

  async function loadFactors() {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.factors()
      setFactors(res.data)
      const verified = res.data.find((f) => f.status === 'verified')
      if (verified) {
        setActiveFactorId(verified.id)
        const ch = await authApi.challenge(verified.id)
        setChallengeId(ch.data.id)
      }
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFactors()
  }, [])

  async function startEnrollment() {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const enrolled = await authApi.enrollTotp()
      const ch = await authApi.challenge(enrolled.data.id)
      setEnrollData({
        id: enrolled.data.id,
        qrCode: enrolled.data.totp.qr_code,
        secret: enrolled.data.totp.secret,
      })
      setActiveFactorId(enrolled.data.id)
      setChallengeId(ch.data.id)
      setMessage(
        c(
          'امسح رمز QR بتطبيق المصادقة ثم أدخل الرمز المكون من 6 أرقام.',
          'Scan the QR code in your authenticator app, then enter the 6-digit code.',
        ),
      )
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || !activeFactorId) return
    if (!/^\d{6}$/.test(code)) {
      setError(c('أدخل رمزًا مكونًا من 6 أرقام.', 'Enter a 6-digit code.'))
      return
    }
    setBusy(true)
    setError('')
    try {
      let currentChallenge = challengeId
      if (!currentChallenge) {
        const ch = await authApi.challenge(activeFactorId)
        currentChallenge = ch.data.id
        setChallengeId(currentChallenge)
      }
      await authApi.verify(activeFactorId, currentChallenge, code)
      setCode('')
      await onVerified()
    } catch (err) {
      setError(formatApiError(err, lang))
      // Refresh challenge so next attempt has a fresh challenge ID
      try {
        const ch = await authApi.challenge(activeFactorId)
        setChallengeId(ch.data.id)
      } catch {
        // Ignore secondary error
      }
    } finally {
      setBusy(false)
    }
  }

  const qrSrc = enrollData?.qrCode
    ? enrollData.qrCode.startsWith('data:')
      ? enrollData.qrCode
      : `data:image/svg+xml;utf8,${encodeURIComponent(enrollData.qrCode)}`
    : null

  return (
    <section className="panel mt-6 space-y-5 bg-white">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5 text-primary" />
        <h2 className="text-lg font-bold">
          {c('التحقق الثنائي الإلزامي (MFA)', 'Required Two-Factor Verification (MFA)')}
        </h2>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">
        {c(
          'حساب الأدمن يتطلب جلسة مؤمنة بالمصادقة الثنائية (AAL2) قبل الوصول إلى بيانات الإدارة.',
          'Admin access requires an MFA-verified session (AAL2) before viewing or modifying management data.',
        )}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" />
          {c('جارٍ فحص عوامل المصادقة…', 'Checking authentication factors…')}
        </div>
      ) : !activeFactorId ? (
        <div className="space-y-4">
          <p className="text-sm">
            {c(
              'لم يتم ربط تطبيق مصادقة (TOTP) بهذا الحساب بعد. فعّل المصادقة الثنائية الآن للمتابعة.',
              'No TOTP authenticator is enrolled on this account yet. Enroll one now to continue.',
            )}
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void startEnrollment()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {c('تفعيل تطبيق المصادقة (TOTP)', 'Enroll Authenticator App (TOTP)')}
          </button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submitCode}>
          {enrollData && qrSrc && (
            <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <img
                src={qrSrc}
                alt={c('رمز QR للمصادقة الثنائية', 'TOTP QR code')}
                className="mx-auto size-44 rounded-lg bg-white p-2"
              />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {c('المفتاح اليدوي عند الحاجة:', 'Manual setup key:')}
                </p>
                <code
                  dir="ltr"
                  className="mt-1 inline-block select-all rounded bg-white px-2 py-1 font-mono text-xs"
                >
                  {enrollData.secret}
                </code>
              </div>
            </div>
          )}

          <Field label={c('رمز التحقق المكون من 6 أرقام', '6-digit verification code')}>
            <input
              className="control text-center font-mono text-lg tracking-widest"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              autoComplete="one-time-code"
              dir="ltr"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {c('تأكيد الرمز والمتابعة', 'Verify & continue')}
            </button>
            {factors.some((f) => f.status === 'verified') && !enrollData && (
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  try {
                    const ch = await authApi.challenge(activeFactorId)
                    setChallengeId(ch.data.id)
                    setMessage(
                      c('تم تحديث تحدي التحقق.', 'Verification challenge refreshed.'),
                    )
                  } catch (err) {
                    setError(formatApiError(err, lang))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {c('تحديث التحدي', 'Refresh challenge')}
              </button>
            )}
          </div>
        </form>
      )}

      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {onSignOut && (
        <div className="border-t pt-4">
          <button
            type="button"
            className="text-sm text-muted-foreground underline hover:text-foreground"
            onClick={() => void onSignOut()}
          >
            {c('تسجيل الخروج واستخدام حساب آخر', 'Sign out and use another account')}
          </button>
        </div>
      )}
    </section>
  )
}

export function PasswordUpdatePanel({
  onCompleted,
}: {
  onCompleted?: (mfaRequired: boolean) => void
}) {
  const c = useCopy()
  const { lang } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setError('')
    setMessage('')
    if (password.length < 12) {
      setError(
        c(
          'يجب أن تتكون كلمة المرور من 12 حرفًا على الأقل.',
          'Password must be at least 12 characters.',
        ),
      )
      return
    }
    if (password !== confirmation) {
      setError(c('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'))
      return
    }
    setBusy(true)
    try {
      const res = await authApi.updatePassword(password)
      setPassword('')
      setConfirmation('')
      setMessage(
        c('تم تحديث كلمة المرور بنجاح.', 'Password updated successfully.'),
      )
      onCompleted?.(res.data.mfaRequired)
    } catch (err: any) {
      if (err?.code === 'MFA_REQUIRED') {
        setNeedsMfa(true)
      }
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel mt-6 space-y-4 bg-white">
      <div className="flex items-center gap-3">
        <KeyRound className="size-5 text-primary" />
        <h2 className="font-bold">
          {c('تعيين كلمة مرور جديدة', 'Set a new password')}
        </h2>
      </div>
      {needsMfa ? (
        <MfaVerificationPanel
          onVerified={() => {
            setNeedsMfa(false)
            setError('')
            setMessage(
              c(
                'تم التحقق الثنائي. يمكنك حفظ كلمة المرور الجديدة الآن.',
                'MFA verified. You can now save your new password.',
              ),
            )
          }}
        />
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field
            label={c(
              'كلمة المرور الجديدة (12 حرفًا على الأقل)',
              'New password (min 12 characters)',
            )}
          >
            <input
              className="control"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label={c('تأكيد كلمة المرور', 'Confirm password')}>
            <input
              className="control"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              dir="ltr"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {c('حفظ كلمة المرور الجديدة', 'Save new password')}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}
