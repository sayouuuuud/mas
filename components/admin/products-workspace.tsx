'use client'
import { useState } from 'react'
import { ImportPreview } from './import-preview'
import {
  Pagination,
  useConfirmAction,
  useUnsavedChanges,
} from './frontend-tools'
import { csvDownload } from '@/lib/frontend-model'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Plus, Search, Save, ExternalLink, Trash2 } from 'lucide-react'
import { useDemo, useCatalogData } from '@/components/demo/demo-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { bi, type DemoProduct, type CategoryKey } from '@/lib/demo-data'

export function ProductWorkspace({ id }: { id?: string }) {
  const { brands, categories } = useCatalogData()
  const { products, setProducts, requests, recordActivity } = useDemo()
  const c = useCopy()
  const { lang } = useLanguage()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const { confirm, confirmation } = useConfirmAction()
  if (id) return <ProductEditor key={id} id={id} />
  const filtered = products.filter(
    (p) =>
      (!status || p.status === status) &&
      `${p.name.ar} ${p.name.en} ${p.variants.map((v) => v.sku).join(' ')}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  )
  return (
    <>
      {confirmation}
      <div className="admin-heading">
        <div>
          <h1>{c('إدارة المنتجات', 'Manage products')}</h1>
          <p>
            {c(
              'راجع البيانات الفنية والعبوات وحالة ظهور كل منتج.',
              'Review technical data, pack options and product visibility.',
            )}
          </p>
        </div>
        <Link href="/admin/products/new" className="btn-primary">
          <Plus className="size-4" />
          {c('منتج جديد', 'New product')}
        </Link>
      </div>
      <ImportPreview />
      <div className="panel bg-white">
        <div className="mb-5 flex flex-wrap gap-3">
          <button
            className="btn-outline"
            onClick={() =>
              csvDownload(
                'demo-products.csv',
                ['name', 'sku', 'status'],
                filtered.map((p) => [
                  p.name[lang],
                  p.variants[0]?.sku || '',
                  p.status,
                ]),
              )
            }
          >
            {c('تصدير النتائج', 'Export results')}
          </button>
          <select
            className="control w-auto"
            value=""
            aria-label={c('إجراء جماعي', 'Bulk action')}
            disabled={!selectedIds.length}
            onChange={(e) => {
              const status = e.target.value
              if (status)
                confirm(
                  c(
                    'تطبيق الحالة على المنتجات المحددة؟',
                    'Apply status to selected products?',
                  ),
                  () => {
                    setProducts((all) =>
                      all.map((p) =>
                        selectedIds.includes(p.id)
                          ? { ...p, status: status as DemoProduct['status'] }
                          : p,
                      ),
                    )
                    recordActivity(
                      `products.bulk_${status}`,
                      selectedIds.join(','),
                    )
                    setSelectedIds([])
                  },
                )
            }}
          >
            <option value="">
              {c('إجراء على المحدد', 'Selected action')} ({selectedIds.length})
            </option>
            <option value="draft">{c('إلغاء النشر', 'Unpublish')}</option>
            <option value="archived">{c('أرشفة', 'Archive')}</option>
          </select>
        </div>
        <div className="mb-5 flex flex-wrap gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">
              {c('البحث عن منتج', 'Find a product')}
            </span>
            <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <input
              className="control ps-10"
              placeholder={c('اسم المنتج أو الكود…', 'Product name or SKU…')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            aria-label={c('حالة النشر', 'Publication status')}
            className="control w-auto"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{c('كل الحالات', 'All statuses')}</option>
            <option value="published">{c('منشور', 'Published')}</option>
            <option value="draft">{c('مسودة', 'Draft')}</option>
            <option value="archived">{c('مؤرشف', 'Archived')}</option>
          </select>
        </div>
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
                  <th>
                    <input
                      type="checkbox"
                      aria-label={c('تحديد الكل', 'Select all')}
                      checked={
                        filtered.length > 0 &&
                        filtered.every((p) => selectedIds.includes(p.id))
                      }
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked ? filtered.map((p) => p.id) : [],
                        )
                      }
                    />
                  </th>
                  {[
                    c('المنتج', 'Product'),
                    c('العلامة / التصنيف', 'Brand / category'),
                    c('المتغيرات', 'Variants'),
                    c('الحالة', 'Status'),
                    c('الإجراء', 'Action'),
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice(
                    (Math.min(
                      page,
                      Math.max(1, Math.ceil(filtered.length / 8)),
                    ) -
                      1) *
                      8,
                    Math.min(
                      page,
                      Math.max(1, Math.ceil(filtered.length / 8)),
                    ) * 8,
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${c('تحديد', 'Select')} ${p.name[lang]}`}
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) =>
                            setSelectedIds((ids) =>
                              e.target.checked
                                ? [...ids, p.id]
                                : ids.filter((id) => id !== p.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Image
                            src={p.image}
                            alt=""
                            width={44}
                            height={44}
                            className="size-11 rounded-lg object-cover"
                          />
                          <div>
                            <Link
                              href={`/admin/products/${p.id}`}
                              className="font-bold text-primary"
                            >
                              {p.name[lang]}
                            </Link>
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              {p.variants[0]?.sku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {brands.find((b) => b.id === p.brand)?.name[lang]}
                        <p className="text-xs text-muted-foreground">
                          {
                            categories.find((t) => t.id === p.category)?.name[
                              lang
                            ]
                          }
                        </p>
                      </td>
                      <td>{p.variants.length}</td>
                      <td>
                        <Badge
                          tone={
                            p.status === 'published'
                              ? 'green'
                              : p.status === 'draft'
                                ? 'gold'
                                : 'neutral'
                          }
                        >
                          {p.status === 'published'
                            ? c('منشور', 'Published')
                            : p.status === 'draft'
                              ? c('مسودة', 'Draft')
                              : c('مؤرشف', 'Archived')}
                        </Badge>
                      </td>
                      <td>
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-primary underline"
                        >
                          {c('تحرير', 'Edit')}
                        </Link>
                        <button
                          className="ms-3 text-primary"
                          onClick={() => {
                            const id = `demo-${Date.now()}`
                            setProducts((all) => [
                              ...all,
                              {
                                ...structuredClone(p),
                                id,
                                slug: `${p.slug}-copy-${Date.now()}`,
                                status: 'draft',
                                variants: p.variants.map((v, i) => ({
                                  ...v,
                                  id: `${id}-${i}`,
                                  sku: `COPY-${Date.now()}-${i}`,
                                })),
                              },
                            ])
                            recordActivity('product.duplicated', p.id)
                          }}
                        >
                          {c('نسخ', 'Duplicate')}
                        </button>
                        <button
                          className="ms-3 text-red-700"
                          onClick={() => {
                            if (
                              p.status !== 'draft' ||
                              requests.some((r) =>
                                r.items.some((i) =>
                                  p.variants.some((v) => v.id === i.variantId),
                                ),
                              )
                            ) {
                              window.alert(
                                c(
                                  'الحذف للمسودات غير المرتبطة فقط.',
                                  'Only unreferenced drafts can be deleted.',
                                ),
                              )
                              return
                            }
                            confirm(
                              c('حذف المسودة المحلية؟', 'Delete local draft?'),
                              () => {
                                setProducts((all) =>
                                  all.filter((item) => item.id !== p.id),
                                )
                                recordActivity('product.deleted', p.id)
                              },
                            )
                          }}
                        >
                          {c('حذف', 'Delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={c('لا توجد منتجات مطابقة', 'No matching products')}
            description={c(
              'جرّب اسمًا آخر أو غيّر حالة النشر.',
              'Try another name or publication status.',
            )}
          />
        )}
        <Pagination
          page={Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))}
          pages={Math.max(1, Math.ceil(filtered.length / 8))}
          total={filtered.length}
          onChange={setPage}
        />
        <p className="mt-5 text-xs text-muted-foreground">
          {filtered.length}{' '}
          {c(
            'منتج — تغييرات المعاينة لا تستمر بعد إعادة تحميل الصفحة.',
            'products — preview changes reset on reload.',
          )}
        </p>
      </div>
    </>
  )
}

