import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicPage } from '@/components/catalog/public-page'

const SLUG_OR_UUID =
  /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

const SINGLES = [
  'products',
  'compare',
  'categories',
  'brands',
  'sectors',
  'about',
  'contact',
  'request-quote',
  'privacy',
  'terms',
] as const

const SECTION_TITLES: Record<string, { ar: string; en: string }> = {
  products: { ar: 'كتالوج المنتجات', en: 'Product Catalog' },
  compare: { ar: 'مقارنة المنتجات', en: 'Compare Products' },
  categories: { ar: 'التصنيفات', en: 'Categories' },
  brands: { ar: 'العلامات التجارية', en: 'Brands' },
  sectors: { ar: 'القطاعات', en: 'Sectors' },
  about: { ar: 'عن الشركة', en: 'About Us' },
  contact: { ar: 'تواصل معنا', en: 'Contact Us' },
  'request-quote': { ar: 'طلب عرض سعر', en: 'Request a Quote' },
  privacy: { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  terms: { ar: 'شروط الاستخدام', en: 'Terms of Use' },
}

function parseRoute(rawPath: string[]) {
  const locale = rawPath[0] === 'en' ? 'en' : 'ar'
  const hasLocalePrefix = rawPath[0] === 'ar' || rawPath[0] === 'en'
  const path = hasLocalePrefix ? rawPath.slice(1) : rawPath
  return { locale, path }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>
}): Promise<Metadata> {
  const { path: rawPath } = await params
  const { locale, path } = parseRoute(rawPath)
  const [section, slug] = path
  const suffix = path.length ? `/${path.join('/')}` : ''
  const noIndex =
    section === 'compare' || (section === 'request-quote' && slug === 'success')

  const labels = section ? SECTION_TITLES[section] : undefined
  const title = labels
    ? locale === 'en'
      ? labels.en
      : labels.ar
    : locale === 'en'
      ? 'M.A.S Engineering For Trade'
      : 'إم إيه إس للتجارة الهندسية'

  return {
    title,
    alternates: {
      canonical: `/${locale}${suffix}`,
      languages: {
        ar: `/ar${suffix}`,
        en: `/en${suffix}`,
      },
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>
}) {
  const { path: rawPath } = await params
  const { path } = parseRoute(rawPath)
  const [section, slug] = path

  const validSingle =
    path.length === 0 ||
    (path.length === 1 && (SINGLES as readonly string[]).includes(section))

  const validDetail =
    path.length === 2 &&
    ((['products', 'categories', 'brands', 'sectors'].includes(section) &&
      SLUG_OR_UUID.test(slug)) ||
      (section === 'request-quote' && slug === 'success'))

  if (!validSingle && !validDetail) notFound()

  return (
    <Suspense
      fallback={
        <div className="site-container py-40" role="status">
          جارٍ تجهيز الصفحة / Loading…
        </div>
      }
    >
      <PublicPage path={path} />
    </Suspense>
  )
}
