'use client'

import { ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { HeroSlider } from '@/components/site/hero-slider'
import { useLanguage } from '@/components/language-provider'
import { buttonVariants } from '@/components/ui/button'
import { company, whatsappLink } from '@/lib/site'
import { cn } from '@/lib/utils'

export function Hero() {
  const { t, lang } = useLanguage()
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <HeroSlider
      footer={
        <div className="flex items-center justify-between gap-5 text-sm text-background/85">
          <a href="#products" className="inline-flex items-center gap-3 underline-offset-4 hover:underline">
            {t.hero.explore}
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
          <p className="hidden xl:block">{t.hero.stockNote} · {t.hero.stockPlace}</p>
        </div>
      }
    >
      <div className="hero-copy pointer-events-auto flex max-w-xl flex-col gap-6 md:gap-7">
        <p className="text-base font-medium text-background/85">{company.name[lang]}</p>
        <h1
          id="hero-title"
          className={cn('font-sans leading-[1.2] font-bold text-balance', lang === 'ar' ? 'text-5xl sm:text-6xl lg:text-7xl' : 'text-4xl sm:text-5xl lg:text-6xl')}
        >
          <span className="block">{t.hero.titleStart}</span>
          <span className="block">{t.hero.titleHighlight}</span>
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-pretty text-background/85">{t.hero.subtitle}</p>
        <div className="flex flex-wrap items-center gap-6">
          <a href="#quote" className={cn(buttonVariants({ size: 'lg' }), 'h-12 gap-4 rounded-lg px-6')}>
            {t.cta.quote}
            <Arrow data-icon="inline-end" aria-hidden="true" />
          </a>
          <a
            href={whatsappLink(t.hero.whatsappGreeting)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 py-3 text-base font-medium underline-offset-8 hover:underline"
          >
            {t.cta.whatsapp}
            <Arrow className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </HeroSlider>
  )
}
