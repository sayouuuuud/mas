'use client'

import Image from 'next/image'
import { useLanguage } from '@/components/language-provider'
import { allBrands } from '@/lib/site'

export function BrandMarquee() {
  const { t, lang } = useLanguage()

  return (
    <section aria-label={t.brandMarquee.label} className="relative border-b border-primary/10 bg-background py-8 text-foreground md:py-10">
      <div className="brand-marquee-viewport" dir="ltr">
        <div className="brand-marquee-track">
          {[false, true].map((duplicate) => (
            <ul
              key={String(duplicate)}
              aria-hidden={duplicate || undefined}
              className={duplicate ? 'brand-marquee-duplicate flex shrink-0 items-center' : 'flex shrink-0 items-center'}
            >
              {allBrands.map((partner) => (
                <li key={partner.name.en} className="flex h-20 w-44 shrink-0 items-center justify-center px-6 md:w-52">
                  {partner.logo ? (
                    <Image
                      src={partner.logo}
                      alt={duplicate ? '' : partner.name[lang]}
                      width={partner.width}
                      height={partner.height}
                      sizes="150px"
                      className="h-16 w-auto max-w-36 object-contain"
                    />
                  ) : (
                    <span className="font-sans text-3xl font-bold text-foreground">{partner.name.en}</span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  )
}
