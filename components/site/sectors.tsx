'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'

import { useCatalogData } from '@/components/demo/demo-provider'
import { useContentPreview } from '@/components/demo/content-preview'
const sectorKeys = [
  'factories',
  'fleets',
  'service',
  'construction',
  'agriculture',
  'power',
] as const

export function Sectors() {
  const { t, lang } = useLanguage()
  const { sectors } = useCatalogData()
  const content = useContentPreview('home-sectors')
  const image = content?.media.find(
    (m) => m.id === content.layout?.imageMediaId,
  )?.url

  return (
    <section
      id="sectors"
      aria-labelledby="sectors-title"
      className="relative isolate overflow-hidden bg-brand-dark text-on-brand"
    >
      {image && (
        <Image
          src={image}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="-z-20 object-cover object-left [html[dir=ltr]_&]:-scale-x-100"
        />
      )}
      <div
        aria-hidden="true"
        className="industry-shade pointer-events-none absolute inset-0 -z-10"
      />
      <div className="site-container py-20 md:py-28">
        <div className="flex flex-col gap-12 md:w-4/5 lg:w-3/5">
          <SectionHeading
            id="sectors-title"
            eyebrow={content?.layout?.eyebrow?.[lang] || ''}
            title={(lang === 'ar' ? content?.nameAr : content?.nameEn) || ''}
            subtitle={(lang === 'ar' ? content?.bodyAr : content?.bodyEn) || ''}
            tone="dark"
            className="max-w-xl"
          />
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {sectors.map((sector) => (
              <li
                key={sector.id}
                className="border-t border-on-brand/20 py-6 transition-colors duration-300 hover:border-accent"
              >
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold">{sector.name[lang]}</h3>
                  <p className="text-sm leading-relaxed text-on-brand/75">
                    {sector.description[lang]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
