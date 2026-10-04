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
    <section id="products" aria-labelledby="products-title" className="bg-muted py-20 md:py-28">
      <div className="site-container flex flex-col gap-12">
        <SectionHeading
          id="products-title"
          eyebrow={t.products.eyebrow}
          title={t.products.title}
          subtitle={t.products.subtitle}
        />

        <ul className="grid gap-x-8 gap-y-12 md:grid-cols-3">
          {productKeys.map((key) => {
            const item = t.products.items[key]
            return (
              <li key={key} className="flex flex-col gap-6">
                <div className="relative aspect-[4/3] overflow-hidden bg-background">
                  <Image
                    src={productImages[key]}
                    alt={item.imageAlt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <h3 className="font-sans text-3xl font-medium">{item.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.types.join(' / ')}
                  </p>
                  <a
                    href="#quote"
                    onClick={() => setProduct(key)}
                    className={cn(buttonVariants({ variant: 'link' }), 'mt-auto h-11 w-fit justify-start px-0')}
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
