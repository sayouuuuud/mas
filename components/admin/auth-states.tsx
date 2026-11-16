'use client'
import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, ShieldCheck, Clock3 } from 'lucide-react'
import { Field, useCopy } from '@/components/demo/ui'
export function AuthStates({
  initial = 'mfa',
}: {
  initial?: 'mfa' | 'password' | 'expired'
}) {
  const c = useCopy()
  const [scenario, setScenario] = useState(initial)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  return (
    <section className="panel mt-6 bg-white">
      <div className="mb-5 flex items-center gap-3">
        <ShieldCheck className="size-5 text-primary" />
        <h2 className="font-bold">
          {c('معاينة حالات الحساب', 'Account state preview')}
        </h2>
      </div>
      <p className="mb-5 text-xs leading-6 text-muted-foreground">
        {c(
          'حالات واجهة فقط. لا يُرسل كود أو بريد، ولا تتغير كلمة مرور أو جلسة فعلية.',
          'Interface states only. No codes or emails are sent; no password or actual session is changed.',
        )}
      </p>
      <label className="form-field">
        <span>{c('الحالة المعروضة', 'Displayed state')}</span>
        <select
          className="control"
          value={scenario}
          onChange={(e) => {
            setScenario(e.target.value as typeof scenario)
            setMessage('')
          }}
        >
          <option value="mfa">
            {c('التحقق بخطوتين', 'Two-factor verification')}
          </option>
          <option value="password">
            {c('تعيين كلمة مرور جديدة', 'Set new password')}
          </option>
          <option value="expired">
            {c(
              'انتهاء الجلسة / رابط الاستعادة',
              'Expired session / recovery link',
            )}
          </option>
        </select>
      </label>
      {scenario === 'mfa' ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setMessage(
              /^\d{6}$/.test(code)
                ? c(
                    'صيغة الكود صحيحة للمعاينة فقط. لم يحدث تحقق أو تسجيل دخول.',
                    'Code format is valid for preview only. No verification or sign-in occurred.',
                  )
                : c('اكتب 6 أرقام.', 'Enter six digits.'),
            )
          }}
        >
          <Field label={c('كود التحقق التجريبي', 'Sample verification code')}>
            <input
              className="control tracking-widest"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              autoComplete="off"
              dir="ltr"
            />
          </Field>
          <button className="btn-primary">
            {c('معاينة التحقق', 'Preview verification')}
          </button>
          <button
            className="btn-outline ms-2"
            type="button"
            onClick={() =>
              setMessage(
                c(
                  'إعادة إرسال الكود تحتاج ربط المصادقة. لم يُرسل شيء.',
                  'Resending requires authentication integration. Nothing was sent.',
                ),
              )
            }
          >
            {c('إعادة إرسال (غير متصل)', 'Resend (not connected)')}
          </button>
        </form>
      ) : scenario === 'password' ? (
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setMessage(
              password.length < 12
                ? c('استخدم 12 حرفًا على الأقل.', 'Use at least 12 characters.')
                : password !== confirmation
                  ? c('كلمتا المرور غير متطابقتين.', 'Passwords do not match.')
                  : c(
                      'المدخلات متطابقة. لم تتغير كلمة مرور فعلية.',
                      'Inputs match. No actual password was changed.',
                    ),
            )
          }}
        >
          <Field label={c('كلمة المرور الجديدة', 'New password')}>
            <input
              className="control"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
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
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <button className="btn-primary">
            {c('مراجعة المدخلات', 'Review inputs')}
          </button>
        </form>
      ) : (
        <div className="mt-5 rounded-xl bg-muted p-5">
          <Clock3 className="mb-3 size-7 text-primary" />
          <h3 className="font-bold">
            {c(
              'الجلسة أو الرابط غير صالح',
              'Session or link is no longer valid',
            )}
          </h3>
          <p className="my-3 text-sm text-muted-foreground">
            {c(
              'هذه معاينة لحالة الانتهاء. اطلب رابطًا جديدًا عند تفعيل المصادقة.',
              'This previews expiry. Request a new link once authentication is integrated.',
            )}
          </p>
          <Link className="btn-outline" href="/admin/login">
            {c('العودة للدخول', 'Back to sign in')}
          </Link>
        </div>
      )}
      <p role="status" className="mt-4 text-sm leading-7 text-primary">
        {message}
      </p>
    </section>
  )
}
