'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  RequestStatusBadge,
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
} from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import type {
  AdminInquiry,
  AdminQuoteRequest,
  AdminTeamMember,
  CompanySettingsRecord,
  ContentBlockRecord,
  CustomerContact,
  QuotationRecord,
  ReportsSummary,
  UnitRecord,
} from '@/lib/types'

const RFQ_STATUSES = [
  'new',
  'assigned',
  'in_progress',
  'awaiting_customer',
  'quoted',
  'won',
  'lost',
  'cancelled',
] as const

const RFQ_TRANSITIONS: Record<string, string[]> = {
  new: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'awaiting_customer', 'cancelled'],
  in_progress: ['awaiting_customer', 'quoted', 'cancelled'],
  awaiting_customer: ['in_progress', 'quoted', 'cancelled'],
  quoted: ['awaiting_customer', 'won', 'lost', 'cancelled'],
  won: ['in_progress'],
  lost: ['in_progress'],
  cancelled: ['in_progress'],
}

const INQUIRY_STATUSES = [
  'new',
  'assigned',
  'in_progress',
  'resolved',
  'spam',
] as const

const INQUIRY_TRANSITIONS: Record<string, string[]> = {
  new: ['assigned', 'spam'],
  assigned: ['in_progress', 'spam'],
  in_progress: ['resolved', 'spam'],
  resolved: ['in_progress'],
  spam: ['in_progress'],
}

const INQUIRY_STATUS_LABELS: Record<
  string,
  { ar: string; en: string; tone: 'gold' | 'green' | 'blue' | 'muted' | 'red' }
> = {
  new: { ar: 'جديد', en: 'New', tone: 'gold' },
  assigned: { ar: 'معيّن', en: 'Assigned', tone: 'blue' },
  in_progress: { ar: 'قيد المتابعة', en: 'In progress', tone: 'blue' },
  resolved: { ar: 'تمت المعالجة', en: 'Resolved', tone: 'green' },
  spam: { ar: 'غير مرغوب', en: 'Spam', tone: 'red' },
}

