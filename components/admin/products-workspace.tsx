'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Plus, Search, Save, ExternalLink, Trash2 } from 'lucide-react'
import { useDemo } from '@/components/demo/demo-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import {
  bi,
  brands,
  categories,
  sectors,
  type DemoProduct,
  type CategoryKey,
} from '@/lib/demo-data'

export function ProductWorkspace({ id }: { id?: string }) {
  const { products } = useDemo()
  const c = useCopy()
  const { lang } = useLanguage()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
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
      <div className="panel bg-white">
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
                {filtered.map((p) => (
                  <tr key={p.id}>
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
  const { products, setProducts } = useDemo()
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
  const [tab, setTab] = useState('basic')
  const [message, setMessage] = useState('')
  const tabs = [
    ['basic', 'البيانات الأساسية', 'Basics'],
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
            <div>
              <Image
                src={draft.image}
                alt={draft.name[lang]}
                width={320}
                height={240}
                className="mb-5 rounded-xl"
              />
              <p className="mb-4 text-muted-foreground">
                {c(
                  'الصورة الحالية توضيحية. يمكن تجربة اختيار ملفات محليًا من مكتبة الوسائط؛ الرفع غير مفعّل.',
                  'This is a category illustration. Try local file selection in the media library; uploads are not connected.',
                )}
              </p>
              <Link className="btn-outline" href="/admin/media">
                {c('مكتبة الوسائط', 'Media library')}
              </Link>
            </div>
          )}
          {tab === 'seo' && (
            <div className="space-y-6">
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
