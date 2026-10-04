'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { bearingPartners, featuredPartner, oilPartners, type Partner } from '@/lib/site'
import type { Lang } from '@/lib/i18n'

function PartnerLogo({ partner, lang }: { partner: Partner; lang: Lang }) {
  return (
    <li className="flex h-24 items-center justify-center px-3">
      {partner.logo ? (
        <Image
          src={partner.logo}
          alt={partner.name[lang]}
          width={partner.width}
          height={partner.height}
          className="h-14 w-auto max-w-28 object-contain"
        />
      ) : (
        <span dir="ltr" className="font-sans text-2xl font-bold text-foreground/80">{partner.name.en}</span>
      )}
    </li>
  )
}

export function Partners() {
  const { t, lang } = useLanguage()

  return (
    <section id="partners" aria-labelledby="partners-title" className="py-20 md:py-28">
      <div className="site-container flex flex-col gap-14">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading id="partners-title" eyebrow={t.partners.eyebrow} title={t.partners.title} />
          <p className="max-w-md text-lg leading-relaxed text-pretty text-muted-foreground lg:pt-10">{t.partners.subtitle}</p>
        </div>
        <article className="flex flex-col items-start gap-8 border-y py-10 md:flex-row md:items-center md:gap-14">
          <Image
            src={featuredPartner.logo!}
            alt="OLA Energy"
            width={featuredPartner.width}
            height={featuredPartner.height}
            className="h-28 w-auto shrink-0 object-contain md:h-36"
          />
          <div className="flex max-w-3xl flex-col gap-3">
            <p className="text-sm font-medium text-primary">{t.partners.featuredLabel}</p>
            <h3 className="font-sans text-3xl font-medium"><span dir="ltr">OLA Energy</span></h3>
            <p className="text-base leading-relaxed text-muted-foreground">{t.partners.featuredBody}</p>
          </div>
        </article>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-medium text-muted-foreground">{t.partners.oilsGroup}</h3>
            <ul className="grid grid-cols-3 items-center gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {oilPartners.map((partner) => <PartnerLogo key={partner.name.en} partner={partner} lang={lang} />)}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-medium text-muted-foreground">{t.partners.bearingsGroup}</h3>
            <ul className="grid grid-cols-2 items-center gap-3 sm:grid-cols-4 lg:w-4/7">
              {bearingPartners.map((partner) => <PartnerLogo key={partner.name.en} partner={partner} lang={lang} />)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
