'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { ActionLink } from '@/components/site/action-link'
import { SectionHeading } from '@/components/site/section-heading'
import { useCatalogData } from '@/components/demo/demo-provider'
import { useContentPreview } from '@/components/demo/content-preview'
import type { ReferenceRecord } from '@/lib/types'
import { PublicLink as Link } from '@/components/demo/public-link'
import { usePublicBootstrap } from '@/components/demo/demo-provider'
import { cn } from '@/lib/utils'

function ProductCard({
  category,
  children,
  wide,
  href,
}: {
  category: ReferenceRecord & { image: string }
  children: ReferenceRecord[]
  wide: boolean
  href: string
}) {
  const { t, lang } = useLanguage()
  const item = {
    title: category.name[lang],
    body: category.description?.[lang] || '',
    types: children.map((row) => row.name[lang]),
    imageAlt: category.name[lang],
  }
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <li
      className={cn(
        'notched group grid',
        wide && 'sm:col-span-2 lg:col-span-1',
      )}
    >
      <div
        className={cn(
          'notched-media flex flex-col justify-end self-stretch bg-foreground text-background',
          wide
            ? 'aspect-[4/5] sm:aspect-[2/1] lg:aspect-[3/4]'
            : 'aspect-[4/5] lg:aspect-[3/4]',
        )}
      >
        {category.image && (
          <Image
            src={category.image}
            alt={item.imageAlt}
            fill
            sizes="(min-width: 1280px) 380px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="-z-20 object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
          />
        )}
        <div
          aria-hidden="true"
          className="product-shade absolute inset-0 -z-10"
        />
        <div className="flex max-w-md flex-col gap-4 p-6 pt-32 lg:p-7 lg:pt-32">
          <h3 className="font-sans text-3xl font-bold">{item.title}</h3>
          <p className="leading-relaxed text-pretty text-background/85">
            {item.body}
          </p>
          <ul className="flex flex-wrap gap-2">
            {item.types.map((type) => (
              <li
                key={type}
                className="rounded-full border border-background/30 px-3 py-1 text-sm text-background/90"
              >
                {type}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <span
        aria-hidden="true"
        className="notched-tab flex items-center justify-center bg-primary text-primary-foreground transition-colors duration-300 group-hover:bg-accent group-hover:text-accent-foreground"
      >
        <Arrow className="size-5 transition-transform duration-300 motion-safe:ltr:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5" />
      </span>
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-[var(--notch-r)]"
      >
        <span className="sr-only">
          {t.products.request}: {item.title}
        </span>
      </Link>
    </li>
  )
}

export function Products() {
  const { t, lang } = useLanguage()
  const { categories } = useCatalogData()
  const roots = categories.filter((cat) => !cat.parentId)
  const content = useContentPreview('home-products')

  return (
    <section
      id="products"
      aria-labelledby="products-title"
      className="mechanical-section relative isolate overflow-hidden bg-background py-20 md:py-28"
    >
      <div className="site-container flex flex-col gap-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="products-title"
            eyebrow={content?.layout?.eyebrow?.[lang] || ''}
            title={(lang === 'ar' ? content?.nameAr : content?.nameEn) || ''}
            subtitle={(lang === 'ar' ? content?.bodyAr : content?.bodyEn) || ''}
          />
          <ActionLink href="/products" variant="primary" className="w-fit">
            {t.products.request}
          </ActionLink>
        </div>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {roots.map((category, index) => (
            <ProductCard
              key={category.id}
              category={category}
              children={categories.filter(
                (cat) => cat.parentId === category.id,
              )}
              wide={index === roots.length - 1}
              href={`/categories/${category.slug}`}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}
