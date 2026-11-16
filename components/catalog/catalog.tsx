'use client'

import { useState } from 'react'
import { ProductImageDialog } from './product-image-dialog'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { useDemo } from '@/components/demo/demo-provider'
import {
  Badge,
  DemoNotice,
  DirectionArrow,
  EmptyState,
  Field,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'
import { brands, categories, sectors, type DemoProduct } from '@/lib/demo-data'

export function ProductCard({ product }: { product: DemoProduct }) {
  const { lang } = useLanguage()
  const c = useCopy()
  return (
    <article className="catalog-card group">
      <Link href={`/products/${product.id}`} className="product-visual">
        <Image
          src={product.image}
          alt={product.name[lang]}
          fill
          sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 90vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute start-4 top-4">
          <Badge>
            {categories.find((t) => t.id === product.category)?.name[lang]}
          </Badge>
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-2 text-xs font-semibold tracking-wider text-primary">
          {brands.find((b) => b.id === product.brand)?.name[lang]}
        </p>
        <h2 className="text-xl font-bold">
          <Link href={`/products/${product.id}`}>{product.name[lang]}</Link>
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {product.summary[lang]}
        </p>
        <dl className="my-5 flex flex-wrap gap-2">
          {product.specs.map((s) => (
            <div
              key={s.label.en}
              className="rounded bg-muted px-2 py-1 text-xs"
            >
              <dt className="sr-only">{s.label[lang]}</dt>
              <dd dir="auto">{s.value}</dd>
            </div>
          ))}
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
            href={`/products/${product.id}`}
          >
            {c('التفاصيل والخيارات', 'Details & options')}
            <DirectionArrow />
          </Link>
        </div>
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
}: {
  category?: string
  brand?: string
  sector?: string
  title?: string
  description?: string
}) {
  const c = useCopy()
  const { lang } = useLanguage()
  const { products } = useDemo()
  const router = useRouter()
  const params = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const q = params.get('q') || ''
  const categoryFilter = category || params.get('category') || ''
  const brandFilter = brand || params.get('brand') || ''
  const sectorFilter = sector || params.get('sector') || ''
  const availability = params.get('availability') || ''
  const pack = params.get('pack') || ''
  const sort = params.get('sort') || 'featured'
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u064B-\u065Fـ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const filtered = products
    .filter(
      (p) =>
        p.status === 'published' &&
        (!categoryFilter || p.category === categoryFilter) &&
        (!brandFilter || p.brand === brandFilter) &&
        (!sectorFilter || p.sectorIds.includes(sectorFilter)) &&
        p.variants.some(
          (v) =>
            (!availability || v.availability === availability) &&
            (!pack || v.pack === pack),
        ) &&
        normalize(
          [
            p.name.ar,
            p.name.en,
            p.slug,
            brands.find((b) => b.id === p.brand)?.name.en,
            ...p.variants.map((v) => v.sku),
            ...p.specs.map((s) => s.value),
          ].join(' '),
        ).includes(normalize(q.trim())),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name[lang].localeCompare(b.name[lang], lang)
        : sort === 'latest'
          ? b.id.localeCompare(a.id)
          : Number(b.featured) - Number(a.featured),
    )
  const totalPages = Math.max(1, Math.ceil(filtered.length / 6))
  const rawPage = Number(params.get('page') || 1)
  const page =
    Number.isInteger(rawPage) && rawPage > 0 ? Math.min(totalPages, rawPage) : 1
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    router.replace(
      `${window.location.pathname}${next.size ? `?${next}` : ''}`,
      { scroll: false },
    )
  }
  function clear() {
    router.replace(window.location.pathname, { scroll: false })
  }
  const activeCount = [
    'q',
    'category',
    'brand',
    'sector',
    'availability',
    'pack',
  ].filter((k) => params.get(k)).length
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
        <DemoNotice />
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
            {filtered.length} {c('منتج تجريبي', 'sample products')}
          </p>
          <div className="flex items-center gap-3">
            <button
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
                  {c('ترتيب بديل للمعاينة', 'Alternate demo order')}
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
                  className="text-xs text-primary underline"
                  onClick={clear}
                >
                  {c('مسح الكل', 'Clear all')}
                </button>
              )}
            </div>
            <div className="space-y-6">
              {!category && (
                <Field label={c('التصنيف', 'Category')}>
                  <select
                    className="control"
                    value={categoryFilter}
                    onChange={(e) => change('category', e.target.value)}
                  >
                    <option value="">
                      {c('كل التصنيفات', 'All categories')}
                    </option>
                    {categories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name[lang]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {!brand && (
                <Field label={c('العلامة التجارية', 'Brand')}>
                  <select
                    className="control"
                    value={brandFilter}
                    onChange={(e) => change('brand', e.target.value)}
                  >
                    <option value="">{c('كل العلامات', 'All brands')}</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name[lang]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {!sector && (
                <Field label={c('القطاع', 'Sector')}>
                  <select
                    className="control"
                    value={sectorFilter}
                    onChange={(e) => change('sector', e.target.value)}
                  >
                    <option value="">{c('كل القطاعات', 'All sectors')}</option>
                    {sectors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name[lang]}
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
                  <option value="on_request">
                    {c('توريد حسب الطلب', 'Supply on request')}
                  </option>
                  <option value="unavailable">
                    {c('غير متاح حاليًا', 'Currently unavailable')}
                  </option>
                </select>
              </Field>
              <Field
                label={c('سعة العبوة / عدد القطع', 'Pack size / piece count')}
              >
                <select
                  className="control"
                  value={pack}
                  onChange={(e) => change('pack', e.target.value)}
                >
                  <option value="">{c('كل الخيارات', 'All options')}</option>
                  {['1', '18', '20', '180', '208'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <div className="rounded-xl bg-surface-tint p-4 text-sm">
                <Package className="mb-3 size-6 text-primary" aria-hidden />
                <p className="font-bold">
                  {c('مش لاقي منتجك؟', 'Can’t find your product?')}
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
            {filtered.length ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.slice((page - 1) * 6, page * 6).map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <nav
                  className="mt-10 flex items-center justify-center gap-2"
                  aria-label={c('صفحات المنتجات', 'Product pagination')}
                >
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
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
              </>
            ) : (
              <EmptyState
                title={c('لا توجد منتجات مطابقة', 'No matching products')}
                description={c(
                  'جرّب اسمًا آخر أو قلّل الفلاتر المختارة.',
                  'Try another search or remove some filters.',
                )}
              >
                <button className="btn-primary" onClick={clear}>
                  {c('إعادة ضبط البحث', 'Reset search')}
                </button>
              </EmptyState>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export function ProductDetail({ slug }: { slug: string }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const { products, cart, addToCart } = useDemo()
  const product = products.find((p) => p.id === slug || p.slug === slug)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState('overview')
  if (!product || product.status !== 'published')
    return (
      <EmptyState
        title={c(
          'المنتج غير متاح في المعاينة',
          'Product unavailable in preview',
        )}
        description={c(
          'ارجع إلى الكتالوج لاختيار منتج آخر.',
          'Return to the catalog to choose another product.',
        )}
      >
        <Link className="btn-primary" href="/products">
          {c('الكتالوج', 'Catalog')}
        </Link>
      </EmptyState>
    )
  const variant =
    product.variants.find((v) => v.id === variantId) || product.variants[0]
  const category = categories.find((t) => t.id === product.category)!
  const brand = brands.find((b) => b.id === product.brand)!
  const validQuantity =
    Number.isInteger(quantity) && quantity >= 1 && quantity <= 99999
  const full =
    cart.length >= 30 && !cart.some((i) => i.variantId === variant.id)
  return (
    <>
      <PageIntro
        title={product.name[lang]}
        eyebrow={brand.name[lang]}
        description={category.description[lang]}
      >
        <Link href={`/categories/${category.id}`} className="btn-outline">
          {category.name[lang]}
          <DirectionArrow />
        </Link>
      </PageIntro>
      <div className="site-container page-section">
        <DemoNotice />
        <div className="grid gap-9 lg:grid-cols-2">
          <div>
            <button
              className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-muted"
              onClick={() => setZoom(true)}
              aria-label={c('تكبير صورة المنتج', 'Enlarge product image')}
            >
              <Image
                src={product.image}
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
            <p className="mt-3 text-xs text-muted-foreground">
              {c(
                'صورة توضيحية للمجموعة وليست صورة عبوة معتمدة.',
                'Illustrative category image, not an approved product pack image.',
              )}
            </p>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="text-sm font-bold text-primary"
                href={`/brands/${brand.id}`}
              >
                {brand.name[lang]}
              </Link>
              <Badge tone="gold">
                {variant.availability === 'unavailable'
                  ? c('غير متاح حاليًا', 'Currently unavailable')
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
                  {variant.unit[lang]})
                </label>
                <div className="flex w-fit items-center rounded-lg border">
                  <button
                    className="quantity-button"
                    disabled={quantity <= 1}
                    onClick={() => {
                      setQuantity((q) => Math.max(1, q - 1))
                      setAdded(false)
                    }}
                    aria-label={c('تقليل الكمية', 'Decrease quantity')}
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    id="product-quantity"
                    className="w-20 bg-transparent text-center"
                    type="number"
                    min={1}
                    max={99999}
                    step={1}
                    value={Number.isNaN(quantity) ? '' : quantity}
                    onChange={(e) => {
                      setQuantity(e.target.valueAsNumber)
                      setAdded(false)
                    }}
                  />
                  <button
                    className="quantity-button"
                    disabled={quantity >= 99999}
                    onClick={() => {
                      setQuantity((q) => Math.min(99999, q + 1))
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
                      'اكتب عددًا صحيحًا من 1 إلى 99999.',
                      'Enter a whole number from 1 to 99999.',
                    )}
                  </p>
                )}
              </div>
              <button
                className="btn-primary w-full"
                disabled={!validQuantity || full}
                onClick={() => {
                  addToCart(variant.id, quantity)
                  setAdded(true)
                }}
              >
                {added ? (
                  <Check className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )}
                {added
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
                  'القيم المعروضة تجريبية. راجع متطلبات المعدة مع الفريق الفني قبل اختيار أي منتج.',
                  'Displayed values are samples. Confirm equipment requirements with the technical team before choosing a product.',
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
                <p className="my-4 max-w-3xl leading-8 text-muted-foreground">
                  {product.summary[lang]}{' '}
                  {c(
                    'ستُضاف معلومات الاستخدام والفوائد من البيانات الفنية المعتمدة عند ربط الكتالوج.',
                    'Approved technical descriptions, applications and benefits will be added when the catalog data is connected.',
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.sectorIds.map((id) => (
                    <Link
                      className="rounded-full bg-muted px-4 py-2 text-sm hover:bg-surface-tint"
                      key={id}
                      href={`/sectors/${id}`}
                    >
                      {sectors.find((s) => s.id === id)?.name[lang]}
                    </Link>
                  ))}
                </div>
              </>
            ) : tab === 'specs' ? (
              <dl className="spec-list">
                {[
                  ...product.specs,
                  {
                    label: { ar: 'العبوة / المتغير', en: 'Pack / variant' },
                    value: variant.label[lang],
                  },
                  {
                    label: { ar: 'الكود التجريبي', en: 'Demo SKU' },
                    value: variant.sku,
                  },
                ].map((s) => (
                  <div key={s.label.en}>
                    <dt>{s.label[lang]}</dt>
                    <dd dir="auto">{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="flex items-start gap-4">
                <FileText
                  className="size-8 shrink-0 text-primary"
                  aria-hidden
                />
                <div>
                  <h3 className="font-bold">
                    {c(
                      'لا توجد مستندات معتمدة بعد',
                      'No approved documents yet',
                    )}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {c(
                      'ستظهر ملفات TDS وSDS هنا بعد إضافتها ومراجعتها. لا توجد ملفات وهمية للتنزيل.',
                      'TDS and SDS files will appear here after approval. No placeholder downloads are provided.',
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold">
            {c('منتجات من نفس المجموعة', 'More from this category')}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products
              .filter(
                (p) =>
                  p.category === product.category &&
                  p.id !== product.id &&
                  p.status === 'published',
              )
              .slice(0, 3)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
        {zoom && (
          <ProductImageDialog
            src={product.image}
            alt={product.name[lang]}
            onClose={() => setZoom(false)}
          />
        )}
      </div>
    </>
  )
}