function toDatetimeLocalValue(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function Dashboard() {
  const c = useCopy()

  const reportsQuery = useLiveQuery('/admin/reports', async () => {
    return (await api<ReportsSummary>('/admin/reports')).data
  })

  const publishedProductsQuery = useLiveQuery(
    '/admin/products?page=1&pageSize=1&status=published',
    async () => {
      const res = await api<unknown[]>(
        '/admin/products?page=1&pageSize=1&status=published',
      )
      return res.meta?.total ?? res.data.length
    },
  )

  const settingsQuery = useLiveQuery(
    '/admin/settings?page=1&pageSize=1',
    async () =>
      (await api<CompanySettingsRecord[]>('/admin/settings?page=1&pageSize=1'))
        .data,
  )

  const unitsQuery = useLiveQuery(
    '/admin/units?page=1&pageSize=48',
    async () =>
      (await api<UnitRecord[]>('/admin/units?page=1&pageSize=48')).data,
  )

  const contentQuery = useLiveQuery(
    '/admin/content?page=1&pageSize=48',
    async () =>
      (await api<ContentBlockRecord[]>('/admin/content?page=1&pageSize=48'))
        .data,
  )

  const summary = reportsQuery.data
  const newRequests = Number(summary?.byStatus?.new || 0)
  const inProgressRequests =
    Number(summary?.byStatus?.assigned || 0) +
    Number(summary?.byStatus?.in_progress || 0) +
    Number(summary?.byStatus?.awaiting_customer || 0)

  const hasSettings = Boolean(settingsQuery.data?.length)
  const hasActiveUnit = Boolean(unitsQuery.data?.some((u) => u.active))
  const hasPublishedPrivacy = Boolean(
    contentQuery.data?.some(
      (b) =>
        b.key === 'privacy' &&
        b.status === 'published' &&
        Boolean(b.policyVersion),
    ),
  )
  const needsBootstrap =
    !settingsQuery.isLoading &&
    !unitsQuery.isLoading &&
    !contentQuery.isLoading &&
    (!hasSettings || !hasActiveUnit || !hasPublishedPrivacy)

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('لوحة التحكم', 'Dashboard')}</h1>
          <p>
            {c(
              'نظرة تشغيلية مباشرة على الكتالوج وطلبات عروض الأسعار والاستفسارات.',
              'Live operational snapshot across catalog, quote requests and inquiries.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products/new" className="btn-primary">
            <Plus className="size-4" />
            {c('منتج جديد', 'New product')}
          </Link>
          <Link href="/admin/quote-requests" className="btn-outline">
            {c('جميع الطلبات', 'All requests')}
          </Link>
        </div>
      </div>

      {needsBootstrap && (
        <section className="panel mb-6 border-accent/40 bg-white">
          <h2 className="text-lg font-bold">
            {c(
              'قائمة تهيئة الجاهزية التشغيلية للموقع العام',
              'Public Readiness Setup Checklist',
            )}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {c(
              'أكمل هذه المتطلبات الأساسية لتفعيل استقبال النماذج العامة واكتمال فحص الجاهزية (/api/v1/health).',
              'Complete these core items so public forms and /api/v1/health report READY.',
            )}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/settings"
              className="flex items-center justify-between rounded-xl border p-3.5 text-sm hover:border-primary"
            >
              <span>{c('1. إعدادات الشركة', '1. Company settings')}</span>
              <Badge tone={hasSettings ? 'green' : 'gold'}>
                {hasSettings ? c('مكتمل', 'Ready') : c('مطلوب', 'Pending')}
              </Badge>
            </Link>
            <Link
              href="/admin/units/new"
              className="flex items-center justify-between rounded-xl border p-3.5 text-sm hover:border-primary"
            >
              <span>{c('2. وحدة بيع نشطة', '2. Active selling unit')}</span>
              <Badge tone={hasActiveUnit ? 'green' : 'gold'}>
                {hasActiveUnit ? c('مكتمل', 'Ready') : c('مطلوب', 'Pending')}
              </Badge>
            </Link>
            <Link
              href="/admin/content/new"
              className="flex items-center justify-between rounded-xl border p-3.5 text-sm hover:border-primary"
            >
              <span>
                {c(
                  '3. سياسة خصوصية منشورة (privacy)',
                  '3. Published privacy policy',
                )}
              </span>
              <Badge tone={hasPublishedPrivacy ? 'green' : 'gold'}>
                {hasPublishedPrivacy
                  ? c('مكتمل', 'Ready')
                  : c('مطلوب', 'Pending')}
              </Badge>
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            c('طلبات جديدة', 'New requests'),
            reportsQuery.isLoading ? '…' : newRequests,
            c('تنتظر التعيين والمراجعة', 'Awaiting triage'),
          ],
          [
            c('طلبات قيد المتابعة', 'Active pipeline'),
            reportsQuery.isLoading ? '…' : inProgressRequests,
            c('معيّنة أو قيد التسعير', 'Assigned or in progress'),
          ],
          [
            c('منتجات منشورة', 'Published products'),
            publishedProductsQuery.isLoading
              ? '…'
              : (publishedProductsQuery.data ?? 0),
            c('متاحة في الكتالوج العام', 'Visible in public catalog'),
          ],
          [
            c('الاستفسارات وعروض الأسعار', 'Inquiries & quotations'),
            reportsQuery.isLoading
              ? '…'
              : `${summary?.inquiries ?? 0} / ${summary?.quotations ?? 0}`,
            c('رسائل العملاء / العروض', 'Inquiries / Quotations'),
          ],
        ].map(([label, val, note]) => (
          <div className="panel bg-white" key={String(label)}>
            <span className="text-sm text-muted-foreground">{label}</span>
            <strong className="my-3 block text-4xl font-bold">{val}</strong>
            <small className="text-xs text-muted-foreground">{note}</small>
          </div>
        ))}
      </div>

      <section className="panel mt-6 bg-white">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            {c('أحدث طلبات عروض الأسعار', 'Recent quote requests')}
          </h2>
          <Link
            href="/admin/quote-requests"
            className="text-sm font-semibold text-primary"
          >
            {c('فتح صندوق الطلبات', 'Open inbox')}
          </Link>
        </div>
        <RequestTable compact />
      </section>
    </>
  )
}

