'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'

const sectorKeys = ['factories', 'fleets', 'service', 'construction', 'agriculture', 'power'] as const

export function Sectors() {
  const { t } = useLanguage()

  return (
    <section id="sectors" aria-labelledby="sectors-title" className="relative isolate overflow-hidden bg-foreground text-background">
      <Image
        src="/images/industrial-sectors.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="-z-20 object-cover object-left [html[dir=ltr]_&]:-scale-x-100"
      />
      <div aria-hidden="true" className="industry-shade pointer-events-none absolute inset-0 -z-10" />
      <div className="site-container py-20 md:py-28">
        <div className="flex flex-col gap-12 md:w-4/5 lg:w-3/5">
          <SectionHeading
            id="sectors-title"
            eyebrow={t.sectors.eyebrow}
            title={t.sectors.title}
            subtitle={t.sectors.subtitle}
            tone="dark"
            className="max-w-xl"
          />
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {sectorKeys.map((key) => (
              <li key={key} className="border-t border-background/20 py-6 transition-colors duration-300 hover:border-accent">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold">{t.sectors.items[key].title}</h3>
                  <p className="text-sm leading-relaxed text-background/75">{t.sectors.items[key].body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
