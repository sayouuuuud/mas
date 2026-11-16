'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  ClipboardList,
  Package,
  Clock3,
  ArrowUpLeft,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'
import { useDemo } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import { useConfirmAction, Pagination } from './frontend-tools'
import { csvDownload } from '@/lib/frontend-model'
import { requestStatuses } from '@/lib/demo-data'

export function StatusBadge({ status }: { status: string }) {
  const c = useCopy()
  const found = requestStatuses.find((s) => s[0] === status)
  return (
    <Badge
      tone={
        status === 'new'
          ? 'gold'
          : status === 'won' || status === 'quoted'
            ? 'green'
            : 'neutral'
      }
    >
      {found ? c(found[1], found[2]) : status}
    </Badge>
  )
}
export function RequestTable({ compact = false }: { compact?: boolean }) {
  const { requests } = useDemo()
  const c = useCopy()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [owner, setOwner] = useState('')
  const [priority, setPriority] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const filtered = requests.filter(
    (r) =>
      (!status || r.status === status) &&
      (!owner || r.owner === owner) &&
      (!priority || r.priority === priority) &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      `${r.id} ${r.company} ${r.name}`.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <>
      {!compact && (
        <div className="mb-5 flex flex-wrap gap-3">
          <label className="grow">
            <span className="sr-only">
              {c('البحث في الطلبات', 'Search requests')}
            </span>
            <input
              className="control"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={c('رقم الطلب أو العميل…', 'Request or customer…')}
            />
          </label>
          <select
            aria-label={c('حالة الطلب', 'Request status')}
            className="control w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{c('كل الحالات', 'All statuses')}</option>
            {requestStatuses.map((s) => (
              <option key={s[0]} value={s[0]}>
                {c(s[1], s[2])}
              </option>
            ))}
          </select>
        </div>
      )}
      {!compact && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label={c('المسؤول', 'Owner')}>
            <select
              className="control"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">{c('الكل', 'All')}</option>
              {Array.from(
                new Set(requests.map((r) => r.owner).filter(Boolean)),
              ).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={c('الأولوية', 'Priority')}>
            <select
              className="control"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">{c('الكل', 'All')}</option>
              {['normal', 'high', 'urgent'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={c('من تاريخ', 'From')}>
            <input
              className="control"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label={c('إلى تاريخ', 'To')}>
            <input
              className="control"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <button
            className="btn-outline self-end"
            onClick={() =>
              csvDownload(
                'demo-requests.csv',
                ['reference', 'company', 'status', 'owner', 'date'],
                filtered.map((r) => [
                  r.id,
                  r.company,
                  r.status,
                  r.owner,
                  r.date,
                ]),
              )
            }
          >
            {c('تصدير النتائج', 'Export results')}
          </button>
        </div>
      )}
      {filtered.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={c(
            'جدول قابل للتمرير أفقيًا',
            'Horizontally scrollable table',
          )}
        >
          <table className="data-table">
            <thead>
              <tr>
                {[
                  c('الطلب', 'Request'),
                  c('العميل', 'Customer'),
                  c('الحالة', 'Status'),
                  c('المسؤول', 'Owner'),
                  c('البنود', 'Items'),
                  c('التاريخ', 'Date'),
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(
                  compact
                    ? 0
                    : (Math.min(
                        page,
                        Math.max(1, Math.ceil(filtered.length / 8)),
                      ) -
                        1) *
                        8,
                  compact
                    ? 5
                    : Math.min(
                        page,
                        Math.max(1, Math.ceil(filtered.length / 8)),
                      ) * 8,
                )
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/admin/quote-requests/${r.id}`}
                        className="font-mono text-sm font-bold text-primary"
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td>
                      <span className="font-semibold">{r.company}</span>
                      <p className="text-xs text-muted-foreground">{r.name}</p>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.owner || c('غير مسند', 'Unassigned')}</td>
                    <td>{r.items.length}</td>
                    <td>
                      <time dateTime={r.date}>{r.date}</time>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={c('لا توجد طلبات مطابقة', 'No matching requests')}
          description={c(
            'جرّب مسح البحث أو تغيير الحالة.',
            'Clear the search or change the status.',
          )}
        />
      )}
      {!compact && (
        <Pagination
          total={filtered.length}
          pages={Math.max(1, Math.ceil(filtered.length / 8))}
          page={Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))}
          onChange={setPage}
        />
      )}
    </>
  )
}
export function Dashboard() {
  const { requests, products } = useDemo()
  const c = useCopy()
  const stats = [
    {
      title: c('طلبات المعاينة', 'Sample requests'),
      value: requests.length,
      icon: ClipboardList,
      sub: c('بيانات صناعية للتجربة', 'Synthetic preview data'),
    },
    {
      title: c('طلبات جديدة', 'New requests'),
      value: requests.filter((r) => r.status === 'new').length,
      icon: Clock3,
      sub: c('بانتظار الإسناد', 'Awaiting assignment'),
    },
    {
      title: c('المنتجات المنشورة', 'Published products'),
      value: products.filter((p) => p.status === 'published').length,
      icon: Package,
      sub: c('داخل المعاينة فقط', 'Within the preview only'),
    },
  ]
  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="eyebrow">M.A.S WORKSPACE</p>
          <h1>{c('أهلًا بك في مساحة العمل', 'Welcome to your workspace')}</h1>
          <p>
            {c(
              'نظرة منظمة على الكتالوج ومتابعة الاستفسارات.',
              'A clear view of your catalog and customer inquiries.',
            )}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn-primary">
          <Plus className="size-4" />
          {c('إضافة منتج', 'Add product')}
        </Link>
      </div>
      <div className="mb-8 grid gap-5 md:grid-cols-3">
        {stats.map((s) => (
          <article className="panel bg-white" key={s.title}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.title}</p>
              <s.icon className="size-5 text-primary" />
            </div>
            <strong className="my-5 block text-4xl font-bold">{s.value}</strong>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </article>
        ))}
      </div>
      <section className="panel bg-white">
        <div className="mb-6 flex justify-between gap-4">
          <h2 className="text-xl font-bold">
            {c('طلبات عروض الأسعار', 'Quote requests')}
          </h2>
          <Link href="/admin/quote-requests" className="text-sm text-primary">
            {c('عرض الكل', 'View all')}
          </Link>
        </div>
        <RequestTable compact />
      </section>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Link
          className="panel flex items-center justify-between bg-foreground text-white"
          href="/admin/products"
        >
          <div>
            <h2 className="font-bold">
              {c('كتالوج مرتب، تفاصيل أوضح', 'An organized catalog')}
            </h2>
            <p className="mt-2 text-sm text-white/65">
              {c(
                'راجع المواصفات والعبوات والصور.',
                'Review specifications, packs and imagery.',
              )}
            </p>
          </div>
          <ArrowUpLeft className="size-6" />
        </Link>
        <div className="panel bg-white">
          <h2 className="font-bold">
            {c('ملاحظات التشغيل', 'Operating notes')}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {c(
              'لا توجد إشعارات أو طلبات حقيقية في هذه المرحلة. كل مؤشرات اللوحة مشتقة من بيانات المعاينة.',
              'No real notifications or requests are connected. Dashboard metrics come from preview data.',
            )}
          </p>
        </div>
      </div>
    </>
  )
}
export function RequestsPage({ id }: { id?: string }) {
  const {
    requests,
    setRequests,
    products,
    resources,
    recordActivity,
    quotations,
  } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const { confirm, confirmation } = useConfirmAction()
  const request = requests.find((r) => r.id === id)
  if (!id)
    return (
      <>
        <div className="admin-heading">
          <div>
            <h1>{c('طلبات عروض الأسعار', 'Quote requests')}</h1>
            <p>
              {c(
                'متابعة وإسناد وحالات وتجهيز عروض محلية.',
                'Local tracking, assignment, status and quotations.',
              )}
            </p>
          </div>
          <Link className="btn-primary" href="/request-quote">
            {c('تجربة طلب جديد من الموقع', 'Try a new public request')}
          </Link>
        </div>
        <section className="panel bg-white">
          <RequestTable />
        </section>
      </>
    )
  if (!request)
    return (
      <EmptyState
        title={c('الطلب غير موجود', 'Request not found')}
        description={c(
          'قد تكون بيانات المعاينة عادت للأصل بعد التحديث.',
          'Preview data may have reset after a reload.',
        )}
      />
    )
  const event = (
    patch: Partial<typeof request>,
    action: string,
    text: string,
  ) => {
    setRequests((all) =>
      all.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              events: [
                ...(r.events || []),
                {
                  id: crypto.randomUUID(),
                  at: new Date().toISOString(),
                  action,
                  text,
                },
              ],
            }
          : r,
      ),
    )
    recordActivity(action, id!)
    setMessage(c('تم تحديث المعاينة المحلية.', 'Local preview updated.'))
  }
  const allowed: Record<string, string[]> = {
    new: ['assigned', 'cancelled', 'lost'],
    assigned: ['in_progress', 'cancelled', 'lost'],
    in_progress: ['awaiting_customer', 'quoted', 'cancelled', 'lost'],
    awaiting_customer: ['in_progress', 'quoted', 'cancelled', 'lost'],
    quoted: ['in_progress', 'won', 'lost', 'cancelled'],
    won: ['in_progress'],
    lost: ['in_progress'],
    cancelled: ['in_progress'],
  }
  const changeStatus = (next: string) => {
    if (!allowed[request.status]?.includes(next)) {
      setMessage(
        c('هذا الانتقال غير مسموح.', 'This transition is not allowed.'),
      )
      return
    }
    if (next === 'assigned' && !request.owner) {
      setMessage(c('اختر المسؤول أولًا.', 'Assign an owner first.'))
      return
    }
    if (
      next === 'quoted' &&
      !quotations.some(
        (q) => q.requestId === id && ['sent', 'accepted'].includes(q.state),
      )
    ) {
      setMessage(
        c(
          'جهّز عرضًا وسجّل التواصل التجريبي قبل حالة تم العرض.',
          'Prepare a quotation and record sample delivery first.',
        ),
      )
      return
    }
    if (
      (['lost', 'cancelled', 'won'].includes(next) ||
        ['won', 'lost', 'cancelled'].includes(request.status)) &&
      !reason.trim()
    ) {
      setMessage(
        c(
          'أضف سبب الإغلاق أو مرجع الموافقة أو إعادة الفتح.',
          'Add a close reason, acceptance reference or reopening reason.',
        ),
      )
      return
    }
    confirm(
      c('تطبيق تغيير الحالة محليًا؟', 'Apply this status change locally?'),
      () =>
        event(
          { status: next, closeReason: reason },
          'request.status',
          `${request.status} → ${next}: ${reason}`,
        ),
    )
  }
  return (
    <>
      {confirmation}
      <div className="admin-heading">
        <div>
          <Link href="/admin/quote-requests" className="text-sm text-primary">
            {c('كل الطلبات', 'All requests')}
          </Link>
          <h1 className="font-mono">{request.id}</h1>
          <p>
            {request.company} · {request.date}
          </p>
        </div>
        <Link href={`/admin/quotations/${request.id}`} className="btn-primary">
          {c('تجهيز عرض سعر', 'Prepare quotation')}
        </Link>
      </div>
      <p role="status" className="mb-4 text-sm text-primary">
        {message}
      </p>
      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="panel bg-white">
            <h2 className="mb-5 text-xl font-bold">
              {c('بنود الطلب', 'Request items')}
            </h2>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{c('المنتج / الوصف', 'Product / description')}</th>
                    <th>SKU</th>
                    <th>{c('الكمية والوحدة', 'Quantity & unit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item, i) => {
                    const p = products.find((p) =>
                      p.variants.some((v) => v.id === item.variantId),
                    )
                    const v = p?.variants.find((v) => v.id === item.variantId)
                    return (
                      <tr key={i}>
                        <td>
                          {item.snapshot?.name[lang] ||
                            p?.name[lang] ||
                            item.description ||
                            c('بند حر', 'Custom item')}
                          <p className="text-xs text-muted-foreground">
                            {item.snapshot?.label[lang] || v?.label[lang]}
                          </p>
                        </td>
                        <td>{item.snapshot?.sku || v?.sku || '—'}</td>
                        <td>
                          {item.quantity}{' '}
                          {item.snapshot?.unit[lang] ||
                            v?.unit[lang] ||
                            item.unit}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel bg-white">
            <h2 className="mb-5 text-xl font-bold">
              {c('الملاحظات وسجل التواصل', 'Notes & contact history')}
            </h2>
            <ul className="mb-5 space-y-3">
              {request.notes.map((n, i) => (
                <li key={i} className="rounded-lg bg-muted p-4 text-sm">
                  {n}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (note.trim()) {
                  event(
                    { notes: [...request.notes, note.trim()] },
                    'request.note',
                    'تمت إضافة ملاحظة محلية / Local note added',
                  )
                  setNote('')
                }
              }}
            >
              <Field label={c('ملاحظة داخلية تجريبية', 'Sample internal note')}>
                <textarea
                  className="control"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={2000}
                  required
                  rows={3}
                />
              </Field>
              <button className="btn-outline mt-3">
                {c('إضافة للمعاينة', 'Add to preview')}
              </button>
            </form>
            <ol className="mt-6 space-y-3 border-t pt-5">
              {(request.events || [])
                .slice()
                .reverse()
                .map((e) => (
                  <li
                    key={e.id}
                    className="border-s-2 border-primary ps-4 text-sm"
                  >
                    <p className="font-semibold">{e.action}</p>
                    <p className="my-1 text-muted-foreground">{e.text}</p>
                    <time className="text-xs">
                      {new Date(e.at).toLocaleString(
                        lang === 'ar' ? 'ar-EG' : 'en-EG',
                        { timeZone: 'Africa/Cairo' },
                      )}
                    </time>
                  </li>
                ))}
            </ol>
          </section>
          <section className="panel bg-white">
            <h2 className="mb-4 font-bold">
              {c('عروض الطلب', 'Request quotations')}
            </h2>
            {quotations
              .filter((q) => q.requestId === id)
              .map((q) => (
                <Link
                  className="mb-2 flex justify-between rounded-lg border p-3 text-sm text-primary"
                  href={`/admin/quotations/${q.id}`}
                  key={q.id}
                >
                  <span>
                    {q.id} R{q.revision}
                  </span>
                  <span>{q.state}</span>
                </Link>
              ))}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="panel bg-white">
            <h2 className="mb-4 font-bold">
              {c('بيانات العميل', 'Customer details')}
            </h2>
            <p>{request.name}</p>
            {request.phone && (
              <p dir="ltr" className="mt-3 text-sm">
                {request.phone}
              </p>
            )}
            {request.email && (
              <p dir="ltr" className="mt-2 text-sm">
                {request.email}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {request.company}
            </p>
            <div className="mt-5">
              <Field label={c('ربط بعميل موجود', 'Link existing customer')}>
                <select
                  className="control"
                  value={request.customerId || ''}
                  onChange={(e) =>
                    event(
                      { customerId: e.target.value },
                      'request.customer',
                      'Customer link updated',
                    )
                  }
                >
                  <option value="">
                    {c('بدون ربط', 'No linked customer')}
                  </option>
                  {resources.customers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameAr} · {r.organization}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section className="panel space-y-5 bg-white">
            <StatusBadge status={request.status} />
            <Field label={c('المسؤول عن المتابعة', 'Assigned owner')}>
              <select
                className="control"
                value={request.owner}
                onChange={(e) => {
                  const owner = e.target.value
                  event(
                    {
                      owner,
                      ...(request.status === 'new' && owner
                        ? { status: 'assigned' }
                        : {}),
                    },
                    'request.assignment',
                    owner || 'Unassigned',
                  )
                }}
              >
                <option value="">{c('غير مسند', 'Unassigned')}</option>
                <option value="موظف المبيعات">
                  {c('موظف المبيعات التجريبي', 'Sample sales agent')}
                </option>
                {resources.team
                  .filter((r) => r.status !== 'inactive')
                  .map((r) => (
                    <option key={r.id} value={r.nameAr}>
                      {r.nameAr} · {r.role}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={c('الأولوية', 'Priority')}>
              <select
                className="control"
                value={request.priority}
                onChange={(e) =>
                  event(
                    { priority: e.target.value },
                    'request.priority',
                    e.target.value,
                  )
                }
              >
                <option value="normal">{c('عادية', 'Normal')}</option>
                <option value="high">{c('عالية', 'High')}</option>
                <option value="urgent">{c('عاجلة', 'Urgent')}</option>
              </select>
            </Field>
            <Field label={c('موعد المتابعة التالي', 'Next follow-up')}>
              <input
                className="control"
                type="datetime-local"
                value={request.followUpAt || ''}
                onChange={(e) =>
                  event(
                    { followUpAt: e.target.value },
                    'request.follow_up',
                    e.target.value,
                  )
                }
              />
            </Field>
            <Field
              label={c(
                'سبب الإغلاق / مرجع الموافقة',
                'Close reason / approval reference',
              )}
            >
              <textarea
                className="control"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
            </Field>
            <Field label={c('الانتقال إلى حالة', 'Move to status')}>
              <select
                className="control"
                value=""
                onChange={(e) => e.target.value && changeStatus(e.target.value)}
              >
                <option value="">{c('اختر إجراء…', 'Choose action…')}</option>
                {requestStatuses
                  .filter((s) => allowed[request.status]?.includes(s[0]))
                  .map((s) => (
                    <option key={s[0]} value={s[0]}>
                      {c(s[1], s[2])}
                    </option>
                  ))}
              </select>
            </Field>
            {request.closeReason && (
              <p className="text-sm text-muted-foreground">
                {request.closeReason}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
