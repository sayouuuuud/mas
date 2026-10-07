'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { bearingPartners, featuredPartner, oilPartners, type Partner } from '@/lib/site'
import type { Lang } from '@/lib/i18n'

function PartnerLogo({ partner, lang }: { partner: Partner; lang: Lang }) {
  return (
    <li className="flex h-24 items-center justify-center bg-background px-4 text-foreground">
      {partner.logo ? (
        <Image
          src={partner.logo}
          alt={partner.name[lang]}
          width={partner.width}
          height={partner.height}
          className="h-14 w-auto max-w-full object-contain"
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
    <section id="partners" aria-labelledby="partners-title" className="bg-background py-20 text-foreground md:py-28">
      <div className="site-container flex flex-col gap-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <SectionHeading id="partners-title" eyebrow={t.partners.eyebrow} title={t.partners.title} />
          <p className="max-w-sm text-base leading-relaxed text-pretty text-muted-foreground">{t.partners.subtitle}</p>
        </div>
        <article className="overflow-hidden rounded-2xl bg-muted text-foreground">
          <div className="flex flex-col md:flex-row md:items-stretch">
            <div className="flex shrink-0 items-center justify-center bg-background p-8 text-foreground md:w-1/4">
              <Image
                src={featuredPartner.logo!}
                alt="OLA Energy"
                width={featuredPartner.width}
                height={featuredPartner.height}
                className="h-28 w-auto object-contain md:h-32"
              />
            </div>
            <div className="p-7 md:p-9 lg:p-10">
              <div className="flex max-w-3xl flex-col gap-4">
                <p className="text-sm font-bold text-primary">{t.partners.featuredLabel}</p>
                <h3 className="font-sans text-3xl font-bold md:text-4xl"><span dir="ltr">OLA Energy</span></h3>
                <p className="text-base leading-relaxed text-pretty text-muted-foreground">{t.partners.featuredBody}</p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-primary">
                  {t.partners.featuredPoints.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </article>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="border-b pb-4 text-base font-bold">{t.partners.oilsGroup}</h3>
            <ul className="grid grid-cols-3 items-center gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {oilPartners.map((partner) => <PartnerLogo key={partner.name.en} partner={partner} lang={lang} />)}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="border-b pb-4 text-base font-bold">{t.partners.bearingsGroup}</h3>
            <ul className="grid grid-cols-2 items-center gap-3 sm:grid-cols-4 lg:w-4/7">
              {bearingPartners.map((partner) => <PartnerLogo key={partner.name.en} partner={partner} lang={lang} />)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
