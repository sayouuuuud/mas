'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'

const sectorKeys = ['factories', 'fleets', 'service', 'construction', 'agriculture', 'power'] as const

export function Sectors() {
  const { t } = useLanguage()

  return (
    <section id="sectors" aria-labelledby="sectors-title" className="bg-foreground text-background">
      <div className="mx-auto flex max-w-400 flex-col lg:flex-row">
        <div className="flex flex-col gap-10 px-6 py-20 sm:px-12 lg:w-3/5 lg:px-16 lg:py-24">
          <div className="flex max-w-xl flex-col gap-4">
            <p className="text-base text-background/70">{t.sectors.eyebrow}</p>
            <h2 id="sectors-title" className="font-sans text-3xl leading-snug font-medium text-balance sm:text-4xl lg:text-5xl">
              {t.sectors.title}
            </h2>
            <p className="text-lg leading-relaxed text-background/75">{t.sectors.subtitle}</p>
          </div>
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {sectorKeys.map((key) => (
              <li key={key} className="flex flex-col gap-2 border-t border-background/20 pt-5">
                <h3 className="text-lg font-medium">{t.sectors.items[key].title}</h3>
                <p className="text-sm leading-relaxed text-background/70">{t.sectors.items[key].body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative min-h-96 overflow-hidden lg:w-2/5">
          <Image src="/images/hero-warehouse.png" alt={t.hero.stockPlace} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
        </div>
      </div>
    </section>
  )
}
