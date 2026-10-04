'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'

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
        <div className="flex flex-col gap-10 md:w-4/5 lg:w-3/5">
          <div className="flex max-w-xl flex-col gap-4">
            <p className="text-sm font-medium text-background/80 [html[lang=en]_&]:tracking-[0.16em] [html[lang=en]_&]:uppercase">{t.sectors.eyebrow}</p>
            <h2 id="sectors-title" className="font-sans text-3xl leading-snug font-medium text-balance sm:text-4xl lg:text-5xl">
              {t.sectors.title}
            </h2>
            <p className="text-lg leading-relaxed text-pretty text-background/85">{t.sectors.subtitle}</p>
          </div>
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {sectorKeys.map((key) => (
              <li key={key} className="border-t border-background/25 pt-5">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-medium">{t.sectors.items[key].title}</h3>
                  <p className="text-sm leading-relaxed text-background/80">{t.sectors.items[key].body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
