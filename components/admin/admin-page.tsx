'use client'

import { useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  useCopy,
} from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { AccountSecurityWorkspace } from './security-workspace'
import { AdminLogin, AdminShell } from './admin-shell'
import { CategoriesWorkspace } from './categories-workspace'
import { ProductWorkspace } from './products-workspace'
import { Dashboard, InquiriesWorkspace, RequestsPage } from './sales-workspace'
import { QuotationsWorkspace } from './quotations-workspace'
import {
  MediaWorkspace,
  ResourceWorkspace,
  SettingsWorkspace,
} from './resources'
import { Pagination } from './frontend-tools'
import {
  api,
  buildApiPath,
  downloadServerExport,
  formatApiError,
} from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import type { AuditLogRecord, ReportsSummary } from '@/lib/types'

export function AdminPage({ path }: { path: string[] }) {
  const [section, id] = path
  if (section === 'login' || section === 'reset-password')
    return <AdminLogin reset={section === 'reset-password'} />

  let body
  if (!section) body = <Dashboard />
  else if (section === 'products') body = <ProductWorkspace id={id} />
  else if (section === 'categories' && !id) body = <CategoriesWorkspace />
  else if (section === 'quote-requests') body = <RequestsPage id={id} />
  else if (section === 'inquiries') body = <InquiriesWorkspace id={id} />
  else if (section === 'quotations') body = <QuotationsWorkspace id={id} />
  else if (section === 'media') body = <MediaWorkspace />
  else if (section === 'security') body = <AccountSecurityWorkspace />
  else if (section === 'settings') body = <SettingsWorkspace />
  else if (section === 'reports') body = <Reports />
  else if (section === 'audit-log') body = <ActivityLog />
  else
    body = (
      <ResourceWorkspace
        key={`${section}/${id || ''}`}
        section={section}
        id={id}
      />
    )
  return <AdminShell>{body}</AdminShell>
}

