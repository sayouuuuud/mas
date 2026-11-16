import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PublicPage } from '@/components/catalog/public-page'
import { brands, categories, initialProducts, sectors } from '@/lib/demo-data'

export const metadata: Metadata = {
  title: 'M.A.S | كتالوج المنتجات والخدمات',
  robots: { index: false, follow: false },
}
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>
}) {
  const { path } = await params
  const [section, slug] = path
  const singles = [
    'products',
    'categories',
    'brands',
    'sectors',
    'about',
    'contact',
    'request-quote',
    'privacy',
    'terms',
  ]
  const validSingle = path.length === 1 && singles.includes(section)
  const validDetail =
    path.length === 2 &&
    ((section === 'products' &&
      (initialProducts.some((p) => p.id === slug) ||
        /^demo-\d+$/.test(slug))) ||
      (section === 'categories' && categories.some((p) => p.id === slug)) ||
      (section === 'brands' && brands.some((p) => p.id === slug)) ||
      (section === 'sectors' && sectors.some((p) => p.id === slug)) ||
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
