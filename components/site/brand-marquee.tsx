'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { allBrands } from '@/lib/site'

export function BrandMarquee() {
  const { t, lang } = useLanguage()
  const [paused, setPaused] = useState(false)
  const RotationIcon = paused ? Play : Pause

  return (
    <section aria-label={t.brandMarquee.label} className="relative bg-background py-10 text-foreground md:py-14">
      <div className="brand-marquee-viewport" dir="ltr">
        <div className="brand-marquee-track" data-paused={paused}>
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
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="absolute end-4 bottom-1 hidden size-11 rounded-full motion-safe:flex"
        aria-label={paused ? t.brandMarquee.play : t.brandMarquee.pause}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        <RotationIcon aria-hidden="true" />
      </Button>
    </section>
  )
}
