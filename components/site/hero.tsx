'use client'

import Image from 'next/image'
import { ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { buttonVariants } from '@/components/ui/button'
import { company, whatsappLink } from '@/lib/site'
import { cn } from '@/lib/utils'

export function Hero() {
  const { t, lang } = useLanguage()
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate flex min-h-160 overflow-hidden bg-foreground text-background md:min-h-176 lg:min-h-192">
      <Image
        src="/images/industrial-hero.png"
        alt={t.hero.imageAlt}
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[42%_center] md:object-center"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-foreground/55" />
      <div className="site-container flex flex-col justify-end gap-12 pt-44 pb-8 md:gap-16 md:pt-52 md:pb-10">
        <div className="hero-copy flex max-w-xl flex-col gap-6 md:gap-7">
          <p className="text-base font-medium text-background/85">{company.name[lang]}</p>
          <h1
            id="hero-title"
            className={cn('font-sans leading-[1.2] font-normal text-balance', lang === 'ar' ? 'text-5xl sm:text-6xl lg:text-7xl' : 'text-4xl sm:text-5xl lg:text-6xl')}
          >
            <span className="block">{t.hero.titleStart}</span>
            <span className="block">{t.hero.titleHighlight}</span>
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-pretty text-background/90">{t.hero.subtitle}</p>
          <div className="flex flex-wrap items-center gap-7">
            <a href="#quote" className={cn(buttonVariants({ variant: 'inverse', size: 'lg' }), 'h-12 rounded-full px-7')}>
              {t.cta.quote}
              <Arrow data-icon="inline-end" aria-hidden="true" />
            </a>
            <a
              href={whatsappLink(t.hero.whatsappGreeting)}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 text-base font-medium underline-offset-8 hover:underline"
            >
              {t.cta.whatsapp}
            </a>
          </div>
        </div>
        <div className="flex justify-between border-t border-background/25 pt-5 text-sm text-background/85">
          <a href="#products" className="inline-flex items-center gap-3 underline-offset-4 hover:underline">
            {t.hero.explore}
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
          <p className="hidden sm:block">{t.hero.stockNote} · {t.hero.stockPlace}</p>
        </div>
      </div>
    </section>
  )
}
