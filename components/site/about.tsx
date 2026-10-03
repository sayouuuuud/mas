'use client'

import Image from 'next/image'
import { BadgePercent, Headset, ShieldCheck, Truck } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { company, phones } from '@/lib/site'

const pointIcons = [ShieldCheck, Headset, Truck, BadgePercent]

export function About() {
  const { t, lang } = useLanguage()

  return (
    <section id="about" aria-labelledby="about-title" className="py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-secondary">
            <Image
              src="/images/about-storage.png"
              alt={t.about.imageAlt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <a
            href={phones.mobile.href}
            className="absolute -bottom-6 start-4 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-lg transition-shadow hover:shadow-xl sm:start-8"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Headset className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">{t.about.supportLabel}</span>
              <span className="font-semibold">{company.support[lang]}</span>
            </span>
          </a>
        </div>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <SectionHeading id="about-title" eyebrow={t.about.eyebrow} title={t.about.title} />
            <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{t.about.body}</p>
          </div>

          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {t.about.points.map((point, index) => {
              const Icon = pointIcons[index]
              return (
                <li key={point.title} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold">{point.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