export function RequestTable({ compact = false }: { compact?: boolean }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const pageSize = compact ? 5 : 10

  const listPath = buildApiPath('/admin/quote-requests', {
    page: compact ? 1 : page,
    pageSize,
    status: status || undefined,
    q: q.trim() || undefined,
  })

  const listQuery = useLiveQuery(listPath, async () => {
    const res = await api<AdminQuoteRequest[]>(listPath)
    return {
      data: res.data,
      meta: res.meta || {
        page: 1,
        pageSize,
        total: res.data.length,
        totalPages: 1,
      },
    }
  })

  const teamQuery = useLiveQuery('/admin/team?page=1&pageSize=48', async () => {
    return (await api<AdminTeamMember[]>('/admin/team?page=1&pageSize=48')).data
  })

  const teamMap = new Map(
    (teamQuery.data || []).map((m) => [m.id, m.displayName]),
  )
  const rows = listQuery.data?.data || []
  const meta = listQuery.data?.meta || {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  }

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      await downloadServerExport('quote_requests', {
        status: status || undefined,
        q: q.trim() || undefined,
      })
      invalidateLiveQueries('/admin/audit-log')
    } catch (err) {
      setExportError(formatApiError(err, lang))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {!compact && (
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <input
            className="control"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            aria-label={c('بحث', 'Search')}
            placeholder={c(
              'بحث بالرقم المرجعي أو الشركة أو الهاتف…',
              'Search reference, company or phone…',
            )}
          />
          <select
            className="control"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            aria-label={c('تصفية بالحالة', 'Filter status')}
          >
            <option value="">{c('كل الحالات', 'All statuses')}</option>
            {RFQ_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            CSV
          </button>
        </div>
      )}

      {exportError && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {exportError}
        </p>
      )}

      {listQuery.isLoading ? (
        <LoadingState />
      ) : listQuery.error ? (
        <ErrorState
          error={listQuery.error}
          onRetry={() => void listQuery.refresh()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={c('لا توجد طلبات عروض أسعار', 'No quote requests yet')}
          description={c(
            'ستظهر الطلبات المرسلة من الموقع العام أو المحولة من الاستفسارات هنا فورًا.',
            'Requests submitted from the public website or converted from inquiries appear here.',
          )}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{c('المرجع', 'Reference')}</th>
                <th>{c('العميل / الشركة', 'Customer / Company')}</th>
                <th>{c('الحالة', 'Status')}</th>
                <th>{c('المسؤول', 'Assignee')}</th>
                <th>{c('البنود', 'Items')}</th>
                <th>{c('التاريخ', 'Date')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/admin/quote-requests/${r.id}`}
                      dir="ltr"
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {r.reference}
                    </Link>
                  </td>
                  <td>
                    <strong>
                      {r.customerSnapshot?.company || r.customerSnapshot?.name}
                    </strong>
                    <small className="block text-xs text-muted-foreground">
                      {r.customerSnapshot?.name} ·{' '}
                      <span dir="ltr">{r.customerSnapshot?.phone}</span>
                    </small>
                  </td>
                  <td>
                    <RequestStatusBadge status={r.status} />
                  </td>
                  <td className="text-muted-foreground">
                    {(r.assignedTo && teamMap.get(r.assignedTo)) ||
                      c('غير معيّن', 'Unassigned')}
                  </td>
                  <td>{r.itemCount ?? r.items?.length ?? 0}</td>
                  <td className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString(
                      lang === 'ar' ? 'ar-EG' : 'en-EG',
                      { timeZone: 'Africa/Cairo' },
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!compact && meta.total > 0 && (
        <Pagination
          page={meta.page}
          pages={Math.max(1, meta.totalPages)}
          total={meta.total}
          onChange={setPage}
        />
      )}
    </>
  )
}

export function RequestsPage({ id }: { id?: string }) {
  const c = useCopy()
  const { lang } = useLanguage()

  const detailPath = id ? `/admin/quote-requests/${id}` : null
  const detailQuery = useLiveQuery(detailPath, async () => {
    if (!detailPath) throw new Error('Missing ID')
    return (await api<AdminQuoteRequest>(detailPath)).data
  })

  const quotationsQuery = useLiveQuery(
    id ? `/admin/quotations?requestId=${id}&pageSize=20` : null,
    async () =>
      (await api<QuotationRecord[]>(`/admin/quotations?requestId=${id}&pageSize=20`))
        .data,
  )

  const teamQuery = useLiveQuery(
    id ? '/admin/team?page=1&pageSize=48' : null,
    async () =>
      (await api<AdminTeamMember[]>('/admin/team?page=1&pageSize=48')).data,
  )

  const customersQuery = useLiveQuery(
    id ? '/admin/customers?page=1&pageSize=48' : null,
    async () =>
      (await api<CustomerContact[]>('/admin/customers?page=1&pageSize=48'))
        .data,
  )

  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>(
    'normal',
  )
  const [followUpLocal, setFollowUpLocal] = useState('')
  const [contactId, setContactId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const request = detailQuery.data

  useEffect(() => {
    if (!request) return
    setPriority(request.priority || 'normal')
    setFollowUpLocal(toDatetimeLocalValue(request.followUpAt))
    setContactId(request.contactId || '')
    setAssigneeId(request.assignedTo || '')
    const allowed = RFQ_TRANSITIONS[request.status] || []
    setNextStatus((prev) => (allowed.includes(prev) ? prev : allowed[0] || ''))
  }, [request])

  if (!id) {
    return (
      <>
        <div className="admin-heading">
          <div>
            <h1>{c('طلبات عروض الأسعار', 'Quote requests')}</h1>
            <p>
              {c(
                'صندوق المبيعات الموحّد للمراجعة والتعيين وإعداد عروض الأسعار الرسمية.',
                'Unified sales inbox for triage, assignment and formal quotation preparation.',
              )}
            </p>
          </div>
        </div>
        <div className="panel bg-white">
          <RequestTable />
        </div>
      </>
    )
  }

  if (detailQuery.isLoading) return <LoadingState />
  if (detailQuery.error || !request) {
    return (
      <ErrorState
        error={detailQuery.error}
        onRetry={() => void detailQuery.refresh()}
        title={c('تعذر تحميل طلب عرض السعر', 'Unable to load quote request')}
      />
    )
  }

  const allowedTransitions = RFQ_TRANSITIONS[request.status] || []
  const needsReason =
    nextStatus === 'lost' ||
    nextStatus === 'cancelled' ||
    ['won', 'lost', 'cancelled'].includes(request.status)

  async function refreshAfterMutation() {
    invalidateLiveQueries('/admin/quote-requests')
    invalidateLiveQueries('/admin/reports')
    invalidateLiveQueries('/admin/audit-log')
    await detailQuery.refresh()
  }

  async function saveMetadata(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || !request) return
    setBusy(true)
    setFeedback('')
    setErrorMsg('')
    try {
      const followUpIso = followUpLocal
        ? new Date(followUpLocal).toISOString()
        : null
      await api(`/admin/quote-requests/${request.id}`, {
        method: 'PATCH',
        body: {
          version: request.version,
          data: {
            priority,
            followUpAt: followUpIso,
            contactId: contactId || null,
          },
        },
      })
      await refreshAfterMutation()
      setFeedback(
        c('تم حفظ بيانات المتابعة بنجاح.', 'Follow-up details saved.'),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function saveAssignment() {
    if (busy || !request) return
    setBusy(true)
    setFeedback('')
    setErrorMsg('')
    try {
      await api(`/admin/quote-requests/${request.id}/assign`, {
        method: 'POST',
        body: {
          version: request.version,
          assignedTo: assigneeId || null,
        },
      })
      await refreshAfterMutation()
      setFeedback(c('تم تحديث مسؤول الطلب.', 'Assignee updated.'))
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function runTransition(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || !request || !nextStatus) return
    if (needsReason && reason.trim().length < 3) {
      setErrorMsg(
        c(
          'أدخل سببًا واضحًا (3 أحرف على الأقل) لهذا الانتقال.',
          'Please enter a reason (at least 3 characters) for this transition.',
        ),
      )
      return
    }
    setBusy(true)
    setFeedback('')
    setErrorMsg('')
    try {
      await api(`/admin/quote-requests/${request.id}/transitions`, {
        method: 'POST',
        body: {
          version: request.version,
          status: nextStatus,
          reason: reason.trim(),
        },
      })
      setReason('')
      await refreshAfterMutation()
      setFeedback(
        c('تم تحديث حالة الطلب وتسجيل الحدث.', 'Status transitioned and logged.'),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function addNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || !request || !note.trim()) return
    setBusy(true)
    setFeedback('')
    setErrorMsg('')
    try {
      await api(`/admin/quote-requests/${request.id}/events`, {
        method: 'POST',
        body: { version: request.version, body: note.trim() },
      })
      setNote('')
      await detailQuery.refresh()
      setFeedback(c('تمت إضافة الملاحظة الداخلية.', 'Internal note recorded.'))
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  const linkedQuotations = quotationsQuery.data || []

  return (
    <>
      <div className="admin-heading">
        <div>
          <Link href="/admin/quote-requests" className="text-sm text-primary">
            {c('العودة للطلبات', 'Back to requests')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 dir="ltr" className="font-mono">
              {request.reference}
            </h1>
            <RequestStatusBadge status={request.status} />
            <span className="font-mono text-xs text-muted-foreground">
              v{request.version}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/quotations/new?requestId=${request.id}`}
            className="btn-primary"
          >
            <Plus className="size-4" />
            {c('إعداد مسودة عرض سعر', 'Prepare quotation draft')}
          </Link>
        </div>
      </div>

      {feedback && (
        <p role="status" className="mb-4 text-sm font-medium text-primary">
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="panel bg-white">
            <h2 className="mb-4 text-xl font-bold">
              {c('البنود المطلوبة (لقطة العميل المحفوظة)', 'Requested items (immutable snapshot)')}
            </h2>
            <div className="space-y-3">
              {(request.items || []).map((item) => {
                const snapName = item.snapshot?.name
                  ? lang === 'ar'
                    ? item.snapshot.name.ar
                    : item.snapshot.name.en
                  : item.snapshot?.description
                const varLabel = item.snapshot?.label
                  ? lang === 'ar'
                    ? item.snapshot.label.ar
                    : item.snapshot.label.en
                  : null
                const unitDisplay = item.snapshot?.unit
                  ? lang === 'ar'
                    ? item.snapshot.unit.ar
                    : item.snapshot.unit.en
                  : item.snapshot?.unitCode || ''

                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-muted/60 p-4"
                  >
                    <div>
                      <strong>{snapName || c('بند مخصص', 'Custom item')}</strong>
                      {varLabel && (
                        <small className="mt-0.5 block text-xs text-muted-foreground">
                          {varLabel}
                          {item.snapshot?.sku ? ` · SKU: ${item.snapshot.sku}` : ''}
                        </small>
                      )}
                      {item.notes && (
                        <small className="mt-1 block text-xs text-muted-foreground">
                          {item.notes}
                        </small>
                      )}
                    </div>
                    <Badge tone="gold">
                      {item.quantity} {unitDisplay}
                    </Badge>
                  </div>
                )
              })}
            </div>
            {request.notes && (
              <div className="mt-5 rounded-xl border bg-muted/30 p-4">
                <strong className="block text-xs text-muted-foreground">
                  {c('ملاحظات العميل العامة', 'Customer notes')}
                </strong>
                <p className="mt-1 text-sm leading-7">{request.notes}</p>
              </div>
            )}
          </section>

          <section className="panel bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {c('عروض الأسعار المرتبطة', 'Linked quotations')}
              </h2>
              <Link
                href={`/admin/quotations/new?requestId=${request.id}`}
                className="text-sm font-semibold text-primary"
              >
                {c('+ مسودة جديدة', '+ New draft')}
              </Link>
            </div>
            {linkedQuotations.length ? (
              <div className="space-y-2">
                {linkedQuotations.map((q) => (
                  <Link
                    key={q.id}
                    href={`/admin/quotations/${q.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 hover:border-primary"
                  >
                    <div>
                      <strong dir="ltr" className="font-mono text-primary">
                        {q.number || c('مسودة غير مصدرة', 'Draft')} · R{q.revision}
                      </strong>
                      <small className="block text-xs text-muted-foreground">
                        {q.status} · PDF: {q.pdfStatus}
                      </small>
                    </div>
                    <strong dir="ltr" className="font-mono text-sm">
                      {(Number(q.totals?.total || 0) / 100).toLocaleString('en-EG')} {q.currency}
                    </strong>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {c(
                  'لم يتم إنشاء عرض سعر لهذا الطلب بعد.',
                  'No quotation has been created for this request yet.',
                )}
              </p>
            )}
          </section>

          <section className="panel bg-white">
            <h2 className="mb-4 text-xl font-bold">
              {c('السجل الزمني والملاحظات الداخلية', 'Timeline & internal notes')}
            </h2>
            <form className="mb-6 space-y-3" onSubmit={addNote}>
              <textarea
                className="control"
                rows={3}
                placeholder={c(
                  'أضف ملاحظة متابعة داخلية محفوظة في قاعدة البيانات…',
                  'Add an internal follow-up note persisted to the database…',
                )}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !note.trim()}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {c('حفظ الملاحظة', 'Save note')}
              </button>
            </form>

            <ol className="space-y-3 text-sm">
              {(request.events || []).map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-lg border-s-2 border-primary bg-muted/40 py-2.5 ps-4 pe-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">
                      {ev.kind}
                      {ev.detail?.to
                        ? ` (${ev.detail?.from || '—'} → ${ev.detail?.to})`
                        : ''}
                    </span>
                    <time>
                      {new Date(ev.createdAt).toLocaleString(
                        lang === 'ar' ? 'ar-EG' : 'en-EG',
                        { timeZone: 'Africa/Cairo' },
                      )}
                    </time>
                  </div>
                  {ev.detail?.body && <p className="mt-1.5 leading-7">{ev.detail?.body}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="panel space-y-2 bg-white text-sm">
            <h2 className="text-lg font-bold">
              {c('بيانات العميل وقت الطلب', 'Customer snapshot')}
            </h2>
            <p className="font-semibold">
              {request.customerSnapshot?.company ||
                c('بدون اسم شركة', 'No company name')}
            </p>
            <p>{request.customerSnapshot?.name}</p>
            <p dir="ltr">{request.customerSnapshot?.phone}</p>
            {request.customerSnapshot?.email && (
              <p dir="ltr">{request.customerSnapshot.email}</p>
            )}
            <p className="text-muted-foreground">
              {[
                request.customerSnapshot?.city,
                request.customerSnapshot?.governorate,
              ]
                .filter(Boolean)
                .join(' — ')}
            </p>
            <p className="pt-1 text-xs text-muted-foreground">
              {c('قناة التواصل المفضلة:', 'Preferred channel:')}{' '}
              {request.customerSnapshot?.preferredChannel} · {c('سياسة:', 'Policy:')}{' '}
              {request.privacy?.policyVersion}
            </p>
          </div>

          <div className="panel space-y-4 bg-white">
            <h2 className="text-lg font-bold">
              {c('التعيين وانتقال الحالة', 'Assignment & transition')}
            </h2>

            <div className="space-y-2">
              <Field label={c('مسؤول المتابعة (أدمن)', 'Assigned Admin')}>
                <select
                  className="control"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">{c('غير معيّن', 'Unassigned')}</option>
                  {(teamQuery.data || [])
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                </select>
              </Field>
              <button
                type="button"
                className="btn-outline w-full"
                disabled={busy}
                onClick={() => void saveAssignment()}
              >
                {c('حفظ التعيين', 'Save assignment')}
              </button>
            </div>

            {allowedTransitions.length > 0 && (
              <form className="space-y-3 border-t pt-4" onSubmit={runTransition}>
                <Field label={c('انتقال الحالة المسموح', 'Allowed next status')}>
                  <select
                    className="control"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                  >
                    {allowedTransitions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    needsReason
                      ? c('سبب الانتقال (إلزامي)', 'Transition reason (required)')
                      : c('ملاحظة / سبب (اختياري)', 'Reason / note (optional)')
                  }
                >
                  <input
                    className="control"
                    required={needsReason}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={busy}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {c('تنفيذ انتقال الحالة', 'Transition status')}
                </button>
              </form>
            )}
          </div>

          <form className="panel space-y-4 bg-white" onSubmit={saveMetadata}>
            <h2 className="text-lg font-bold">
              {c('الأولوية وموعد المتابعة والربط', 'Priority, follow-up & CRM link')}
            </h2>
            <Field label={c('الأولوية', 'Priority')}>
              <select
                className="control"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="low">{c('منخفضة', 'Low')}</option>
                <option value="normal">{c('عادية', 'Normal')}</option>
                <option value="high">{c('مرتفعة', 'High')}</option>
                <option value="urgent">{c('عاجلة', 'Urgent')}</option>
              </select>
            </Field>
            <Field label={c('موعد المتابعة القادم', 'Next follow-up')}>
              <input
                type="datetime-local"
                className="control"
                value={followUpLocal}
                onChange={(e) => setFollowUpLocal(e.target.value)}
              />
            </Field>
            <Field label={c('ربط بسجل عميل', 'Linked customer contact')}>
              <select
                className="control"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">{c('بدون ربط', 'Unlinked')}</option>
                {(customersQuery.data || []).map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.name} ({cust.phone})
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit" className="btn-outline w-full" disabled={busy}>
              {c('حفظ بيانات المتابعة', 'Save follow-up settings')}
            </button>
          </form>
        </aside>
      </div>
    </>
  )
}

export function InquiriesWorkspace({ id }: { id?: string }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const router = useRouter()

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const listPath = !id
    ? buildApiPath('/admin/inquiries', {
        page,
        pageSize: 12,
        q: q.trim() || undefined,
        status: statusFilter || undefined,
      })
    : null

  const listQuery = useLiveQuery(listPath, async () => {
    if (!listPath) throw new Error('Detail mode')
    const res = await api<AdminInquiry[]>(listPath)
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

  const detailPath = id ? `/admin/inquiries/${id}` : null
  const detailQuery = useLiveQuery(detailPath, async () => {
    if (!detailPath) throw new Error('List mode')
    return (await api<AdminInquiry>(detailPath)).data
  })

  const teamQuery = useLiveQuery(
    id ? '/admin/team?page=1&pageSize=48' : null,
    async () =>
      (await api<AdminTeamMember[]>('/admin/team?page=1&pageSize=48')).data,
  )

  const unitsQuery = useLiveQuery(
    id ? '/admin/units?page=1&pageSize=48' : null,
    async () =>
      (await api<UnitRecord[]>('/admin/units?page=1&pageSize=48')).data,
  )

  const inquiry = detailQuery.data
  const activeUnits = (unitsQuery.data || []).filter((u) => u.active)

  const [assigneeId, setAssigneeId] = useState('')
  const [nextStatus, setNextStatus] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [convertItems, setConvertItems] = useState<
    Array<{ customName: string; quantity: number; unitCode: string; notes: string }>
  >([])
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!inquiry) return
    setAssigneeId(inquiry.assignedTo || '')
    const allowed = INQUIRY_TRANSITIONS[inquiry.status] || []
    setNextStatus((prev) => (allowed.includes(prev) ? prev : allowed[0] || ''))
    if (convertItems.length === 0) {
      setConvertItems([
        {
          customName: inquiry.message || '',
          quantity: 1,
          unitCode: activeUnits[0]?.code || 'unit',
          notes: '',
        },
      ])
    }
  }, [inquiry, activeUnits.length])

  if (!id) {
    const rows = listQuery.data?.data || []
    const meta = listQuery.data?.meta || {
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 1,
    }

    return (
      <>
        <div className="admin-heading">
          <div>
            <h1>{c('الرسائل والاستفسارات', 'Inquiries')}</h1>
            <p>
              {c(
                'إدارة رسائل نموذج التواصل وتحويل الاستفسارات المؤهلة إلى طلبات عروض أسعار.',
                'Manage contact messages and convert qualified inquiries into quote requests.',
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn-outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                await downloadServerExport('inquiries', {
                  q: q.trim() || undefined,
                  status: statusFilter || undefined,
                })
                invalidateLiveQueries('/admin/audit-log')
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

        <div className="panel bg-white">
          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              className="control"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder={c(
                'بحث بالمرجع أو الموضوع أو الهاتف…',
                'Search reference, subject or phone…',
              )}
            />
            <select
              className="control"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">{c('كل الحالات', 'All statuses')}</option>
              {INQUIRY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
          ) : rows.length === 0 ? (
            <EmptyState
              title={c('لا توجد استفسارات', 'No inquiries found')}
              description={c(
                'ستظهر رسائل صفحة تواصل معنا هنا تلقائيًا.',
                'Messages submitted via the Contact page appear here.',
              )}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{c('المرجع', 'Reference')}</th>
                    <th>{c('المرسل', 'Sender')}</th>
                    <th>{c('الموضوع', 'Subject')}</th>
                    <th>{c('الحالة', 'Status')}</th>
                    <th>{c('تحويل RFQ', 'RFQ Conversion')}</th>
                    <th>{c('التاريخ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inq) => {
                    const st =
                      INQUIRY_STATUS_LABELS[inq.status] ||
                      INQUIRY_STATUS_LABELS.new
                    return (
                      <tr key={inq.id}>
                        <td>
                          <Link
                            href={`/admin/inquiries/${inq.id}`}
                            dir="ltr"
                            className="font-mono font-semibold text-primary hover:underline"
                          >
                            {inq.reference}
                          </Link>
                        </td>
                        <td>
                          <strong>
                            {inq.customerSnapshot?.company ||
                              inq.customerSnapshot?.name}
                          </strong>
                          <small className="block text-xs text-muted-foreground">
                            <span dir="ltr">{inq.customerSnapshot?.phone}</span>
                          </small>
                        </td>
                        <td>{inq.message}</td>
                        <td>
                          <Badge tone={st.tone}>{c(st.ar, st.en)}</Badge>
                        </td>
                        <td>
                          {inq.convertedRequestId ? (
                            <Link
                              href={`/admin/quote-requests/${inq.convertedRequestId}`}
                              className="text-xs font-semibold text-primary hover:underline"
                            >
                              {c('تم التحويل لطلب عرض سعر', 'Converted to RFQ')}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {new Date(inq.createdAt).toLocaleDateString(
                            lang === 'ar' ? 'ar-EG' : 'en-EG',
                            { timeZone: 'Africa/Cairo' },
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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

  if (detailQuery.isLoading) return <LoadingState />
  if (detailQuery.error || !inquiry) {
    return (
      <ErrorState
        error={detailQuery.error}
        onRetry={() => void detailQuery.refresh()}
      />
    )
  }

  const statusMeta =
    INQUIRY_STATUS_LABELS[inquiry.status] || INQUIRY_STATUS_LABELS.new
  const allowedTransitions = INQUIRY_TRANSITIONS[inquiry.status] || []
  const needsReopenReason = ['resolved', 'spam'].includes(inquiry.status)

  async function convertToRfq(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || !inquiry || inquiry.convertedRequestId) return
    const validItems = convertItems
      .map((it) => ({
        description: it.customName.trim(),
        quantity: Number(it.quantity),
        unitCode: it.unitCode,
        notes: it.notes.trim(),
      }))
      .filter((it) => it.description.length >= 2 && it.quantity > 0 && it.unitCode)

    if (!validItems.length) {
      setErrorMsg(
        c(
          'أضف بندًا واحدًا صالحًا على الأقل بوحدة بيع نشطة.',
          'Add at least one valid item with an active selling unit.',
        ),
      )
      return
    }

    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      const res = await api<{ convertedRequestId: string; reference: string }>(
        `/admin/inquiries/${inquiry.id}/convert`,
        {
          method: 'POST',
          body: {
            version: inquiry.version,
            items: validItems,
          },
        },
      )
      invalidateLiveQueries('/admin/inquiries')
      invalidateLiveQueries('/admin/quote-requests')
      invalidateLiveQueries('/admin/reports')
      router.push(`/admin/quote-requests/${res.data.convertedRequestId}`)
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
          <Link href="/admin/inquiries" className="text-sm text-primary">
            {c('العودة للاستفسارات', 'Back to inquiries')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 dir="ltr" className="font-mono">
              {inquiry.reference}
            </h1>
            <Badge tone={statusMeta.tone}>
              {c(statusMeta.ar, statusMeta.en)}
            </Badge>
          </div>
        </div>
      </div>

      {feedback && (
        <p role="status" className="mb-4 text-sm font-medium text-primary">
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="panel bg-white">
            <h2 className="text-xl font-bold">{inquiry.message}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-8 text-foreground/90">
              {inquiry.message}
            </p>
          </section>

          <section className="panel bg-white">
            <div className="mb-4 flex items-center gap-2">
              <ArrowRightLeft className="size-5 text-primary" />
              <h2 className="text-xl font-bold">
                {c(
                  'تحويل الاستفسار إلى طلب عرض سعر (لمرة واحدة)',
                  'Convert Inquiry to Quote Request (single-use)',
                )}
              </h2>
            </div>

            {inquiry.convertedRequestId ? (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <CheckCircle2 className="size-5 text-emerald-700" />
                  {c(
                    'تم تحويل هذا الاستفسار بالفعل ولا يمكن تحويله مرة أخرى.',
                    'This inquiry has already been converted and cannot be converted again.',
                  )}
                </div>
                <Link
                  href={`/admin/quote-requests/${inquiry.convertedRequestId}`}
                  className="btn-primary"
                >
                  {c('فتح طلب عرض السعر', 'Open Quote Request')}
                </Link>
              </div>
            ) : inquiry.status === 'spam' ? (
              <p className="text-sm text-muted-foreground">
                {c(
                  'لا يمكن تحويل استفسار مصنّف كغير مرغوب (Spam) إلى طلب عرض سعر.',
                  'Spam inquiries cannot be converted into quote requests.',
                )}
              </p>
            ) : !activeUnits.length ? (
              <p className="text-sm text-amber-800">
                {c(
                  'أضف وحدة بيع نشطة أولًا من قسم وحدات البيع والقياس قبل التحويل.',
                  'Create at least one active selling unit in Units before converting.',
                )}
              </p>
            ) : (
              <form className="space-y-4" onSubmit={convertToRfq}>
                {convertItems.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[1fr_110px_140px_auto]"
                  >
                    <input
                      className="control"
                      required
                      placeholder={c('وصف البند المطلوب', 'Requested item name')}
                      value={it.customName}
                      onChange={(e) =>
                        setConvertItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, customName: e.target.value } : row,
                          ),
                        )
                      }
                    />
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      className="control"
                      required
                      value={it.quantity}
                      onChange={(e) =>
                        setConvertItems((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, quantity: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                    <select
                      className="control"
                      value={it.unitCode}
                      onChange={(e) =>
                        setConvertItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, unitCode: e.target.value } : row,
                          ),
                        )
                      }
                    >
                      {activeUnits.map((u) => (
                        <option key={u.id} value={u.code}>
                          {lang === 'ar' ? u.name.ar : u.name.en} ({u.code})
                        </option>
                      ))}
                    </select>
                    {convertItems.length > 1 && (
                      <button
                        type="button"
                        className="icon-button text-red-700"
                        onClick={() =>
                          setConvertItems((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        aria-label={c('حذف البند', 'Remove line')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() =>
                      setConvertItems((prev) => [
                        ...prev,
                        {
                          customName: '',
                          quantity: 1,
                          unitCode: activeUnits[0]?.code || 'unit',
                          notes: '',
                        },
                      ])
                    }
                  >
                    <Plus className="size-4" />
                    {c('إضافة بند آخر', 'Add item')}
                  </button>
                  <button type="submit" className="btn-primary" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {c('تحويل إلى طلب عرض سعر', 'Convert to RFQ')}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="panel bg-white">
            <h2 className="mb-4 text-xl font-bold">
              {c('الملاحظات الداخلية والسجل', 'Internal notes & timeline')}
            </h2>
            <form
              className="mb-5 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                if (busy || !note.trim()) return
                setBusy(true)
                setErrorMsg('')
                try {
                  await api(`/admin/inquiries/${inquiry.id}/events`, {
                    method: 'POST',
                    body: { version: inquiry.version, body: note.trim() },
                  })
                  setNote('')
                  await detailQuery.refresh()
                  setFeedback(c('تم حفظ الملاحظة.', 'Note saved.'))
                } catch (err) {
                  setErrorMsg(formatApiError(err, lang))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <textarea
                className="control"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={c('أضف ملاحظة متابعة…', 'Add follow-up note…')}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !note.trim()}
              >
                {c('حفظ الملاحظة', 'Save note')}
              </button>
            </form>

            <ol className="space-y-3 text-sm">
              {(inquiry.events || []).map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-lg border-s-2 border-primary bg-muted/40 py-2.5 ps-4 pe-3"
                >
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">
                      {ev.kind}
                      {ev.detail?.to
                        ? ` (${ev.detail?.from || '—'} → ${ev.detail?.to})`
                        : ''}
                    </span>
                    <time>
                      {new Date(ev.createdAt).toLocaleString(
                        lang === 'ar' ? 'ar-EG' : 'en-EG',
                        { timeZone: 'Africa/Cairo' },
                      )}
                    </time>
                  </div>
                  {ev.detail?.body && <p className="mt-1 leading-7">{ev.detail?.body}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="panel space-y-2 bg-white text-sm">
            <h2 className="text-lg font-bold">
              {c('بيانات المرسل', 'Sender snapshot')}
            </h2>
            <p className="font-semibold">
              {inquiry.customerSnapshot?.company || inquiry.customerSnapshot?.name}
            </p>
            <p>{inquiry.customerSnapshot?.name}</p>
            <p dir="ltr">{inquiry.customerSnapshot?.phone}</p>
            {inquiry.customerSnapshot?.email && (
              <p dir="ltr">{inquiry.customerSnapshot.email}</p>
            )}
          </div>

          <div className="panel space-y-4 bg-white">
            <h2 className="text-lg font-bold">
              {c('التعيين وتحديث الحالة', 'Assignment & status')}
            </h2>
            <Field label={c('الأدمن المسؤول', 'Assigned Admin')}>
              <select
                className="control"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">{c('غير معيّن', 'Unassigned')}</option>
                {(teamQuery.data || [])
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              type="button"
              className="btn-outline w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setErrorMsg('')
                try {
                  await api(`/admin/inquiries/${inquiry.id}/assign`, {
                    method: 'POST',
                    body: {
                      version: inquiry.version,
                      assignedTo: assigneeId || null,
                    },
                  })
                  invalidateLiveQueries('/admin/inquiries')
                  await detailQuery.refresh()
                  setFeedback(c('تم تحديث التعيين.', 'Assignment updated.'))
                } catch (err) {
                  setErrorMsg(formatApiError(err, lang))
                } finally {
                  setBusy(false)
                }
              }}
            >
              {c('حفظ التعيين', 'Save assignment')}
            </button>

            {allowedTransitions.length > 0 && (
              <form
                className="space-y-3 border-t pt-4"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (busy || !nextStatus) return
                  setBusy(true)
                  setErrorMsg('')
                  try {
                    await api(`/admin/inquiries/${inquiry.id}/transitions`, {
                      method: 'POST',
                      body: {
                        version: inquiry.version,
                        status: nextStatus,
                        reason: reason.trim(),
                      },
                    })
                    setReason('')
                    invalidateLiveQueries('/admin/inquiries')
                    await detailQuery.refresh()
                    setFeedback(c('تم تحديث الحالة.', 'Status updated.'))
                  } catch (err) {
                    setErrorMsg(formatApiError(err, lang))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Field label={c('الحالة التالية', 'Next status')}>
                  <select
                    className="control"
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                  >
                    {allowedTransitions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    needsReopenReason
                      ? c('سبب إعادة الفتح (إلزامي)', 'Reopen reason (required)')
                      : c('ملاحظة (اختياري)', 'Note (optional)')
                  }
                >
                  <input
                    className="control"
                    required={needsReopenReason}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={busy}
                >
                  {c('تنفيذ انتقال الحالة', 'Transition status')}
                </button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
