'use client'

import Image from 'next/image'
import { Check, Cog, Droplets } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { bearingPartners, featuredPartner, oilPartners, type Partner } from '@/lib/site'
import type { Lang } from '@/lib/i18n'

function LogoTile({ partner, lang }: { partner: Partner; lang: Lang }) {
  return (
    <li className="flex h-28 items-center justify-center rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      {partner.logo ? (
        <Image
          src={partner.logo}
          alt={partner.name[lang]}
          width={partner.width}
          height={partner.height}
          className="h-14 w-auto max-w-full object-contain"
        />
      ) : (
        <span dir="ltr" className="font-heading text-3xl font-extrabold tracking-widest text-foreground/80">
          {partner.name.en}
        </span>
      )}
    </li>
  )
}

function PartnerGroup({
  title,
  icon: Icon,
  partners,
  lang,
}: {
  title: string
  icon: typeof Droplets
  partners: Partner[]
  lang: Lang
}) {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5 text-primary" aria-hidden="true" />
        {title}
      </h3>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {partners.map((partner) => (
          <LogoTile key={partner.name.en} partner={partner} lang={lang} />
        ))}
      </ul>
    </div>
  )
}

export function Partners() {
  const { t, lang } = useLanguage()

  return (
    <section id="partners" aria-labelledby="partners-title" className="bg-secondary py-20 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="partners-title"
          eyebrow={t.partners.eyebrow}
          title={t.partners.title}
          subtitle={t.partners.subtitle}
          align="center"
        />

        <article className="grid items-center gap-8 rounded-2xl border-2 border-accent bg-card p-6 shadow-sm sm:p-10 md:grid-cols-[auto_1fr] md:gap-12">
          <div className="flex items-center justify-center rounded-xl bg-secondary p-8 md:size-60">
            <Image
              src={featuredPartner.logo!}
              alt="OLA Energy"
              width={featuredPartner.width}
              height={featuredPartner.height}
              className="h-32 w-auto object-contain md:h-40"
            />
          </div>
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
              {t.partners.featuredLabel}
            </span>
            <h3 className="text-3xl font-extrabold sm:text-4xl">
              <span dir="ltr">OLA Energy</span>
            </h3>
            <p className="max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
              {t.partners.featuredBody}
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {t.partners.featuredPoints.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm font-medium">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <div className="flex flex-col gap-12">
          <PartnerGroup title={t.partners.oilsGroup} icon={Droplets} partners={oilPartners} lang={lang} />
          <PartnerGroup title={t.partners.bearingsGroup} icon={Cog} partners={bearingPartners} lang={lang} />
        </div>
      </div>
    </section>
  )
}
