'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useQuote } from '@/components/quote-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { buttonVariants } from '@/components/ui/button'
import { productKeys } from '@/lib/site'
import { cn } from '@/lib/utils'

const productImages = {
  oils: '/images/product-oils.png',
  grease: '/images/product-grease.png',
  bearings: '/images/product-bearings.png',
} as const

export function Products() {
  const { t, lang } = useLanguage()
  const { setProduct } = useQuote()
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <section id="products" aria-labelledby="products-title" className="mechanical-section relative isolate overflow-hidden bg-background py-20 md:py-28">
      <div className="site-container flex flex-col gap-12">
        <SectionHeading
          id="products-title"
          eyebrow={t.products.eyebrow}
          title={t.products.title}
          subtitle={t.products.subtitle}
        />

        <ul className="grid gap-6 md:grid-cols-3 lg:gap-8">
          {productKeys.map((key) => {
            const item = t.products.items[key]
            return (
              <li key={key} className="product-card flex flex-col overflow-hidden rounded-3xl border border-primary/10 bg-card text-card-foreground">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <Image
                    src={productImages[key]}
                    alt={item.imageAlt}
                    fill
                    sizes="(min-width: 1280px) 350px, (min-width: 768px) 30vw, 90vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 p-6 lg:p-8">
                  <div className="flex h-full flex-col gap-5">
                    <div className="flex flex-col gap-3">
                      <h3 className="font-sans text-3xl font-medium text-balance">{item.title}</h3>
                      <p className="leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.types.join(' / ')}
                    </p>
                    <div className="mt-auto border-t border-primary/10 pt-4">
                      <a
                        href="#quote"
                        onClick={() => setProduct(key)}
                        className={cn(buttonVariants({ variant: 'link' }), 'h-11 w-full justify-between px-0')}
                      >
                        {t.products.request}
                        <Arrow data-icon="inline-end" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
