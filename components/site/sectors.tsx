'use client'

import { Factory, HardHat, Tractor, Truck, Wrench, Zap } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'

const sectorIcons = {
  factories: Factory,
  fleets: Truck,
  service: Wrench,
  construction: HardHat,
  agriculture: Tractor,
  power: Zap,
} as const

const sectorKeys = Object.keys(sectorIcons) as (keyof typeof sectorIcons)[]

export function Sectors() {
  const { t } = useLanguage()

  return (
    <section id="sectors" aria-labelledby="sectors-title" className="py-20 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="sectors-title"
          eyebrow={t.sectors.eyebrow}
          title={t.sectors.title}
          subtitle={t.sectors.subtitle}
          align="center"
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectorKeys.map((key) => {
            const Icon = sectorIcons[key]
            const sector = t.sectors.items[key]
            return (
              <li
                key={key}
                className="group flex gap-5 rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold">{sector.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{sector.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
