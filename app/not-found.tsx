'use client'
import Link from 'next/link'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { useCopy } from '@/components/demo/ui'
export default function NotFound() {
  const c = useCopy()
  return (
    <>
      <Header />
      <main id="main-content" className="public-main">
        <div className="site-container py-24 text-center">
          <p className="mb-5 font-mono text-7xl font-bold text-primary/25">
            404
          </p>
          <h1 className="text-3xl font-bold">
            {c('الصفحة غير موجودة', 'Page not found')}
          </h1>
          <p className="my-6 text-muted-foreground">
            {c(
              'قد يكون الرابط غير صحيح أو تغير مكان الصفحة.',
              'The link may be incorrect or the page may have moved.',
            )}
          </p>
          <Link href="/products" className="btn-primary">
            {c('تصفح المنتجات', 'Browse products')}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
