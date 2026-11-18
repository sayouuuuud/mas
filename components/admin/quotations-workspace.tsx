'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  CopyPlus,
  Download,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  useCopy,
} from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { Pagination } from './frontend-tools'
import {
  api,
  BackendError,
  buildApiPath,
  downloadServerExport,
  formatApiError,
  saveQuotation,
} from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import { quoteTotals } from '@/lib/frontend-model'
import type { QuotationInput } from '@/lib/server/contracts'
import type {
  AdminQuoteRequest,
  QuotationRecord,
  QuotationStatus,
} from '@/lib/types'

const STATUS_META: Record<
  QuotationStatus,
  { ar: string; en: string; tone: 'gold' | 'green' | 'blue' | 'muted' | 'red' }
> = {
  draft: { ar: 'مسودة', en: 'Draft', tone: 'muted' },
  issued: { ar: 'صادر رسميًا', en: 'Issued', tone: 'blue' },
  sent: { ar: 'سُجّل تسليمه للعميل', en: 'Delivery logged', tone: 'gold' },
  accepted: { ar: 'مقبول من العميل', en: 'Accepted', tone: 'green' },
  rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'red' },
  expired: { ar: 'منتهي الصلاحية', en: 'Expired', tone: 'muted' },
  superseded: { ar: 'مستبدل بمراجعة أحدث', en: 'Superseded', tone: 'muted' },
}

type EditableLine = {
  key: string
  requestItemId: string | null
  variantId: string | null
  descriptionAr: string
  descriptionEn: string
  sku: string
  unit: string
  quantity: number
  unitPrice: number
  discount: string
  tax: string
}

export function QuotationsWorkspace({ id }: { id?: string }) {
  if (!id) return <QuotationsList />
  return <QuotationEditor id={id} />
}

