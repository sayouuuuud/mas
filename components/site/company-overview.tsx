'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/components/language-provider'
import {
  useCatalogData,
  usePublicBootstrap,
} from '@/components/demo/demo-provider'
import { useContentPreview } from '@/components/demo/content-preview'
import { cn } from '@/lib/utils'

export function CompanyOverview() {
  const { t, lang } = useLanguage()
  const { brands: allBrands, categories, sectors } = useCatalogData()
  const bootstrap = usePublicBootstrap()
  const content = useContentPreview('overview')
  const sectionRef = useRef<HTMLElement>(null)
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    const section = sectionRef.current
    if (
      !section ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return

    let frame = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        setProgress(0)

        const animate = (now: number) => {
          const elapsed = Math.min((now - start) / 1200, 1)
          setProgress(1 - Math.pow(1 - elapsed, 3))
          if (elapsed < 1) frame = requestAnimationFrame(animate)
        }

        frame = requestAnimationFrame(animate)
      },
      { threshold: 0.25 },
    )

    observer.observe(section)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  const metrics = [
    {
      value: allBrands.length,
      label: t.overview.brands,
      symbol: '',
      prefix: false,
    },
    {
      value: categories.filter((c) => !c.parentId).length,
      label: t.overview.products,
      symbol: '',
      prefix: false,
    },
    {
      value: sectors.length,
      label: t.overview.sectors,
      symbol: '',
      prefix: false,
    },
    {
      value: bootstrap.data?.locations?.length || 0,
      label: t.overview.locations,
      symbol: '',
      prefix: false,
    },
    { value: 100, label: t.overview.genuine, symbol: '%', prefix: false },
  ]

  return (
    <section
      ref={sectionRef}
      aria-labelledby="overview-title"
      className="bg-background pt-10 pb-20 text-foreground md:pt-12 md:pb-28"
    >
      <div className="site-container flex flex-col items-center gap-12 md:gap-16">
        <h2
          id="overview-title"
          className="max-w-4xl text-center font-sans text-2xl leading-relaxed font-normal text-pretty md:text-3xl"
        >
          {lang === 'ar' ? content?.bodyAr : content?.bodyEn}
        </h2>
        <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-10 text-center sm:grid-cols-5">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={cn(
                'flex flex-col items-center gap-3 md:gap-5',
                index === metrics.length - 1 && 'col-span-2 sm:col-span-1',
              )}
            >
              <dt className="order-last text-base leading-relaxed text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="font-sans text-5xl leading-none font-semibold tabular-nums md:text-6xl">
                <span className="sr-only">
                  {metric.prefix ? metric.symbol : ''}
                  {metric.value}
                  {!metric.prefix ? metric.symbol : ''}
                </span>
                <span
                  aria-hidden="true"
                  dir="ltr"
                  className="inline-flex items-baseline gap-1"
                >
                  {metric.prefix && (
                    <span className="text-4xl text-primary md:text-5xl">
                      {metric.symbol}
                    </span>
                  )}
                  <span>{Math.round(metric.value * progress)}</span>
                  {!metric.prefix && metric.symbol && (
                    <span className="text-3xl text-primary md:text-4xl">
                      {metric.symbol}
                    </span>
                  )}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
