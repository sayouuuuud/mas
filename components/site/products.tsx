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
    <section id="products" aria-labelledby="products-title" className="bg-secondary py-20 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="products-title"
          eyebrow={t.products.eyebrow}
          title={t.products.title}
          subtitle={t.products.subtitle}
        />

        <ul className="grid gap-6 md:grid-cols-3">
          {productKeys.map((key) => {
            const item = t.products.items[key]
            return (
              <li key={key} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
                <div className="relative aspect-[4/3] bg-secondary">
                  <Image
                    src={productImages[key]}
                    alt={item.imageAlt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-5 p-6">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-extrabold">{item.title}</h3>
                    <p className="leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {item.types.map((type) => (
                      <li key={type} className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                        {type}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#quote"
                    onClick={() => setProduct(key)}
                    className={cn(buttonVariants({ variant: 'outline' }), 'mt-auto h-11 gap-2 text-sm font-semibold')}
                  >
                    {t.products.request}
                    <Arrow className="size-4 text-primary" aria-hidden="true" />
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
