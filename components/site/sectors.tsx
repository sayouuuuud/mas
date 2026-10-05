'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'

const sectorKeys = ['factories', 'fleets', 'service', 'construction', 'agriculture', 'power'] as const

export function Sectors() {
  const { t } = useLanguage()

  return (
    <section id="sectors" aria-labelledby="sectors-title" className="bg-surface-tint py-20 md:py-28">
      <div className="site-container grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20">
        <div className="flex flex-col gap-6 lg:sticky lg:top-28">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-primary [html[lang=en]_&]:tracking-[0.16em] [html[lang=en]_&]:uppercase">{t.sectors.eyebrow}</p>
            <h2 id="sectors-title" className="font-sans text-3xl leading-snug font-medium text-balance sm:text-4xl lg:text-5xl">
              {t.sectors.title}
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">{t.sectors.subtitle}</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            <Image src="/images/industrial-sectors.png" alt="" aria-hidden="true" fill sizes="(min-width: 1024px) 35vw, 100vw" className="object-cover object-left" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent" />
            <span className="absolute bottom-5 start-5 font-mono text-xs uppercase tracking-[0.18em] text-background">M.A.S / FIELD SUPPORT</span>
          </div>
        </div>
        <ul className="divide-y divide-foreground/15 border-y border-foreground/15">
          {sectorKeys.map((key, index) => (
            <li key={key} className="group grid gap-4 py-7 transition-colors hover:bg-background/60 sm:grid-cols-[5rem_1fr] sm:items-start sm:gap-6 sm:px-5">
              <span className="font-mono text-sm text-primary">0{index + 1}</span>
              <div className="flex flex-col gap-2">
                <h3 className="font-sans text-2xl font-medium">{t.sectors.items[key].title}</h3>
                <p className="max-w-xl leading-relaxed text-muted-foreground">{t.sectors.items[key].body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