function ProductEditor({ id }: { id: string }) {
  const { brands, categories, sectors } = useCatalogData()
  const { products, setProducts, media, resources, recordActivity } = useDemo()
  const c = useCopy()
  const { lang } = useLanguage()
  const router = useRouter()
  const source = products.find((p) => p.id === id)
  const [draft, setDraft] = useState<DemoProduct>(() =>
    source
      ? structuredClone(source)
      : {
          id: `demo-${Date.now()}`,
          slug: '',
          name: bi('', ''),
          summary: bi('', ''),
          category: 'oils',
          brand: brands[0].id,
          sectorIds: [],
          image: categories[0].image,
          status: 'draft',
          featured: false,
          specs: [],
          variants: [
            {
              id: `variant-${Date.now()}`,
              label: bi('عبوة تجريبية', 'Demo pack'),
              sku: '',
              pack: '20',
              availability: 'on_request',
              unit: bi('عبوة', 'pack'),
            },
          ],
        },
  )
  const [baseline, setBaseline] = useState(JSON.stringify(draft))
  useUnsavedChanges(JSON.stringify(draft) !== baseline)
  const [tab, setTab] = useState('basic')
  const [message, setMessage] = useState('')
  const tabs = [
    ['basic', 'البيانات الأساسية', 'Basics'],
    ['description', 'الوصف والاستخدامات', 'Description & applications'],
    ['specs', 'المواصفات', 'Specifications'],
    ['variants', 'العبوات والمتغيرات', 'Variants'],
    ['media', 'الصور والملفات', 'Media'],
    ['seo', 'الظهور والربط', 'Visibility & links'],
  ]
  if (id !== 'new' && !source)
    return (
      <EmptyState
        title={c('المنتج غير موجود', 'Product not found')}
        description={c(
          'المنتجات الجديدة المؤقتة لا تستمر بعد تحديث المتصفح.',
          'New preview products reset on browser reload.',
        )}
      >
        <Link className="btn-outline" href="/admin/products">
          {c('المنتجات', 'Products')}
        </Link>
      </EmptyState>
    )
  function save() {
    if (
      !draft.name.ar.trim() ||
      !draft.name.en.trim() ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)
    ) {
      setMessage(
        c(
          'أكمل الاسم باللغتين ورابطًا بحروف إنجليزية صغيرة وأرقام وشرطات.',
          'Complete both names and use a lowercase slug with letters, numbers and hyphens.',
        ),
      )
      setTab('basic')
      return
    }
    if (products.some((p) => p.id !== draft.id && p.slug === draft.slug)) {
      setMessage(
        c('رابط المنتج مستخدم بالفعل.', 'This product slug is already in use.'),
      )
      return
    }
    if (
      !brands.some((b) => b.id === draft.brand && b.status !== 'archived') ||
      !categories.some(
        (cat) => cat.id === draft.category && cat.status !== 'archived',
      )
    ) {
      setMessage(
        c('اختر علامة وتصنيفًا فعالين.', 'Select an active brand and category.'),
      )
      setTab('basic')
      return
    }
    if (
      draft.status === 'published' &&
      (!draft.description?.ar.trim() || !draft.description?.en.trim())
    ) {
      setMessage(
        c(
          'أكمل الوصف التفصيلي باللغتين للنشر.',
          'Complete detailed descriptions in both languages before publishing.',
        ),
      )
      setTab('description')
      return
    }
    const skus = draft.variants.map((v) => v.sku.trim().toLowerCase())
    const otherSkus = products
      .filter((p) => p.id !== draft.id)
      .flatMap((p) => p.variants.map((v) => v.sku.toLowerCase()))
    if (
      !skus.length ||
      skus.some((s) => !s || otherSkus.includes(s)) ||
      new Set(skus).size !== skus.length ||
      draft.variants.some(
        (v) =>
          !v.label.ar.trim() ||
          !v.label.en.trim() ||
          !Number.isFinite(Number(v.pack)) ||
          Number(v.pack) <= 0,
      )
    ) {
      setMessage(
        c(
          'كل متغير يحتاج كودًا فريدًا واسمًا باللغتين وحجمًا موجبًا.',
          'Each variant needs a unique SKU, bilingual labels and a positive pack size.',
        ),
      )
      setTab('variants')
      return
    }
    if (
      draft.status === 'published' &&
      (!draft.summary.ar.trim() || !draft.summary.en.trim())
    ) {
      setMessage(
        c(
          'الوصف المختصر باللغتين مطلوب في معاينة النشر.',
          'Both summaries are required to preview publication.',
        ),
      )
      setTab('basic')
      return
    }
    if (
      draft.status === 'published' &&
      (!categories.some(
        (cat) => cat.id === draft.category && cat.status === 'published',
      ) ||
        !brands.some((b) => b.id === draft.brand && b.status === 'published'))
    ) {
      setMessage(
        c(
          'انشر التصنيف والعلامة المرتبطين أولًا.',
          'Publish the related category and brand first.',
        ),
      )
      return
    }
    if (
      draft.status === 'published' &&
      draft.mainMediaId &&
      media.some(
        (m) =>
          m.id === draft.mainMediaId && (!m.altAr.trim() || !m.altEn.trim()),
      )
    ) {
      setMessage(
        c(
          'الصورة الرئيسية تحتاج نصًا بديلًا باللغتين.',
          'The main image requires bilingual alt text.',
        ),
      )
      setTab('media')
      return
    }
    if (
      draft.status === 'published' &&
      resources.attributes.some(
        (a) =>
          a.required === 'yes' &&
          a.category === draft.category &&
          !draft.specs.some((s) => s.label.ar === a.nameAr && s.value.trim()),
      )
    ) {
      setMessage(
        c(
          'أكمل المواصفات الإلزامية المعرفة للتصنيف.',
          'Complete required category attributes.',
        ),
      )
      setTab('specs')
      return
    }
    setProducts((current) =>
      current.some((p) => p.id === draft.id)
        ? current.map((p) => (p.id === draft.id ? draft : p))
        : [...current, draft],
    )
    setMessage(
      c(
        'تم تطبيق التعديل داخل المعاينة فقط. لن يستمر بعد إعادة تحميل الصفحة.',
        'Changes applied to this preview only. They will reset on reload.',
      ),
    )
    setBaseline(JSON.stringify(draft))
    recordActivity('product.saved', draft.id)
    if (id === 'new') router.push(`/admin/products/${draft.id}`)
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <Link
            href="/admin/products"
            className="mb-2 block text-sm text-primary"
          >
            {c('← قائمة المنتجات', '← Products')}
          </Link>
          <h1>
            {id === 'new'
              ? c('إضافة منتج تجريبي', 'Add a demo product')
              : draft.name[lang]}
          </h1>
          <p>
            {c(
              'محرر فرونت فقط — لا رفع ملفات ولا نشر على خادم.',
              'Frontend editor only — no file uploads or server publication.',
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {source?.status === 'published' && (
            <Link className="btn-outline" href={`/products/${source.id}`}>
              <ExternalLink className="size-4" />
              {c('معاينة', 'Preview')}
            </Link>
          )}
          <button className="btn-primary" onClick={save}>
            <Save className="size-4" />
            {c('تطبيق في المعاينة', 'Apply to preview')}
          </button>
        </div>
      </div>
      <p role="status" className="mb-4 text-sm text-primary">
        {message}
      </p>
      <div className="panel bg-white">
        <div
          className="admin-tabs"
          role="tablist"
          aria-label={c('تبويبات المنتج', 'Product tabs')}
        >
          {tabs.map(([key, ar, en]) => (
            <button
              role="tab"
              aria-selected={key === tab}
              aria-controls={`product-panel-${key}`}
              key={key}
              onClick={() => setTab(key)}
            >
              {c(ar, en)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`product-panel-${tab}`} className="pt-6">
          {tab === 'basic' && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={c('الاسم بالعربية *', 'Arabic name *')}>
                <input
                  className="control"
                  maxLength={160}
                  value={draft.name.ar}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: { ...draft.name, ar: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={c('الاسم بالإنجليزية *', 'English name *')}>
                <input
                  className="control"
                  dir="ltr"
                  maxLength={160}
                  value={draft.name.en}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: { ...draft.name, en: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={c('الرابط المختصر *', 'URL slug *')}>
                <input
                  className="control"
                  dir="ltr"
                  value={draft.slug}
                  maxLength={120}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                />
              </Field>
              <Field label={c('التصنيف', 'Category')}>
                <select
                  className="control"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as CategoryKey,
                      image: categories.find((t) => t.id === e.target.value)!
                        .image,
                    })
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name[lang]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={c('العلامة التجارية', 'Brand')}>
                <select
                  className="control"
                  value={draft.brand}
                  onChange={(e) =>
                    setDraft({ ...draft, brand: e.target.value })
                  }
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name[lang]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={c('الحالة في المعاينة', 'Preview status')}>
                <select
                  className="control"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as DemoProduct['status'],
                    })
                  }
                >
                  <option value="draft">{c('مسودة', 'Draft')}</option>
                  <option value="published">
                    {c('منشور تجريبيًا', 'Published in preview')}
                  </option>
                  <option value="archived">{c('مؤرشف', 'Archived')}</option>
                </select>
              </Field>
              {(['ar', 'en'] as const).map((locale) => (
                <Field
                  label={c(
                    locale === 'ar' ? 'وصف مختصر عربي' : 'وصف مختصر إنجليزي',
                    locale === 'ar' ? 'Arabic summary' : 'English summary',
                  )}
                  key={locale}
                >
                  <textarea
                    className="control"
                    rows={4}
                    dir={locale === 'ar' ? 'rtl' : 'ltr'}
                    maxLength={500}
                    value={draft.summary[locale]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        summary: { ...draft.summary, [locale]: e.target.value },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          )}
          {tab === 'description' && (
            <div className="space-y-6">
              {(['description', 'applications', 'benefits'] as const).map(
                (key) => (
                  <div className="grid gap-5 md:grid-cols-2" key={key}>
                    {(['ar', 'en'] as const).map((locale) => (
                      <Field
                        key={locale}
                        label={`${c(key === 'description' ? 'الوصف التفصيلي' : key === 'applications' ? 'الاستخدامات' : 'المزايا', key)} (${locale})`}
                      >
                        <textarea
                          rows={6}
                          className="control"
                          maxLength={10000}
                          value={draft[key]?.[locale] || ''}
                          dir={locale === 'ar' ? 'rtl' : 'ltr'}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [key]: {
                                ar: draft[key]?.ar || '',
                                en: draft[key]?.en || '',
                                [locale]: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                ),
              )}
              <Field
                label={c(
                  'مصدر المواصفات — داخلي',
                  'Specification source — internal',
                )}
              >
                <textarea
                  className="control"
                  rows={3}
                  maxLength={1000}
                  value={draft.sourceNote || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, sourceNote: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          {tab === 'specs' && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {c(
                  'مواصفات توضيحية فقط؛ لا تضف ادعاء اعتماد فني دون مصدر.',
                  'Sample specifications only; do not claim technical approval without a source.',
                )}
              </p>
              {draft.specs.map((spec, i) => (
                <div
                  className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  key={i}
                >
                  <Field label={c('الخاصية عربي', 'Arabic attribute')}>
                    <input
                      className="control"
                      value={spec.label.ar}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          specs: draft.specs.map((s, n) =>
                            n === i
                              ? {
                                  ...s,
                                  label: { ...s.label, ar: e.target.value },
                                }
                              : s,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label={c('الخاصية إنجليزي', 'English attribute')}>
                    <input
                      className="control"
                      value={spec.label.en}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          specs: draft.specs.map((s, n) =>
                            n === i
                              ? {
                                  ...s,
                                  label: { ...s.label, en: e.target.value },
                                }
                              : s,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label={c('القيمة', 'Value')}>
                    <input
                      className="control"
                      value={spec.value}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          specs: draft.specs.map((s, n) =>
                            n === i ? { ...s, value: e.target.value } : s,
                          ),
                        })
                      }
                    />
                  </Field>
                  <button
                    className="icon-button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        specs: draft.specs.filter((_, n) => n !== i),
                      })
                    }
                    aria-label={c('حذف الخاصية', 'Remove attribute')}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                className="btn-outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    specs: [...draft.specs, { label: bi('', ''), value: '' }],
                  })
                }
              >
                <Plus className="size-4" />
                {c('خاصية جديدة', 'Add attribute')}
              </button>
            </div>
          )}
          {tab === 'variants' && (
            <div className="space-y-6">
              {draft.variants.map((v, i) => (
                <div className="rounded-xl border p-5" key={v.id}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-bold">
                      {c('متغير', 'Variant')} {i + 1}
                    </h2>
                    <button
                      className="icon-button"
                      disabled={draft.variants.length === 1}
                      aria-label={c('حذف المتغير', 'Remove variant')}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter((x) => x.id !== v.id),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(['ar', 'en'] as const).map((locale) => (
                      <Field
                        key={locale}
                        label={
                          locale === 'ar'
                            ? c('عنوان عربي', 'Arabic label')
                            : c('عنوان إنجليزي', 'English label')
                        }
                      >
                        <input
                          className="control"
                          value={v.label[locale]}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              variants: draft.variants.map((x) =>
                                x.id === v.id
                                  ? {
                                      ...x,
                                      label: {
                                        ...x.label,
                                        [locale]: e.target.value,
                                      },
                                    }
                                  : x,
                              ),
                            })
                          }
                        />
                      </Field>
                    ))}
                    <Field label="SKU *">
                      <input
                        className="control"
                        dir="ltr"
                        value={v.sku}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((x) =>
                              x.id === v.id ? { ...x, sku: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label={c(
                        'حجم العبوة / عدد القطع',
                        'Pack size / piece count',
                      )}
                    >
                      <input
                        type="number"
                        min={1}
                        className="control"
                        value={v.pack}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((x) =>
                              x.id === v.id
                                ? { ...x, pack: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label={c('وحدة البيع', 'Sales unit')}>
                      <select
                        className="control"
                        value={v.unit.en}
                        onChange={(e) => {
                          const unit = resources.units.find(
                            (u) => u.code === e.target.value,
                          )!
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((x) =>
                              x.id === v.id
                                ? { ...x, unit: bi(unit.nameAr, unit.nameEn) }
                                : x,
                            ),
                          })
                        }}
                      >
                        {resources.units
                          .filter((u) => u.status !== 'archived')
                          .map((u) => (
                            <option key={u.id} value={u.code}>
                              {lang === 'ar' ? u.nameAr : u.nameEn}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label={c('التوفر', 'Availability')}>
                      <select
                        className="control"
                        value={v.availability}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            variants: draft.variants.map((x) =>
                              x.id === v.id
                                ? {
                                    ...x,
                                    availability: e.target.value as
                                      'on_request' | 'unavailable',
                                  }
                                : x,
                            ),
                          })
                        }
                      >
                        <option value="on_request">
                          {c('حسب الطلب', 'On request')}
                        </option>
                        <option value="unavailable">
                          {c('غير متاح', 'Unavailable')}
                        </option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
              <button
                className="btn-outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    variants: [
                      ...draft.variants,
                      {
                        ...draft.variants[0],
                        id: `v-${Date.now()}`,
                        sku: '',
                        label: bi('', ''),
                      },
                    ],
                  })
                }
              >
                <Plus className="size-4" />
                {c('إضافة متغير', 'Add variant')}
              </button>
            </div>
          )}
          {tab === 'media' && (
            <div className="space-y-5">
              <Image
                src={draft.image}
                alt={draft.name[lang]}
                width={320}
                height={240}
                className="rounded-xl"
              />
              <Field label={c('الصورة الرئيسية', 'Main image')}>
                <select
                  className="control"
                  value={draft.mainMediaId || ''}
                  onChange={(e) => {
                    const file = media.find((m) => m.id === e.target.value)
                    setDraft({
                      ...draft,
                      mainMediaId: file?.id,
                      image:
                        file?.url ||
                        categories.find((t) => t.id === draft.category)
                          ?.image ||
                        categories[0].image,
                    })
                  }}
                >
                  <option value="">
                    {c(
                      'صورة التصنيف الافتراضية',
                      'Default category illustration',
                    )}
                  </option>
                  {media
                    .filter(
                      (m) =>
                        m.mime.startsWith('image/') && m.status === 'ready',
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </Field>
              <fieldset>
                <legend className="mb-3 font-bold">
                  {c('صور وملفات مرتبطة', 'Linked images & documents')}
                </legend>
                {media
                  .filter((m) => m.status === 'ready')
                  .map((m) => (
                    <label key={m.id} className="mb-3 flex gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.mediaIds?.includes(m.id) || false}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            mediaIds: e.target.checked
                              ? [...(draft.mediaIds || []), m.id]
                              : (draft.mediaIds || []).filter(
                                  (id) => id !== m.id,
                                ),
                          })
                        }
                      />
                      {m.name} · {m.mime}
                    </label>
                  ))}
              </fieldset>
              <Link className="btn-outline" href="/admin/media">
                {c(
                  'اختيار ملفات محلية من المكتبة',
                  'Choose local files from the library',
                )}
              </Link>
              <p className="text-sm text-muted-foreground">
                {c(
                  'تطبق النصوص البديلة من مكتبة الوسائط؛ لا رفع أو فحص أو نشر حقيقي.',
                  'Alt text comes from the library. No real upload, scanning or publishing.',
                )}
              </p>
            </div>
          )}
          {tab === 'seo' && (
            <div className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                {(['seoTitle', 'seoDescription'] as const).flatMap((key) =>
                  (['ar', 'en'] as const).map((locale) => (
                    <Field
                      key={`${key}-${locale}`}
                      label={`${key === 'seoTitle' ? c('عنوان البحث', 'SEO title') : c('وصف البحث', 'SEO description')} (${locale})`}
                    >
                      <input
                        className="control"
                        maxLength={key === 'seoTitle' ? 70 : 180}
                        value={draft[key]?.[locale] || ''}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            [key]: {
                              ar: draft[key]?.ar || '',
                              en: draft[key]?.en || '',
                              [locale]: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  )),
                )}
              </div>
              <fieldset>
                <legend className="mb-3 font-bold">
                  {c('منتجات مرتبطة', 'Related products')}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {products
                    .filter(
                      (p) => p.id !== draft.id && p.status === 'published',
                    )
                    .map((p) => (
                      <label key={p.id} className="flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.relatedIds?.includes(p.id) || false}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              relatedIds: e.target.checked
                                ? [...(draft.relatedIds || []), p.id]
                                : (draft.relatedIds || []).filter(
                                    (id) => id !== p.id,
                                  ),
                            })
                          }
                        />
                        {p.name[lang]}
                      </label>
                    ))}
                </div>
              </fieldset>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) =>
                    setDraft({ ...draft, featured: e.target.checked })
                  }
                />
                {c('منتج مميز في المعاينة', 'Featured in preview')}
              </label>
              <fieldset>
                <legend className="mb-4 font-bold">
                  {c('القطاعات المرتبطة', 'Related sectors')}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {sectors.map((s) => (
                    <label className="flex gap-2" key={s.id}>
                      <input
                        type="checkbox"
                        checked={draft.sectorIds.includes(s.id)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            sectorIds: e.target.checked
                              ? [...draft.sectorIds, s.id]
                              : draft.sectorIds.filter((x) => x !== s.id),
                          })
                        }
                      />
                      {s.name[lang]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="rounded-xl bg-muted p-5">
                <p className="font-bold text-primary">
                  {draft.name[lang]} | M.A.S
                </p>
                <p className="my-2 font-mono text-xs">/products/{draft.slug}</p>
                <p className="text-sm text-muted-foreground">
                  {draft.summary[lang]}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
