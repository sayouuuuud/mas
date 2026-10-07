'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { allBrands } from '@/lib/site'

export function BrandMarquee() {
  const { t, lang } = useLanguage()

  return (
    <section aria-label={t.brandMarquee.label} className="border-b border-border/70 bg-background py-7 text-foreground">
      <div className="site-container flex flex-col gap-5">
        <p className="text-center text-sm font-medium text-muted-foreground">{t.brandMarquee.label}</p>
        <ul className="grid grid-cols-4 items-center gap-x-4 gap-y-5 sm:grid-cols-6 xl:grid-cols-12" dir="ltr">
          {allBrands.map((partner) => (
            <li key={partner.name.en} className="flex h-10 items-center justify-center">
              {partner.logo ? (
                <Image
                  src={partner.logo}
                  alt={partner.name[lang]}
                  width={partner.width}
                  height={partner.height}
                  sizes="90px"
                  className="h-9 w-auto max-w-18 object-contain opacity-70 grayscale transition-[filter,opacity] duration-300 hover:opacity-100 hover:grayscale-0 motion-reduce:transition-none"
                />
              ) : (
                <span className="font-sans text-xl font-bold text-muted-foreground">{partner.name.en}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
