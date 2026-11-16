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
  const filtered = requests.filter(
    (r) =>
      (!status || r.status === status) &&
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
              {filtered.map((r) => (
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
  const { requests, setRequests, products } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const request = requests.find((r) => r.id === id)
  if (!id)
    return (
      <>
        <div className="admin-heading">
          <div>
            <h1>{c('طلبات عروض الأسعار', 'Quote requests')}</h1>
            <p>
              {c(
                'صندوق متابعة المبيعات — بيانات تجريبية فقط.',
                'Sales inbox — sample data only.',
              )}
            </p>
          </div>
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
          'اختر طلبًا من القائمة التجريبية.',
          'Choose a request from the sample list.',
        )}
      />
    )
  const update = (patch: Partial<typeof request>) => {
    setRequests((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setMessage(
      c('تم تحديث المعاينة المؤقتة فقط.', 'Temporary preview updated only.'),
    )
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <Link
            href="/admin/quote-requests"
            className="mb-2 block text-sm text-primary"
          >
            {c('كل الطلبات', 'All requests')}
          </Link>
          <h1 className="font-mono">{request.id}</h1>
          <p>
            {request.company} — {request.date}
          </p>
        </div>
        <Link className="btn-primary" href={`/admin/quotations/${request.id}`}>
          {c('تجهيز عرض سعر تجريبي', 'Prepare sample quotation')}
        </Link>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <section className="panel bg-white">
            <h2 className="mb-5 text-xl font-bold">
              {c('بنود الطلب', 'Request items')}
            </h2>
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
                    <th>{c('المنتج', 'Product')}</th>
                    <th>SKU</th>
                    <th>{c('الكمية', 'Quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item) => {
                    const product = products.find((p) =>
                      p.variants.some((v) => v.id === item.variantId),
                    )
                    const variant = product?.variants.find(
                      (v) => v.id === item.variantId,
                    )
                    return (
                      <tr key={item.variantId}>
                        <td>
                          {product?.name[lang]}
                          <p className="text-xs text-muted-foreground">
                            {variant?.label[lang]}
                          </p>
                        </td>
                        <td className="font-mono text-xs">{variant?.sku}</td>
                        <td>
                          {item.quantity} {variant?.unit[lang]}
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
              {c('ملاحظات المتابعة', 'Follow-up notes')}
            </h2>
            {request.notes.length ? (
              <ul className="mb-5 space-y-3">
                {request.notes.map((n, i) => (
                  <li
                    className="rounded-lg border-s-2 border-primary bg-muted p-4 text-sm"
                    key={i}
                  >
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-muted-foreground">
                {c('لا توجد ملاحظات بعد.', 'No notes yet.')}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (note.trim()) {
                  update({ notes: [...request.notes, note.trim()] })
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
          </section>
        </div>
        <aside className="space-y-5">
          <div className="panel bg-white">
            <h2 className="mb-5 font-bold">
              {c('بيانات العميل', 'Customer details')}
            </h2>
            <p>{request.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {request.company}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              {c(
                'لا توجد بيانات تواصل حقيقية في المعاينة.',
                'No real contact details are included in this preview.',
              )}
            </p>
          </div>
          <div className="panel space-y-5 bg-white">
            <Field label={c('الحالة التجريبية', 'Preview status')}>
              <select
                className="control"
                value={request.status}
                onChange={(e) => update({ status: e.target.value })}
              >
                {requestStatuses.map((s) => (
                  <option key={s[0]} value={s[0]}>
                    {c(s[1], s[2])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={c('مسؤول المتابعة', 'Assigned owner')}>
              <select
                className="control"
                value={request.owner}
                onChange={(e) => update({ owner: e.target.value })}
              >
                <option value="">{c('غير مسند', 'Unassigned')}</option>
                <option value="موظف المبيعات">
                  {c('موظف المبيعات', 'Sales agent')}
                </option>
                <option value="مدير المبيعات">
                  {c('مدير المبيعات', 'Sales manager')}
                </option>
              </select>
            </Field>
            <Field label={c('الأولوية', 'Priority')}>
              <select
                className="control"
                value={request.priority}
                onChange={(e) => update({ priority: e.target.value })}
              >
                <option value="normal">{c('عادية', 'Normal')}</option>
                <option value="high">{c('مرتفعة', 'High')}</option>
              </select>
            </Field>
            <p role="status" className="text-sm text-primary">
              {message}
            </p>
            <p className="text-xs leading-6 text-muted-foreground">
              {c(
                'التنقل بين الحالات هنا لاستعراض الواجهة فقط؛ صلاحيات وقواعد دورة العمل تُنفّذ في مرحلة الباك إند.',
                'Status changes demonstrate the interface only. Authorization and workflow rules belong to the backend phase.',
              )}
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}

type QuoteLine = {
  id: number
  description: string
  quantity: number
  price: string
  discount: string
  tax: string
}
export function QuotationPreview({ id }: { id: string }) {
  const { requests, products } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()
  const request = requests.find((r) => r.id === id)
  const [lines, setLines] = useState<QuoteLine[]>(() =>
    (request?.items || []).map((item, i) => ({
      id: i,
      description:
        products.find((p) => p.variants.some((v) => v.id === item.variantId))
          ?.name[lang] || '',
      quantity: item.quantity,
      price: '',
      discount: '0',
      tax: '0',
    })),
  )
  const [message, setMessage] = useState('')
  const [terms, setTerms] = useState('')
  if (!request)
    return (
      <EmptyState
        title={c('العرض غير موجود', 'Quotation not found')}
        description={c(
          'ابدأ من تفاصيل طلب تجريبي.',
          'Start from a sample request.',
        )}
      />
    )
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  const calculated = lines.map((l) => {
    const gross = round(l.quantity * Number(l.price))
    const net = round(Math.max(0, gross - Number(l.discount)))
    const tax = round((net * Number(l.tax)) / 100)
    return { ...l, gross, net, taxAmount: tax, total: round(net + tax) }
  })
  const invalid =
    !lines.length ||
    lines.some(
      (l) =>
        !l.description.trim() ||
        !Number.isInteger(l.quantity) ||
        l.quantity <= 0 ||
        l.price === '' ||
        !Number.isFinite(Number(l.price)) ||
        Number(l.price) < 0 ||
        !Number.isFinite(Number(l.discount)) ||
        Number(l.discount) < 0 ||
        Number(l.discount) > l.quantity * Number(l.price) ||
        !Number.isFinite(Number(l.tax)) ||
        Number(l.tax) < 0 ||
        Number(l.tax) > 100,
    )
  const money = (n: number) =>
    new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(n)
  const update = (id: number, patch: Partial<QuoteLine>) =>
    setLines((all) => all.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('معاينة عرض سعر', 'Quotation preview')}</h1>
          <p>
            {request.id} — {request.company}
          </p>
        </div>
        <button
          className="btn-outline"
          disabled={invalid}
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          {c('طباعة المعاينة', 'Print preview')}
        </button>
      </div>
      <div className="panel space-y-6 bg-white">
        <Badge tone="gold">
          {c(
            'مسودة تجريبية — غير صالحة للتعاقد',
            'Sample draft — not a commercial offer',
          )}
        </Badge>
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
                  c('البند', 'Item'),
                  c('الكمية', 'Quantity'),
                  c('السعر EGP', 'Price EGP'),
                  c('خصم EGP', 'Discount EGP'),
                  c('ضريبة %', 'Tax %'),
                  c('الإجمالي', 'Total'),
                  '',
                ].map((x, i) => (
                  <th key={i}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calculated.map((l) => (
                <tr key={l.id}>
                  <td>
                    <input
                      className="control min-w-48"
                      aria-label={c('وصف البند', 'Item description')}
                      value={l.description}
                      onChange={(e) =>
                        update(l.id, { description: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="control min-w-20"
                      aria-label={c('كمية البند', 'Item quantity')}
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        update(l.id, { quantity: e.target.valueAsNumber })
                      }
                    />
                  </td>
                  {(['price', 'discount', 'tax'] as const).map((key) => (
                    <td key={key}>
                      <input
                        className="control min-w-24"
                        type="number"
                        aria-label={c(
                          key === 'price'
                            ? 'سعر الوحدة'
                            : key === 'discount'
                              ? 'خصم البند'
                              : 'نسبة الضريبة',
                          key,
                        )}
                        min={0}
                        max={key === 'tax' ? 100 : undefined}
                        step="0.01"
                        value={l[key]}
                        onChange={(e) =>
                          update(l.id, { [key]: e.target.value })
                        }
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap">
                    {Number.isFinite(l.total) ? money(l.total) : '—'}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={c('حذف البند', 'Remove item')}
                      onClick={() =>
                        setLines((all) => all.filter((x) => x.id !== l.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          className="btn-outline"
          onClick={() =>
            setLines((all) => [
              ...all,
              {
                id: Date.now(),
                description: '',
                quantity: 1,
                price: '',
                discount: '0',
                tax: '0',
              },
            ])
          }
        >
          <Plus className="size-4" />
          {c('إضافة بند', 'Add item')}
        </button>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label={c('الشروط ومهلة التوريد', 'Terms and lead time')}>
            <textarea
              className="control"
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              maxLength={2000}
            />
          </Field>
          <dl className="space-y-3 rounded-xl bg-muted p-5">
            <div className="flex justify-between gap-4">
              <dt>{c('الصافي', 'Net')}</dt>
              <dd>
                {money(
                  calculated.reduce(
                    (s, l) => s + (Number.isFinite(l.net) ? l.net : 0),
                    0,
                  ),
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{c('الضريبة', 'Tax')}</dt>
              <dd>
                {money(
                  calculated.reduce(
                    (s, l) =>
                      s + (Number.isFinite(l.taxAmount) ? l.taxAmount : 0),
                    0,
                  ),
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3 font-bold">
              <dt>{c('الإجمالي التجريبي', 'Preview total')}</dt>
              <dd>
                {money(
                  calculated.reduce(
                    (s, l) => s + (Number.isFinite(l.total) ? l.total : 0),
                    0,
                  ),
                )}
              </dd>
            </div>
          </dl>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          {c(
            'الحسابات للعرض فقط وليست محرك تسعير معتمدًا. لم يُصدر PDF أو رقم عرض رسمي، ولم تُرسل بيانات لأي جهة.',
            'Calculations are illustrative, not an approved pricing engine. No PDF or official quotation number has been issued and nothing has been sent.',
          )}
        </p>
        <button
          className="btn-primary"
          disabled={invalid}
          onClick={() =>
            setMessage(
              c(
                'المعاينة جاهزة داخل المتصفح فقط؛ الإصدار والحفظ والإرسال غير مفعّلين.',
                'Preview ready in this browser only; issuing, saving and sending are not connected.',
              ),
            )
          }
        >
          {c('مراجعة المسودة التجريبية', 'Review sample draft')}
        </button>
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
        {invalid && (
          <p className="text-sm text-muted-foreground">
            {c(
              'أكمل الأسعار والكميات والأوصاف، وتأكد أن الخصم لا يتجاوز قيمة البند.',
              'Complete prices, quantities and descriptions; discounts must not exceed the line value.',
            )}
          </p>
        )}
      </div>
    </>
  )
}
