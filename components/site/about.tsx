'use client'

import Image from 'next/image'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { company, phones } from '@/lib/site'

export function About() {
  const { t, lang } = useLanguage()
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <section id="about" aria-labelledby="about-title" className="bg-background py-20 text-foreground md:py-28">
      <div className="site-container flex flex-col gap-12 md:flex-row md:items-center md:gap-10 lg:gap-16">
        <figure className="relative order-last aspect-[6/5] w-full overflow-hidden rounded-2xl bg-muted md:order-first md:aspect-[4/5] md:w-5/12">
          <Image
            src="/images/about-storage.png"
            alt={t.about.imageAlt}
            fill
            sizes="(min-width: 768px) 40vw, 90vw"
            className="object-cover object-[48%_center]"
          />
          <figcaption className="absolute end-0 bottom-0 w-4/5 rounded-ss-3xl bg-primary p-6 text-primary-foreground md:p-7">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-primary-foreground/80">{t.hero.stockPlace}</p>
              <p className="text-2xl font-bold">{t.hero.stockNote}</p>
            </div>
          </figcaption>
        </figure>
        <div className="flex flex-col gap-7 md:flex-1">
          <SectionHeading id="about-title" eyebrow={t.about.eyebrow} title={t.about.title} />
          <p className="text-base leading-relaxed text-pretty text-muted-foreground lg:text-lg">{t.about.body}</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-7 border-t pt-7">
            {t.about.points.map((point) => (
              <li key={point.title} className="flex flex-col gap-2">
                <h3 className="text-base font-bold">{point.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{point.body}</p>
              </li>
            ))}
          </ul>
          <a href={phones.mobile.href} className="inline-flex w-fit items-center gap-3 text-base font-medium text-primary underline-offset-4 hover:underline">
            {t.about.supportLabel} — {company.support[lang]}
            <Arrow className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
