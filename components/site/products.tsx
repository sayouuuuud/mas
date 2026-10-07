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
    <section id="products" aria-labelledby="products-title" className="mechanical-section relative isolate overflow-hidden bg-muted py-20 text-foreground md:py-28">
      <div className="site-container flex flex-col gap-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <SectionHeading id="products-title" eyebrow={t.products.eyebrow} title={t.products.title} />
          <p className="max-w-sm text-base leading-relaxed text-pretty text-muted-foreground">{t.products.subtitle}</p>
        </div>
        <ul className="grid gap-10 md:grid-cols-3 md:gap-6 lg:gap-8">
          {productKeys.map((key) => {
            const item = t.products.items[key]
            return (
              <li key={key} className="product-editorial group flex flex-col gap-6">
                <a
                  href="#quote"
                  onClick={() => setProduct(key)}
                  aria-label={`${t.products.request} — ${item.title}`}
                  className="product-image relative block aspect-[5/4] overflow-hidden rounded-2xl bg-background"
                >
                  <Image
                    src={productImages[key]}
                    alt={item.imageAlt}
                    fill
                    sizes="(min-width: 1280px) 350px, (min-width: 768px) 30vw, 90vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                  />
                  <span className="absolute end-0 bottom-0 rounded-ss-2xl bg-muted ps-3 pt-3 text-foreground">
                    <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Arrow className="size-5" aria-hidden="true" />
                    </span>
                  </span>
                </a>
                <div className="flex flex-1 flex-col gap-4">
                  <h3 className="font-sans text-3xl font-bold text-balance">{item.title}</h3>
                  <p className="text-base leading-relaxed text-muted-foreground">{item.body}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.types.join(' · ')}</p>
                  <div className="mt-auto border-t border-foreground/15 pt-4">
                    <a
                      href="#quote"
                      onClick={() => setProduct(key)}
                      aria-label={`${t.products.request} — ${item.title}`}
                      className={cn(buttonVariants({ variant: 'link' }), 'h-10 gap-3 px-0')}
                    >
                      {t.products.request}
                      <Arrow data-icon="inline-end" aria-hidden="true" />
                    </a>
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
