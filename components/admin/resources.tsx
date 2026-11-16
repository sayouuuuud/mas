'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Search, ImagePlus, FileText, Trash2, Save } from 'lucide-react'
import { brands, categories, sectors } from '@/lib/demo-data'
import { useLanguage } from '@/components/language-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import { useDemo } from '@/components/demo/demo-provider'
import {
  Pagination,
  Tabs,
  useConfirmAction,
  PreviewDialog,
  useUnsavedChanges,
} from './frontend-tools'
import { csvDownload, phoneE164 } from '@/lib/frontend-model'
import { addresses, company, phones } from '@/lib/site'

import type { PreviewMedia } from '@/lib/frontend-model'
import { resourceConfigs, type ResourceRow } from '@/lib/demo-resources'
export function ResourceWorkspace({
  section,
  id,
}: {
  section: string
  id?: string
}) {
  const config = resourceConfigs[section]
  const c = useCopy()
  const { lang } = useLanguage()
  const {
    resources,
    setResources,
    products,
    requests,
    setRequests,
    recordActivity,
  } = useDemo()
  const rows = resources[section] || []
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ResourceRow | null>(() =>
    id === 'new'
      ? { id: `new-${Date.now()}`, status: 'draft' }
      : rows.find((r) => r.id === id) || null,
  )
  const [baseline, setBaseline] = useState(() => JSON.stringify(selected))
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('details')
  const { confirm, confirmation } = useConfirmAction()
  useUnsavedChanges(!!selected && JSON.stringify(selected) !== baseline)
  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 8))
  const currentPage = Math.min(page, pages)
  const columns = config.fields
    .filter((f) => f.key !== 'nameEn' && f.type !== 'textarea')
    .slice(0, 3)
  const open = (row: ResourceRow | null) => {
    const change = () => {
      setSelected(row)
      setBaseline(JSON.stringify(row))
      setTab('details')
      setMessage('')
    }
    if (selected && JSON.stringify(selected) !== baseline)
      confirm(
        c(
          'التعديلات الحالية غير مطبقة. تجاهلها؟',
          'Discard unapplied changes?',
        ),
        change,
      )
    else change()
  }
  const saveRows = (next: ResourceRow[]) =>
    setResources((all) => ({ ...all, [section]: next }))
  const dependent = (row: ResourceRow) => {
    if (
      section === 'team' &&
      row.role === 'Owner' &&
      row.status === 'active' &&
      rows.filter((r) => r.role === 'Owner' && r.status === 'active').length <=
        1
    )
      return true
    if (['categories', 'brands', 'sectors'].includes(section))
      return (
        products.some((p) =>
          section === 'categories'
            ? p.category === row.id
            : section === 'brands'
              ? p.brand === row.id
              : p.sectorIds.includes(row.id),
        ) ||
        (section === 'categories' &&
          rows.some((r) => r.parent === row.id || r.parent === row.nameAr))
      )
    if (section === 'customers')
      return requests.some((r) => r.customerId === row.id)
    if (section === 'units')
      return products.some((p) =>
        p.variants.some((v) => v.unit.en === row.code),
      )
    return false
  }
  const changeState = (row: ResourceRow) => {
    const next = row.status === 'archived' ? 'draft' : 'archived'
    if (next === 'archived' && dependent(row)) {
      setMessage(
        c(
          'السجل مرتبط بمنتجات أو طلبات؛ غيّر الارتباطات قبل أرشفته.',
          'This entry has dependencies. Update its references before archiving.',
        ),
      )
      return
    }
    confirm(
      c(
        'تغيير الحالة داخل المتصفح فقط؟',
        'Change the status in the browser only?',
      ),
      () => {
        saveRows(
          rows.map((r) => (r.id === row.id ? { ...r, status: next } : r)),
        )
        recordActivity(`${section}.${next}`, row.id)
        setMessage(c('تم تحديث الحالة محليًا.', 'Status updated locally.'))
      },
    )
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const clean = Object.fromEntries(
      Object.entries(selected).map(([k, v]) => [
        k,
        typeof v === 'string' ? v.trim() : '',
      ]),
    ) as ResourceRow
    for (const field of config.fields) {
      if (field.required && !clean[field.key]) {
        setMessage(c('أكمل الحقول المطلوبة.', 'Complete all required fields.'))
        return
      }
    }
    if (
      clean.status === 'published' &&
      ['categories', 'brands', 'sectors', 'content'].includes(section) &&
      (!clean.nameAr || !clean.nameEn)
    ) {
      setMessage(
        c('النشر يحتاج الاسم باللغتين.', 'Publishing requires both languages.'),
      )
      return
    }
    if (clean.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean.slug)) {
      setMessage(c('راجع صيغة الرابط المختصر.', 'Check the slug format.'))
      return
    }
    for (const key of ['slug', 'code', 'email'])
      if (
        clean[key] &&
        rows.some(
          (r) =>
            r.id !== clean.id &&
            r[key]?.toLowerCase() === clean[key].toLowerCase(),
        )
      ) {
        setMessage(
          c(
            'الرابط أو الكود أو البريد مستخدم بالفعل.',
            'Slug, code or email is already in use.',
          ),
        )
        return
      }
    for (const key of ['image', 'logo'])
      if (
        clean[key] &&
        !/^\/(images|partners)\/[a-zA-Z0-9_./-]+$/.test(clean[key])
      ) {
        setMessage(
          c(
            'اختر مسار صورة من مجلدات المشروع images أو partners.',
            'Choose an image from the project images or partners folders.',
          ),
        )
        return
      }
    if (clean.website && !/^https:\/\/[^\s]+$/.test(clean.website)) {
      setMessage(
        c(
          'الموقع الرسمي يحتاج رابط HTTPS صحيحًا.',
          'Use a valid HTTPS website URL.',
        ),
      )
      return
    }
    if (clean.parent && clean.parent !== '—') {
      let cursor = rows.find(
        (r) => r.id === clean.parent || r.nameAr === clean.parent,
      )
      const seen = new Set([clean.id])
      while (cursor) {
        if (seen.has(cursor.id)) {
          setMessage(
            c(
              'العلاقة تؤدي إلى دورة في شجرة التصنيف.',
              'This creates a category cycle.',
            ),
          )
          return
        }
        seen.add(cursor.id)
        cursor = rows.find(
          (r) => r.id === cursor?.parent || r.nameAr === cursor?.parent,
        )
      }
    }
    if (clean.type === 'option' && !clean.choices?.trim()) {
      setMessage(c('أضف خيارات الخاصية أولًا.', 'Add attribute options first.'))
      return
    }
    if (
      section === 'navigation' &&
      (!/^\/[a-z0-9/-]*$/.test(clean.href) || clean.href.startsWith('//'))
    ) {
      setMessage(
        c(
          'استخدم مسارًا داخليًا صالحًا مثل /products.',
          'Use a valid internal path such as /products.',
        ),
      )
      return
    }
    if (
      section === 'team' &&
      rows.find((r) => r.id === clean.id)?.role === 'Owner' &&
      (clean.status !== 'active' || clean.role !== 'Owner') &&
      rows.filter((r) => r.role === 'Owner' && r.status === 'active').length <=
        1
    ) {
      setMessage(
        c(
          'لا يمكن تعطيل آخر مدير نظام فعال في المعاينة.',
          'Cannot disable the last active owner in the preview.',
        ),
      )
      return
    }
    if (section === 'content' && clean.status === 'published')
      clean.publishedSnapshot = JSON.stringify({
        ...clean,
        previewUpdated: 'yes',
        publishedSnapshot: '',
      })
    clean.previewUpdated = 'yes'
    saveRows(
      rows.some((r) => r.id === clean.id)
        ? rows.map((r) => (r.id === clean.id ? clean : r))
        : [...rows, clean],
    )
    recordActivity(`${section}.saved`, clean.id)
    setSelected(clean)
    setBaseline(JSON.stringify(clean))
    setMessage(
      c(
        'تم تطبيق التعديل على المعاينة المشتركة.',
        'Applied to the shared preview.',
      ),
    )
  }
  const fields = config.fields.filter((f) =>
    tab === 'seo' ? f.key.startsWith('seo') : !f.key.startsWith('seo'),
  )
  const customerRequests = selected
    ? requests.filter((r) => r.customerId === selected.id)
    : []
  return (
    <>
      {confirmation}
      <div className="admin-heading">
        <div>
          <h1>{c(config.ar, config.en)}</h1>
          <p>{c(...config.description)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-outline"
            onClick={() =>
              csvDownload(
                `demo-${section}.csv`,
                columns.map((f) => f.en),
                filtered.map((r) => columns.map((f) => r[f.key] || '')),
              )
            }
          >
            {c('تصدير CSV', 'Export CSV')}
          </button>
          <button
            className="btn-primary"
            onClick={() => open({ id: `new-${Date.now()}`, status: 'draft' })}
          >
            <Plus className="size-4" />
            {c('إضافة تجريبية', 'Add sample')}
          </button>
        </div>
      </div>
      <p role="status" className="mb-4 text-sm text-primary">
        {message}
      </p>
      <div
        className={`grid items-start gap-6 ${selected ? 'xl:grid-cols-[1.1fr_1fr]' : ''}`}
      >
        <section className="panel min-w-0 bg-white">
          <div className="mb-5 flex flex-wrap gap-3">
            <input
              aria-label={c('بحث', 'Search')}
              className="control flex-1"
              placeholder={c('ابحث في القائمة…', 'Search entries…')}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
            />
            <select
              aria-label={c('تصفية الحالة', 'Filter status')}
              className="control w-auto"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">{c('كل الحالات', 'All statuses')}</option>
              {[
                'draft',
                'published',
                'archived',
                'active',
                'inactive',
                'new',
                'resolved',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {filtered.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label={c('جدول البيانات', 'Data table')}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    {columns.map((f) => (
                      <th key={f.key}>{c(f.ar, f.en)}</th>
                    ))}
                    <th>{c('الإجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice((currentPage - 1) * 8, currentPage * 8)
                    .map((row) => (
                      <tr key={row.id}>
                        {columns.map((f) => (
                          <td key={f.key}>
                            {f.key === 'nameAr' && lang === 'en' && row.nameEn
                              ? row.nameEn
                              : row[f.key] || '—'}
                          </td>
                        ))}
                        <td>
                          <div className="flex flex-wrap gap-3">
                            <button
                              className="text-primary underline"
                              onClick={() => open({ ...row })}
                            >
                              {c('فتح', 'Open')}
                            </button>
                            <button
                              className="text-primary"
                              onClick={() =>
                                open({
                                  ...row,
                                  id: `new-${Date.now()}`,
                                  slug: row.slug
                                    ? `${row.slug}-copy`
                                    : row.slug,
                                  code: row.code
                                    ? `${row.code}-copy`
                                    : row.code,
                                  email: section === 'team' ? '' : row.email,
                                  status: 'draft',
                                })
                              }
                            >
                              {c('نسخ', 'Duplicate')}
                            </button>
                            <button onClick={() => changeState(row)}>
                              {row.status === 'archived'
                                ? c('استعادة', 'Restore')
                                : c('أرشفة', 'Archive')}
                            </button>
                            <button
                              className="text-red-700"
                              onClick={() => {
                                if (dependent(row)) {
                                  setMessage(
                                    c(
                                      'لا يمكن حذف سجل مرتبط.',
                                      'Referenced entries cannot be deleted.',
                                    ),
                                  )
                                  return
                                }
                                confirm(
                                  c(
                                    'حذف هذا السجل من بيانات العرض؟',
                                    'Delete this preview entry?',
                                  ),
                                  () => {
                                    saveRows(
                                      rows.filter((r) => r.id !== row.id),
                                    )
                                    if (selected?.id === row.id) {
                                      setSelected(null)
                                      setBaseline('null')
                                    }
                                    recordActivity(`${section}.deleted`, row.id)
                                  },
                                )
                              }}
                            >
                              {c('حذف', 'Delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={c('لا توجد نتائج', 'No results')}
              description={c(
                'جرّب تغيير البحث أو الحالة.',
                'Change the search or status filter.',
              )}
            />
          )}
          <Pagination
            page={currentPage}
            pages={pages}
            total={filtered.length}
            onChange={setPage}
          />
        </section>
        {selected && (
          <form className="panel min-w-0 space-y-5 bg-white" onSubmit={submit}>
            <div className="flex justify-between">
              <h2 className="font-bold">
                {c('تحرير البيانات', 'Edit details')}
              </h2>
              <button
                type="button"
                className="text-sm text-muted-foreground"
                onClick={() => open(null)}
              >
                {c('إغلاق', 'Close')}
              </button>
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              label={c('أقسام التحرير', 'Editor sections')}
              items={[
                { id: 'details', label: c('البيانات', 'Details') },
                ...(config.fields.some((f) => f.key.startsWith('seo'))
                  ? [{ id: 'seo', label: c('محركات البحث', 'SEO') }]
                  : []),
                ...(['customers', 'inquiries'].includes(section)
                  ? [
                      {
                        id: 'history',
                        label: c('المتابعة والطلبات', 'History & requests'),
                      },
                    ]
                  : []),
              ]}
            />
            <div role="tabpanel" id={`panel-${tab}`} className="space-y-5">
              {tab === 'history' ? (
                <>
                  <h3 className="font-bold">
                    {c('الطلبات المرتبطة', 'Linked requests')}
                  </h3>
                  {(section === 'customers'
                    ? customerRequests
                    : requests.filter(
                        (r) => r.id === selected.convertedRequestId,
                      )
                  ).map((r) => (
                    <Link
                      className="block rounded-lg border p-3 text-primary"
                      key={r.id}
                      href={`/admin/quote-requests/${r.id}`}
                    >
                      {r.id} · {r.status}
                    </Link>
                  ))}
                  {!customerRequests.length && section === 'customers' && (
                    <p className="text-sm text-muted-foreground">
                      {c('لم تُربط طلبات بعد.', 'No linked requests yet.')}
                    </p>
                  )}
                  {section === 'inquiries' && (
                    <>
                      <p className="text-sm">
                        {c(
                          'يتم إنشاء طلب تجريبي فقط بعد إضافة وصف بند وكمية. لا تُرسل رسالة خارجية.',
                          'A sample request requires an item description and quantity. No external message is sent.',
                        )}
                      </p>
                      <Field
                        label={c(
                          'وصف البند للتحويل',
                          'Item description for conversion',
                        )}
                      >
                        <textarea
                          className="control"
                          minLength={3}
                          value={selected.conversionDescription || ''}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              conversionDescription: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label={c('كمية التحويل', 'Conversion quantity')}>
                        <input
                          className="control"
                          type="number"
                          min={1}
                          max={99999}
                          value={selected.conversionQuantity || '1'}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              conversionQuantity: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={!!selected.convertedRequestId}
                        onClick={() => {
                          if (
                            (selected.conversionDescription || '').trim()
                              .length < 3 ||
                            !Number.isInteger(
                              Number(selected.conversionQuantity || 1),
                            ) ||
                            Number(selected.conversionQuantity || 1) < 1 ||
                            Number(selected.conversionQuantity || 1) > 99999
                          ) {
                            setMessage(
                              c(
                                'أكمل وصف البند وكمية صحيحة.',
                                'Enter an item description and valid quantity.',
                              ),
                            )
                            return
                          }
                          const requestId = `DEMO-RFQ-${Date.now()}`
                          setRequests((all) => [
                            ...all,
                            {
                              id: requestId,
                              name: selected.nameAr,
                              company: c('استفسار محوّل', 'Converted inquiry'),
                              status: 'new',
                              owner: selected.owner || '',
                              date: new Date().toISOString().slice(0, 10),
                              priority: 'normal',
                              items: [
                                {
                                  description: selected.conversionDescription,
                                  quantity: Number(
                                    selected.conversionQuantity || 1,
                                  ),
                                  unit: 'pack',
                                },
                              ],
                              notes: [],
                            },
                          ])
                          const next = {
                            ...selected,
                            convertedRequestId: requestId,
                            status: 'resolved',
                          }
                          saveRows(
                            rows.map((r) => (r.id === next.id ? next : r)),
                          )
                          setSelected(next)
                          setBaseline(JSON.stringify(next))
                          recordActivity('inquiry.converted', selected.id)
                          setMessage(
                            c(
                              'تم إنشاء طلب محلي وربطه بالاستفسار.',
                              'Created and linked a local request.',
                            ),
                          )
                        }}
                      >
                        {selected.convertedRequestId
                          ? c('تم التحويل بالفعل', 'Already converted')
                          : c(
                              'تحويل إلى طلب تجريبي',
                              'Convert to sample request',
                            )}
                      </button>
                    </>
                  )}
                </>
              ) : (
                fields.map((f) => (
                  <Field
                    key={f.key}
                    label={`${c(f.ar, f.en)}${f.required ? ' *' : ''}`}
                  >
                    {f.type === 'textarea' ? (
                      <textarea
                        className="control"
                        rows={4}
                        maxLength={2000}
                        required={f.required && tab === 'details'}
                        value={selected[f.key] || ''}
                        onChange={(e) =>
                          setSelected({ ...selected, [f.key]: e.target.value })
                        }
                      />
                    ) : f.type === 'select' ? (
                      <select
                        className="control"
                        required={f.required}
                        value={selected[f.key] || ''}
                        onChange={(e) =>
                          setSelected({ ...selected, [f.key]: e.target.value })
                        }
                      >
                        <option value="">{c('اختر…', 'Choose…')}</option>
                        {(f.key === 'parent'
                          ? [
                              { id: '—', label: c('بدون أب', 'No parent') },
                              ...resources.categories
                                .filter((r) => r.id !== selected.id)
                                .map((r) => ({
                                  id: r.id,
                                  label: lang === 'ar' ? r.nameAr : r.nameEn,
                                })),
                            ]
                          : f.options?.map((o) => ({ id: o, label: o })) || []
                        ).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="control"
                        maxLength={254}
                        type={
                          f.type === 'email'
                            ? 'email'
                            : f.type === 'url'
                              ? 'url'
                              : f.type === 'number'
                                ? 'number'
                                : f.type === 'date'
                                  ? 'date'
                                  : f.type === 'tel'
                                    ? 'tel'
                                    : 'text'
                        }
                        min={f.min}
                        max={f.max}
                        required={f.required && tab === 'details'}
                        value={selected[f.key] || ''}
                        onChange={(e) =>
                          setSelected({ ...selected, [f.key]: e.target.value })
                        }
                      />
                    )}
                  </Field>
                ))
              )}
            </div>
            <button className="btn-primary">
              <Save className="size-4" />
              {c('تطبيق في المعاينة', 'Apply to preview')}
            </button>
            <button
              type="button"
              className="btn-outline ms-2"
              onClick={() =>
                open(
                  rows.find((r) => r.id === selected.id)
                    ? { ...rows.find((r) => r.id === selected.id)! }
                    : null,
                )
              }
            >
              {c('تراجع عن التعديلات', 'Discard changes')}
            </button>
          </form>
        )}
      </div>
      {section === 'team' && (
        <section className="panel mt-6 bg-white">
          <h2 className="mb-5 text-xl font-bold">
            {c('مصفوفة الأدوار المخططة', 'Planned role matrix')}
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            {c(
              'هذه سياسة العرض المطلوبة؛ تفعيلها وتأمينها ينتظر المصادقة وRLS.',
              'This shows the intended policy. Enforcement requires authentication and RLS.',
            )}
          </p>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    'Role',
                    c('الكتالوج', 'Catalog'),
                    c('المحتوى', 'Content'),
                    c('المبيعات', 'Sales'),
                    c('الفريق والإعدادات', 'Team & settings'),
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Owner', '✓', '✓', '✓', '✓'],
                  ['Catalog Manager', '✓', '—', '—', '—'],
                  ['Content Editor', '—', '✓', '—', '—'],
                  [
                    'Sales Manager',
                    '—',
                    '—',
                    c('كل الطلبات', 'All requests'),
                    '—',
                  ],
                  [
                    'Sales Agent',
                    '—',
                    '—',
                    c('المسند فقط', 'Assigned only'),
                    '—',
                  ],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

export function MediaWorkspace() {
  const { media, setMedia, trackMediaUrl, products, recordActivity } = useDemo()
  const c = useCopy()
  const [q, setQ] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const { confirm, confirmation } = useConfirmAction()
  async function choose(files: FileList | null) {
    let rejected = 0
    const additions: PreviewMedia[] = []
    for (const file of Array.from(files || [])) {
      const allowed =
        ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(
          file.type,
        ) &&
        file.size > 0 &&
        file.size <= (file.type === 'application/pdf' ? 20 : 5) * 1024 * 1024
      if (!allowed) {
        rejected++
        continue
      }
      const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
      const head = String.fromCharCode(...bytes)
      const signature =
        file.type === 'application/pdf'
          ? head.startsWith('%PDF-')
          : file.type === 'image/png'
            ? bytes[0] === 137 && head.slice(1, 4) === 'PNG'
            : file.type === 'image/jpeg'
              ? bytes[0] === 255 && bytes[1] === 216
              : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP'
      if (!signature) {
        rejected++
        continue
      }
      additions.push({
        id: crypto.randomUUID(),
        name: file.name,
        url: trackMediaUrl(file),
        mime: file.type,
        size: file.size,
        altAr: '',
        altEn: '',
        status: 'ready' as const,
      })
    }
    setMedia((all) => [...all, ...additions])
    if (additions.length)
      recordActivity('media.selected', String(additions.length))
    setMessage(
      rejected
        ? c(
            'استُبعدت ملفات غير مدعومة أو أكبر من الحد أو لا تطابق نوعها.',
            'Unsupported, oversized or mismatched files were excluded.',
          )
        : c(
            'الملفات محلية فقط، ولم تُرفع لخادم.',
            'Files are local only; nothing was uploaded.',
          ),
    )
  }
  const rows = media.filter((m) =>
    m.name.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <>
      {confirmation}
      <div className="admin-heading">
        <div>
          <h1>{c('مكتبة الوسائط', 'Media library')}</h1>
          <p>
            {c(
              'اختيار ومعاينة وربط الصور والملفات محليًا. لا فحص خادم أو رفع فعلي.',
              'Select, preview and link local media. No server scanning or uploads.',
            )}
          </p>
        </div>
      </div>
      <label className="upload-zone">
        <ImagePlus className="mx-auto mb-4 size-10 text-primary" />
        <strong>{c('اختر صورًا أو PDF', 'Choose images or PDFs')}</strong>
        <span className="mt-2 block text-sm text-muted-foreground">
          JPG / PNG / WebP ≤ 5 MB · PDF ≤ 20 MB
        </span>
        <input
          className="mt-5 block max-w-full text-sm"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            void choose(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      <p role="status" className="my-4 text-sm text-primary">
        {message}
      </p>
      <input
        className="control mb-5"
        placeholder={c('بحث باسم الملف', 'Search file name')}
        aria-label={c('بحث الوسائط', 'Search media')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((file) => (
          <article className="panel min-w-0 space-y-4 bg-white" key={file.id}>
            {file.mime.startsWith('image/') ? (
              <img
                className="aspect-video w-full rounded-lg object-contain"
                src={file.url}
                alt={file.altAr || file.name}
              />
            ) : (
              <FileText className="my-8 size-12 text-primary" />
            )}
            <h2 className="truncate text-sm font-bold">{file.name}</h2>
            <p className="text-xs text-muted-foreground">
              {Math.round(file.size / 1024)} KB · {file.mime}
            </p>
            <Badge>
              {file.status === 'archived'
                ? c('مؤرشف محليًا', 'Archived locally')
                : c('معاينة محلية', 'Local preview')}
            </Badge>
            {(['ar', 'en'] as const).map((locale) => (
              <Field
                key={locale}
                label={
                  locale === 'ar'
                    ? c('النص البديل عربي', 'Arabic alt text')
                    : c('النص البديل إنجليزي', 'English alt text')
                }
              >
                <input
                  className="control"
                  maxLength={200}
                  value={locale === 'ar' ? file.altAr : file.altEn}
                  onChange={(e) =>
                    setMedia((all) =>
                      all.map((m) =>
                        m.id === file.id
                          ? {
                              ...m,
                              [locale === 'ar' ? 'altAr' : 'altEn']:
                                e.target.value,
                            }
                          : m,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <p className="text-xs">
              {c('الاستخدامات', 'Usage')}:{' '}
              {products
                .filter(
                  (p) =>
                    p.mainMediaId === file.id || p.mediaIds?.includes(file.id),
                )
                .map((p) => p.name.ar)
                .join('، ') || c('غير مرتبط', 'Not linked')}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="text-primary underline"
                onClick={() => setPreview(file.id)}
              >
                {c('معاينة', 'Preview')}
              </button>
              <button
                className="text-sm"
                onClick={() => {
                  if (
                    products.some(
                      (p) =>
                        p.mainMediaId === file.id ||
                        p.mediaIds?.includes(file.id),
                    )
                  ) {
                    setMessage(
                      c(
                        'استبدل استخدامات الملف أولًا.',
                        'Replace this file usage first.',
                      ),
                    )
                    return
                  }
                  confirm(
                    c('أرشفة الملف المحلي؟', 'Archive this local file?'),
                    () => {
                      setMedia((all) =>
                        all.map((m) =>
                          m.id === file.id
                            ? {
                                ...m,
                                status:
                                  m.status === 'archived'
                                    ? 'ready'
                                    : 'archived',
                              }
                            : m,
                        ),
                      )
                      recordActivity('media.archive_changed', file.id)
                    },
                  )
                }}
              >
                {file.status === 'archived'
                  ? c('استعادة', 'Restore')
                  : c('أرشفة', 'Archive')}
              </button>
              <button
                className="text-red-700"
                onClick={() => {
                  if (
                    products.some(
                      (p) =>
                        p.mainMediaId === file.id ||
                        p.mediaIds?.includes(file.id),
                    )
                  ) {
                    setMessage(
                      c(
                        'لا يمكن حذف ملف مستخدم بمنتج.',
                        'Cannot delete media used by a product.',
                      ),
                    )
                    return
                  }
                  confirm(
                    c('إزالة الملف من المعاينة؟', 'Remove this local file?'),
                    () => {
                      setMedia((all) => all.filter((m) => m.id !== file.id))
                      URL.revokeObjectURL(file.url)
                      recordActivity('media.deleted', file.id)
                    },
                  )
                }}
              >
                {c('حذف', 'Delete')}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <EmptyState
          title={c('لا توجد ملفات محلية', 'No local files')}
          description={c(
            'اختر ملفًا لمعاينته وربطه بالمنتجات.',
            'Select a file to preview and link it to products.',
          )}
        />
      )}
      <h2 className="mb-5 mt-10 text-xl font-bold">
        {c('صور المشروع', 'Project images')}
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {categories.map((cat) => (
          <div className="panel bg-white" key={cat.id}>
            <Image
              src={cat.image}
              alt={c(cat.name.ar, cat.name.en)}
              width={300}
              height={220}
              className="mb-4 aspect-video w-full rounded-lg object-cover"
            />
            <p>{c(cat.name.ar, cat.name.en)}</p>
          </div>
        ))}
      </div>
      {preview && (
        <PreviewDialog
          close={() => setPreview(null)}
          label={c('معاينة الملف', 'File preview')}
        >
          {media.find((m) => m.id === preview)?.mime === 'application/pdf' ? (
            <iframe
              className="h-[65vh] w-full"
              src={media.find((m) => m.id === preview)?.url}
              title={c('معاينة PDF محلي', 'Local PDF preview')}
            />
          ) : (
            <img
              className="max-h-[65vh] w-full object-contain"
              src={media.find((m) => m.id === preview)?.url}
              alt={media.find((m) => m.id === preview)?.name}
            />
          )}
        </PreviewDialog>
      )}
    </>
  )
}
export function SettingsWorkspace() {
  const c = useCopy()
  const { resources, setResources, recordActivity } = useDemo()
  const initial = resources.settings?.[0] || {
    id: 'company',
    nameAr: company.name.ar,
    nameEn: company.name.en,
    email: company.email,
    mobile: phones.mobile.display,
    office: phones.office.display,
    branchPhone: phones.branch.display,
    fax: phones.fax.display,
    whatsapp: '201004998655',
    supportAr: company.support.ar,
    supportEn: company.support.en,
    hqAr: addresses.hq.ar,
    hqEn: addresses.hq.en,
    branchAr: addresses.branch.ar,
    branchEn: addresses.branch.en,
    storesAr: addresses.stores.ar,
    storesEn: addresses.stores.en,
    hoursAr: '',
    hoursEn: '',
    replyTimeAr: '',
    replyTimeEn: '',
    currency: 'EGP',
  }
  const [draft, setDraft] = useState<ResourceRow>(initial)
  const [baseline, setBaseline] = useState(JSON.stringify(initial))
  const [message, setMessage] = useState('')
  const [tab, setTab] = useState('company')
  useUnsavedChanges(JSON.stringify(draft) !== baseline)
  const tabs = [
    { id: 'company', label: c('الشركة والتواصل', 'Company & contact') },
    { id: 'locations', label: c('الفروع وساعات العمل', 'Locations & hours') },
    { id: 'defaults', label: c('القيم الافتراضية', 'Defaults') },
  ]
  const fields =
    tab === 'company'
      ? [
          ['nameAr', 'الاسم عربي', 'Arabic name'],
          ['nameEn', 'الاسم إنجليزي', 'English name'],
          ['email', 'البريد العام', 'Public email'],
          ['mobile', 'الموبايل', 'Mobile'],
          ['office', 'هاتف الإدارة', 'Office phone'],
          ['branchPhone', 'هاتف الفرع', 'Branch phone'],
          ['fax', 'فاكس', 'Fax'],
          ['whatsapp', 'واتساب دولي', 'International WhatsApp'],
          ['supportAr', 'الدعم الفني عربي', 'Arabic support name'],
          ['supportEn', 'الدعم الفني إنجليزي', 'English support name'],
        ]
      : tab === 'locations'
        ? [
            ['hqAr', 'عنوان الإدارة عربي', 'Arabic HQ'],
            ['hqEn', 'عنوان الإدارة إنجليزي', 'English HQ'],
            ['branchAr', 'عنوان الفرع عربي', 'Arabic branch'],
            ['branchEn', 'عنوان الفرع إنجليزي', 'English branch'],
            ['storesAr', 'المخازن عربي', 'Arabic warehouses'],
            ['storesEn', 'المخازن إنجليزي', 'English warehouses'],
            ['hoursAr', 'ساعات العمل عربي', 'Arabic opening hours'],
            ['hoursEn', 'ساعات العمل إنجليزي', 'English opening hours'],
          ]
        : [
            ['replyTimeAr', 'مدة الرد عربي', 'Arabic response target'],
            ['replyTimeEn', 'مدة الرد إنجليزي', 'English response target'],
          ]
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('إعدادات الموقع', 'Site settings')}</h1>
          <p>
            {c(
              'تعديلات محلية على بيانات الشركة؛ لا تضع مفاتيح أو بيانات سرية.',
              'Local company settings; do not enter secrets or API keys.',
            )}
          </p>
        </div>
      </div>
      <form
        className="panel space-y-6 bg-white"
        onSubmit={(e) => {
          e.preventDefault()
          if (
            !draft.nameAr.trim() ||
            !draft.nameEn.trim() ||
            !/^\S+@\S+\.\S+$/.test(draft.email) ||
            !/^\d{8,15}$/.test(draft.whatsapp) ||
            !draft.mobile.trim() ||
            ['mobile', 'office', 'branchPhone', 'fax'].some(
              (key) =>
                draft[key] && !/^\+\d{8,15}$/.test(phoneE164(draft[key])),
            )
          ) {
            setMessage(
              c(
                'راجع الاسم باللغتين والبريد والهواتف ورقم واتساب الدولي.',
                'Check bilingual names, email, phone numbers and international WhatsApp number.',
              ),
            )
            return
          }
          setResources((all) => ({ ...all, settings: [draft] }))
          setBaseline(JSON.stringify(draft))
          recordActivity('settings.saved', 'company')
          setMessage(
            c('تم تطبيق إعدادات المعاينة.', 'Preview settings applied.'),
          )
        }}
      >
        <Tabs
          value={tab}
          onChange={setTab}
          items={tabs}
          label={c('الإعدادات', 'Settings')}
        />
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          className="grid gap-5 md:grid-cols-2"
        >
          {fields.map(([key, ar, en]) => (
            <Field key={key} label={c(ar, en)}>
              <input
                className="control"
                maxLength={500}
                type={key === 'email' ? 'email' : 'text'}
                value={draft[key] || ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </Field>
          ))}
          {tab === 'defaults' && (
            <>
              <Field label={c('العملة', 'Currency')}>
                <select
                  className="control"
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft({ ...draft, currency: e.target.value })
                  }
                >
                  {['EGP', 'USD', 'EUR'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label={c('المنطقة الزمنية', 'Timezone')}>
                <input className="control" readOnly value="Africa/Cairo" />
              </Field>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button className="btn-primary">
            {c('تطبيق في المعاينة', 'Apply to preview')}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setDraft(initial)
              setBaseline(JSON.stringify(initial))
            }}
          >
            {c('إلغاء التعديلات', 'Discard changes')}
          </button>
        </div>
        <p role="status" className="text-primary">
          {message}
        </p>
      </form>
    </>
  )
}
