'use client'

import Image from 'next/image'
import { Award, Check } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import type { Partner } from '@/lib/site'
import { useCatalogData } from '@/components/demo/demo-provider'
import { useContentPreview } from '@/components/demo/content-preview'
import type { Lang } from '@/lib/i18n'

function PartnerLogo({ partner, lang }: { partner: Partner; lang: Lang }) {
  return (
    <li className="flex h-24 items-center justify-center px-4">
      {partner.logo ? (
        <Image
          src={partner.logo}
          alt={partner.name[lang]}
          width={partner.width || 160}
          height={partner.height || 80}
          sizes="140px"
          className="h-14 w-auto max-w-full object-contain dark:rounded-md dark:bg-logo-matte dark:p-1.5"
        />
      ) : (
        <span
          dir="ltr"
          className="font-sans text-2xl font-bold text-foreground/80"
        >
          {partner.name.en}
        </span>
      )}
    </li>
  )
}

function GroupLabel({ children }: { children: string }) {
  return (
    <h3 className="flex items-center gap-4 text-sm font-bold text-foreground">
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </h3>
  )
}

export function Partners() {
  const { t, lang } = useLanguage()
  const { brands } = useCatalogData()
  const content = useContentPreview('partners')
  const featuredPartner = brands.find((b) => b.featured)
  const oilPartners = brands.filter((b) => b.group === 'oils' && !b.featured)
  const bearingPartners = brands.filter(
    (b) => b.group === 'bearings' && !b.featured,
  )

  return (
    <section
      id="partners"
      aria-labelledby="partners-title"
      className="bg-muted py-20 md:py-28"
    >
      <div className="site-container flex flex-col gap-12 md:gap-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <SectionHeading
            id="partners-title"
            eyebrow={content?.layout?.eyebrow?.[lang] || ''}
            title={(lang === 'ar' ? content?.nameAr : content?.nameEn) || ''}
          />
          <p className="max-w-md text-lg leading-relaxed text-pretty text-muted-foreground">
            {lang === 'ar' ? content?.bodyAr : content?.bodyEn}
          </p>
        </div>

        {featuredPartner && (
          <article
            data-notch="start"
            className="notched [--notch-h:3.5rem] [--notch-w:11rem]"
          >
            <div className="notched-media grid bg-background md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex items-center justify-center border-b px-8 pt-20 pb-10 md:border-e md:border-b-0 md:p-12">
                {featuredPartner.logo && (
                  <Image
                    src={featuredPartner.logo}
                    alt="OLA Energy"
                    width={200}
                    height={150}
                    sizes="200px"
                    className="h-28 w-auto object-contain md:h-36"
                  />
                )}
              </div>
              <div className="flex flex-col gap-5 p-7 md:p-10 lg:p-12">
                <h3 className="font-sans text-3xl font-bold md:text-4xl">
                  <span dir="ltr">{featuredPartner.name[lang]}</span>
                </h3>
                <p className="max-w-2xl leading-relaxed text-pretty text-muted-foreground">
                  {content?.layout?.cards?.[0]?.body?.[lang]}
                </p>
                <ul className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:gap-x-8">
                  {(content?.layout?.points || [])
                    .map((entry) => entry[lang])
                    .map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <Check
                          className="size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        {point}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
            <p className="notched-tab flex items-center justify-center gap-2 bg-brand-dark text-sm font-medium text-on-brand">
              <Award className="size-4 text-accent" aria-hidden="true" />
              {t.partners.featuredLabel}
            </p>
          </article>
        )}

        <div className="flex flex-col gap-8 rounded-[1.125rem] bg-background p-6 md:p-10">
          <div className="flex flex-col gap-4">
            <GroupLabel>{t.partners.oilsGroup}</GroupLabel>
            <ul className="grid grid-cols-2 items-center sm:grid-cols-4 lg:grid-cols-7">
              {oilPartners.map((partner) => (
                <PartnerLogo
                  key={partner.name.en}
                  partner={partner}
                  lang={lang}
                />
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4">
            <GroupLabel>{t.partners.bearingsGroup}</GroupLabel>
            <ul className="grid grid-cols-2 items-center sm:grid-cols-4 lg:w-4/7">
              {bearingPartners.map((partner) => (
                <PartnerLogo
                  key={partner.name.en}
                  partner={partner}
                  lang={lang}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
