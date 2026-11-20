'use client'

import { PublicLink as Link } from '@/components/demo/public-link'
import Image from 'next/image'
import { useCatalogData } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { About } from '@/components/site/about'
import { Sectors } from '@/components/site/sectors'
import { ScrollEdgeBlur } from '@/components/site/scroll-edge-blur'
import { WhatsAppFloat } from '@/components/site/whatsapp-float'
import {
  DirectionArrow,
  EmptyState,
  ErrorState,
  LoadingState,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'
import { Catalog, ProductDetail } from './catalog'
import { usePublicContentBlock } from '@/components/demo/content-preview'
import { ComparisonTray, ComparisonPage } from './comparison'
import { HomePage } from '@/components/site/home-page'
import { PreviewReceipt } from './preview-receipt'
import { RequestForm } from './request-form'
import { api, BackendError } from '@/lib/api-client'
import { useLiveQuery } from '@/lib/live-query'
import type { ReferenceRecord } from '@/lib/types'

function ReferenceCatalogView({
  resource,
  slug,
}: {
  resource: 'categories' | 'brands' | 'sectors'
  slug: string
}) {
  const { lang } = useLanguage()
  const c = useCopy()
  const { categories } = useCatalogData()
  const detail = useLiveQuery(`/catalog/${resource}/${slug}`, async () => {
    const res = await api<ReferenceRecord>(`/catalog/${resource}/${slug}`)
    return res.data
  })

  if (detail.isLoading) {
    return (
      <div className="site-container page-section">
        <LoadingState />
      </div>
    )
  }

  if (detail.error) {
    if (detail.error instanceof BackendError && detail.error.status === 404) {
      return <UnavailableContent />
    }
    return (
      <div className="site-container page-section">
        <ErrorState
          error={detail.error}
          onRetry={() => void detail.refresh()}
        />
      </div>
    )
  }

  const record = detail.data
  if (!record) return <UnavailableContent />

  const subcategories =
    resource === 'categories'
      ? categories.filter((cat) => cat.parent === record.id)
      : []

  return (
    <>
      <Catalog
        category={resource === 'categories' ? record.id : undefined}
        brand={resource === 'brands' ? record.id : undefined}
        sector={resource === 'sectors' ? record.id : undefined}
        title={record.name[lang]}
        description={
          record.description?.[lang] ||
          (resource === 'brands'
            ? c(
                'تصفح المنتجات المنشورة ضمن هذه العلامة التجارية.',
                'Browse published products under this brand.',
              )
            : '')
        }
        subcategories={subcategories}
      />
    </>
  )
}

export function PublicPage({ path }: { path: string[] }) {
  const { brands, categories, sectors, isLoading, error, refresh } =
    useCatalogData()
  const { lang } = useLanguage()
  const c = useCopy()
  const [section, slug] = path
  const mainCategories = categories.filter((category) => !category.parentId)

  if (!section) return <HomePage />

  let body
  if (section === 'compare') body = <ComparisonPage />
  else if (section === 'products' && slug)
    body = <ProductDetail key={slug} slug={slug} />
  else if (section === 'products') body = <Catalog />
  else if (
    (section === 'categories' ||
      section === 'brands' ||
      section === 'sectors') &&
    slug
  ) {
    body = (
      <ReferenceCatalogView
        key={`${section}/${slug}`}
        resource={section}
        slug={slug}
      />
    )
  } else if (section === 'request-quote' && slug === 'success')
    body = <PreviewReceipt />
  else if (section === 'request-quote' || section === 'contact')
    body = <RequestForm contact={section === 'contact'} />
  else if (section === 'brands')
    body = (
      <>
        <PageIntro
          eyebrow="M.A.S PARTNERS"
          title={c('العلامات التجارية', 'Brands')}
          description={c(
            'استكشف العلامات المتاحة وتصفح المنتجات المنشورة في الكتالوج.',
            'Explore available brands and browse published catalog products.',
          )}
        />
        <div className="site-container page-section">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refresh()} />
          ) : brands.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {brands.map((b) => (
                <Link
                  href={`/brands/${b.slug || b.id}`}
                  className="directory-card group"
                  key={b.id}
                >
                  <div className="relative mb-7 flex h-24 w-full items-center justify-center">
                    {b.logo ? (
                      <Image
                        src={b.logo}
                        alt={b.name[lang]}
                        fill
                        sizes="200px"
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-primary">
                        {b.name[lang]}
                      </span>
                    )}
                  </div>
                  <h2 className="font-bold">{b.name[lang]}</h2>
                  <span className="mt-3 flex items-center gap-2 text-sm text-primary">
                    {c('تصفح المنتجات', 'Browse products')}
                    <DirectionArrow />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={c('لا توجد علامات منشورة بعد', 'No published brands yet')}
              description={c(
                'ستظهر العلامات التجارية فور نشرها من لوحة الإدارة.',
                'Brands will appear here once published from the admin panel.',
              )}
            />
          )}
        </div>
      </>
    )
  else if (section === 'categories')
    body = (
      <>
        <PageIntro
          title={c('مجموعات المنتجات', 'Product categories')}
          description={c(
            'ابدأ بمجموعة المنتجات المناسبة لطبيعة استخدامك.',
            'Start with the product category that fits your application.',
          )}
        />
        <div className="site-container page-section">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refresh()} />
          ) : mainCategories.length ? (
            <div className="grid gap-6 md:grid-cols-3">
              {mainCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug || cat.id}`}
                  className="catalog-card"
                >
                  <div className="relative aspect-[4/3]">
                    {cat.image && (
                      <Image
                        src={cat.image}
                        alt={cat.name[lang]}
                        fill
                        sizes="33vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    <h2 className="text-2xl font-bold">{cat.name[lang]}</h2>
                    <p className="my-3 text-muted-foreground">
                      {cat.description[lang]}
                    </p>
                    <DirectionArrow />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={c(
                'لا توجد تصنيفات منشورة بعد',
                'No published categories yet',
              )}
              description={c(
                'ستظهر مجموعات المنتجات فور نشرها من لوحة الإدارة.',
                'Product categories will appear here once published.',
              )}
            />
          )}
        </div>
      </>
    )
  else if (section === 'sectors')
    body = (
      <>
        <PageIntro
          title={c('القطاعات التي نخدمها', 'Sectors we serve')}
          description={c(
            'احتياجات مختلفة، ودعم فني يساعدك على اختيار المواصفة المناسبة.',
            'Different needs, with technical support to help you choose the right specification.',
          )}
        />
        <div className="site-container page-section">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refresh()} />
          ) : sectors.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sectors.map((s, i) => (
                <Link
                  href={`/sectors/${s.slug || s.id}`}
                  className="directory-card sector-card"
                  key={s.id}
                >
                  <span className="mb-6 block font-mono text-3xl text-primary/30">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-xl font-bold">{s.name[lang]}</h2>
                  <p className="my-4 leading-7 text-muted-foreground">
                    {s.description[lang]}
                  </p>
                  <span className="flex items-center gap-2 text-sm font-bold text-primary">
                    {c('المنتجات المرتبطة', 'Related products')}
                    <DirectionArrow />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={c('لا توجد قطاعات منشورة بعد', 'No published sectors yet')}
              description={c(
                'ستظهر القطاعات المرتبطة بالمنتجات فور نشرها.',
                'Sectors linked to products will appear here once published.',
              )}
            />
          )}
        </div>
        <Sectors />
      </>
    )
  else if (section === 'about')
    body = (
      <>
        <PageIntro
          eyebrow="ENGINEERING FOR TRADE"
          title={c(
            'خبرة هندسية قريبة من احتياجك',
            'Engineering expertise, close to your needs',
          )}
          description={c(
            'إم إيه إس للتجارة الهندسية — زيوت وشحوم ورمان بلي للمصانع والأساطيل ومراكز الخدمة.',
            'M.A.S Engineering For Trade — oils, greases and bearings for factories, fleets and service centers.',
          )}
        />
        <About />
        <div className="site-container page-section">
          <div className="rounded-2xl bg-surface-tint p-8 sm:p-12">
            <h2 className="text-2xl font-bold">
              {c(
                'من اختيار المواصفة إلى مناقشة التوريد',
                'From choosing a specification to discussing supply',
              )}
            </h2>
            <p className="my-5 max-w-2xl leading-8 text-muted-foreground">
              {c(
                'تصفح مجموعات المنتجات أو اكتب تفاصيل احتياجك لتجهيز استفسار للفريق الفني.',
                'Browse our categories or describe your requirements to prepare an inquiry for the technical team.',
              )}
            </p>
            <Link className="btn-primary" href="/products">
              {c('استكشف الكتالوج', 'Explore the catalog')}
              <DirectionArrow />
            </Link>
          </div>
        </div>
      </>
    )
  else body = <LegalPage type={section} />

  return (
    <>
      <Header />
      <main id="main-content" className="public-main">
        {body}
      </main>
      <ComparisonTray />
      <Footer />
      <ScrollEdgeBlur />
      <WhatsAppFloat />
    </>
  )
}

function LegalPage({ type }: { type: string }) {
  const {
    data: content,
    isLoading,
    error,
    refresh,
  } = usePublicContentBlock(type)
  const { lang } = useLanguage()
  const c = useCopy()
  const privacy = type === 'privacy'

  return (
    <>
      <PageIntro
        title={
          privacy
            ? c('سياسة الخصوصية', 'Privacy policy')
            : c('شروط الاستخدام', 'Terms of use')
        }
        description={
          content?.policyVersion
            ? `${c('الإصدار المعتمد', 'Policy version')}: ${content.policyVersion}`
            : undefined
        }
      />
      <div className="site-container page-section">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refresh()} />
        ) : content ? (
          <article className="mx-auto max-w-3xl space-y-6">
            <h2 className="text-2xl font-bold">{content.name[lang]}</h2>
            <div className="whitespace-pre-line leading-8 text-foreground/90">
              {content.body[lang]}
            </div>
          </article>
        ) : (
          <EmptyState
            title={
              privacy
                ? c(
                    'لم تُنشر سياسة الخصوصية بعد',
                    'Privacy policy has not been published yet',
                  )
                : c(
                    'لم تُنشر شروط الاستخدام بعد',
                    'Terms of use have not been published yet',
                  )
            }
            description={c(
              'يقوم مدير النظام بمراجعة واعتماد النص الرسمي قبل نشره.',
              'The administrator will publish the approved document once finalized.',
            )}
          />
        )}
      </div>
    </>
  )
}

function UnavailableContent() {
  const c = useCopy()
  return (
    <>
      <PageIntro
        title={c('الصفحة أو السجل غير متاح', 'Content not available')}
        description={c(
          'قد يكون الرابط غير صحيح أو لم يُنشر هذا السجل بعد.',
          'The link may be outdated or this item is not currently published.',
        )}
      />
      <div className="site-container page-section">
        <Link href="/products" className="btn-primary">
          {c('تصفح المنتجات', 'Browse products')}
        </Link>
      </div>
    </>
  )
}
