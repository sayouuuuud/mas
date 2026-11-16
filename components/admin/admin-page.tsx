'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useDemo } from '@/components/demo/demo-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import { AdminLogin, AdminShell } from './admin-shell'
import { ProductWorkspace } from './products-workspace'
import { Dashboard, RequestsPage } from './sales-workspace'
import { QuotationsWorkspace } from './quotations-workspace'
import {
  MediaWorkspace,
  ResourceWorkspace,
  SettingsWorkspace,
} from './resources'

export function AdminPage({ path }: { path: string[] }) {
  const [section, id] = path
  if (section === 'login' || section === 'reset-password')
    return <AdminLogin reset={section === 'reset-password'} />
  let body
  if (!section) body = <Dashboard />
  else if (section === 'products') body = <ProductWorkspace id={id} />
  else if (section === 'quote-requests') body = <RequestsPage id={id} />
  else if (section === 'quotations') body = <QuotationsWorkspace id={id} />
  else if (section === 'media') body = <MediaWorkspace />
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
  const { requests, products } = useDemo()
  const c = useCopy()
  const [from, setFrom] = useState('2026-11-01')
  const [to, setTo] = useState('2026-11-30')
  const [message, setMessage] = useState('')
  const valid = !from || !to || from <= to
  const filtered = valid
    ? requests.filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    : []
  function download() {
    const csv = [
      'reference,status,date',
      ...filtered.map((r) => `${r.id},${r.status},${r.date}`),
    ].join('\n')
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'mas-demo-requests.csv'
    a.click()
    URL.revokeObjectURL(url)
    setMessage(
      c(
        'تم تنزيل بيانات الطلبات التجريبية فقط.',
        'Downloaded sample request data only.',
      ),
    )
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('تقارير المعاينة', 'Preview reports')}</h1>
          <p>
            {c(
              'أرقام مشتقة من البيانات التجريبية، وليست أداء أعمال فعليًا.',
              'Metrics derived from sample data, not actual business performance.',
            )}
          </p>
        </div>
        <button
          className="btn-outline"
          disabled={!valid || !filtered.length}
          onClick={download}
        >
          {c('تنزيل CSV تجريبي', 'Download sample CSV')}
        </button>
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
      {!valid && (
        <p role="alert" className="mb-5 text-red-700">
          {c(
            'تاريخ النهاية يجب ألا يسبق البداية.',
            'End date must not precede start date.',
          )}
        </p>
      )}
      <p role="status" className="mb-4 text-primary">
        {message}
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          [c('الطلبات خلال الفترة', 'Requests in period'), filtered.length],
          [
            c('منتجات الكتالوج التجريبي', 'Sample catalog products'),
            products.length,
          ],
          [
            c('طلبات مجهّز لها عرض', 'Requests marked quoted'),
            filtered.filter((r) => r.status === 'quoted').length,
          ],
        ].map(([label, value]) => (
          <div className="panel bg-white" key={label}>
            <h2 className="text-sm text-muted-foreground">{label}</h2>
            <strong className="mt-5 block text-4xl">{value}</strong>
          </div>
        ))}
      </div>
      <section className="panel mt-6 bg-white">
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
          const count = filtered.filter((r) => r.status === status).length
          return (
            <div className="mb-5" key={status}>
              <div className="mb-2 flex justify-between text-sm">
                <span>{status}</span>
                <span>{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${filtered.length ? (count / filtered.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </section>
    </>
  )
}
function ActivityLog() {
  const { audit } = useDemo()
  const c = useCopy()
  const [q, setQ] = useState('')
  const rows = audit.filter((e) =>
    `${e.action} ${e.entity}`.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('سجل نشاط المعاينة', 'Preview activity log')}</h1>
          <p>
            {c(
              'أحداث التعديلات المحلية لهذه الجلسة، وليست سجل تدقيق مؤمّنًا.',
              'Local session activity, not a secured audit trail.',
            )}
          </p>
        </div>
      </div>
      <div className="panel bg-white">
        <Field label={c('بحث بالنوع أو المعرف', 'Search action or identifier')}>
          <input
            className="control"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <div className="mt-5 space-y-4">
          {rows.length ? (
            rows.map((e) => (
              <article key={e.id} className="rounded-lg border p-4">
                <Badge>{e.action}</Badge>
                <p className="my-2 font-mono text-sm">{e.entity}</p>
                <time className="text-xs text-muted-foreground">
                  {new Date(e.at).toLocaleString('ar-EG', {
                    timeZone: 'Africa/Cairo',
                  })}
                </time>
              </article>
            ))
          ) : (
            <EmptyState
              title={c('لا توجد أحداث مطابقة', 'No matching activity')}
              description={c(
                'جرّب تعديل منتج أو طلب لتظهر أنشطتك هنا.',
                'Edit a product or request to see session activity here.',
              )}
            />
          )}
        </div>
      </div>
    </>
  )
}
