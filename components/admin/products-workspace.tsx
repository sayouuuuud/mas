'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { ImportPreview } from './import-preview'
import { Pagination } from './frontend-tools'
import {
  api,
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
  SpecificationInput,
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

  const categoriesQuery = useLiveQuery(
    !id ? '/admin/categories?page=1&pageSize=48' : null,
    async () =>
      (await api<CategoryRecord[]>('/admin/categories?page=1&pageSize=48')).data,
  )

  const brandsQuery = useLiveQuery(
    !id ? '/admin/brands?page=1&pageSize=48' : null,
    async () =>
      (await api<BrandRecord[]>('/admin/brands?page=1&pageSize=48')).data,
  )

  if (id) return <ProductEditor id={id} />

  const rows = listQuery.data?.data || []
  const meta = listQuery.data?.meta || {
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  }
  const catMap = new Map(
    (categoriesQuery.data || []).map((cat) => [cat.id, cat]),
  )
  const brandMap = new Map((brandsQuery.data || []).map((b) => [b.id, b]))

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
                  const cat = p.categoryId ? catMap.get(p.categoryId) : null
                  const br = p.brandId ? brandMap.get(p.brandId) : null
                  const badge = STATUS_BADGE[p.status || 'draft'] || STATUS_BADGE.draft
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
                        <Badge tone={badge.tone}>
                          {c(badge.ar, badge.en)}
                        </Badge>
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

  const categoriesQuery = useLiveQuery(
    '/admin/categories?page=1&pageSize=48',
    async () =>
      (await api<CategoryRecord[]>('/admin/categories?page=1&pageSize=48')).data,
  )
  const brandsQuery = useLiveQuery(
    '/admin/brands?page=1&pageSize=48',
    async () =>
      (await api<BrandRecord[]>('/admin/brands?page=1&pageSize=48')).data,
  )
  const sectorsQuery = useLiveQuery(
    '/admin/sectors?page=1&pageSize=48',
    async () =>
      (await api<SectorRecord[]>('/admin/sectors?page=1&pageSize=48')).data,
  )
  const unitsQuery = useLiveQuery(
    '/admin/units?page=1&pageSize=48',
    async () =>
      (await api<UnitRecord[]>('/admin/units?page=1&pageSize=48')).data,
  )
  const attributesQuery = useLiveQuery(
    '/admin/attributes?page=1&pageSize=48',
    async () =>
      (await api<AttributeRecord[]>('/admin/attributes?page=1&pageSize=48'))
        .data,
  )
  const mediaQuery = useLiveQuery(
    '/admin/media?page=1&pageSize=48',
    async () =>
      (await api<MediaAssetRecord[]>('/admin/media?page=1&pageSize=48')).data,
  )
  const relatedProductsQuery = useLiveQuery(
    '/admin/products?page=1&pageSize=48',
    async () =>
      (await api<ProductDetailRecord[]>('/admin/products?page=1&pageSize=48'))
        .data,
  )

  const [tab, setTab] = useState(0)
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [slug, setSlug] = useState('')
  const [family, setFamily] = useState<ProductFamily>('oils')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
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
  const [specifications, setSpecifications] = useState<SpecificationInput[]>([])
  const [variants, setVariants] = useState<EditableVariant[]>([])
  const [initializedKey, setInitializedKey] = useState('')

  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const activeUnits = (unitsQuery.data || []).filter((u) => u.active)
  const product = productQuery.data

  useEffect(() => {
    if (!isNew && product && initializedKey !== `${product.id}:${product.version}`) {
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
      setApplicationsTextAr(
        product.applications?.ar || '',
      )
      setApplicationsTextEn(
        product.applications?.en || '',
      )
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
      setSpecifications((product.specifications || []).map(sp => {
        const attribute = attributesQuery.data?.find(a => a.id === sp.attributeId)
        return { attributeId: sp.attributeId,
          ...(typeof sp.value === 'number' ? { valueNumber: sp.value } :
            typeof sp.value === 'boolean' ? { valueBoolean: sp.value } :
            Array.isArray(sp.value) ? { optionIds: sp.value } :
            attribute?.type === 'option' ? { optionId: sp.value } : { valueText: sp.value }) }
      }))
      setVariants(
        (product.variants || []).map((v) => ({
          id: v.id,
          specifications: v.specifications, mediaIds: v.mediaIds, order: v.order,
          sku: v.sku || '',
          manufacturerPartNumber: v.manufacturerPartNumber || '',
          labelAr: v.label?.ar || '',
          labelEn: v.label?.en || '',
          unitId: v.unitId,
          packQuantity: v.packQuantity != null ? String(v.packQuantity) : '',
          packUnitId: v.packUnitId || '',
          minQuantity: Number(v.minQuantity || 1),
          quantityStep: Number(v.quantityStep || 1),
          availability: v.availability || 'available',
          active: v.active !== false,
        })),
      )
      setInitializedKey(`${product.id}:${product.version}`)
    } else if (isNew && initializedKey !== 'new' && activeUnits.length > 0) {
      setVariants([
        {
          sku: '',
          manufacturerPartNumber: '',
          labelAr: 'العبوة القياسية',
          labelEn: 'Standard Unit',
          unitId: activeUnits[0].id,
          packQuantity: '',
          packUnitId: '',
          minQuantity: 1,
          quantityStep: 1,
          availability: 'available',
          active: true,
        },
      ])
      setInitializedKey('new')
    }
  }, [isNew, product, initializedKey, activeUnits])

  const applicableProductAttributes = useMemo(() => {
    const allAttrs = (attributesQuery.data || []).filter(
      (a) => a.scope === 'product',
    )
    if (!categoryId) return allAttrs
    return allAttrs.filter(
      (a) =>
        !a.categories?.length ||
        a.categories.some((cItem) => cItem.categoryId === categoryId),
    )
  }, [attributesQuery.data, categoryId])

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

  const readyPublicMedia = (mediaQuery.data || []).filter(
    (m) => m.visibility === 'public' && m.status === 'ready',
  )
  const readyImages = readyPublicMedia.filter((m) => m.kind === 'image')
  const quarantinedCount = (mediaQuery.data || []).filter(
    (m) => m.status === 'quarantined',
  ).length

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
      summary: { ar: summaryAr.trim(), en: summaryEn.trim() },
      description: { ar: descriptionAr.trim(), en: descriptionEn.trim() },
      applications: { ar: applicationsTextAr.trim(), en: applicationsTextEn.trim() },
      benefits: { ar: benefitsTextAr.trim(), en: benefitsTextEn.trim() },
      sourceNote: sourceNote.trim(),
      seoTitle: { ar: seoTitleAr.trim(), en: seoTitleEn.trim() },
      seoDescription: { ar: seoDescAr.trim(), en: seoDescEn.trim() },
      mainMediaId: mainMediaId || null,
      mediaIds: combinedMedia,
      sectorIds,
      relatedIds,
      specifications: specifications.filter(
        (sp) =>
          (sp.valueText != null && sp.valueText.trim() !== '') ||
          sp.valueNumber != null ||
          sp.valueBoolean != null ||
          Boolean(sp.optionId) ||
          Boolean(sp.optionIds?.length),
      ).map(sp => ({ attributeId: sp.attributeId, value: sp.valueNumber ?? sp.valueBoolean ?? sp.optionId ?? sp.optionIds ?? sp.valueText ?? '' })),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku.trim(),
        manufacturerPartNumber: v.manufacturerPartNumber.trim(),
        label: {
          ar: v.labelAr.trim() || v.labelEn.trim(),
          en: v.labelEn.trim() || v.labelAr.trim(),
        },
        unitId: v.unitId,
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
    if (!variants.length || variants.some((v) => !v.unitId)) {
      setErrorMsg(
        c(
          'أضف متغير بيع واحدًا على الأقل بوحدة بيع نشطة قبل الحفظ.',
          'Add at least one variant with an active selling unit before saving.',
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
        product?.version,
      )
      invalidateLiveQueries('/admin/products')
      invalidateLiveQueries('/catalog/')
      invalidateLiveQueries('/public/bootstrap')
      if (isNew) {
        router.replace(`/admin/products/${saved.id}`)
      } else {
        await productQuery.refresh()
      }
      setFeedback(c('تم حفظ بيانات المنتج بنجاح.', 'Product saved successfully.'))
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
      invalidateLiveQueries('/admin/products')
      invalidateLiveQueries('/catalog/')
      invalidateLiveQueries('/public/bootstrap')
      if (isNew) {
        router.replace(`/admin/products/${saved.id}`)
      } else {
        await productQuery.refresh()
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
    c('الأساسيات', 'Basics'),
    c('الوصف والتطبيقات', 'Description'),
    c('المواصفات الفنية', 'Specifications'),
    c('المتغيرات والعبوات', 'Variants'),
    c('الوسائط والملفات', 'Media'),
    c('SEO والروابط', 'SEO & Links'),
  ]

  const currentStatus: PublishStatus = product?.status || 'draft'
  const statusMeta = STATUS_BADGE[currentStatus] || STATUS_BADGE.draft

  return (
    <form onSubmit={handleSave}>
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
        <p role="status" className="mb-5 flex items-center gap-2 text-sm font-medium text-primary">
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
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={c('الاسم بالعربية', 'Arabic name')}>
              <input
                className="control"
                required
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
              />
            </Field>
            <Field label={c('الاسم بالإنجليزية', 'English name')}>
              <input
                className="control"
                dir="ltr"
                required
                value={nameEn}
                onChange={(e) => {
                  setNameEn(e.target.value)
                  if (isNew && !slug) setSlug(toSlug(e.target.value))
                }}
              />
            </Field>
            <Field label={c('رمز الرابط اللاتيني (Slug)', 'URL slug')}>
              <input
                className="control font-mono"
                dir="ltr"
                required
                placeholder="hydraulic-oil-iso-68"
                value={slug}
                onChange={(e) => setSlug(toSlug(e.target.value))}
              />
            </Field>
            <Field label={c('العائلة الرئيسية', 'Product family')}>
              <select
                className="control"
                value={family}
                onChange={(e) => setFamily(e.target.value as ProductFamily)}
              >
                <option value="oils">{c('زيوت صناعية', 'Industrial Oils')}</option>
                <option value="grease">{c('شحومات', 'Greases')}</option>
                <option value="bearings">
                  {c('رولمان بلي', 'Industrial Bearings')}
                </option>
              </select>
            </Field>
            <Field label={c('التصنيف (مطلوب للنشر)', 'Category (required to publish)')}>
              <select
                className="control"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">{c('اختر تصنيفًا…', 'Select category…')}</option>
                {(categoriesQuery.data || []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {lang === 'ar' ? cat.name.ar : cat.name.en} ({cat.status})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={c('العلامة التجارية', 'Brand')}>
              <select
                className="control"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">{c('بدون علامة محددة', 'No brand')}</option>
                {(brandsQuery.data || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {lang === 'ar' ? b.name.ar : b.name.en} ({b.status})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={c('كود الموديل / المرجع الفني', 'Model / technical code')}>
              <input
                className="control font-mono"
                dir="ltr"
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              {c('إظهار ضمن المنتجات المختارة في الرئيسية', 'Feature on homepage')}
            </label>
            <Field label={c('ملخص قصير بالعربية', 'Arabic summary')}>
              <textarea
                rows={2}
                className="control"
                value={summaryAr}
                onChange={(e) => setSummaryAr(e.target.value)}
              />
            </Field>
            <Field label={c('ملخص قصير بالإنجليزية', 'English summary')}>
              <textarea
                rows={2}
                dir="ltr"
                className="control"
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
              />
            </Field>
          </div>
        )}

        {tab === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={c('الوصف التفصيلي بالعربية', 'Arabic description')}>
              <textarea
                rows={5}
                className="control"
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
              />
            </Field>
            <Field label={c('الوصف التفصيلي بالإنجليزية', 'English description')}>
              <textarea
                rows={5}
                dir="ltr"
                className="control"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
              />
            </Field>
            <Field label={c('التطبيقات بالعربية (سطر لكل تطبيق)', 'Arabic applications (one per line)')}>
              <textarea
                rows={4}
                className="control"
                value={applicationsTextAr}
                onChange={(e) => setApplicationsTextAr(e.target.value)}
              />
            </Field>
            <Field label={c('التطبيقات بالإنجليزية (سطر لكل تطبيق)', 'English applications (one per line)')}>
              <textarea
                rows={4}
                dir="ltr"
                className="control"
                value={applicationsTextEn}
                onChange={(e) => setApplicationsTextEn(e.target.value)}
              />
            </Field>
            <Field label={c('المزايا بالعربية (سطر لكل ميزة)', 'Arabic benefits (one per line)')}>
              <textarea
                rows={4}
                className="control"
                value={benefitsTextAr}
                onChange={(e) => setBenefitsTextAr(e.target.value)}
              />
            </Field>
            <Field label={c('المزايا بالإنجليزية (سطر لكل ميزة)', 'English benefits (one per line)')}>
              <textarea
                rows={4}
                dir="ltr"
                className="control"
                value={benefitsTextEn}
                onChange={(e) => setBenefitsTextEn(e.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label={c('ملاحظة مصدر المواصفات الداخلية', 'Internal specification source note')}>
                <input
                  className="control"
                  value={sourceNote}
                  onChange={(e) => setSourceNote(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {c(
                'تُقرأ خصائص المواصفات من قاموس المواصفات الفنية، مع تمييز الحقول الإلزامية للتصنيف المختار.',
                'Specification fields come from your Attributes dictionary, highlighting required attributes for the selected category.',
              )}
            </p>
            {applicableProductAttributes.length === 0 ? (
              <EmptyState
                title={c('لا توجد مواصفات معرّفة بعد', 'No product attributes defined')}
                description={c(
                  'يمكنك تعريف مواصفات مثل اللزوجة أو درجة NLGI أو القطر الداخلي من قسم المواصفات الفنية.',
                  'Define attributes such as ISO VG, NLGI grade or bore diameter in the Attributes section.',
                )}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {applicableProductAttributes.map((attr) => {
                  const rule = attr.categories?.find(
                    (cRule) => cRule.categoryId === categoryId,
                  )
                  const current = specifications.find(
                    (s) => s.attributeId === attr.id,
                  )

                  function upsertSpec(patch: Partial<SpecificationInput>) {
                    setSpecifications((prev) => {
                      const existing = prev.find(
                        (s) => s.attributeId === attr.id,
                      )
                      if (existing) {
                        return prev.map((s) =>
                          s.attributeId === attr.id ? { ...s, ...patch } : s,
                        )
                      }
                      return [...prev, { attributeId: attr.id, ...patch }]
                    })
                  }

                  const labelText = `${lang === 'ar' ? attr.name.ar : attr.name.en} (${attr.code})${rule?.required ? ' *' : ''}`

                  return (
                    <div key={attr.id} className="rounded-xl border p-4">
                      <Field label={labelText}>
                        {attr.type === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            className="control font-mono"
                            dir="ltr"
                            placeholder={
                              rule?.min != null || rule?.max != null
                                ? `${rule?.min ?? '—'} .. ${rule?.max ?? '—'}`
                                : ''
                            }
                            value={current?.valueNumber ?? ''}
                            onChange={(e) =>
                              upsertSpec({
                                valueNumber:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        ) : attr.type === 'boolean' ? (
                          <select
                            className="control"
                            value={
                              current?.valueBoolean == null
                                ? ''
                                : current.valueBoolean
                                  ? 'true'
                                  : 'false'
                            }
                            onChange={(e) =>
                              upsertSpec({
                                valueBoolean:
                                  e.target.value === ''
                                    ? null
                                    : e.target.value === 'true',
                              })
                            }
                          >
                            <option value="">{c('غير محدد', 'Unset')}</option>
                            <option value="true">{c('نعم', 'Yes')}</option>
                            <option value="false">{c('لا', 'No')}</option>
                          </select>
                        ) : attr.type === 'option' ? (
                          <select
                            className="control"
                            value={current?.optionId || ''}
                            onChange={(e) =>
                              upsertSpec({ optionId: e.target.value || null })
                            }
                          >
                            <option value="">
                              {c('اختر قيمة…', 'Select option…')}
                            </option>
                            {(attr.options || []).map((opt) => (
                              <option key={opt.id || opt.code} value={opt.id}>
                                {lang === 'ar' ? opt.label.ar : opt.label.en}
                              </option>
                            ))}
                          </select>
                        ) : attr.type === 'multi_option' ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(attr.options || []).map((opt) => {
                              const optId = opt.id || ''
                              const checked = Boolean(
                                current?.optionIds?.includes(optId),
                              )
                              return (
                                <label
                                  key={optId || opt.code}
                                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const nextIds = e.target.checked
                                        ? [
                                            ...(current?.optionIds || []),
                                            optId,
                                          ]
                                        : (current?.optionIds || []).filter(
                                            (x) => x !== optId,
                                          )
                                      upsertSpec({ optionIds: nextIds })
                                    }}
                                  />
                                  {lang === 'ar' ? opt.label.ar : opt.label.en}
                                </label>
                              )
                            })}
                          </div>
                        ) : (
                          <input
                            className="control"
                            value={current?.valueText || ''}
                            onChange={(e) =>
                              upsertSpec({ valueText: e.target.value || null })
                            }
                          />
                        )}
                      </Field>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 3 && (
          <div className="space-y-4">
            {!activeUnits.length && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                {c(
                  'يجب إنشاء وحدة بيع نشطة أولًا من قسم وحدات البيع والقياس قبل حفظ المتغيرات.',
                  'Create at least one active selling unit in Units before saving variants.',
                )}{' '}
                <Link href="/admin/units/new" className="font-semibold underline">
                  {c('إضافة وحدة الآن', 'Create unit now')}
                </Link>
              </div>
            )}

            {variants.map((v, idx) => (
              <div key={v.id || idx} className="space-y-4 rounded-xl border p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label={c('وصف العبوة بالعربية', 'Arabic label')}>
                    <input
                      className="control"
                      required
                      value={v.labelAr}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, labelAr: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={c('وصف العبوة بالإنجليزية', 'English label')}>
                    <input
                      className="control"
                      dir="ltr"
                      required
                      value={v.labelEn}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, labelEn: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="SKU">
                    <input
                      className="control font-mono"
                      dir="ltr"
                      value={v.sku}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, sku: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={c('وحدة البيع', 'Selling unit')}>
                    <select
                      className="control"
                      value={v.unitId}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, unitId: e.target.value } : row,
                          ),
                        )
                      }
                    >
                      <option value="">{c('اختر وحدة…', 'Select unit…')}</option>
                      {activeUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {lang === 'ar' ? u.name.ar : u.name.en} ({u.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="grid gap-3 md:grid-cols-5 md:items-end">
                  <Field label={c('الحد الأدنى للكمية', 'Min qty')}>
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      className="control"
                      value={v.minQuantity}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, minQuantity: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={c('خطوة الزيادة', 'Qty step')}>
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      className="control"
                      value={v.quantityStep}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, quantityStep: Number(e.target.value) }
                              : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={c('حجم العبوة الداخلي', 'Pack size (optional)')}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="control"
                      value={v.packQuantity}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, packQuantity: e.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={c('وحدة المحتوى', 'Pack unit')}>
                    <select
                      className="control"
                      value={v.packUnitId}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, packUnitId: e.target.value }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="">{c('بدون', 'None')}</option>
                      {activeUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={c('حالة التوفر', 'Availability')}>
                    <select
                      className="control"
                      value={v.availability}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, availability: e.target.value as any }
                              : row,
                          ),
                        )
                      }
                    >
                      <option value="available">{c('متوفر', 'Available')}</option>
                      <option value="on_request">
                        {c('حسب الطلب', 'On request')}
                      </option>
                      <option value="unavailable">
                        {c('غير متوفر حاليًا', 'Unavailable')}
                      </option>
                    </select>
                  </Field>
                </div>

                <VariantSpecsEditor
                  attributes={(attributesQuery.data || []).filter(a => a.scope === 'variant' && (!a.categories.length || a.categories.some(rule => rule.categoryId === categoryId)))}
                  specifications={v.specifications || []}
                  onChange={specs => setVariants(current => current.map((row, i) => i === idx ? { ...row, specifications: specs } : row))}
                />
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={v.active}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? { ...row, active: e.target.checked }
                              : row,
                          ),
                        )
                      }
                    />
                    {c('متغير بيع نشط', 'Active selling variant')}
                  </label>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      className="text-xs font-medium text-red-700 hover:underline"
                      onClick={() =>
                        setVariants((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      {c('إزالة المتغير', 'Remove variant')}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  {
                    sku: '',
                    manufacturerPartNumber: '',
                    labelAr: '',
                    labelEn: '',
                    unitId: activeUnits[0]?.id || '',
                    packQuantity: '',
                    packUnitId: '',
                    minQuantity: 1,
                    quantityStep: 1,
                    availability: 'available',
                    active: true,
                  },
                ])
              }
            >
              <Plus className="size-4" />
              {c('إضافة عبوة / متغير بيع', 'Add selling variant')}
            </button>
          </div>
        )}

        {tab === 4 && (
          <div className="space-y-5">
            {quarantinedCount > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                {c(
                  `يوجد ${quarantinedCount} ملف في الحجر الأمني (quarantined) بانتظار المعالجة؛ الوسائط الجاهزة (ready) فقط متاحة للربط والنشر العام.`,
                  `${quarantinedCount} media file(s) are currently quarantined pending file processing; only ready public files can be attached for publication.`,
                )}
              </div>
            )}

            <Field
              label={c(
                'الصورة الرئيسية للمنتج (مطلوبة للنشر وبنص بديل عربي وإنجليزي)',
                'Main product image (required to publish; must have bilingual alt text)',
              )}
            >
              <select
                className="control"
                value={mainMediaId}
                onChange={(e) => setMainMediaId(e.target.value)}
              >
                <option value="">
                  {c('اختر صورة جاهزة من مكتبة الوسائط…', 'Select a ready image…')}
                </option>
                {readyImages.map((img) => (
                  <option key={img.id} value={img.id}>
                    {img.name} ({img.alt?.ar && img.alt?.en ? 'Alt OK' : 'Missing alt!'})
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <strong className="mb-2 block text-sm">
                {c(
                  'صور إضافية ونشرات فنية عامة (TDS / SDS / كتالوج PDF)',
                  'Additional gallery images & public technical documents (TDS / SDS / PDF)',
                )}
              </strong>
              {readyPublicMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {c(
                    'لا توجد وسائط عامة بحالة ready بعد.',
                    'No ready public media assets available yet.',
                  )}{' '}
                  <Link href="/admin/media" className="text-primary underline">
                    {c('فتح مكتبة الوسائط', 'Open Media Library')}
                  </Link>
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {readyPublicMedia.map((asset) => {
                    const checked = mediaIds.includes(asset.id)
                    return (
                      <label
                        key={asset.id}
                        className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setMediaIds((prev) =>
                              e.target.checked
                                ? [...prev, asset.id]
                                : prev.filter((x) => x !== asset.id),
                            )
                          }
                        />
                        <span className="truncate font-medium">{asset.name}</span>
                        <Badge tone="muted">{asset.kind}</Badge>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 5 && (
          <div className="space-y-6">
            <div>
              <strong className="mb-2 block text-sm">
                {c('القطاعات الصناعية المرتبطة', 'Applicable industrial sectors')}
              </strong>
              <div className="flex flex-wrap gap-2">
                {(sectorsQuery.data || []).map((sec) => {
                  const checked = sectorIds.includes(sec.id)
                  return (
                    <label
                      key={sec.id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSectorIds((prev) =>
                            e.target.checked
                              ? [...prev, sec.id]
                              : prev.filter((x) => x !== sec.id),
                          )
                        }
                      />
                      {lang === 'ar' ? sec.name.ar : sec.name.en}
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <strong className="mb-2 block text-sm">
                {c('منتجات ذات صلة', 'Related products')}
              </strong>
              <div className="flex flex-wrap gap-2">
                {(relatedProductsQuery.data || [])
                  .filter((rp) => rp.id !== product?.id)
                  .map((rp) => {
                    const checked = relatedIds.includes(rp.id)
                    return (
                      <label
                        key={rp.id}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setRelatedIds((prev) =>
                              e.target.checked
                                ? [...prev, rp.id]
                                : prev.filter((x) => x !== rp.id),
                            )
                          }
                        />
                        {lang === 'ar' ? rp.name.ar : rp.name.en}
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="grid gap-5 border-t pt-5 md:grid-cols-2">
              <Field label={c('عنوان SEO بالعربية', 'Arabic SEO title')}>
                <input
                  className="control"
                  value={seoTitleAr}
                  onChange={(e) => setSeoTitleAr(e.target.value)}
                />
              </Field>
              <Field label={c('عنوان SEO بالإنجليزية', 'English SEO title')}>
                <input
                  className="control"
                  dir="ltr"
                  value={seoTitleEn}
                  onChange={(e) => setSeoTitleEn(e.target.value)}
                />
              </Field>
              <Field label={c('وصف SEO بالعربية', 'Arabic SEO description')}>
                <textarea
                  rows={2}
                  className="control"
                  value={seoDescAr}
                  onChange={(e) => setSeoDescAr(e.target.value)}
                />
              </Field>
              <Field label={c('وصف SEO بالإنجليزية', 'English SEO description')}>
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
        )}
      </div>
    </form>
  )
}

function VariantSpecsEditor({ attributes, specifications, onChange }: { attributes: AttributeRecord[]; specifications: ProductSpec[]; onChange: (specs: ProductSpec[]) => void }) {
  const { lang } = useLanguage()
  const c = useCopy()
  function update(attributeId: string, value: ProductSpec['value'] | undefined) {
    const remaining = specifications.filter(spec => spec.attributeId !== attributeId)
    onChange(value === undefined ? remaining : [...remaining, { attributeId, value }])
  }
  return <div className="grid gap-4 sm:grid-cols-2">{attributes.map(attribute => {
    const value = specifications.find(spec => spec.attributeId === attribute.id)?.value
    return <Field key={attribute.id} label={attribute.name[lang]}>
      {attribute.type === 'boolean' ? <select className="control" value={value === undefined ? '' : String(value)} onChange={e => update(attribute.id, e.target.value === '' ? undefined : e.target.value === 'true')}><option value="">{c('غير محدد', 'Unset')}</option><option value="true">{c('نعم', 'Yes')}</option><option value="false">{c('لا', 'No')}</option></select>
      : attribute.type === 'option' ? <select className="control" value={typeof value === 'string' ? value : ''} onChange={e => update(attribute.id, e.target.value || undefined)}><option value="">{c('اختر قيمة', 'Select option')}</option>{attribute.options.map(option => <option key={option.id} value={option.id}>{option.label[lang]}</option>)}</select>
      : attribute.type === 'multi_option' ? <select multiple className="control" value={Array.isArray(value) ? value : []} onChange={e => update(attribute.id, Array.from(e.target.selectedOptions, option => option.value))}>{attribute.options.map(option => <option key={option.id} value={option.id}>{option.label[lang]}</option>)}</select>
      : <input className="control" type={attribute.type === 'number' ? 'number' : 'text'} step="any" value={typeof value === 'number' || typeof value === 'string' ? value : ''} onChange={e => update(attribute.id, e.target.value === '' ? undefined : attribute.type === 'number' ? Number(e.target.value) : e.target.value)} />}
    </Field>
  })}</div>
}