function Reports() {
  const c = useCopy()
  const { lang } = useLanguage()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const validRange = !from || !to || from <= to
  const queryPath = validRange
    ? buildApiPath('/admin/reports', {
        from: from || undefined,
        to: to || undefined,
      })
    : null

  const reportsQuery = useLiveQuery(queryPath, async () => {
    if (!queryPath) throw new Error('Invalid range')
    return (await api<ReportsSummary>(queryPath)).data
  })

  async function handleExport(
    resource:
      | 'quote_requests'
      | 'inquiries'
      | 'quotations'
      | 'products'
      | 'contacts',
  ) {
    if (busy || !validRange) return
    setBusy(true)
    setErrorMsg('')
    setMessage('')
    try {
      await downloadServerExport(resource, {
        from: from || undefined,
        to: to || undefined,
      })
      invalidateLiveQueries('/admin/audit-log')
      setMessage(
        c(
          'تم توليد وتنزيل ملف CSV من الخادم وتسجيل العملية في سجل التدقيق.',
          'Server CSV exported and recorded in the audit log.',
        ),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function triggerJobs() {
    if (busy) return
    setBusy(true)
    setErrorMsg('')
    setMessage('')
    try {
      const res = await api<{
        processed: Array<{ id: string; kind: string; status: string }>
      }>('/admin/jobs', { method: 'POST', body: {} })
      invalidateLiveQueries('/admin/quotations')
      invalidateLiveQueries('/admin/media')
      setMessage(
        c(
          `تم فحص الطابور ومعالجة ${res.data.processed.length} مهمة.`,
          `Processed ${res.data.processed.length} queued job(s).`,
        ),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  const summary = reportsQuery.data
  const totalRequests = summary?.requests || 0
  const byStatus = summary?.byStatus || {}
  const bySource = summary?.bySource || {}

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('التقارير ومؤشرات التشغيل', 'Operational Reports')}</h1>
          <p>
            {c(
              'إحصاءات حقيقية من قاعدة البيانات لطلبات عروض الأسعار والاستفسارات والعروض.',
              'Live database metrics across quote requests, inquiries and quotations.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline"
            disabled={busy}
            onClick={() => void triggerJobs()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {c('تشغيل طابور المهام', 'Run background jobs')}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!validRange || busy}
            onClick={() => void handleExport('quote_requests')}
          >
            {c('تصدير الطلبات CSV', 'Export requests CSV')}
          </button>
        </div>
      </div>

      <div className="panel mb-6 grid gap-5 bg-white sm:grid-cols-2">
        <Field label={c('من تاريخ', 'From date')}>
          <input
            type="date"
            className="control"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={c('إلى تاريخ', 'To date')}>
          <input
            type="date"
            className="control"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>

      {!validRange && (
        <p role="alert" className="mb-5 text-sm font-medium text-red-700">
          {c(
            'تاريخ النهاية يجب ألا يسبق تاريخ البداية.',
            'End date must not precede start date.',
          )}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 text-sm text-primary">
          {message}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      {reportsQuery.isLoading ? (
        <LoadingState />
      ) : reportsQuery.error ? (
        <ErrorState
          error={reportsQuery.error}
          onRetry={() => void reportsQuery.refresh()}
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                c('طلبات عروض الأسعار', 'Quote requests'),
                summary?.requests ?? 0,
              ],
              [c('الاستفسارات', 'Inquiries'), summary?.inquiries ?? 0],
              [c('عروض الأسعار', 'Quotations'), summary?.quotations ?? 0],
              [
                c('متابعات متأخرة', 'Overdue follow-ups'),
                summary?.overdueFollowUps ?? 0,
              ],
            ].map(([label, value]) => (
              <div className="panel bg-white" key={String(label)}>
                <h2 className="text-sm text-muted-foreground">{label}</h2>
                <strong className="mt-5 block text-4xl">{value}</strong>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="panel bg-white">
              <h2 className="mb-6 text-xl font-bold">
                {c('توزيع حالات الطلبات', 'Request status breakdown')}
              </h2>
              {[
                'new',
                'assigned',
                'in_progress',
                'awaiting_customer',
                'quoted',
                'won',
                'lost',
                'cancelled',
              ].map((status) => {
                const count = Number(byStatus[status] || 0)
                return (
                  <div className="mb-4" key={status}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-mono">{status}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${totalRequests ? (count / totalRequests) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </section>

            <section className="panel bg-white">
              <h2 className="mb-6 text-xl font-bold">
                {c('مصادر الطلبات وتصدير البيانات', 'Sources & CSV exports')}
              </h2>
              {Object.keys(bySource).length ? (
                <ul className="mb-6 space-y-2 text-sm">
                  {Object.entries(bySource).map(([src, cnt]) => (
                    <li
                      key={src}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <span dir="ltr" className="font-mono">
                        {src}
                      </span>
                      <strong>{cnt}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-6 text-sm text-muted-foreground">
                  {c(
                    'لا توجد مصادر مسجلة ضمن الفترة المحددة.',
                    'No recorded sources in the selected period.',
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-5">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy}
                  onClick={() => void handleExport('quotations')}
                >
                  {c('تصدير العروض CSV', 'Export quotations CSV')}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy}
                  onClick={() => void handleExport('inquiries')}
                >
                  {c('تصدير الاستفسارات CSV', 'Export inquiries CSV')}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={busy}
                  onClick={() => void handleExport('contacts')}
                >
                  {c('تصدير العملاء CSV', 'Export customers CSV')}
                </button>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  )
}

function ActivityLog() {
  const c = useCopy()
  const { lang } = useLanguage()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const validRange = !from || !to || from <= to

  const listPath = buildApiPath('/admin/audit-log', {
    page,
    pageSize: 20,
    q: q.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
  })

  const auditQuery = useLiveQuery(validRange ? listPath : null, async () => {
    const res = await api<AuditLogRecord[]>(listPath)
    return {
      data: res.data,
      meta: res.meta || {
        page,
        pageSize: 20,
        total: res.data.length,
        totalPages: 1,
      },
    }
  })

  const rows = auditQuery.data?.data || []
  const meta = auditQuery.data?.meta || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('سجل التدقيق الأمني', 'Security Audit Log')}</h1>
          <p>
            {c(
              'سجل غير قابل للتعديل أو الحذف لجميع عمليات الإدارة والتصدير.',
              'Immutable server audit trail of all administrative commands and exports.',
            )}
          </p>
        </div>
      </div>
      <div className="panel bg-white">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
          <Field
            label={c(
              'بحث بالمورد أو العملية أو المعرف',
              'Search resource, action or ID',
            )}
          >
            <input
              className="control"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Field label={c('من تاريخ', 'From date')}>
            <input type="date" className="control" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          </Field>
          <Field label={c('إلى تاريخ', 'To date')}>
            <input type="date" className="control" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          </Field>
        </div>
        <div className="mt-5 space-y-4">
          {!validRange ? (
            <p role="alert" className="text-sm text-red-700">{c('تاريخ النهاية لازم يكون بعد البداية أو في نفس اليوم.', 'End date must be on or after the start date.')}</p>
          ) : auditQuery.isLoading ? (
            <LoadingState />
          ) : auditQuery.error ? (
            <ErrorState
              error={auditQuery.error}
              onRetry={() => void auditQuery.refresh()}
            />
          ) : rows.length ? (
            rows.map((e) => (
              <article key={e.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{e.resource}</Badge>
                  <Badge tone="green">{e.action}</Badge>
                  {e.afterVersion != null && (
                    <span className="font-mono text-xs text-muted-foreground">
                      v{e.beforeVersion ?? 0} → v{e.afterVersion}
                    </span>
                  )}
                </div>
                {e.entityId && (
                  <p
                    dir="ltr"
                    className="my-2 font-mono text-xs text-foreground/80"
                  >
                    {e.entityName
                      ? typeof e.entityName === 'string'
                        ? e.entityName
                        : e.entityName[lang]
                      : e.entityId}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {e.actorId
                      ? `${c('المنفذ', 'Actor')}: ${e.actorName || e.actorId.slice(0, 8) + '…'}`
                      : c('النظام', 'System')}
                  </span>
                  <time>
                    {new Date(e.createdAt).toLocaleString(
                      lang === 'ar' ? 'ar-EG' : 'en-EG',
                      { timeZone: 'Africa/Cairo' },
                    )}
                  </time>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title={c('لا توجد أحداث مطابقة', 'No matching audit entries')}
              description={c(
                'ستظهر جميع التعديلات والإصدارات وعمليات التصدير هنا تلقائيًا.',
                'Administrative changes, publications and exports appear here automatically.',
              )}
            />
          )}
        </div>
        <Pagination
          page={meta.page}
          pages={Math.max(1, meta.totalPages)}
          total={meta.total}
          onChange={setPage}
        />
      </div>
    </>
  )
}
