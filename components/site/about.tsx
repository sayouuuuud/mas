'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { SectionHeading } from '@/components/site/section-heading'
import { company, phones } from '@/lib/site'

export function About() {
  const { t, lang } = useLanguage()

  return (
    <section id="about" aria-labelledby="about-title" className="py-20 md:py-28 lg:py-32">
      <div className="site-container flex flex-col gap-12 md:flex-row md:items-center md:gap-10 lg:gap-20">
        <div className="flex flex-col gap-7 md:w-1/2">
          <SectionHeading id="about-title" eyebrow={t.about.eyebrow} title={t.about.title} />
          <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{t.about.body}</p>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-6 border-t pt-7">
            {t.about.points.map((point) => (
              <li key={point.title} className="flex flex-col gap-2">
                <h3 className="text-lg font-medium">{point.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{point.body}</p>
              </li>
            ))}
          </ul>
          <a href={phones.mobile.href} className="text-base text-primary underline-offset-4 hover:underline">
            {t.about.supportLabel} — {company.support[lang]}
          </a>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted md:aspect-[5/6] md:w-1/2">
          <Image
            src="/images/about-storage.png"
            alt={t.about.imageAlt}
            fill
            sizes="(min-width: 1024px) 45vw, 90vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}
