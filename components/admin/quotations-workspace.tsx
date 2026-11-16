'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Printer, Trash2, Copy, FileCheck2 } from 'lucide-react'
import { useDemo } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import {
  Pagination,
  useConfirmAction,
  useUnsavedChanges,
} from './frontend-tools'
import {
  quoteTotals,
  type PreviewQuotation,
  type QuoteLine,
} from '@/lib/frontend-model'

export function QuotationsWorkspace({ id }: { id?: string }) {
  const { quotations, requests } = useDemo()
  const c = useCopy()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  if (id) return <QuotationEditor key={id} id={id} />
  const rows = quotations.filter(
    (qt) =>
      (!status || qt.state === status) &&
      `${qt.id} ${qt.requestId}`.toLowerCase().includes(q.toLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(rows.length / 8))
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('عروض الأسعار', 'Quotations')}</h1>
          <p>
            {c(
              'مسودات وإصدارات ومراجعات محلية. لا إرسال أو PDF رسمي.',
              'Local drafts, issues and revisions. No external sending or official PDFs.',
            )}
          </p>
        </div>
        <label className="form-field">
          <span>{c('ابدأ من طلب', 'Start from a request')}</span>
          <select
            className="control"
            value=""
            onChange={(e) =>
              e.target.value &&
              router.push(`/admin/quotations/${e.target.value}`)
            }
          >
            <option value="">{c('اختر طلبًا…', 'Choose a request…')}</option>
            {requests.map((r) => (
              <option value={r.id} key={r.id}>
                {r.id} · {r.company}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel bg-white">
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            className="control flex-1"
            aria-label={c('بحث العروض', 'Search quotations')}
            placeholder={c(
              'بحث برقم العرض أو الطلب',
              'Search quotation or request',
            )}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="control w-auto"
            aria-label={c('حالة العرض', 'Quotation status')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{c('كل الحالات', 'All statuses')}</option>
            {[
              'draft',
              'issued',
              'sent',
              'accepted',
              'rejected',
              'expired',
              'superseded',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{c('العرض', 'Quotation')}</th>
                  <th>{c('الطلب', 'Request')}</th>
                  <th>{c('المراجعة', 'Revision')}</th>
                  <th>{c('الحالة', 'Status')}</th>
                  <th>{c('الصلاحية', 'Valid until')}</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice(
                    (Math.min(page, pages) - 1) * 8,
                    Math.min(page, pages) * 8,
                  )
                  .map((qt) => (
                    <tr key={qt.id}>
                      <td>
                        <Link
                          className="text-primary underline"
                          href={`/admin/quotations/${qt.id}`}
                        >
                          {qt.id}
                        </Link>
                      </td>
                      <td>{qt.requestId}</td>
                      <td>R{qt.revision}</td>
                      <td>
                        <Badge>{qt.state}</Badge>
                      </td>
                      <td>{qt.validUntil}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={c('لا توجد عروض مطابقة', 'No matching quotations')}
            description={c(
              'ابدأ بمراجعة أحد الطلبات وتجهيز مسودة.',
              'Start by selecting a request to prepare a draft.',
            )}
          />
        )}
        <Pagination
          total={rows.length}
          pages={pages}
          page={Math.min(page, pages)}
          onChange={setPage}
        />
      </section>
    </>
  )
}
function QuotationEditor({ id }: { id: string }) {
  const {
    quotations,
    setQuotations,
    requests,
    setRequests,
    products,
    recordActivity,
    resources,
  } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()
  const router = useRouter()
  const existing =
    quotations.find((q) => q.id === id) ||
    quotations.find((q) => q.requestId === id && q.state === 'draft') ||
    [...quotations].reverse().find((q) => q.requestId === id)
  const request = requests.find((r) => r.id === (existing?.requestId || id))
  const [draft, setDraft] = useState<PreviewQuotation>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: `DEMO-Q-${id.replace(/^DEMO-RFQ-/, '')}-1`,
          requestId: id,
          revision: 1,
          state: 'draft',
          locale: lang,
          currency: 'EGP',
          validUntil: new Date(Date.now() + 7 * 86400000)
            .toISOString()
            .slice(0, 10),
          leadTime: '',
          terms: '',
          createdAt: new Date().toISOString(),
          lines: (request?.items || []).map((item, i) => {
            const p = products.find((p) =>
              p.variants.some((v) => v.id === item.variantId),
            )
            const v = p?.variants.find((v) => v.id === item.variantId)
            return {
              id: String(i),
              description:
                item.snapshot?.name[lang] ||
                p?.name[lang] ||
                item.description ||
                '',
              sku: item.snapshot?.sku || v?.sku || '',
              quantity: item.quantity,
              unit: item.snapshot?.unit.en || v?.unit.en || item.unit || 'pack',
              price: '',
              discount: '0',
              tax: '0',
            }
          }),
        },
  )
  const [baseline, setBaseline] = useState(JSON.stringify(draft))
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState('email')
  const [reason, setReason] = useState('')
  const { confirm, confirmation } = useConfirmAction()
  useUnsavedChanges(
    draft.state === 'draft' && JSON.stringify(draft) !== baseline,
  )
  if (!request)
    return (
      <EmptyState
        title={c('الطلب غير موجود', 'Request not found')}
        description={c(
          'ابدأ من قائمة الطلبات في هذه المعاينة.',
          'Choose a request from this preview.',
        )}
      >
        <Link href="/admin/quote-requests" className="btn-outline">
          {c('الطلبات', 'Requests')}
        </Link>
      </EmptyState>
    )
  const totals = quoteTotals(draft.lines)
  const frozen = draft.state !== 'draft'
  const expired = draft.validUntil < new Date().toISOString().slice(0, 10)
  const money = (cents: number) =>
    new Intl.NumberFormat(draft.locale === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: draft.currency,
    }).format(cents / 100)
  const updateLine = (id: string, patch: Partial<QuoteLine>) =>
    setDraft((q) => ({
      ...q,
      lines: q.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  function persist(next: PreviewQuotation, action: string) {
    setQuotations((all) =>
      all.some((q) => q.id === next.id)
        ? all.map((q) => (q.id === next.id ? structuredClone(next) : q))
        : [...all, structuredClone(next)],
    )
    setDraft(next)
    setBaseline(JSON.stringify(next))
    recordActivity(action, next.id)
    setMessage(
      c(
        'تم تطبيق الإجراء في المعاينة المحلية فقط.',
        'Applied to the local preview only.',
      ),
    )
  }
  function issue() {
    if (
      !totals.valid ||
      expired ||
      !draft.terms.trim() ||
      !draft.leadTime.trim()
    ) {
      setMessage(
        c(
          'راجع البنود والشروط ومدة التوريد والصلاحية قبل الإصدار.',
          'Check items, terms, lead time and validity before issuing.',
        ),
      )
      return
    }
    confirm(
      c(
        'تثبيت نسخة تجريبية غير قابلة للتحرير؟ لا يصدر مستند رسمي.',
        'Freeze a read-only sample revision? No official document is issued.',
      ),
      () => {
        setQuotations((all) =>
          all.map((q) =>
            q.requestId === request!.id &&
            q.state !== 'draft' &&
            q.id !== draft.id
              ? { ...q, state: 'superseded' }
              : q,
          ),
        )
        persist({ ...draft, state: 'issued' }, 'quotation.issued')
      },
    )
  }
  const transition = (state: PreviewQuotation['state']) => {
    if (
      ['accepted', 'rejected'].includes(state) &&
      (!reason.trim() || expired)
    ) {
      setMessage(
        c(
          'أضف سببًا/مرجع الموافقة؛ لا تقبل عرضًا منتهيًا.',
          'Add a response note; expired quotations cannot be accepted.',
        ),
      )
      return
    }
    if (state === 'sent' && !channel) {
      setMessage(
        c('اختر قناة الإرسال المسجل.', 'Choose the recorded delivery channel.'),
      )
      return
    }
    confirm(
      c('تسجيل هذا التغيير محليًا فقط؟', 'Record this change locally only?'),
      () => {
        persist(
          {
            ...draft,
            state,
            channel,
            sentAt: state === 'sent' ? new Date().toISOString() : draft.sentAt,
          },
          `quotation.${state}`,
        )
        if (state === 'sent')
          setRequests((all) =>
            all.map((r) =>
              r.id === request!.id
                ? {
                    ...r,
                    status: 'quoted',
                    events: [
                      ...(r.events || []),
                      {
                        id: crypto.randomUUID(),
                        at: new Date().toISOString(),
                        action: 'quotation.sent',
                        text: `${draft.id} (${channel})`,
                      },
                    ],
                  }
                : r,
            ),
          )
      },
    )
  }
  return (
    <>
      {confirmation}
      <div className="admin-heading">
        <div>
          <Link className="text-sm text-primary" href="/admin/quotations">
            {c('كل عروض الأسعار', 'All quotations')}
          </Link>
          <h1>{c('محرر عرض السعر', 'Quotation editor')}</h1>
          <p>
            {draft.id} · R{draft.revision} · {request.company}
          </p>
        </div>
        <button
          className="btn-outline"
          disabled={!totals.valid}
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          {c('طباعة / حفظ المعاينة PDF', 'Print / save preview PDF')}
        </button>
      </div>
      <p role="status" className="mb-4 text-primary">
        {message}
      </p>
      <div className="panel bg-white quotation-editor">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Badge tone={frozen ? 'green' : 'gold'}>{draft.state}</Badge>
          <span className="text-sm text-muted-foreground">
            {c(
              'معاينة فقط — ليست فاتورة أو عرضًا ملزمًا',
              'Preview only — not an invoice or binding offer',
            )}
          </span>
          {expired && (
            <Badge tone="gold">{c('انتهت الصلاحية', 'Expired')}</Badge>
          )}
        </div>
        <fieldset disabled={frozen} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label={c('لغة المستند', 'Document language')}>
              <select
                className="control"
                value={draft.locale}
                onChange={(e) =>
                  setDraft({ ...draft, locale: e.target.value as 'ar' | 'en' })
                }
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label={c('العملة', 'Currency')}>
              <select
                className="control"
                value={draft.currency}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    currency: e.target.value as PreviewQuotation['currency'],
                  })
                }
              >
                {['EGP', 'USD', 'EUR'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={c('صالح حتى', 'Valid until')}>
              <input
                className="control"
                type="date"
                value={draft.validUntil}
                onChange={(e) =>
                  setDraft({ ...draft, validUntil: e.target.value })
                }
              />
            </Field>
            <Field label={c('مهلة التوريد المتوقعة *', 'Expected lead time *')}>
              <input
                className="control"
                value={draft.leadTime}
                maxLength={200}
                onChange={(e) =>
                  setDraft({ ...draft, leadTime: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    c('البند', 'Item'),
                    c('الكمية', 'Quantity'),
                    c('الوحدة', 'Unit'),
                    c('سعر الوحدة', 'Unit price'),
                    c('خصم بالقيمة', 'Discount amount'),
                    c('ضريبة %', 'Tax %'),
                    c('الإجمالي', 'Total'),
                    '',
                  ].map((s, i) => (
                    <th key={i}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td>
                      <input
                        className="control min-w-48"
                        aria-label={c('وصف البند', 'Item description')}
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.id, { description: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="control min-w-24"
                        aria-label={c('كمية البند', 'Item quantity')}
                        type="number"
                        min={0.001}
                        max={99999}
                        step={0.001}
                        value={Number.isNaN(line.quantity) ? '' : line.quantity}
                        onChange={(e) =>
                          updateLine(line.id, {
                            quantity: e.target.valueAsNumber,
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="control min-w-24"
                        aria-label={c('وحدة البند', 'Item unit')}
                        value={line.unit}
                        onChange={(e) =>
                          updateLine(line.id, { unit: e.target.value })
                        }
                      >
                        {resources.units.map((u) => (
                          <option key={u.id} value={u.code}>
                            {draft.locale === 'ar' ? u.nameAr : u.nameEn}
                          </option>
                        ))}
                      </select>
                    </td>
                    {(['price', 'discount', 'tax'] as const).map((key) => (
                      <td key={key}>
                        <input
                          className="control min-w-24"
                          aria-label={c(
                            key === 'price'
                              ? 'سعر الوحدة'
                              : key === 'discount'
                                ? 'خصم البند'
                                : 'نسبة الضريبة',
                            key,
                          )}
                          type="number"
                          min={0}
                          max={key === 'tax' ? 100 : 100000000}
                          step={key === 'price' ? '0.0001' : '0.01'}
                          value={line[key]}
                          onChange={(e) =>
                            updateLine(line.id, { [key]: e.target.value })
                          }
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap">
                      {money(totals.rows[index].total)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            lines: draft.lines.filter((l) => l.id !== line.id),
                          })
                        }
                        aria-label={c('حذف البند', 'Remove item')}
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
              setDraft({
                ...draft,
                lines: [
                  ...draft.lines,
                  {
                    id: crypto.randomUUID(),
                    description: '',
                    sku: '',
                    quantity: 1,
                    unit: 'pack',
                    price: '',
                    discount: '0',
                    tax: '0',
                  },
                ],
              })
            }
          >
            <Plus className="size-4" />
            {c('إضافة بند', 'Add line')}
          </button>
          <Field label={c('شروط العرض *', 'Quotation terms *')}>
            <textarea
              className="control"
              rows={4}
              maxLength={3000}
              value={draft.terms}
              onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
            />
          </Field>
        </fieldset>
        <dl className="mt-6 ms-auto max-w-md space-y-3 rounded-xl bg-muted p-5">
          {[
            [c('الصافي', 'Net'), totals.net],
            [c('الضريبة', 'Tax'), totals.tax],
            [c('الإجمالي', 'Total'), totals.total],
          ].map(([key, value]) => (
            <div className="flex justify-between gap-4" key={key}>
              <dt>{key}</dt>
              <dd className="font-bold">{money(Number(value))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {!frozen ? (
            <>
              <button
                className="btn-outline"
                onClick={() => persist(draft, 'quotation.draft_saved')}
              >
                {c('حفظ مسودة محلية', 'Save local draft')}
              </button>
              <button
                className="btn-primary"
                disabled={!totals.valid}
                onClick={issue}
              >
                <FileCheck2 className="size-4" />
                {c('إصدار تجريبي', 'Issue sample revision')}
              </button>
            </>
          ) : (
            <button
              className="btn-outline"
              onClick={() => {
                const next = {
                  ...structuredClone(draft),
                  id: `DEMO-Q-${Date.now()}`,
                  revision:
                    Math.max(
                      ...quotations
                        .filter((q) => q.requestId === request.id)
                        .map((q) => q.revision),
                      draft.revision,
                    ) + 1,
                  state: 'draft' as const,
                  createdAt: new Date().toISOString(),
                  sentAt: undefined,
                }
                persist(next, 'quotation.revised')
                router.push(`/admin/quotations/${next.id}`)
              }}
            >
              <Copy className="size-4" />
              {c('إنشاء مراجعة جديدة', 'Create revision')}
            </button>
          )}
        </div>
        {frozen && (
          <div className="mt-6 grid gap-5 border-t pt-6 sm:grid-cols-2">
            <Field
              label={c(
                'قناة تواصل مسجلة — لا إرسال فعلي',
                'Recorded channel — nothing is sent',
              )}
            >
              <select
                className="control"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
              </select>
            </Field>
            <Field
              label={c(
                'ملاحظة الاستجابة أو مرجع الموافقة',
                'Response note / approval reference',
              )}
            >
              <input
                className="control"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {draft.state === 'issued' && (
                <button
                  className="btn-primary"
                  onClick={() => transition('sent')}
                >
                  {c('تسجيل تواصل تجريبي', 'Record sample delivery')}
                </button>
              )}
              {draft.state === 'sent' && (
                <>
                  <button
                    className="btn-outline"
                    disabled={expired}
                    onClick={() => transition('accepted')}
                  >
                    {c('تسجيل قبول', 'Record acceptance')}
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => transition('rejected')}
                  >
                    {c('تسجيل رفض', 'Record rejection')}
                  </button>
                </>
              )}
              {expired && ['issued', 'sent'].includes(draft.state) && (
                <button
                  className="btn-outline"
                  onClick={() => transition('expired')}
                >
                  {c('تسجيل انتهاء الصلاحية', 'Mark expired')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <section
        id="quotation-print"
        className="quotation-print panel mt-8 bg-white"
        dir={draft.locale === 'ar' ? 'rtl' : 'ltr'}
        lang={draft.locale}
      >
        <div className="mb-6 flex justify-between border-b pb-6">
          <div>
            <h2 className="text-3xl font-bold text-primary">M.A.S</h2>
            <p>Engineering For Trade</p>
          </div>
          <div className="text-end">
            <p className="font-bold">
              {draft.locale === 'ar' ? 'عرض سعر تجريبي' : 'Sample quotation'}
            </p>
            <p className="text-xs">
              {draft.id} / R{draft.revision}
            </p>
            <p className="mt-2 text-xs">
              {draft.locale === 'ar'
                ? 'غير صالح للتعاقد'
                : 'Not a binding offer'}
            </p>
          </div>
        </div>
        <p>
          {request.name} · {request.company}
        </p>
        <p className="my-3 text-sm">
          {draft.locale === 'ar' ? 'صالح حتى' : 'Valid until'}:{' '}
          {draft.validUntil} · {draft.leadTime}
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  draft.locale === 'ar' ? 'البند' : 'Item',
                  draft.locale === 'ar' ? 'الكمية' : 'Quantity',
                  draft.locale === 'ar' ? 'القيمة' : 'Amount',
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, i) => (
                <tr key={line.id}>
                  <td>
                    {line.description || '—'}
                    <p className="text-xs">{line.sku}</p>
                  </td>
                  <td>
                    {line.quantity} {line.unit}
                  </td>
                  <td>{money(totals.rows[i].total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="my-6 text-xl font-bold">
          {draft.locale === 'ar' ? 'الإجمالي' : 'Total'}: {money(totals.total)}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-7">
          {draft.terms || '—'}
        </p>
        <p className="mt-6 border-t pt-4 text-xs">
          {draft.locale === 'ar'
            ? 'معاينة داخل المتصفح؛ لم يرسل مستند ولم ينشأ إصدار رسمي.'
            : 'Browser preview; no document was sent or officially issued.'}
        </p>
      </section>
    </>
  )
}