function QuotationsList() {
  const c = useCopy()
  const { lang } = useLanguage()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const listPath = buildApiPath('/admin/quotations', {
    page,
    pageSize: 12,
    status: status || undefined,
    q: q.trim() || undefined,
  })

  const listQuery = useLiveQuery(listPath, async () => {
    const res = await api<QuotationRecord[]>(listPath)
    return {
      data: res.data,
      meta: res.meta || {
        page: 1,
        pageSize: 12,
        total: res.data.length,
        totalPages: 1,
      },
    }
  })

  const recentRequestsQuery = useLiveQuery(
    '/admin/quote-requests?page=1&pageSize=8',
    async () =>
      (
        await api<AdminQuoteRequest[]>(
          '/admin/quote-requests?page=1&pageSize=8',
        )
      ).data,
  )

  const rows = listQuery.data?.data || []
  const meta = listQuery.data?.meta || {
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  }

  return (
    <>
      {exportError && (
        <p role="alert" className="text-red-700">
          {exportError}
        </p>
      )}
      <div className="admin-heading">
        <div>
          <h1>{c('عروض الأسعار الرسمية', 'Formal Quotations')}</h1>
          <p>
            {c(
              'إعداد المسودات، الإصدار الرسمي بأرقام متسلسلة، المراجعات المجمدة، وتنزيل ملفات PDF.',
              'Draft preparation, sequential formal issuance, frozen revisions and official PDF downloads.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn-outline"
          disabled={exporting}
          onClick={async () => {
            setExporting(true)
            setExportError('')
            try {
              await downloadServerExport('quotations', {
                status: status || undefined,
                q: q.trim() || undefined,
              })
              invalidateLiveQueries('/admin/audit-log')
            } catch (err) {
              setExportError(formatApiError(err, lang))
            } finally {
              setExporting(false)
            }
          }}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          CSV
        </button>
      </div>

      {(recentRequestsQuery.data || []).length > 0 && (
        <section className="panel mb-6 bg-white">
          <h2 className="mb-3 font-bold">
            {c(
              'بدء مسودة عرض سعر من طلب قائم',
              'Start a quotation draft from a request',
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            {(recentRequestsQuery.data || []).slice(0, 6).map((r) => (
              <Link
                key={r.id}
                href={`/admin/quotations/new?requestId=${r.id}`}
                className="btn-outline text-xs"
              >
                <Plus className="size-3.5" />
                <span dir="ltr" className="font-mono">
                  {r.reference}
                </span>{' '}
                — {r.customerSnapshot?.company || r.customerSnapshot?.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="panel bg-white">
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
          <input
            className="control"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder={c('بحث برقم عرض السعر…', 'Search quotation number…')}
          />
          <select
            className="control"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">{c('كل الحالات', 'All statuses')}</option>
            {Object.entries(STATUS_META).map(([key, item]) => (
              <option key={key} value={key}>
                {c(item.ar, item.en)}
              </option>
            ))}
          </select>
        </div>

        {listQuery.isLoading ? (
          <LoadingState />
        ) : listQuery.error ? (
          <ErrorState
            error={listQuery.error}
            onRetry={() => void listQuery.refresh()}
          />
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{c('رقم العرض', 'Quotation #')}</th>
                  <th>{c('المراجعة', 'Revision')}</th>
                  <th>{c('الإجمالي', 'Total')}</th>
                  <th>{c('حالة العرض', 'Status')}</th>
                  <th>{c('حالة PDF', 'PDF status')}</th>
                  <th>{c('تاريخ الصلاحية', 'Valid until')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const st = STATUS_META[row.status] || STATUS_META.draft
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link
                          href={`/admin/quotations/${row.id}`}
                          dir="ltr"
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {row.number || c('مسودة (Draft)', 'Draft')}
                        </Link>
                      </td>
                      <td className="font-mono">R{row.revision}</td>
                      <td dir="ltr" className="font-mono">
                        {(Number(row.totals?.total || 0) / 100).toLocaleString(
                          'en-EG',
                        )}{' '}
                        {row.currency}
                      </td>
                      <td>
                        <Badge tone={st.tone}>{c(st.ar, st.en)}</Badge>
                      </td>
                      <td>
                        <Badge
                          tone={
                            row.pdfStatus === 'ready'
                              ? 'green'
                              : row.pdfStatus === 'failed'
                                ? 'red'
                                : row.pdfStatus === 'processing'
                                  ? 'gold'
                                  : 'muted'
                          }
                        >
                          {row.pdfStatus}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground">
                        {row.validUntil || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={c('لا توجد عروض أسعار مسجلة', 'No quotations yet')}
            description={c(
              'ابدأ من أي طلب عرض سعر لإنشاء مسودة عرض رسمي وإصدارها.',
              'Open any quote request to prepare and issue a formal quotation.',
            )}
          />
        )}

        {meta.total > 0 && (
          <Pagination
            page={meta.page}
            pages={Math.max(1, meta.totalPages)}
            total={meta.total}
            onChange={setPage}
          />
        )}
      </div>
    </>
  )
}

function QuotationEditor({ id }: { id: string }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = id === 'new'
  const queryRequestId = searchParams.get('requestId') || ''

  const quotationQuery = useLiveQuery(
    !isNew ? `/admin/quotations/${id}` : null,
    async () => (await api<QuotationRecord>(`/admin/quotations/${id}`)).data,
  )

  const resolvedRequestId = isNew
    ? queryRequestId
    : quotationQuery.data?.requestId || ''

  const requestQuery = useLiveQuery(
    resolvedRequestId ? `/admin/quote-requests/${resolvedRequestId}` : null,
    async () =>
      (
        await api<AdminQuoteRequest>(
          `/admin/quote-requests/${resolvedRequestId}`,
        )
      ).data,
  )

  const quotation = quotationQuery.data
  const request = requestQuery.data

  const [quoteLocale, setQuoteLocale] = useState<'ar' | 'en'>('ar')
  const [quoteCurrency, setQuoteCurrency] = useState<'EGP' | 'USD' | 'EUR'>(
    'EGP',
  )
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(14)
  const [channel, setChannel] = useState('email')
  const [decisionReason, setDecisionReason] = useState('')
  const [lines, setLines] = useState<EditableLine[]>([])
  const [initializedKey, setInitializedKey] = useState('')

  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (
      !isNew &&
      quotation &&
      initializedKey !== `q:${quotation.id}:${quotation.version}`
    ) {
      setQuoteLocale(quotation.locale)
      setQuoteCurrency(quotation.currency)
      setValidUntil(quotation.validUntil || '')
      setPaymentTerms(quotation.terms || '')
      setDeliveryTerms(quotation.leadTime || '')
      setDiscount(
        quotation.lines.reduce(
          (sum, line) => sum + Number(line.discount || 0),
          0,
        ),
      )
      setTaxRate(Number(quotation.lines[0]?.tax || 0))
      setLines(
        (quotation.lines || []).map((item, idx) => ({
          key: `line-${idx}`,
          requestItemId: item.requestItemId || null,
          variantId: item.variantId || null,
          descriptionAr:
            item.descriptionLocalized?.ar || item.description || '',
          descriptionEn:
            item.descriptionLocalized?.en || item.description || '',
          sku: item.sku || '',
          unit: item.unit || 'unit',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.price || 0),
          discount: item.discount || '0',
          tax: item.tax || '0',
        })),
      )
      setInitializedKey(`q:${quotation.id}:${quotation.version}`)
    } else if (isNew && request && initializedKey !== `req:${request.id}`) {
      const defaultValid = new Date(Date.now() + 14 * 86400000)
        .toISOString()
        .slice(0, 10)
      setQuoteLocale(request.locale || lang)
      setValidUntil(defaultValid)
      setPaymentTerms(
        c('تحويل بنكي قبل التوريد', 'Bank transfer prior to dispatch'),
      )
      setDeliveryTerms(
        c(
          'تسليم مخازن العميل حسب الجدول المتفق عليه',
          'Delivery per agreed schedule',
        ),
      )
      const seedLines: EditableLine[] = (request.items || []).map(
        (item, idx) => {
          const arDesc =
            item.snapshot?.name?.ar ||
            item.snapshot?.description ||
            `بند ${idx + 1}`
          const enDesc =
            item.snapshot?.name?.en ||
            item.snapshot?.description ||
            `Item ${idx + 1}`
          const varAr = item.snapshot?.label?.ar
            ? ` — ${item.snapshot.label.ar}`
            : ''
          const varEn = item.snapshot?.label?.en
            ? ` — ${item.snapshot.label.en}`
            : ''
          return {
            key: item.id || `seed-${idx}`,
            requestItemId: item.id || null,
            variantId: item.variantId || null,
            descriptionAr: `${arDesc}${varAr}`,
            descriptionEn: `${enDesc}${varEn}`,
            sku: item.snapshot?.sku || '',
            unit: item.snapshot?.unitCode || 'unit',
            quantity: Number(item.quantity || 1),
            unitPrice: 0,
            discount: '0',
            tax: '14',
          }
        },
      )
      setLines(
        seedLines.length
          ? seedLines
          : [
              {
                key: 'seed-0',
                requestItemId: null,
                variantId: null,
                descriptionAr: '',
                descriptionEn: '',
                sku: '',
                unit: 'unit',
                quantity: 1,
                unitPrice: 0,
                discount: '0',
                tax: String(taxRate),
              },
            ],
      )
      setInitializedKey(`req:${request.id}`)
    }
  }, [isNew, quotation, request, initializedKey, c])

  const status: QuotationStatus = isNew ? 'draft' : quotation?.status || 'draft'
  const frozen = status !== 'draft'
  const statusBadge = STATUS_META[status] || STATUS_META.draft

  const totals = useMemo(() => {
    const calculated = quoteTotals(
      lines.map((line, i) => ({
        id: String(i),
        description: line.descriptionAr || line.descriptionEn,
        sku: line.sku,
        unit: line.unit,
        quantity: line.quantity,
        price: String(line.unitPrice),
        discount: line.discount,
        tax: line.tax,
      })),
    )
    return {
      subtotal:
        calculated.net / 100 +
        lines.reduce((sum, l) => sum + Number(l.discount), 0),
      taxAmount: calculated.tax / 100,
      total: calculated.total / 100,
    }
  }, [lines])

  if (isNew && !queryRequestId) {
    return (
      <EmptyState
        title={c('اختر طلب عرض سعر أولًا', 'Select a quote request first')}
        description={c(
          'يجب ربط عرض السعر بطلب عرض سعر قائم.',
          'Every quotation must be linked to an existing quote request.',
        )}
        action={
          <Link href="/admin/quote-requests" className="btn-primary">
            {c('فتح طلبات عروض الأسعار', 'Open quote requests')}
          </Link>
        }
      />
    )
  }

  if ((!isNew && quotationQuery.isLoading) || requestQuery.isLoading) {
    return <LoadingState />
  }

  if (!isNew && (quotationQuery.error || !quotation)) {
    return (
      <ErrorState
        error={quotationQuery.error}
        onRetry={() => void quotationQuery.refresh()}
        title={c('تعذر تحميل عرض السعر', 'Unable to load quotation')}
      />
    )
  }

  function buildPayload(): QuotationInput {
    const locale = quoteLocale
    return {
      locale,
      currency: quoteCurrency,
      validUntil,
      leadTime: deliveryTerms.trim(),
      terms: paymentTerms.trim(),
      lines: lines.map((l) => ({
        requestItemId: l.requestItemId,
        variantId: l.variantId,
        description: (locale === 'ar'
          ? l.descriptionAr || l.descriptionEn
          : l.descriptionEn || l.descriptionAr
        ).trim(),
        descriptionLocalized: {
          ar: l.descriptionAr.trim(),
          en: l.descriptionEn.trim(),
        },
        sku: l.sku.trim(),
        unit: l.unit.trim(),
        quantity: Number(l.quantity),
        price: String(l.unitPrice),
        discount: l.discount,
        tax: l.tax,
      })),
    }
  }

  async function persistDraft() {
    if (busy || frozen) return null
    const payload = buildPayload()
    if (
      !payload.lines.length ||
      payload.lines.some(
        (it) => !it.description || it.quantity <= 0 || Number(it.price) < 0,
      )
    ) {
      setErrorMsg(
        c(
          'تأكد من إدخال وصف صالح وكمية أكبر من صفر وسعر غير سالب لجميع البنود.',
          'Ensure every line has a description, positive quantity, and non-negative unit price.',
        ),
      )
      return null
    }

    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      const { data: saved } = await saveQuotation(
        resolvedRequestId,
        payload,
        isNew ? undefined : quotation?.id,
        quotation?.version,
      )
      invalidateLiveQueries('/admin/quotations')
      invalidateLiveQueries('/admin/quote-requests')
      invalidateLiveQueries('/admin/audit-log')
      if (isNew) {
        router.replace(`/admin/quotations/${saved.id}`)
      } else {
        await quotationQuery.refresh()
      }
      setFeedback(c('تم حفظ مسودة عرض السعر.', 'Quotation draft saved.'))
      return saved
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function issueFormalQuotation() {
    if (busy) return
    const saved = await persistDraft()
    if (!saved) return
    setBusy(true)
    setErrorMsg('')
    try {
      const res = await api<{
        id: string
        number: string
        status: QuotationStatus
        pdfStatus: string
      }>(`/admin/quotations/${saved.id}/issue`, {
        method: 'POST',
        body: { version: saved.version, status: 'issued' },
      })
      invalidateLiveQueries('/admin/quotations')
      invalidateLiveQueries('/admin/quote-requests')
      invalidateLiveQueries('/admin/reports')
      invalidateLiveQueries('/admin/audit-log')
      if (isNew) {
        router.replace(`/admin/quotations/${saved.id}`)
      } else {
        await quotationQuery.refresh()
      }
      setFeedback(
        c(
          `تم الإصدار الرسمي لعرض السعر رقم ${res.data.number} وتجميد النسخة.`,
          `Quotation formally issued as ${res.data.number} and frozen.`,
        ),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function createNewRevision() {
    if (busy || !quotation) return
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      const res = await api<{ id: string; revision: number }>(
        `/admin/quotations/${quotation.id}/revise`,
        {
          method: 'POST',
          body: { version: quotation.version, status: 'draft' },
        },
      )
      invalidateLiveQueries('/admin/quotations')
      router.push(`/admin/quotations/${res.data.id}`)
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function downloadPdf() {
    if (busy || !quotation) return
    setBusy(true)
    setErrorMsg('')
    try {
      const res = await api<{ url: string; expiresIn: number }>(
        `/admin/quotations/${quotation.id}/download`,
      )
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function retryPdfGeneration() {
    if (busy || !quotation) return
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      await api('/admin/jobs', {
        method: 'POST',
        body: { quotationId: quotation.id },
      })
      await quotationQuery.refresh()
      setFeedback(
        c(
          'تم تحديث حالة المعالجة. يظل التنزيل متاحًا بعد جاهزية الملف فقط.',
          'Processing status refreshed. Download is available only when the file is ready.',
        ),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function transitionStatus(
    targetStatus: QuotationStatus,
    opts?: { channel?: string; reason?: string },
  ) {
    if (busy || !quotation) return
    if (
      ['accepted', 'rejected'].includes(targetStatus) &&
      (!opts?.reason || opts.reason.trim().length < 3)
    ) {
      setErrorMsg(
        c(
          'أدخل سبب قرار العميل (3 أحرف على الأقل).',
          'Enter the customer decision reason (at least 3 characters).',
        ),
      )
      return
    }
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      await api(`/admin/quotations/${quotation.id}/transitions`, {
        method: 'POST',
        body: {
          version: quotation.version,
          status: targetStatus,
          ...(opts?.channel ? { channel: opts.channel } : {}),
          reason: opts?.reason?.trim() || '',
        },
      })
      setDecisionReason('')
      invalidateLiveQueries('/admin/quotations')
      invalidateLiveQueries('/admin/quote-requests')
      await quotationQuery.refresh()
      setFeedback(
        targetStatus === 'sent'
          ? c(
              'تم تسجيل قناة التواصل يدويًا في السجل (بدون إرسال بريد أو واتساب آلي).',
              'Manual delivery channel recorded in audit history (no automated email/WhatsApp sent).',
            )
          : c('تم تحديث حالة عرض السعر.', 'Quotation status updated.'),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <Link href="/admin/quotations" className="text-sm text-primary">
            {c('العودة لعروض الأسعار', 'Back to quotations')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 dir="ltr" className="font-mono">
              {quotation?.number ||
                c('مسودة عرض سعر جديد', 'New Quotation Draft')}
            </h1>
            <Badge tone={statusBadge.tone}>
              {c(statusBadge.ar, statusBadge.en)}
            </Badge>
            <span className="font-mono text-sm text-muted-foreground">
              R{quotation?.revision ?? 1}
            </span>
          </div>
          {request && (
            <p className="mt-1 text-sm text-muted-foreground">
              {c('مرتبط بالطلب:', 'Linked to request:')}{' '}
              <Link
                href={`/admin/quote-requests/${request.id}`}
                dir="ltr"
                className="font-mono text-primary hover:underline"
              >
                {request.reference}
              </Link>{' '}
              —{' '}
              {request.customerSnapshot?.company ||
                request.customerSnapshot?.name}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!frozen && (
            <>
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={() => void persistDraft()}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {c('حفظ المسودة', 'Save draft')}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void issueFormalQuotation()}
              >
                <FileCheck2 className="size-4" />
                {c('إصدار رسمي وتجميد', 'Issue & freeze')}
              </button>
            </>
          )}

          {frozen && quotation && (
            <>
              {quotation.pdfStatus === 'ready' ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void downloadPdf()}
                >
                  <Download className="size-4" />
                  {c('تنزيل ملف PDF الرسمي', 'Download Official PDF')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy}
                  onClick={() => void retryPdfGeneration()}
                >
                  <RefreshCw className="size-4" />
                  {quotation.pdfStatus === 'failed'
                    ? c('إعادة محاولة توليد PDF', 'Retry PDF generation')
                    : c('تجهيز ملف PDF الآن', 'Generate PDF now')}
                </button>
              )}

              {status !== 'superseded' && (
                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy}
                  onClick={() => void createNewRevision()}
                >
                  <CopyPlus className="size-4" />
                  {c('إنشاء مراجعة جديدة', 'New revision')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {feedback && (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 text-sm font-medium text-primary"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-5 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      {frozen && quotation && quotation.pdfStatus !== 'ready' && (
        <div className="panel mb-6 border-amber-300 bg-amber-50/70 text-sm text-amber-950">
          <strong>
            {quotation.pdfStatus === 'failed'
              ? c(
                  'تعذر توليد ملف PDF الرسمي:',
                  'Official PDF generation failed:',
                )
              : c('ملف PDF قيد التجهيز:', 'Official PDF is queued:')}
          </strong>{' '}
          {quotation.pdfError ||
            c(
              'اضغط على زر التجهيز/إعادة المحاولة أعلاه لتوليد ملف PDF وحفظه في التخزين المؤمّن.',
              'Click the generate/retry button above to build and store the signed PDF.',
            )}
        </div>
      )}

      <div className="panel mb-5 grid gap-4 bg-white sm:grid-cols-2">
        <Field label={c('لغة المستند', 'Document language')}>
          <select
            disabled={frozen}
            className="control"
            value={quoteLocale}
            onChange={(e) => setQuoteLocale(e.target.value as 'ar' | 'en')}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={c('عملة عرض السعر', 'Quotation currency')}>
          <select
            disabled={frozen}
            className="control"
            value={quoteCurrency}
            onChange={(e) =>
              setQuoteCurrency(e.target.value as 'EGP' | 'USD' | 'EUR')
            }
          >
            <option>EGP</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="panel bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {c('بنود عرض السعر والتسعير', 'Quotation lines & pricing')}
              </h2>
              {!frozen && (
                <button
                  type="button"
                  className="btn-outline text-xs"
                  onClick={() =>
                    setLines((prev) => [
                      ...prev,
                      {
                        key: `line-${Date.now()}`,
                        requestItemId: null,
                        variantId: null,
                        descriptionAr: '',
                        descriptionEn: '',
                        sku: '',
                        unit: 'unit',
                        quantity: 1,
                        unitPrice: 0,
                        discount: '0',
                        tax: String(taxRate),
                      },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  {c('إضافة بند', 'Add line')}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {lines.map((line, index) => (
                <div key={line.key} className="space-y-3 rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={c('الوصف بالعربية', 'Arabic description')}>
                      <input
                        className="control"
                        disabled={frozen}
                        value={line.descriptionAr}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, descriptionAr: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field
                      label={c('الوصف بالإنجليزية', 'English description')}
                    >
                      <input
                        className="control"
                        dir="ltr"
                        disabled={frozen}
                        value={line.descriptionEn}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, descriptionEn: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[120px_110px_120px_1fr_auto] sm:items-end">
                    <Field label={c('الكمية', 'Qty')}>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        disabled={frozen}
                        className="control"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, quantity: Number(e.target.value) }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label={c('الوحدة', 'Unit')}>
                      <input
                        className="control"
                        disabled={frozen}
                        value={line.unit}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, unit: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="SKU">
                      <input
                        className="control font-mono"
                        dir="ltr"
                        disabled={frozen}
                        value={line.sku}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, sku: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field
                      label={c(
                        `سعر الوحدة (${quoteCurrency})`,
                        `Unit price (${quoteCurrency})`,
                      )}
                    >
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={frozen}
                        className="control font-mono"
                        dir="ltr"
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? { ...row, unitPrice: Number(e.target.value) }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    {!frozen && lines.length > 1 && (
                      <button
                        type="button"
                        className="icon-button text-red-700"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, i) => i !== index))
                        }
                        aria-label={c('حذف السطر', 'Remove line')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {c('إجمالي السطر:', 'Line total:')}{' '}
                      <strong dir="ltr" className="font-mono text-foreground">
                        {(
                          Number(line.quantity || 0) *
                          Number(line.unitPrice || 0)
                        ).toLocaleString('en-EG')}{' '}
                        {quoteCurrency}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel grid gap-4 bg-white sm:grid-cols-2">
            <Field label={c('تاريخ انتهاء الصلاحية', 'Valid until')}>
              <input
                type="date"
                disabled={frozen}
                className="control"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </Field>
            <Field label={c('الخصم (ج.م)', 'Discount (EGP)')}>
              <input
                type="number"
                min={0}
                step="any"
                disabled={frozen}
                className="control font-mono"
                dir="ltr"
                value={discount}
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setDiscount(value)
                  // Assign a total discount deterministically in cents, without losing per-line amounts on reload.
                  let remaining = Math.round(value * 100)
                  setLines((current) =>
                    current.map((line) => {
                      const amount = Math.min(
                        Math.max(
                          0,
                          Math.round(line.quantity * line.unitPrice * 100),
                        ),
                        remaining,
                      )
                      remaining -= amount
                      return { ...line, discount: (amount / 100).toFixed(2) }
                    }),
                  )
                }}
              />
            </Field>
            <Field label={c('نسبة الضريبة (%)', 'Tax rate (%)')}>
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                disabled={frozen}
                className="control font-mono"
                dir="ltr"
                value={taxRate}
                onChange={(e) => {
                  setTaxRate(Number(e.target.value))
                  setLines((current) =>
                    current.map((line) => ({ ...line, tax: e.target.value })),
                  )
                }}
              />
            </Field>
            <Field label={c('الشروط والأحكام', 'Terms and conditions')}>
              <input
                disabled={frozen}
                className="control"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={c('شروط التوريد والتسليم', 'Delivery terms')}>
                <input
                  disabled={frozen}
                  className="control"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="panel space-y-3 bg-white text-sm">
            <h2 className="text-lg font-bold">
              {c('ملخص القيمة المالية', 'Financial summary')}
            </h2>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {c('المجموع الفرعي', 'Subtotal')}
              </span>
              <span dir="ltr" className="font-mono">
                {totals.subtotal.toLocaleString('en-EG')} {quoteCurrency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {c('الخصم', 'Discount')}
              </span>
              <span dir="ltr" className="font-mono">
                -{Number(discount || 0).toLocaleString('en-EG')} {quoteCurrency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {c(`الضريبة (${taxRate}%)`, `VAT (${taxRate}%)`)}
              </span>
              <span dir="ltr" className="font-mono">
                {totals.taxAmount.toLocaleString('en-EG')} {quoteCurrency}
              </span>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-bold">
              <span>{c('الإجمالي النهائي', 'Grand total')}</span>
              <span dir="ltr" className="font-mono text-primary">
                {totals.total.toLocaleString('en-EG')} {quoteCurrency}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {c(
                'تبقى الأسعار داخل عروض الأسعار الخاصة ولا تُنشر في الموقع العام.',
                'Prices remain exclusive to private quotations and never appear publicly.',
              )}
            </p>
          </div>

          {status === 'issued' && (
            <div className="panel space-y-4 bg-white">
              <h2 className="text-lg font-bold">
                {c(
                  'تسجيل قناة التسليم اليدوي للعميل',
                  'Record manual customer delivery',
                )}
              </h2>
              <p className="text-xs leading-6 text-muted-foreground">
                {c(
                  'بعد تنزيل ملف PDF وإرساله للعميل بنفسك، سجّل القناة المستخدمة هنا للتوثيق (لا يقوم النظام بإرسال بريد أو واتساب تلقائيًا).',
                  'After downloading and sharing the PDF with the customer, log the channel used here (no automated email or WhatsApp message is sent).',
                )}
              </p>
              <Field label={c('القناة المستخدمة', 'Channel used')}>
                <select
                  className="control"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="email">
                    {c('بريد إلكتروني يدوي', 'Manual Email')}
                  </option>
                  <option value="whatsapp">
                    {c('واتساب يدوي', 'Manual WhatsApp')}
                  </option>
                  <option value="phone">{c('مكالمة هاتفية', 'Phone')}</option>
                  <option value="in_person">
                    {c('تسليم مباشر', 'In person')}
                  </option>
                </select>
              </Field>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy}
                onClick={() => void transitionStatus('sent', { channel })}
              >
                {c(
                  'توثيق التسليم اليدوي للعميل',
                  'Log manual delivery to customer',
                )}
              </button>
              <button
                type="button"
                className="btn-outline w-full"
                disabled={busy}
                onClick={() => void transitionStatus('expired')}
              >
                {c('تحديد كمنتهي الصلاحية', 'Mark as expired')}
              </button>
            </div>
          )}

          {status === 'sent' && (
            <div className="panel space-y-4 bg-white">
              <h2 className="text-lg font-bold">
                {c('قرار العميل النهائي', 'Customer decision')}
              </h2>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy}
                onClick={() =>
                  void transitionStatus('accepted', { reason: decisionReason })
                }
              >
                {c('تسجيل قبول العميل للعرض', 'Record customer acceptance')}
              </button>
              <div className="space-y-2 border-t pt-3">
                <Field
                  label={c(
                    'سبب قرار العميل (قبول أو رفض)',
                    'Customer decision reason (accept or reject)',
                  )}
                >
                  <input
                    className="control"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className="btn-outline w-full text-red-700"
                  disabled={busy}
                  onClick={() =>
                    void transitionStatus('rejected', {
                      reason: decisionReason,
                    })
                  }
                >
                  {c('تسجيل رفض العرض', 'Record rejection')}
                </button>
              </div>
              <button
                type="button"
                className="btn-outline w-full"
                disabled={busy}
                onClick={() => void transitionStatus('expired')}
              >
                {c('تحديد كمنتهي الصلاحية', 'Mark as expired')}
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
