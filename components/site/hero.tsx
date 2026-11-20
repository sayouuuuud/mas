'use client'

import { ArrowDown } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons'
import { useLanguage } from '@/components/language-provider'
import { ActionLink } from '@/components/site/action-link'
import { HeroSlider } from '@/components/site/hero-slider'
import { company, whatsappLink } from '@/lib/site'
import {
  useContentPreview,
  useSiteInfo,
} from '@/components/demo/content-preview'
import { cn } from '@/lib/utils'

export function Hero() {
  const { t, lang } = useLanguage()
  const { company, whatsappHref } = useSiteInfo()
  const content = useContentPreview('home-hero')

  return (
    <HeroSlider
      footer={
        <a
          href="#products"
          className="group inline-flex items-center gap-3 text-sm text-on-brand/85 transition-colors hover:text-on-brand"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-on-brand/30 transition-transform duration-300 motion-safe:group-hover:translate-y-0.5">
            <ArrowDown className="size-4" aria-hidden="true" />
          </span>
          {t.hero.explore}
        </a>
      }
    >
      <div className="hero-copy pointer-events-auto flex max-w-xl flex-col gap-6 md:gap-7">
        <p className="flex items-center gap-3 text-sm font-medium text-on-brand/85 md:text-base">
          <span aria-hidden="true" className="h-px w-8 bg-accent" />
          {company.name[lang]}
        </p>
        <h1
          id="hero-title"
          className={cn(
            'font-sans leading-[1.2] text-balance',
            lang === 'ar'
              ? 'text-5xl sm:text-6xl lg:text-7xl'
              : 'text-4xl sm:text-5xl lg:text-6xl',
          )}
        >
          {content ? (
            <span className="block font-bold">
              {lang === 'ar' ? content.nameAr : content.nameEn}
            </span>
          ) : null}
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-pretty text-on-brand/90">
          {content ? (lang === 'ar' ? content.bodyAr : content.bodyEn) : ''}
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <ActionLink
            href={content?.ctaPath || '/request-quote'}
            variant="accent"
          >
            {content
              ? (lang === 'ar' ? content.cta : content.ctaEn) || t.cta.quote
              : t.cta.quote}
          </ActionLink>
          <ActionLink
            href={`${whatsappHref}?text=${encodeURIComponent(t.hero.whatsappGreeting)}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="light"
            icon={<WhatsAppIcon className="size-4" />}
          >
            {t.cta.whatsapp}
          </ActionLink>
        </div>
      </div>
    </HeroSlider>
  )
}
