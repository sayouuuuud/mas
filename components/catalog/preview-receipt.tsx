'use client'

import { PublicLink as Link } from '@/components/demo/public-link'
import { CheckCircle2 } from 'lucide-react'
import { useDemo } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'
import { PageIntro, useCopy } from '@/components/demo/ui'

export function PreviewReceipt() {
  const { lastSubmission } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()

  return (
    <>
      <PageIntro title={c('تأكيد استلام الطلب', 'Submission confirmation')} />
      <div className="site-container page-section">
        <div className="panel mx-auto max-w-2xl space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h2 className="text-2xl font-bold">
            {lastSubmission
              ? lastSubmission.kind === 'inquiry'
                ? c('تم استلام رسالتك بنجاح', 'Your inquiry has been received')
                : c(
                    'تم استلام طلب عرض السعر بنجاح',
                    'Your quote request has been received',
                  )
              : c('لا يوجد إيصال في هذه الجلسة', 'No active receipt in this session')}
          </h2>
          <p className="leading-8 text-muted-foreground">
            {lastSubmission
              ? c(
                  'احتفظ بالرقم المرجعي أدناه للمتابعة مع فريق المبيعات والدعم الفني لدى إم إيه إس.',
                  'Keep the reference number below when following up with the M.A.S sales and technical team.',
                )
              : c(
                  'يمكنك تصفح الكتالوج وإرسال طلب عرض سعر جديد في أي وقت.',
                  'You can browse the catalog and submit a new quote request anytime.',
                )}
          </p>
          {lastSubmission && (
            <div className="space-y-3 rounded-xl bg-muted p-5">
              <p className="text-xs text-muted-foreground">
                {c('الرقم المرجعي', 'Reference number')}
              </p>
              <p dir="ltr" className="font-mono text-xl font-bold text-primary">
                {lastSubmission.reference}
              </p>
              {lastSubmission.kind === 'request' && (
                <p className="text-sm">
                  {c('عدد البنود المسجلة', 'Recorded items')}:{' '}
                  <strong>{lastSubmission.itemCount}</strong>
                </p>
              )}
              {lastSubmission.receivedAt && (
                <p className="text-xs text-muted-foreground">
                  {new Date(lastSubmission.receivedAt).toLocaleString(
                    lang === 'ar' ? 'ar-EG' : 'en-EG',
                    { timeZone: 'Africa/Cairo' },
                  )}
                </p>
              )}
            </div>
          )}
          <div className="pt-2">
            <Link className="btn-primary" href="/products">
              {c('العودة للكتالوج', 'Back to catalog')}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
