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

        <ul className="grid gap-8 md:grid-cols-3">
          {productKeys.map((key, index) => {
            const item = t.products.items[key]
            return (
              <li key={key} className="product-card group flex flex-col border-t-2 border-foreground bg-background text-foreground">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <Image
                    src={productImages[key]}
                    alt={item.imageAlt}
                    fill
                    sizes="(min-width: 1280px) 350px, (min-width: 768px) 30vw, 90vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="absolute start-5 top-5 font-mono text-sm font-medium text-primary">0{index + 1}</span>
                  <span className="absolute end-5 top-5 size-9 rounded-full border border-foreground/20 bg-background/80 text-center text-lg leading-8 backdrop-blur-sm" aria-hidden="true">+</span>
                </div>
                <div className="flex flex-1 flex-col gap-6 border-x border-b border-foreground/15 p-6 lg:p-7">
                  <div className="flex flex-col gap-3">
                    <h3 className="font-sans text-3xl font-medium text-balance">{item.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                  <p className="border-t border-foreground/15 pt-4 text-sm leading-relaxed text-muted-foreground">
                    {item.types.join(' / ')}
                  </p>
                  <a
                    href="#quote"
                    onClick={() => setProduct(key)}
                    className={cn(buttonVariants({ variant: 'link' }), 'mt-auto h-10 w-fit justify-start gap-3 px-0')}
                  >
                    {t.products.request}
                    <Arrow data-icon="inline-end" aria-hidden="true" />
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
