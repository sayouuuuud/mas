'use client'
import { PublicLink as Link } from '@/components/demo/public-link'
import { CheckCircle2 } from 'lucide-react'
import { useDemo } from '@/components/demo/demo-provider'
import { PageIntro, useCopy } from '@/components/demo/ui'
export function PreviewReceipt() {
  const { lastSubmission } = useDemo()
  const c = useCopy()
  return (
    <>
      <PageIntro title={c('تأكيد المعاينة', 'Preview confirmation')} />
      <div className="site-container page-section">
        <div className="panel mx-auto max-w-2xl space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h2 className="text-2xl font-bold">
            {lastSubmission
              ? c('تم تجهيز المعاينة المحلية', 'Local preview prepared')
              : c('لا يوجد طلب مرسل', 'No request has been sent')}
          </h2>
          <p className="leading-8 text-muted-foreground">
            {c(
              'لم يُرسل طلب لخادم أو شركة. هذه محاكاة لخطوة التأكيد، وتعود البيانات للأصل عند تحديث المتصفح.',
              'Nothing was sent to a server or company. This simulates confirmation; data resets on browser reload.',
            )}
          </p>
          {lastSubmission && (
            <>
              <p className="rounded-lg bg-muted p-4 font-mono">
                {lastSubmission.reference}
              </p>
              <p>
                {c('عدد البنود', 'Item count')}: {lastSubmission.itemCount}
              </p>
              <Link
                className="btn-outline"
                href={
                  lastSubmission.kind === 'request'
                    ? `/admin/quote-requests/${lastSubmission.reference}`
                    : '/admin/inquiries'
                }
              >
                {c(
                  'مشاهدة النتيجة داخل معاينة الإدارة',
                  'View result in admin preview',
                )}
              </Link>
            </>
          )}
          <div>
            <Link className="btn-primary" href="/products">
              {c('العودة للكتالوج', 'Back to catalog')}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
