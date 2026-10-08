'use client'

import Image from 'next/image'
import { BadgePercent, HardHat, MapPin, PhoneCall, ShieldCheck, Truck } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { company, phones } from '@/lib/site'

const pointIcons = [ShieldCheck, HardHat, Truck, BadgePercent]

export function About() {
  const { t, lang } = useLanguage()

  return (
    <section id="about" aria-labelledby="about-title" className="py-20 md:py-28 lg:py-32">
      <div className="site-container grid gap-14 md:grid-cols-2 md:items-center md:gap-12 lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading id="about-title" eyebrow={t.about.eyebrow} title={t.about.title} />
          <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{t.about.body}</p>
          <ul className="grid border-t sm:grid-cols-2">
            {t.about.points.map((point, index) => {
              const Icon = pointIcons[index] ?? ShieldCheck
              return (
                <li key={point.title} className="flex gap-4 border-b py-5 sm:odd:pe-6 sm:even:border-s sm:even:ps-6">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-base font-bold">{point.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          <a href={phones.mobile.href} className="group flex w-fit items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-300 group-hover:bg-foreground">
              <PhoneCall className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm text-muted-foreground">
                {t.about.supportLabel} — {company.support[lang]}
              </span>
              <span dir="ltr" className="text-start text-lg font-bold transition-colors group-hover:text-primary">
                {phones.mobile.display}
              </span>
            </span>
          </a>
        </div>

        <figure className="notched [--notch-h:4.25rem] [--notch-w:12.5rem]">
          <div className="notched-media aspect-[4/5] bg-muted">
            <Image
              src="/images/about-storage.png"
              alt={t.about.imageAlt}
              fill
              sizes="(min-width: 768px) 45vw, 90vw"
              className="object-cover"
            />
          </div>
          <figcaption className="notched-tab flex items-center gap-3 bg-foreground px-4 text-background">
            <MapPin className="size-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="flex flex-col leading-tight">
              <span className="text-xs text-background/70">{t.hero.stockPlace}</span>
              <span className="text-sm font-bold">{t.hero.stockNote}</span>
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
