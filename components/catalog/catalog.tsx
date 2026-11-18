'use client'

import { useState, useEffect } from 'react'
import { FacetFilter } from './facet-filter'
import { ComparisonToggle } from './comparison'
import { ProductImageDialog } from './product-image-dialog'
import { PublicLink as Link } from '@/components/demo/public-link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  SlidersHorizontal,
  X,
  Package,
  Check,
  Minus,
  Plus,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useDemo, useCatalogData } from '@/components/demo/demo-provider'
import {
  Badge,
  DirectionArrow,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'
import { api, BackendError, buildApiPath } from '@/lib/api-client'
import { useLiveQuery } from '@/lib/live-query'
import {
  formatSpecValue,
  resolveProductImage,
  type AttributeRecord,
  type CatalogFacets,
  type CatalogProduct,
  type MediaItem,
  type PageMeta,
  type UnitRecord,
} from '@/lib/types'

export function usePublicAttributes() {
  return useLiveQuery('/content/attributes', async () => {
    try {
      const res = await api<{ items: AttributeRecord[] }>('/content/attributes')
      return res.data.items || []
    } catch (err) {
      if (err instanceof BackendError && err.status === 404) return []
      throw err
    }
  })
}

export function ProductCard({
  product,
  attributes = [],
  units = [],
}: {
  product: CatalogProduct
  attributes?: AttributeRecord[]
  units?: UnitRecord[]
}) {
  const { brands, categories } = useCatalogData()
  const { lang } = useLanguage()
  const c = useCopy()
  const href = `/products/${product.slug || product.id}`
  const imageSrc = resolveProductImage(product)
  const categoryName = categories.find((t) => t.id === product.categoryId)
    ?.name[lang]
  const brandName = brands.find((b) => b.id === product.brandId)?.name[lang]

  return (
    <article className="catalog-card group">
      <Link href={href} className="product-visual">
        <Image
          src={imageSrc}
          alt={product.name[lang]}
          fill
          sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 90vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {categoryName && (
          <span className="absolute start-4 top-4">
            <Badge>{categoryName}</Badge>
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {brandName && (
          <p className="mb-2 text-xs font-semibold tracking-wider text-primary">
            {brandName}
          </p>
        )}
        <h2 className="text-xl font-bold">
          <Link href={href}>{product.name[lang]}</Link>
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {product.summary[lang]}
        </p>
        <dl className="my-5 flex flex-wrap gap-2">
          {(product.specifications || []).slice(0, 3).map((s) => {
            const attr = attributes.find((a) => a.id === s.attributeId)
            const unit = attr?.unitId
              ? units.find((u) => u.id === attr.unitId)
              : undefined
            const formatted = formatSpecValue(s, attr, unit, lang)
            return (
              <div
                key={s.attributeId}
                className="rounded bg-muted px-2 py-1 text-xs"
              >
                <dt className="sr-only">{formatted.label}</dt>
                <dd dir="auto">{formatted.value}</dd>
              </div>
            )
          })}
          <div className="rounded bg-muted px-2 py-1 text-xs">
            <dt className="sr-only">{c('خيارات العبوة', 'Pack options')}</dt>
            <dd>
              {product.variants.length} {c('خيار', 'options')}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-xs text-muted-foreground">
            {c('السعر عند الطلب', 'Price on request')}
          </span>
          <Link
            className="inline-flex items-center gap-2 text-sm font-bold text-primary"
            href={href}
          >
            {c('التفاصيل والخيارات', 'Details & options')}
            <DirectionArrow />
          </Link>
        </div>
        <ComparisonToggle id={product.slug || product.id} />
      </div>
    </article>
  )
}

export function Catalog({
  category,
  brand,
  sector,
  title,
  description,
  subcategories = [],
}: {
  category?: string
  brand?: string
  sector?: string
  title?: string
  description?: string
  subcategories?: Array<{
    id: string
    slug: string
    name: { ar: string; en: string }
  }>
}) {
  const { brands, categories, sectors, units } = useCatalogData()
  const { data: attributes = [] } = usePublicAttributes()
  const c = useCopy()
  const { lang } = useLanguage()
  const params = useSearchParams()
  const [localQuery, setLocalQuery] = useState(params.toString())
  const urlQuery = params.toString()
  useEffect(() => setLocalQuery(urlQuery), [urlQuery])
  const query = new URLSearchParams(localQuery)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const q = query.get('q') || ''
  const categoryFilter = category || query.get('category') || ''
  const brandFilter = brand || query.get('brand') || ''
  const sectorFilter = sector || query.get('sector') || ''
  const availability = query.get('availability') || ''
  const pack = query.get('pack') || ''
  const attribute = query.get('attribute') || ''
  const specValue = query.get('value') || ''
  const sort = query.get('sort') || 'featured'
  const rawPage = Number(query.get('page') || 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1

  const productsPath = buildApiPath('/catalog/products', {
    page,
    pageSize: 12,
    locale: lang,
    q: q.trim() || undefined,
    category: categoryFilter || undefined,
    family: query.get('family') || undefined,
    brand: brandFilter || undefined,
    sector: sectorFilter || undefined,
    availability: availability || undefined,
    pack: pack || undefined,
    attribute: attribute || undefined,
    value: attribute && specValue ? specValue : undefined,
    sort,
  })

  const facetsPath = buildApiPath('/catalog/facets', {
    locale: lang,
    q: q.trim() || undefined,
    category: categoryFilter || undefined,
    family: query.get('family') || undefined,
    brand: brandFilter || undefined,
    sector: sectorFilter || undefined,
    availability: availability || undefined,
    pack: pack || undefined,
  })

  const productsQuery = useLiveQuery(productsPath, async () => {
    const res = await api<CatalogProduct[]>(productsPath)
    return {
      data: res.data,
      meta: res.meta || {
        page,
        pageSize: 12,
        total: res.data.length,
        totalPages: 1,
      },
    }
  })

  const facetsQuery = useLiveQuery(facetsPath, async () => {
    const res = await api<CatalogFacets>(facetsPath)
    return res.data
  })

  function change(key: string, value: string) {
    const next = new URLSearchParams(localQuery)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setLocalQuery(next.toString())
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${next.size ? `?${next}` : ''}`,
    )
  }

  function changeSpecFilter(combined: string) {
    const next = new URLSearchParams(localQuery)
    if (!combined) {
      next.delete('attribute')
      next.delete('value')
    } else {
      const [attrId, ...rest] = combined.split('::')
      next.set('attribute', attrId)
      next.set('value', rest.join('::'))
    }
    next.delete('page')
    setLocalQuery(next.toString())
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${next.size ? `?${next}` : ''}`,
    )
  }

  function clear() {
    setLocalQuery('')
    window.history.replaceState(null, '', window.location.pathname)
  }

  const activeCount = [
    'q',
    'category',
    'brand',
    'sector',
    'availability',
    'pack',
    'attribute',
  ].filter((k) => query.get(k)).length

  const items = productsQuery.data?.data || []
  const meta: PageMeta = productsQuery.data?.meta || {
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  }
  const facets = facetsQuery.data
  const totalPages = Math.max(1, meta.totalPages || 1)

  const categoryOptions = (facets?.categories || categories).map(
    (cat: any) => ({
      id: cat.id,
      label: cat.name[lang],
      count: typeof cat.count === 'number' ? cat.count : 0,
    }),
  )
  const brandOptions = (facets?.brands || brands).map((b: any) => ({
    id: b.id,
    label: b.name[lang],
    count: typeof b.count === 'number' ? b.count : 0,
  }))
  const sectorOptions = (facets?.sectors || sectors).map((s: any) => ({
    id: s.id,
    label: s.name[lang],
    count: typeof s.count === 'number' ? s.count : 0,
  }))
  const packOptions =
    facets?.packs?.map((p) => String(p.value)).filter(Boolean) || []
  const filterableSpecChoices = (facets?.attributes || []).flatMap((attr) =>
    (attr.values || []).map((entry) => {
      const raw = String(entry.value)
      const opt = attr.options?.find((o) => o.id === raw)
      const display =
        typeof entry.value === 'boolean'
          ? entry.value
            ? c('نعم', 'Yes')
            : c('لا', 'No')
          : opt
            ? opt.label[lang]
            : raw
      return {
        key: `${attr.id}::${raw}`,
        label: `${attr.name[lang]}: ${display} (${entry.count})`,
      }
    }),
  )

  return (
    <>
      <PageIntro
        eyebrow={c('كتالوج إم إيه إس', 'M.A.S CATALOG')}
        title={title || c('المنتجات', 'Products')}
        description={
          description ||
          c(
            'ابحث بالمواصفة أو الكود، واختر المنتجات المناسبة لتجهيز طلب عرض سعر واحد.',
            'Search by specification or code and bring the right products together in one quote request.',
          )
        }
      />
      <div className="site-container page-section">
        {subcategories.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {c('التصنيفات الفرعية:', 'Subcategories:')}
            </span>
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/categories/${sub.slug || sub.id}`}
                className="rounded-full border px-4 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
              >
                {sub.name[lang]}
              </Link>
            ))}
          </div>
        )}
        <form
          className="catalog-search"
          onSubmit={(e) => e.preventDefault()}
          role="search"
        >
          <Search className="size-5 shrink-0 text-primary" aria-hidden />
          <label htmlFor="catalog-search" className="sr-only">
            {c('البحث في المنتجات', 'Search products')}
          </label>
          <input
            id="catalog-search"
            value={q}
            maxLength={100}
            onChange={(e) => change('q', e.target.value)}
            placeholder={c(
              'اسم المنتج، كود الموديل أو المواصفة…',
              'Product name, model code or specification…',
            )}
          />
          {q && (
            <button
              type="button"
              aria-label={c('مسح البحث', 'Clear search')}
              onClick={() => change('q', '')}
            >
              <X className="size-4" />
            </button>
          )}
        </form>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {productsQuery.isLoading
              ? c('جارٍ تحميل المنتجات…', 'Loading products…')
              : `${meta.total} ${c('منتج متاح', 'published products')}`}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-outline lg:hidden"
              onClick={() => setFiltersOpen(!filtersOpen)}
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
            >
              <SlidersHorizontal className="size-4" />
              {c('الفلاتر', 'Filters')} {activeCount > 0 && `(${activeCount})`}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <span className="hidden sm:block">
                {c('ترتيب حسب', 'Sort by')}
              </span>
              <select
                className="control w-auto"
                value={sort}
                onChange={(e) => change('sort', e.target.value)}
                aria-label={c('ترتيب المنتجات', 'Sort products')}
              >
                <option value="featured">
                  {c('المميز أولًا', 'Featured first')}
                </option>
                <option value="name">{c('الاسم', 'Name')}</option>
                <option value="latest">
                  {c('الأحدث إضافة', 'Recently added')}
                </option>
              </select>
            </label>
          </div>
        </div>
        <div className="catalog-layout">
          <aside
            id="catalog-filters"
            className={`filter-panel ${filtersOpen ? '' : 'hidden lg:block'}`}
          >
            <div className="mb-6 flex justify-between">
              <h2 className="font-bold">
                {c('تصفية المنتجات', 'Filter products')}
              </h2>
              {activeCount > 0 && (
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={clear}
                >
                  {c('مسح الكل', 'Clear all')}
                </button>
              )}
            </div>
            <div className="space-y-6">
              {!category && categoryOptions.length > 0 && (
                <FacetFilter
                  label={c('التصنيف', 'Category')}
                  value={categoryFilter}
                  onChange={(value) => change('category', value)}
                  options={categoryOptions}
                />
              )}
              {!brand && brandOptions.length > 0 && (
                <FacetFilter
                  label={c('العلامة التجارية', 'Brand')}
                  value={brandFilter}
                  onChange={(value) => change('brand', value)}
                  options={brandOptions}
                />
              )}
              {!sector && sectorOptions.length > 0 && (
                <FacetFilter
                  label={c('القطاع', 'Sector')}
                  value={sectorFilter}
                  onChange={(value) => change('sector', value)}
                  options={sectorOptions}
                />
              )}
              {filterableSpecChoices.length > 0 && (
                <Field label={c('المواصفة الفنية', 'Technical specification')}>
                  <select
                    className="control"
                    value={
                      attribute && specValue ? `${attribute}::${specValue}` : ''
                    }
                    onChange={(e) => changeSpecFilter(e.target.value)}
                  >
                    <option value="">
                      {c('كل المواصفات', 'All specifications')}
                    </option>
                    {filterableSpecChoices.map((choice) => (
                      <option key={choice.key} value={choice.key}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={c('حالة التوفر', 'Availability')}>
                <select
                  className="control"
                  value={availability}
                  onChange={(e) => change('availability', e.target.value)}
                >
                  <option value="">{c('الكل', 'All')}</option>
                  <option value="available">
                    {c('متاح للتوريد', 'Available')}
                  </option>
                  <option value="on_request">
                    {c('توريد حسب الطلب', 'Supply on request')}
                  </option>
                  <option value="unavailable">
                    {c('غير متاح حاليًا', 'Currently unavailable')}
                  </option>
                </select>
              </Field>
              {packOptions.length > 0 && (
                <Field
                  label={c('سعة العبوة / عدد القطع', 'Pack size / piece count')}
                >
                  <select
                    className="control"
                    value={pack}
                    onChange={(e) => change('pack', e.target.value)}
                  >
                    <option value="">{c('كل الخيارات', 'All options')}</option>
                    {packOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="rounded-xl bg-surface-tint p-4 text-sm">
                <Package className="mb-3 size-6 text-primary" aria-hidden />
                <p className="font-bold">
                  {c('مش لاقي منتجك؟', "Can't find your product?")}
                </p>
                <p className="my-2 leading-6 text-muted-foreground">
                  {c(
                    'أضف وصف المواصفات المطلوبة في طلبك.',
                    'Describe the specifications you need in your request.',
                  )}
                </p>
                <Link
                  className="font-bold text-primary underline"
                  href="/request-quote"
                >
                  {c('طلب منتج غير مدرج', 'Request an unlisted product')}
                </Link>
              </div>
            </div>
          </aside>
          <div className="min-w-0">
            {productsQuery.isLoading ? (
              <LoadingState />
            ) : productsQuery.error ? (
              <ErrorState
                error={productsQuery.error}
                onRetry={() => void productsQuery.refresh()}
              />
            ) : items.length ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      attributes={attributes}
                      units={units}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <nav
                    className="mt-10 flex items-center justify-center gap-2"
                    aria-label={c('صفحات المنتجات', 'Product pagination')}
                  >
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        type="button"
                        className={`pagination-button ${page === i + 1 ? 'bg-primary text-white' : ''}`}
                        aria-current={page === i + 1 ? 'page' : undefined}
                        key={i}
                        onClick={() => {
                          change('page', String(i + 1))
                          document
                            .getElementById('catalog-search')
                            ?.scrollIntoView({ block: 'center' })
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </nav>
                )}
              </>
            ) : (
              <EmptyState
                title={c('لا توجد منتجات مطابقة', 'No matching products')}
                description={c(
                  'جرّب اسمًا آخر أو قلّل الفلاتر المختارة.',
                  'Try another search or remove some filters.',
                )}
              >
                {activeCount > 0 && (
                  <button type="button" className="btn-primary" onClick={clear}>
                    {c('إعادة ضبط البحث', 'Reset search')}
                  </button>
                )}
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function ProductDetail({ slug }: { slug: string }) {
  const { brands, categories, sectors, units } = useCatalogData()
  const { data: attributes = [] } = usePublicAttributes()
  const c = useCopy()
  const { lang } = useLanguage()
  const { cart, addToCart } = useDemo()

  const detailQuery = useLiveQuery(`/catalog/products/${slug}`, async () => {
    const res = await api<CatalogProduct>(`/catalog/products/${slug}`)
    return res.data
  })

  const product = detailQuery.data
  const relatedPath = product?.categoryId
    ? buildApiPath('/catalog/products', {
        category: product.categoryId,
        pageSize: 6,
      })
    : null
  const relatedQuery = useLiveQuery(relatedPath, async () => {
    if (!relatedPath) return []
    return (await api<CatalogProduct[]>(relatedPath)).data
  })

  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState('overview')
  const [selectedImage, setSelectedImage] = useState('')

  const variant =
    product?.variants.find((v) => v.id === variantId) || product?.variants[0]

  useEffect(() => {
    if (variant) {
      setQuantity(variant.minQuantity || 1)
    }
  }, [variant?.id, variant?.minQuantity])

  if (detailQuery.isLoading) {
    return (
      <div className="site-container page-section">
        <LoadingState />
      </div>
    )
  }

  if (detailQuery.error) {
    if (
      detailQuery.error instanceof BackendError &&
      detailQuery.error.status === 404
    ) {
      return (
        <div className="site-container page-section">
          <EmptyState
            title={c('المنتج غير متاح', 'Product not available')}
            description={c(
              'قد يكون المنتج غير منشور أو تغيّر رابطه. ارجع إلى الكتالوج لاختيار منتج آخر.',
              'This product may be unpublished or moved. Return to the catalog to choose another product.',
            )}
          >
            <Link className="btn-primary" href="/products">
              {c('الكتالوج', 'Catalog')}
            </Link>
          </EmptyState>
        </div>
      )
    }
    return (
      <div className="site-container page-section">
        <ErrorState
          error={detailQuery.error}
          onRetry={() => void detailQuery.refresh()}
        />
      </div>
    )
  }

  if (!product || !variant) {
    return (
      <div className="site-container page-section">
        <EmptyState
          title={c('المنتج غير متاح', 'Product not available')}
          description={c(
            'ارجع إلى الكتالوج لاختيار منتج آخر.',
            'Return to the catalog to choose another product.',
          )}
        >
          <Link className="btn-primary" href="/products">
            {c('الكتالوج', 'Catalog')}
          </Link>
        </EmptyState>
      </div>
    )
  }

  const category = categories.find((t) => t.id === product.categoryId)
  const brand = brands.find((b) => b.id === product.brandId)
  const unit = units.find((u) => u.id === variant.unitId)
  const precision = unit?.precision ?? 0
  const minQty = variant.minQuantity || 1
  const stepQty = variant.quantityStep || 10 ** -precision || 1
  const scale = 10 ** precision

  const validQuantity =
    Number.isFinite(quantity) &&
    quantity >= minQty &&
    quantity <= 99999 &&
    Math.abs(quantity * scale - Math.round(quantity * scale)) < 0.000001 &&
    Math.round((quantity - minQty) * 1000) % Math.round(stepQty * 1000) === 0

  const unavailable = variant.availability === 'unavailable'
  const full =
    cart.length >= 30 && !cart.some((i) => i.variantId === variant.id)

  const primaryImage = resolveProductImage(product)
  const galleryImages = Array.from(
    new Set(
      [
        primaryImage,
        ...(product.media || [])
          .filter((m) => m.url && m.mime?.startsWith('image/'))
          .map((m) => m.url as string),
        ...(variant.media || [])
          .filter((m) => m.url && m.mime?.startsWith('image/'))
          .map((m) => m.url as string),
      ].filter(Boolean),
    ),
  )

  const documents = (product.media || []).filter(
    (m) => m.url && m.mime === 'application/pdf',
  )

  const allSpecs = [
    ...(product.specifications || []),
    ...(variant.specifications || []),
  ]

  const relatedProducts = (relatedQuery.data || [])
    .filter((p) => p.id !== product.id)
    .slice(0, 3)

  return (
    <>
      <PageIntro
        title={product.name[lang]}
        eyebrow={brand?.name[lang] || 'M.A.S CATALOG'}
        description={category?.description?.[lang]}
      >
        {category && (
          <Link
            href={`/categories/${category.slug || category.id}`}
            className="btn-outline"
          >
            {category.name[lang]}
            <DirectionArrow />
          </Link>
        )}
      </PageIntro>
      <div className="site-container page-section">
        <div className="grid gap-9 lg:grid-cols-2">
          <div>
            <button
              type="button"
              className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-muted"
              onClick={() => setZoom(true)}
              aria-label={c('تكبير صورة المنتج', 'Enlarge product image')}
            >
              <Image
                src={selectedImage || primaryImage}
                alt={product.name[lang]}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
              />
              <span className="absolute bottom-4 start-4 rounded-full bg-white/95 px-4 py-2 text-sm">
                {c('اضغط للتكبير', 'Click to enlarge')}
              </span>
            </button>
            {galleryImages.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {galleryImages.map((src, i) => (
                  <button
                    type="button"
                    key={src}
                    className={`relative size-16 overflow-hidden rounded-lg border-2 ${(selectedImage || primaryImage) === src ? 'border-primary' : 'border-transparent'}`}
                    onClick={() => setSelectedImage(src)}
                    aria-label={`${c('عرض صورة', 'View image')} ${i + 1}`}
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {brand && (
                <Link
                  className="text-sm font-bold text-primary"
                  href={`/brands/${brand.slug || brand.id}`}
                >
                  {brand.name[lang]}
                </Link>
              )}
              <Badge tone={unavailable ? 'neutral' : 'gold'}>
                {unavailable
                  ? c('غير متاح حاليًا', 'Currently unavailable')
                  : variant.availability === 'available'
                    ? c('متاح للتوريد', 'Available')
                    : c('توريد حسب الطلب', 'Supply on request')}
              </Badge>
            </div>
            <h2 className="my-5 text-3xl font-bold">{product.name[lang]}</h2>
            <p className="leading-8 text-muted-foreground">
              {product.summary[lang]}
            </p>
            <p
              dir="ltr"
              className="my-6 text-start font-mono text-sm text-muted-foreground"
            >
              {variant.sku}
            </p>
            <div className="space-y-5 rounded-2xl border p-6">
              <Field
                label={c('اختر العبوة / المتغير', 'Choose pack / variant')}
              >
                <select
                  className="control"
                  value={variant.id}
                  onChange={(e) => {
                    setVariantId(e.target.value)
                    setAdded(false)
                  }}
                >
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label[lang]}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <label
                  htmlFor="product-quantity"
                  className="mb-2 block text-sm font-bold"
                >
                  {c('الكمية المطلوبة', 'Required quantity')} (
                  {unit?.name[lang] || c('وحدة', 'Unit')})
                </label>
                <div className="flex w-fit items-center rounded-lg border">
                  <button
                    type="button"
                    className="quantity-button"
                    disabled={quantity <= minQty}
                    onClick={() => {
                      setQuantity((q) =>
                        Math.max(minQty, Number((q - stepQty).toFixed(3))),
                      )
                      setAdded(false)
                    }}
                    aria-label={c('تقليل الكمية', 'Decrease quantity')}
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    id="product-quantity"
                    className="w-24 bg-transparent text-center"
                    type="number"
                    min={minQty}
                    step={stepQty}
                    max={99999}
                    value={Number.isNaN(quantity) ? '' : quantity}
                    onChange={(e) => {
                      setQuantity(e.target.valueAsNumber)
                      setAdded(false)
                    }}
                  />
                  <button
                    type="button"
                    className="quantity-button"
                    disabled={quantity >= 99999}
                    onClick={() => {
                      setQuantity((q) =>
                        Math.min(99999, Number((q + stepQty).toFixed(3))),
                      )
                      setAdded(false)
                    }}
                    aria-label={c('زيادة الكمية', 'Increase quantity')}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {!validQuantity && (
                  <p className="mt-2 text-sm text-red-700" role="alert">
                    {c(
                      `الحد الأدنى ${minQty} ومضاعفات ${stepQty} (حتى 99999).`,
                      `Minimum ${minQty} in steps of ${stepQty} (up to 99999).`,
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-primary w-full"
                disabled={!validQuantity || full || unavailable}
                onClick={() => {
                  addToCart(variant.id, quantity, {
                    productId: product.id,
                    productSlug: product.slug || product.id,
                    productName: product.name,
                    variantLabel: variant.label,
                    sku: variant.sku,
                    unitCode: unit?.code,
                    unitName: unit?.name,
                    precision,
                    minQuantity: minQty,
                    quantityStep: stepQty,
                  })
                  setAdded(true)
                }}
              >
                {added ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {unavailable
                  ? c('غير متاح للطلب حاليًا', 'Currently unavailable')
                  : added
                    ? c('أُضيف إلى الطلب', 'Added to request')
                    : c('أضف لطلب عرض السعر', 'Add to quote request')}
              </button>
              <div aria-live="polite">
                {added && (
                  <Link
                    className="text-sm font-bold text-primary underline"
                    href="/request-quote"
                  >
                    {c('مراجعة طلب عرض السعر', 'Review quote request')}
                  </Link>
                )}
                {full && (
                  <p className="text-sm">
                    {c(
                      'وصلت إلى 30 بندًا. راجع طلبك أولًا.',
                      'You have reached 30 items. Review your request first.',
                    )}
                  </p>
                )}
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                {c(
                  'السعر والتوفر النهائي بعد مراجعة الكمية والمواصفات. إضافة المنتج لا تحجز مخزونًا.',
                  'Final pricing and availability depend on quantity and specification review. Adding a product does not reserve stock.',
                )}
              </p>
            </div>
            <div className="mt-6 flex gap-3 text-sm leading-7 text-muted-foreground">
              <ShieldCheck
                className="mt-1 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <p>
                {c(
                  'راجع متطلبات المعدة مع الفريق الفني قبل اعتماد البدائل أو المواصفات التشغيلية.',
                  'Confirm equipment requirements with our technical team before finalizing specifications.',
                )}
              </p>
            </div>
          </div>
        </div>
        <section className="mt-14">
          <div
            className="flex gap-2 overflow-x-auto border-b pb-3"
            role="tablist"
            aria-label={c('معلومات المنتج', 'Product information')}
          >
            {[
              ['overview', 'الوصف والاستخدام', 'Overview & applications'],
              ['specs', 'المواصفات الفنية', 'Specifications'],
              ['files', 'المستندات', 'Documents'],
            ].map(([id, ar, en]) => (
              <button
                type="button"
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className={`rounded-lg px-5 py-3 text-sm whitespace-nowrap ${tab === id ? 'bg-primary text-white' : 'bg-muted'}`}
                onClick={() => setTab(id)}
              >
                {c(ar, en)}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            className="rounded-b-xl border-x border-b p-6 sm:p-8"
          >
            {tab === 'overview' ? (
              <>
                <h3 className="text-xl font-bold">
                  {c('معلومات المنتج', 'Product overview')}
                </h3>
                <p className="my-4 max-w-3xl whitespace-pre-line leading-8 text-muted-foreground">
                  {product.description?.[lang] || product.summary[lang]}
                </p>
                {product.applications?.[lang] && (
                  <section className="mb-5">
                    <h4 className="font-bold">
                      {c('الاستخدامات', 'Applications')}
                    </h4>
                    <p className="mt-2 whitespace-pre-line leading-8 text-muted-foreground">
                      {product.applications[lang]}
                    </p>
                  </section>
                )}
                {product.benefits?.[lang] && (
                  <section className="mb-5">
                    <h4 className="font-bold">
                      {c('الخصائص والفوائد', 'Features & benefits')}
                    </h4>
                    <p className="mt-2 whitespace-pre-line leading-8 text-muted-foreground">
                      {product.benefits[lang]}
                    </p>
                  </section>
                )}
                <div className="flex flex-wrap gap-2">
                  {(product.sectorIds || []).map((id) => {
                    const sector = sectors.find((s) => s.id === id)
                    if (!sector) return null
                    return (
                      <Link
                        className="rounded-full bg-muted px-4 py-2 text-sm hover:bg-surface-tint"
                        key={id}
                        href={`/sectors/${sector.slug || sector.id}`}
                      >
                        {sector.name[lang]}
                      </Link>
                    )
                  })}
                </div>
              </>
            ) : tab === 'specs' ? (
              <dl className="spec-list">
                {allSpecs.map((s) => {
                  const attr = attributes.find((a) => a.id === s.attributeId)
                  const specUnit = attr?.unitId
                    ? units.find((u) => u.id === attr.unitId)
                    : undefined
                  const formatted = formatSpecValue(s, attr, specUnit, lang)
                  return (
                    <div key={`${s.attributeId}-${String(s.value)}`}>
                      <dt>{formatted.label}</dt>
                      <dd dir="auto">{formatted.value}</dd>
                    </div>
                  )
                })}
                <div>
                  <dt>{c('العبوة / المتغير', 'Pack / variant')}</dt>
                  <dd dir="auto">{variant.label[lang]}</dd>
                </div>
                <div>
                  <dt>SKU</dt>
                  <dd dir="ltr">{variant.sku}</dd>
                </div>
              </dl>
            ) : (
              <ProductDocuments documents={documents} />
            )}
          </div>
        </section>
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">
              {c('منتجات من نفس المجموعة', 'More from this category')}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  attributes={attributes}
                  units={units}
                />
              ))}
            </div>
          </section>
        )}
        {zoom && (
          <ProductImageDialog
            src={selectedImage || primaryImage}
            alt={product.name[lang]}
            onClose={() => setZoom(false)}
          />
        )}
      </div>
    </>
  )
}

function ProductDocuments({ documents }: { documents: MediaItem[] }) {
  const c = useCopy()
  return documents.length ? (
    <ul className="space-y-3">
      {documents.map((file) => (
        <li
          key={file.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <span className="flex items-center gap-3">
            <FileText className="size-5 text-primary" />
            <span>
              {file.name}
              <span className="ms-2 text-xs text-muted-foreground">
                ({file.kind})
              </span>
            </span>
          </span>
          <a
            className="btn-outline"
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {c('عرض / تنزيل المستند', 'Open / download PDF')}
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <div className="flex items-start gap-4">
      <FileText className="size-8 shrink-0 text-primary" />
      <div>
        <h3 className="font-bold">
          {c('لا توجد مستندات مرتبطة', 'No linked documents')}
        </h3>
        <p className="mt-2 text-muted-foreground">
          {c(
            'اطلب النشرة الفنية (TDS / SDS) ضمن طلب عرض السعر عند الحاجة.',
            'Request technical or safety data sheets (TDS / SDS) with your quote request.',
          )}
        </p>
      </div>
    </div>
  )
}
