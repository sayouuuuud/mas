'use client'
import { useUnsavedForm } from './form-state'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import {
  Archive,
  Check,
  CheckCircle2,
  Download,
  EyeOff,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
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
import { MediaPicker, RemoteSelect } from './entity-tools'
import { ImportPreview } from './import-preview'
import { Pagination } from './frontend-tools'
import {
  api,
  listAllRecords,
  BackendError,
  buildApiPath,
  downloadServerExport,
  formatApiError,
  saveResource,
} from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import type {
  AttributeRecord,
  BrandRecord,
  CategoryRecord,
  MediaAssetRecord,
  ProductDetailRecord,
  ProductFamily,
  PublishStatus,
  SectorRecord,
  ProductSpec,
  UnitRecord,
} from '@/lib/types'

const STATUS_BADGE: Record<
  PublishStatus,
  { ar: string; en: string; tone: 'green' | 'muted' | 'gold' }
> = {
  published: { ar: 'منشور', en: 'Published', tone: 'green' },
  draft: { ar: 'مسودة', en: 'Draft', tone: 'gold' },
  archived: { ar: 'مؤرشف', en: 'Archived', tone: 'muted' },
}

export function ProductWorkspace({ id }: { id?: string }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [showImport, setShowImport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const listPath = !id
    ? buildApiPath('/admin/products', {
        page,
        pageSize: 12,
        q: q.trim() || undefined,
        status: status || undefined,
      })
    : null

  const listQuery = useLiveQuery(listPath, async () => {
    if (!listPath) throw new Error('Editor mode')
    const res = await api<ProductDetailRecord[]>(listPath)
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

  if (id) return <ProductEditor id={id} />

  const rows = listQuery.data?.data || []
  const meta = listQuery.data?.meta || {
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  }
  async function runBulk(operation: 'unpublish' | 'archive') {
    if (busy || !selected.length) return
    const items = rows
      .filter((r) => selected.includes(r.id))
      .map((r) => ({ id: r.id, version: r.version }))
    if (!items.length) return
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      await api('/admin/products/bulk', {
        method: 'POST',
        body: { operation, items },
      })
      setSelected([])
      invalidateLiveQueries('/admin/products')
      invalidateLiveQueries('/catalog/')
      await listQuery.refresh()
      setFeedback(
        c(
          `تم تنفيذ العملية الجماعية (${operation}) على ${items.length} منتج.`,
          `Applied ${operation} to ${items.length} product(s).`,
        ),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraft(row: ProductDetailRecord) {
    if (busy || row.status !== 'draft') return
    if (
      !window.confirm(
        c(
          'هل تريد حذف مسودة المنتج نهائيًا؟',
          'Permanently delete this draft product?',
        ),
      )
    ) {
      return
    }
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      await api(`/admin/products/${row.id}`, {
        method: 'DELETE',
        body: { version: row.version },
      })
      setSelected((prev) => prev.filter((item) => item !== row.id))
      invalidateLiveQueries('/admin/products')
      await listQuery.refresh()
      setFeedback(c('تم حذف مسودة المنتج.', 'Draft product deleted.'))
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
          <h1>{c('المنتجات والكتالوج', 'Products')}</h1>
          <p>
            {c(
              'إدارة المنتجات والمتغيرات والمواصفات الفنية وفحوصات جاهزية النشر.',
              'Manage products, selling variants, technical specifications and publish readiness.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setShowImport(!showImport)}
          >
            <Upload className="size-4" />
            {c('استيراد CSV', 'Import CSV')}
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setErrorMsg('')
              try {
                await downloadServerExport('products', {
                  q: q.trim() || undefined,
                  status: status || undefined,
                })
                invalidateLiveQueries('/admin/audit-log')
              } catch (err) {
                setErrorMsg(formatApiError(err, lang))
              } finally {
                setBusy(false)
              }
            }}
          >
            <Download className="size-4" />
            {c('تصدير CSV', 'Export CSV')}
          </button>
          <Link href="/admin/products/new" className="btn-primary">
            <Plus className="size-4" />
            {c('منتج جديد', 'New product')}
          </Link>
        </div>
      </div>

      {showImport && (
        <ImportPreview
          onImported={async () => {
            invalidateLiveQueries('/admin/products')
            await listQuery.refresh()
            setShowImport(false)
          }}
        />
      )}

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

      <div className="panel bg-white">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_200px]">
          <input
            className="control"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder={c('بحث بالاسم أو الرمز…', 'Search name or slug…')}
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
            <option value="published">{c('منشور', 'Published')}</option>
            <option value="draft">{c('مسودة', 'Draft')}</option>
            <option value="archived">{c('مؤرشف', 'Archived')}</option>
          </select>
        </div>

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-tint px-4 py-3 text-sm">
            <span>
              {selected.length} {c('منتج محدد', 'selected')}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={() => void runBulk('unpublish')}
              >
                {c('إلغاء النشر للمحدد', 'Unpublish selected')}
              </button>
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={() => void runBulk('archive')}
              >
                {c('أرشفة المحدد', 'Archive selected')}
              </button>
            </div>
          </div>
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
            title={c('لا توجد منتجات في الكتالوج', 'No products found')}
            description={c(
              'أضف منتجًا جديدًا أو استورد منتجاتك عبر CSV لبدء بناء الكتالوج.',
              'Create a new product or import via CSV to populate your catalog.',
            )}
            action={
              <Link href="/admin/products/new" className="btn-primary">
                <Plus className="size-4" />
                {c('إنشاء أول منتج', 'Create first product')}
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label={c('تحديد الكل', 'Select all')}
                      checked={
                        rows.length > 0 &&
                        rows.every((p) => selected.includes(p.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? rows.map((p) => p.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>{c('المنتج', 'Product')}</th>
                  <th>{c('التصنيف', 'Category')}</th>
                  <th>{c('العلامة', 'Brand')}</th>
                  <th>{c('الحالة', 'Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const cat = (p as any).categoryName
                    ? { name: (p as any).categoryName }
                    : null
                  const br = (p as any).brandName
                    ? { name: (p as any).brandName }
                    : null
                  const badge =
                    STATUS_BADGE[p.status || 'draft'] || STATUS_BADGE.draft
                  return (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          aria-label={lang === 'ar' ? p.name.ar : p.name.en}
                          onChange={(e) =>
                            setSelected((prev) =>
                              e.target.checked
                                ? [...prev, p.id]
                                : prev.filter((item) => item !== p.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <strong>{lang === 'ar' ? p.name.ar : p.name.en}</strong>
                        <small
                          dir="ltr"
                          className="block font-mono text-xs text-muted-foreground"
                        >
                          /{p.slug}
                        </small>
                      </td>
                      <td>
                        {cat
                          ? lang === 'ar'
                            ? cat.name.ar
                            : cat.name.en
                          : '—'}
                      </td>
                      <td>
                        {br ? (lang === 'ar' ? br.name.ar : br.name.en) : '—'}
                      </td>
                      <td>
                        <Badge tone={badge.tone}>{c(badge.ar, badge.en)}</Badge>
                      </td>
                      <td className="text-end">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {c('تحرير', 'Edit')}
                          </Link>
                          {p.status === 'draft' && (
                            <button
                              type="button"
                              className="text-xs text-red-700 hover:underline"
                              disabled={busy}
                              onClick={() => void deleteDraft(p)}
                            >
                              {c('حذف', 'Delete')}
                            </button>
                          )}
                        </div>
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

type EditableVariant = {
  specifications?: ProductSpec[]
  mediaIds?: string[]
  order?: number
  id?: string
  sku: string
  manufacturerPartNumber: string
  labelAr: string
  labelEn: string
  unitId: string
  packQuantity: string
  packUnitId: string
  minQuantity: number
  quantityStep: number
  availability: 'available' | 'on_request' | 'unavailable'
  active: boolean
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ProductEditor({ id }: { id: string }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const router = useRouter()
  const isNew = id === 'new'

  const productQuery = useLiveQuery(
    !isNew ? `/admin/products/${id}` : null,
    async () => (await api<ProductDetailRecord>(`/admin/products/${id}`)).data,
  )

  const unitsQuery = useLiveQuery(
    '/admin/units?page=1&pageSize=48',
    async () => await listAllRecords<UnitRecord>('units'),
  )
  const attributesQuery = useLiveQuery(
    '/admin/attributes?page=1&pageSize=48',
    async () => await listAllRecords<AttributeRecord>('attributes'),
  )
  const categoriesQuery = useLiveQuery(
    '/admin/categories?page=1&pageSize=48',
    () => listAllRecords<CategoryRecord>('categories'),
  )
  const brandsQuery = useLiveQuery('/admin/brands?page=1&pageSize=48', () =>
    listAllRecords<BrandRecord>('brands'),
  )
  const [tab, setTab] = useState(0)
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [slug, setSlug] = useState('')
  const [draftFamily, setFamily] = useState<ProductFamily>('oils')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  useEffect(() => {
    if (isNew) {
      const query = new URLSearchParams(window.location.search)
      setCategoryId(query.get('categoryId') || '')
      setBrandId(query.get('brandId') || '')
      const sector = query.get('sectorId')
      if (sector) setSectorIds([sector])
    }
  }, [isNew])
  const [modelCode, setModelCode] = useState('')
  const [featured, setFeatured] = useState(false)
  const [summaryAr, setSummaryAr] = useState('')
  const [summaryEn, setSummaryEn] = useState('')
  const [descriptionAr, setDescriptionAr] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [applicationsTextAr, setApplicationsTextAr] = useState('')
  const [applicationsTextEn, setApplicationsTextEn] = useState('')
  const [benefitsTextAr, setBenefitsTextAr] = useState('')
  const [benefitsTextEn, setBenefitsTextEn] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [mainMediaId, setMainMediaId] = useState('')
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [sectorIds, setSectorIds] = useState<string[]>([])
  const [relatedIds, setRelatedIds] = useState<string[]>([])
  const [seoTitleAr, setSeoTitleAr] = useState('')
  const [seoTitleEn, setSeoTitleEn] = useState('')
  const [seoDescAr, setSeoDescAr] = useState('')
  const [seoDescEn, setSeoDescEn] = useState('')
  const [standardsText, setStandardsText] = useState('')
  const [specifications, setSpecifications] = useState<ProductSpec[]>([])
  const [packSize, setPackSize] = useState('')
  const [packMeasureId, setPackMeasureId] = useState('')
  const [packError, setPackError] = useState('')
  const [variants, setVariants] = useState<EditableVariant[]>([])
  const [initializedKey, setInitializedKey] = useState('')
  const [baseVersion, setBaseVersion] = useState<number>()
  const { markDirty, markSaved } = useUnsavedForm()

  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const activeUnits = (unitsQuery.data || []).filter(
    (u) => u.active && u.usage !== 'measure',
  )
  const product = productQuery.data

  useEffect(() => {
    if (!isNew && product && !initializedKey) {
      setBaseVersion(product.version)
      setNameAr(product.name.ar)
      setNameEn(product.name.en)
      setSlug(product.slug)
      setFamily(product.family)
      setCategoryId(product.categoryId || '')
      setBrandId(product.brandId || '')
      setModelCode(product.modelCode || '')
      setFeatured(Boolean(product.featured))
      setSummaryAr(product.summary?.ar || '')
      setSummaryEn(product.summary?.en || '')
      setDescriptionAr(product.description?.ar || '')
      setDescriptionEn(product.description?.en || '')
      setApplicationsTextAr(product.applications?.ar || '')
      setApplicationsTextEn(product.applications?.en || '')
      setBenefitsTextAr(product.benefits?.ar || '')
      setBenefitsTextEn(product.benefits?.en || '')
      setSourceNote(product.sourceNote || '')
      setMainMediaId(product.mainMediaId || '')
      setMediaIds(product.mediaIds || [])
      setSectorIds(product.sectorIds || [])
      setRelatedIds(product.relatedIds || [])
      setSeoTitleAr(product.seoTitle?.ar || '')
      setSeoTitleEn(product.seoTitle?.en || '')
      setSeoDescAr(product.seoDescription?.ar || '')
      setSeoDescEn(product.seoDescription?.en || '')
      setStandardsText((product.standards || []).join('\n'))
      setSpecifications(product.specifications || [])
      setVariants(
        (product.variants || []).map((v) => ({
          id: v.id,
          specifications: v.specifications,
          mediaIds: v.mediaIds,
          order: v.order,
          sku: v.sku || '',
          manufacturerPartNumber: v.manufacturerPartNumber || '',
          labelAr: v.label?.ar || '',
          labelEn: v.label?.en || '',
          unitId: v.unitId || '',
          packQuantity: v.packQuantity != null ? String(v.packQuantity) : '',
          packUnitId: v.packUnitId || '',
          minQuantity: Number(v.minQuantity || 1),
          quantityStep: Number(v.quantityStep || 1),
          availability: v.availability || 'available',
          active: v.active !== false,
        })),
      )
      setInitializedKey(`${product.id}:${product.version}`)
    }
  }, [isNew, product, initializedKey])

  const categories = [...(categoriesQuery.data || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name[lang].localeCompare(b.name[lang], lang),
  )
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const selectedCategory = categoriesById.get(categoryId)
  const family = selectedCategory?.family || draftFamily
  const mainCategories = categories.filter((category) => !category.parentId)
  const categoryIds = new Set<string>()
  let mainCategoryId = ''
  let currentCategory = categoryId
  while (currentCategory && !categoryIds.has(currentCategory)) {
    categoryIds.add(currentCategory)
    const category = categoriesById.get(currentCategory)
    if (category && !category.parentId) mainCategoryId = category.id
    currentCategory = category?.parentId || ''
  }
  const subcategories = mainCategoryId
    ? categories.filter(
        (category) => category.parentId === mainCategoryId ||
          (category.id === categoryId && category.id !== mainCategoryId),
      )
    : []

  function selectCategory(id: string) {
    const nextFamily = categoriesById.get(id)?.family
    setCategoryId(id)
    if (nextFamily) {
      setFamily(nextFamily)
      if (nextFamily !== family) setPackMeasureId('')
    }
  }

  const applicableAttributes = (attributesQuery.data || []).filter(
    (attribute) =>
      !attribute.categories?.length ||
      attribute.categories.some((rule) => categoryIds.has(rule.categoryId)),
  )
  const requiredAttributes = new Set(
    applicableAttributes
      .filter((attribute) =>
        attribute.categories?.some(
          (rule) => rule.required && categoryIds.has(rule.categoryId),
        ),
      )
      .map((attribute) => attribute.id),
  )
  const measureUnits = (unitsQuery.data || []).filter(
    (unit) => unit.active && unit.usage !== 'sale',
  )
  const defaultSellingUnit =
    activeUnits.find((unit) => unit.code === 'piece') || activeUnits[0]
  const defaultPackMeasure = measureUnits.find(
    (unit) => unit.code === (family === 'grease' ? 'kg' : 'l'),
  )
  const selectedPackMeasure = packMeasureId || defaultPackMeasure?.id || ''

  function updateVariant(index: number, patch: Partial<EditableVariant>) {
    markDirty()
    setVariants((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        const hasSizeChange =
          'packQuantity' in patch || 'packUnitId' in patch || 'unitId' in patch
        const next = { ...row, ...patch }
        if (hasSizeChange && row.labelAr === packName(row, 'ar'))
          next.labelAr = ''
        if (hasSizeChange && row.labelEn === packName(row, 'en'))
          next.labelEn = ''
        return next
      }),
    )
  }

  function addPack() {
    const amount = Number(packSize)
    const measure = measureUnits.find((unit) => unit.id === selectedPackMeasure)
    if (
      !measure ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000 ||
      !defaultSellingUnit
    ) {
      setPackError(
        c(
          'أدخل حجمًا صالحًا واختر وحدة المحتوى. يلزم وجود وحدة بيع نشطة.',
          'Enter a valid size and choose a content unit. An active selling unit is required.',
        ),
      )
      return
    }
    if (
      variants.some(
        (variant) =>
          variant.packUnitId === measure.id &&
          Number(variant.packQuantity) === amount &&
          variant.active,
      )
    ) {
      setPackError(c('الحجم ده موجود بالفعل.', 'This size already exists.'))
      return
    }
    setPackError('')
    setPackSize('')
    markDirty()
    setVariants((rows) => [
      ...rows,
      {
        sku: '',
        manufacturerPartNumber: '',
        labelAr: '',
        labelEn: '',
        unitId: defaultSellingUnit.id,
        packQuantity: String(amount),
        packUnitId: measure.id,
        minQuantity: 1,
        quantityStep: 1,
        availability: 'on_request',
        active: true,
        order: Math.max(-1, ...rows.map((row) => row.order || 0)) + 1,
      },
    ])
  }

  if (!isNew && productQuery.isLoading) return <LoadingState />
  if (!isNew && (productQuery.error || !product)) {
    return (
      <ErrorState
        error={productQuery.error}
        onRetry={() => void productQuery.refresh()}
        title={c('تعذر تحميل بيانات المنتج', 'Unable to load product')}
      />
    )
  }

  function packName(variant: EditableVariant, locale: 'ar' | 'en') {
    const measure = unitsQuery.data?.find(
      (unit) => unit.id === variant.packUnitId,
    )
    if (measure && variant.packQuantity)
      return `${variant.packQuantity} ${measure.name[locale]}`
    const sellingUnit = unitsQuery.data?.find(
      (unit) => unit.id === variant.unitId,
    )
    return sellingUnit?.name[locale] || (locale === 'ar' ? 'قطعة' : 'Piece')
  }

  function buildProductPayload() {
    const finalSlug = slug.trim() || toSlug(nameEn || nameAr)
    const combinedMedia = Array.from(
      new Set([
        ...(mainMediaId ? [mainMediaId] : []),
        ...mediaIds.filter(Boolean),
      ]),
    )
    return {
      slug: finalSlug,
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      family,
      categoryId: categoryId || null,
      brandId: brandId || null,
      modelCode: modelCode.trim(),
      featured,
      status: product?.status || 'draft',
      summary: {
        ar: summaryAr.trim() || descriptionAr.trim().slice(0, 500),
        en: summaryEn.trim() || descriptionEn.trim().slice(0, 500),
      },
      description: {
        ar: descriptionAr.trim() || summaryAr.trim(),
        en: descriptionEn.trim() || summaryEn.trim(),
      },
      applications: {
        ar: applicationsTextAr.trim(),
        en: applicationsTextEn.trim(),
      },
      benefits: { ar: benefitsTextAr.trim(), en: benefitsTextEn.trim() },
      sourceNote: sourceNote.trim(),
      seoTitle: { ar: seoTitleAr.trim(), en: seoTitleEn.trim() },
      seoDescription: { ar: seoDescAr.trim(), en: seoDescEn.trim() },
      mainMediaId: mainMediaId || null,
      mediaIds: combinedMedia,
      sectorIds,
      relatedIds,
      standards: [
        ...new Set(
          standardsText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      ],
      specifications,
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku.trim(),
        manufacturerPartNumber: v.manufacturerPartNumber.trim(),
        label: {
          ar: v.labelAr.trim() || v.labelEn.trim() || packName(v, 'ar'),
          en: v.labelEn.trim() || v.labelAr.trim() || packName(v, 'en'),
        },
        unitId: v.unitId || null,
        packQuantity:
          v.packQuantity && v.packUnitId ? Number(v.packQuantity) : null,
        packUnitId: v.packQuantity && v.packUnitId ? v.packUnitId : null,
        minQuantity: Number(v.minQuantity || 1),
        quantityStep: Number(v.quantityStep || 1),
        availability: v.availability,
        active: v.active,
        specifications: v.specifications || [],
        mediaIds: v.mediaIds || [],
        order: v.order || 0,
      })),
    }
  }

  async function handleSave(e?: FormEvent) {
    e?.preventDefault()
    if (busy) return null
    if (packSize.trim()) {
      setTab(2)
      setPackError(
        c(
          'اضغط «أضف الحجم» لحفظه مع المنتج، أو امسح الرقم.',
          'Add the entered size before saving, or clear it.',
        ),
      )
      return null
    }
    const payload = buildProductPayload()
    if (!payload.slug || !payload.name.ar || !payload.name.en) {
      setErrorMsg(
        c(
          'الاسم العربي والاسم الإنجليزي ورمز الرابط اللاتيني حقول مطلوبة.',
          'Arabic name, English name, and Latin URL slug are required.',
        ),
      )
      return null
    }

    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      const saved = await saveResource<ProductDetailRecord>(
        '/admin/products',
        payload,
        isNew ? undefined : product?.id,
        baseVersion,
      )
      markSaved()
      invalidateLiveQueries('/admin/products')
      invalidateLiveQueries('/catalog/')
      invalidateLiveQueries('/public/bootstrap')
      if (isNew) {
        router.replace(`/admin/products/${saved.id}`)
      } else {
        await productQuery.refresh()
        setInitializedKey('')
      }
      setFeedback(
        c('تم حفظ بيانات المنتج بنجاح.', 'Product saved successfully.'),
      )
      return saved
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function runPublicationAction(
    action: 'publish' | 'unpublish' | 'archive',
  ) {
    if (busy) return
    const saved = await handleSave()
    if (!saved) return
    setBusy(true)
    setErrorMsg('')
    try {
      await api(`/admin/products/${saved.id}/${action}`, {
        method: 'POST',
        body: { version: saved.version },
      })
      markSaved()
      invalidateLiveQueries('/admin/products')
      invalidateLiveQueries('/catalog/')
      invalidateLiveQueries('/public/bootstrap')
      if (isNew) {
        router.replace(`/admin/products/${saved.id}`)
      } else {
        await productQuery.refresh()
        setInitializedKey('')
      }
      setFeedback(
        action === 'publish'
          ? c(
              'اجتاز المنتج جميع فحوصات الجاهزية وأصبح منشورًا في الكتالوج العام.',
              'Product passed all readiness checks and is now published.',
            )
          : action === 'unpublish'
            ? c('تمت إعادة المنتج إلى المسودة.', 'Product moved back to draft.')
            : c('تمت أرشفة المنتج.', 'Product archived.'),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  const tabs = [
    c('بيانات المنتج', 'Product details'),
    c('المواصفات', 'Specifications'),
    c('العبوات والأحجام', 'Packs & sizes'),
    c('الصور والمستندات', 'Images & documents'),
  ]

  const currentStatus: PublishStatus = product?.status || 'draft'
  const statusMeta = STATUS_BADGE[currentStatus] || STATUS_BADGE.draft

  return (
    <form onChangeCapture={markDirty} onSubmit={handleSave}>
      <div className="admin-heading">
        <div>
          <Link href="/admin/products" className="text-sm text-primary">
            {c('العودة للمنتجات', 'Back to products')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1>
              {isNew
                ? c('إضافة منتج جديد', 'New product')
                : lang === 'ar'
                  ? product?.name.ar
                  : product?.name.en}
            </h1>
            <Badge tone={statusMeta.tone}>
              {c(statusMeta.ar, statusMeta.en)}
            </Badge>
            {!isNew && (
              <span className="font-mono text-xs text-muted-foreground">
                v{product?.version}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-outline">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {c('حفظ التغييرات', 'Save changes')}
          </button>
          {currentStatus !== 'published' && (
            <button
              type="button"
              disabled={busy}
              className="btn-primary"
              onClick={() => void runPublicationAction('publish')}
            >
              <Send className="size-4" />
              {c('نشر في الكتالوج', 'Publish')}
            </button>
          )}
          {currentStatus === 'published' && (
            <button
              type="button"
              disabled={busy}
              className="btn-outline"
              onClick={() => void runPublicationAction('unpublish')}
            >
              <EyeOff className="size-4" />
              {c('إلغاء النشر', 'Unpublish')}
            </button>
          )}
          {!isNew && currentStatus !== 'archived' && (
            <button
              type="button"
              disabled={busy}
              className="btn-outline"
              onClick={() => void runPublicationAction('archive')}
            >
              <Archive className="size-4" />
              {c('أرشفة', 'Archive')}
            </button>
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

      <div
        role="tablist"
        aria-label={c('أقسام تحرير المنتج', 'Product editor sections')}
        className="mb-6 flex flex-wrap gap-2 border-b pb-3"
      >
        {tabs.map((label, index) => (
          <button
            key={label}
            id={`product-tab-${index}`}
            role="tab"
            aria-selected={tab === index}
            aria-controls={`product-panel-${index}`}
            type="button"
            onClick={() => setTab(index)}
            className={`filter-pill ${tab === index ? 'filter-pill-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id={`product-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`product-tab-${tab}`}
        className="panel space-y-6 bg-white"
      >
        {tab === 0 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={c('اسم المنتج بالعربية', 'Arabic name')}>
                <input
                  className="control"
                  required
                  value={nameAr}
                  onChange={(event) => setNameAr(event.target.value)}
                />
              </Field>
              <Field label={c('اسم المنتج بالإنجليزية', 'English name')}>
                <input
                  className="control"
                  dir="ltr"
                  required
                  value={nameEn}
                  onChange={(event) => setNameEn(event.target.value)}
                />
              </Field>
              <Field label={c('التصنيف الرئيسي', 'Main category')}>
                <select
                  className="control"
                  disabled={categoriesQuery.isLoading}
                  value={mainCategoryId}
                  onChange={(event) => selectCategory(event.target.value)}
                >
                  <option value="">
                    {c('اختر التصنيف الرئيسي', 'Choose a main category')}
                  </option>
                  {mainCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name[lang]}
                      {category.status !== 'published'
                        ? c(' (غير منشور)', ' (unpublished)')
                        : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={c('التصنيف الفرعي', 'Subcategory')}>
                <select
                  className="control"
                  disabled={!mainCategoryId}
                  value={mainCategoryId && categoryId !== mainCategoryId ? categoryId : ''}
                  onChange={(event) => selectCategory(event.target.value || mainCategoryId)}
                >
                  <option value="">
                    {mainCategoryId
                      ? c('بدون تصنيف فرعي', 'No subcategory')
                      : c('اختر التصنيف الرئيسي أولًا', 'Choose the main category first')}
                  </option>
                  {subcategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name[lang]}
                      {category.status !== 'published'
                        ? c(' (غير منشور)', ' (unpublished)')
                        : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={c('العلامة التجارية', 'Brand')}>
                <select
                  className="control"
                  value={brandId}
                  onChange={(event) => setBrandId(event.target.value)}
                >
                  <option value="">{c('اختر علامة', 'Choose a brand')}</option>
                  {(brandsQuery.data || []).map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name[lang]}
                      {brand.status !== 'published'
                        ? c(' (مسودة أو مؤرشف)', ' (unpublished)')
                        : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <details className="md:col-span-2">
                <summary className="cursor-pointer text-sm text-primary">
                  {c('إضافة تصنيف أو علامة', 'Add a category or brand')}
                </summary>
                <div className="mt-3 grid items-start gap-4 sm:grid-cols-2">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      href={mainCategoryId ? `/admin/categories/new?parentId=${mainCategoryId}` : '/admin/categories/new'}
                      target="_blank"
                      rel="noopener"
                      className="text-primary underline"
                    >
                      {c('إضافة تصنيف فرعي', 'Add a subcategory')}
                    </Link>
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => void categoriesQuery.refresh().catch(() => {})}
                    >
                      {c('تحديث التصنيفات', 'Refresh categories')}
                    </button>
                  </div>
                  <RemoteSelect
                    resource="brands"
                    value={brandId}
                    label={c('العلامة التجارية', 'Brand')}
                    onChange={(id: string) => {
                      markDirty()
                      setBrandId(id)
                      void brandsQuery.refresh()
                    }}
                  />
                </div>
              </details>
              <Field label={c('الوصف بالعربية', 'Arabic description')}>
                <textarea
                  className="control"
                  rows={4}
                  value={descriptionAr}
                  onChange={(event) => setDescriptionAr(event.target.value)}
                />
              </Field>
              <Field label={c('الوصف بالإنجليزية', 'English description')}>
                <textarea
                  className="control"
                  dir="ltr"
                  rows={4}
                  value={descriptionEn}
                  onChange={(event) => setDescriptionEn(event.target.value)}
                />
              </Field>
            </div>
            <MediaPicker
              value={mainMediaId}
              onChange={(value: any) => {
                markDirty()
                setMainMediaId(value)
              }}
              label={c('الصورة الرئيسية للمنتج', 'Main product image')}
              alt={{ ar: nameAr, en: nameEn }}
            />

            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold">
                {c(
                  'تفاصيل اختيارية وإعدادات متقدمة',
                  'Optional details and advanced settings',
                )}
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label={c('رابط المنتج', 'URL slug')}>
                  <input
                    className="control"
                    dir="ltr"
                    placeholder={toSlug(nameEn)}
                    value={slug}
                    onChange={(event) => setSlug(toSlug(event.target.value))}
                  />
                </Field>
                <Field label={c('كود الموديل', 'Model code')}>
                  <input
                    className="control"
                    dir="ltr"
                    value={modelCode}
                    onChange={(event) => setModelCode(event.target.value)}
                  />
                </Field>
                {!selectedCategory?.family && (
                  <Field label={c('عائلة المنتج', 'Product family')}>
                    <select
                      className="control"
                      value={draftFamily}
                      onChange={(event) =>
                        setFamily(event.target.value as ProductFamily)
                      }
                    >
                      <option value="oils">{c('زيوت', 'Oils')}</option>
                      <option value="grease">{c('شحوم', 'Grease')}</option>
                      <option value="bearings">
                        {c('رولمان بلي', 'Bearings')}
                      </option>
                    </select>
                  </Field>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(event) => setFeatured(event.target.checked)}
                  />
                  {c('منتج مميز', 'Featured product')}
                </label>
                <Field label={c('ملخص بالعربية', 'Arabic summary')}>
                  <textarea
                    className="control"
                    rows={2}
                    value={summaryAr}
                    onChange={(event) => setSummaryAr(event.target.value)}
                  />
                </Field>
                <Field label={c('ملخص بالإنجليزية', 'English summary')}>
                  <textarea
                    className="control"
                    dir="ltr"
                    rows={2}
                    value={summaryEn}
                    onChange={(event) => setSummaryEn(event.target.value)}
                  />
                </Field>
                <Field
                  label={c(
                    'التطبيقات بالعربية (سطر لكل تطبيق)',
                    'Arabic applications (one per line)',
                  )}
                >
                  <textarea
                    rows={4}
                    className="control"
                    value={applicationsTextAr}
                    onChange={(e) => setApplicationsTextAr(e.target.value)}
                  />
                </Field>
                <Field
                  label={c(
                    'التطبيقات بالإنجليزية (سطر لكل تطبيق)',
                    'English applications (one per line)',
                  )}
                >
                  <textarea
                    rows={4}
                    dir="ltr"
                    className="control"
                    value={applicationsTextEn}
                    onChange={(e) => setApplicationsTextEn(e.target.value)}
                  />
                </Field>
                <Field
                  label={c(
                    'المزايا بالعربية (سطر لكل ميزة)',
                    'Arabic benefits (one per line)',
                  )}
                >
                  <textarea
                    rows={4}
                    className="control"
                    value={benefitsTextAr}
                    onChange={(e) => setBenefitsTextAr(e.target.value)}
                  />
                </Field>
                <Field
                  label={c(
                    'المزايا بالإنجليزية (سطر لكل ميزة)',
                    'English benefits (one per line)',
                  )}
                >
                  <textarea
                    rows={4}
                    dir="ltr"
                    className="control"
                    value={benefitsTextEn}
                    onChange={(e) => setBenefitsTextEn(e.target.value)}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field
                    label={c(
                      'ملاحظة مصدر المواصفات الداخلية',
                      'Internal specification source note',
                    )}
                  >
                    <input
                      className="control"
                      value={sourceNote}
                      onChange={(e) => setSourceNote(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <RemoteSelect
                  resource="sectors"
                  value={sectorIds}
                  onChange={(value: any) => {
                    markDirty()
                    setSectorIds(value)
                  }}
                  multiple
                  label={c('القطاعات المرتبطة', 'Applicable sectors')}
                />
                <RemoteSelect
                  resource="products"
                  value={relatedIds}
                  onChange={(ids: string[]) => {
                    markDirty()
                    setRelatedIds(ids.filter((value) => value !== id))
                  }}
                  multiple
                  label={c('منتجات ذات صلة', 'Related products')}
                />
                <div className="grid gap-5 border-t pt-5 md:grid-cols-2">
                  <Field label={c('عنوان SEO بالعربية', 'Arabic SEO title')}>
                    <input
                      className="control"
                      value={seoTitleAr}
                      onChange={(e) => setSeoTitleAr(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={c('عنوان SEO بالإنجليزية', 'English SEO title')}
                  >
                    <input
                      className="control"
                      dir="ltr"
                      value={seoTitleEn}
                      onChange={(e) => setSeoTitleEn(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={c('وصف SEO بالعربية', 'Arabic SEO description')}
                  >
                    <textarea
                      rows={2}
                      className="control"
                      value={seoDescAr}
                      onChange={(e) => setSeoDescAr(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={c('وصف SEO بالإنجليزية', 'English SEO description')}
                  >
                    <textarea
                      rows={2}
                      dir="ltr"
                      className="control"
                      value={seoDescEn}
                      onChange={(e) => setSeoDescEn(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </details>
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-5">
            <Field
              label={c('المواصفات والمعايير', 'Specifications and standards')}
              hint={c(
                'أضف مواصفة واحدة في كل سطر من النشرة الفنية للمنتج.',
                'Add one specification per line from the product data sheet.',
              )}
            >
              <textarea
                className="control"
                rows={6}
                dir="auto"
                placeholder={'API SN/CF\nACEA A3/B4\nMB 229.31'}
                value={standardsText}
                onChange={(event) => setStandardsText(event.target.value)}
              />
            </Field>
            {applicableAttributes.some(
              (attribute) => attribute.scope === 'product',
            ) && (
              <section className="space-y-3 border-t pt-4">
                <h2 className="font-bold">
                  {c(
                    'خصائص فنية للبحث والمقارنة',
                    'Technical attributes for search and comparison',
                  )}
                </h2>
                <VariantSpecsEditor
                  attributes={applicableAttributes.filter(
                    (attribute) => attribute.scope === 'product',
                  )}
                  requiredAttributes={requiredAttributes}
                  specifications={specifications}
                  onChange={setSpecifications}
                />
              </section>
            )}
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label={c('حجم العبوة', 'Pack size')}>
                  <input
                    className="control max-w-36"
                    type="number"
                    min="0.001"
                    max="1000000"
                    step="any"
                    placeholder="1"
                    value={packSize}
                    onChange={(event) => setPackSize(event.target.value)}
                  />
                </Field>
                <Field label={c('وحدة المحتوى', 'Content unit')}>
                  <select
                    className="control"
                    value={selectedPackMeasure}
                    onChange={(event) => setPackMeasureId(event.target.value)}
                  >
                    <option value="">{c('اختر وحدة', 'Choose a unit')}</option>
                    {measureUnits.map((unit) => (
                      <option value={unit.id} key={unit.id}>
                        {unit.name[lang]}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="button" className="btn-primary" onClick={addPack}>
                  <Plus className="size-4" />
                  {c('أضف الحجم', 'Add size')}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    markDirty()
                    setVariants((rows) => [
                      ...rows,
                      {
                        sku: '',
                        manufacturerPartNumber: '',
                        labelAr: '',
                        labelEn: '',
                        unitId: defaultSellingUnit?.id || '',
                        packQuantity: '',
                        packUnitId: '',
                        minQuantity: 1,
                        quantityStep: 1,
                        availability: 'on_request',
                        active: true,
                        order:
                          Math.max(-1, ...rows.map((row) => row.order || 0)) +
                          1,
                      },
                    ])
                  }}
                >
                  {c('أضف خيار بيع مخصص', 'Add custom selling option')}
                </button>
              </div>
              {packError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {packError}
                </p>
              )}
            </div>
            {variants.map((variant, index) => (
              <article
                key={variant.id || `new-${variant.order ?? index}`}
                className="space-y-3 rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <h2 className="min-w-32 self-center font-bold" dir="auto">
                    {(lang === 'ar' ? variant.labelAr : variant.labelEn) ||
                      packName(variant, lang)}
                  </h2>
                  <Field label={c('وحدة البيع', 'Selling unit')}>
                    <select
                      className="control"
                      value={variant.unitId}
                      onChange={(event) =>
                        updateVariant(index, { unitId: event.target.value })
                      }
                    >
                      <option value="">
                        {c('اختر وحدة', 'Choose a unit')}
                      </option>
                      {activeUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name[lang]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={c('التوفر', 'Availability')}>
                    <select
                      className="control"
                      value={variant.availability}
                      onChange={(event) =>
                        updateVariant(index, {
                          availability: event.target
                            .value as EditableVariant['availability'],
                        })
                      }
                    >
                      <option value="available">
                        {c('متوفر', 'Available')}
                      </option>
                      <option value="on_request">
                        {c('حسب الطلب', 'On request')}
                      </option>
                      <option value="unavailable">
                        {c('غير متوفر', 'Unavailable')}
                      </option>
                    </select>
                  </Field>
                  <button
                    type="button"
                    className="ms-auto self-center text-sm font-medium text-red-700 hover:underline"
                    onClick={() => {
                      markDirty()
                      setVariants((rows) => rows.filter((_, i) => i !== index))
                    }}
                  >
                    {c('إزالة', 'Remove')}
                  </button>
                </div>
                <details className="border-t pt-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {c('إعدادات العبوة المتقدمة', 'Advanced pack settings')}
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label={c('اسم العبوة بالعربية', 'Arabic pack name')}>
                      <input
                        className="control"
                        value={variant.labelAr}
                        placeholder={packName(variant, 'ar')}
                        onChange={(event) =>
                          updateVariant(index, { labelAr: event.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={c('اسم العبوة بالإنجليزية', 'English pack name')}
                    >
                      <input
                        className="control"
                        value={variant.labelEn}
                        placeholder={packName(variant, 'en')}
                        onChange={(event) =>
                          updateVariant(index, { labelEn: event.target.value })
                        }
                      />
                    </Field>
                    <Field label={c('الرمز الداخلي SKU', 'Internal SKU')}>
                      <input
                        className="control"
                        dir="ltr"
                        value={variant.sku}
                        onChange={(event) =>
                          updateVariant(index, { sku: event.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label={c('مرجع المصنّع', 'Manufacturer part number')}
                    >
                      <input
                        className="control"
                        dir="ltr"
                        value={variant.manufacturerPartNumber}
                        onChange={(event) =>
                          updateVariant(index, {
                            manufacturerPartNumber: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label={c('محتوى العبوة', 'Pack content')}>
                      <input
                        className="control"
                        type="number"
                        min="0.001"
                        step="any"
                        value={variant.packQuantity}
                        onChange={(event) =>
                          updateVariant(index, {
                            packQuantity: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label={c('وحدة المحتوى', 'Content unit')}>
                      <select
                        className="control"
                        value={variant.packUnitId}
                        onChange={(event) =>
                          updateVariant(index, {
                            packUnitId: event.target.value,
                          })
                        }
                      >
                        <option value="">{c('بدون', 'None')}</option>
                        {(unitsQuery.data || []).map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name[lang]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={c('أقل كمية للطلب', 'Minimum order quantity')}
                    >
                      <input
                        className="control"
                        type="number"
                        min="0.001"
                        step="any"
                        value={variant.minQuantity}
                        onChange={(event) =>
                          updateVariant(index, {
                            minQuantity: Number(event.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field label={c('خطوة الكمية', 'Quantity step')}>
                      <input
                        className="control"
                        type="number"
                        min="0.001"
                        step="any"
                        value={variant.quantityStep}
                        onChange={(event) =>
                          updateVariant(index, {
                            quantityStep: Number(event.target.value),
                          })
                        }
                      />
                    </Field>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={variant.active}
                        onChange={(event) =>
                          updateVariant(index, { active: event.target.checked })
                        }
                      />
                      {c('خيار بيع نشط', 'Active selling option')}
                    </label>
                  </div>
                </details>
                <VariantSpecsEditor
                  attributes={applicableAttributes.filter(
                    (attribute) => attribute.scope === 'variant',
                  )}
                  requiredAttributes={requiredAttributes}
                  specifications={variant.specifications || []}
                  onChange={(specifications) =>
                    updateVariant(index, { specifications })
                  }
                />
              </article>
            ))}
            {variants.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {c(
                  'أضف حجمًا أو خيار بيع قبل النشر.',
                  'Add at least one size or selling option before publishing.',
                )}
              </p>
            )}
          </div>
        )}

        {tab === 3 && (
          <div className="space-y-5">
            <MediaPicker
              value={mediaIds}
              onChange={(value: any) => {
                markDirty()
                setMediaIds(value)
              }}
              multiple
              kind="all"
              label={c(
                'معرض الصور والملفات الفنية',
                'Gallery and technical documents',
              )}
              alt={{ ar: nameAr, en: nameEn }}
            />
          </div>
        )}
      </div>
    </form>
  )
}

function VariantSpecsEditor({
  attributes,
  requiredAttributes,
  specifications,
  onChange,
}: {
  attributes: AttributeRecord[]
  requiredAttributes: Set<string>
  specifications: ProductSpec[]
  onChange: (specs: ProductSpec[]) => void
}) {
  const { lang } = useLanguage()
  const c = useCopy()
  function update(
    attributeId: string,
    value: ProductSpec['value'] | undefined,
  ) {
    const remaining = specifications.filter(
      (spec) => spec.attributeId !== attributeId,
    )
    onChange(
      value === undefined ? remaining : [...remaining, { attributeId, value }],
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {attributes.map((attribute) => {
        const value = specifications.find(
          (spec) => spec.attributeId === attribute.id,
        )?.value
        return (
          <Field
            key={attribute.id}
            label={
              attribute.name[lang] +
              (requiredAttributes.has(attribute.id) ? ' *' : '')
            }
          >
            {attribute.type === 'boolean' ? (
              <select
                className="control"
                value={value === undefined ? '' : String(value)}
                onChange={(e) =>
                  update(
                    attribute.id,
                    e.target.value === ''
                      ? undefined
                      : e.target.value === 'true',
                  )
                }
              >
                <option value="">{c('غير محدد', 'Unset')}</option>
                <option value="true">{c('نعم', 'Yes')}</option>
                <option value="false">{c('لا', 'No')}</option>
              </select>
            ) : attribute.type === 'option' ? (
              <select
                className="control"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) =>
                  update(attribute.id, e.target.value || undefined)
                }
              >
                <option value="">{c('اختر قيمة', 'Select option')}</option>
                {attribute.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label[lang]}
                  </option>
                ))}
              </select>
            ) : attribute.type === 'multi_option' ? (
              <select
                multiple
                className="control"
                value={Array.isArray(value) ? value : []}
                onChange={(e) =>
                  update(
                    attribute.id,
                    Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
              >
                {attribute.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label[lang]}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="control"
                type={attribute.type === 'number' ? 'number' : 'text'}
                step="any"
                value={
                  typeof value === 'number' || typeof value === 'string'
                    ? value
                    : ''
                }
                onChange={(e) =>
                  update(
                    attribute.id,
                    e.target.value === ''
                      ? undefined
                      : attribute.type === 'number'
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
          </Field>
        )
      })}
    </div>
  )
}
