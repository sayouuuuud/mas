'use client'

import Image from 'next/image'
import { Phone, Truck } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons'
import { useLanguage } from '@/components/language-provider'
import { buttonVariants } from '@/components/ui/button'
import { featuredPartner, phones, whatsappLink } from '@/lib/site'
import { cn } from '@/lib/utils'

const reveal = 'animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both motion-reduce:animate-none'

export function Hero() {
  const { t } = useLanguage()

  return (
    <section id="top" aria-labelledby="hero-title" className="overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pt-12 pb-20 sm:px-6 md:pt-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pt-20 lg:pb-24">
        <div className="flex flex-col gap-7">
          <div
            className={cn(
              'inline-flex w-fit items-center gap-3 rounded-full border border-accent/70 bg-accent/10 py-1.5 ps-1.5 pe-4',
              reveal,
            )}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-background ring-1 ring-accent/50">
              <Image src={featuredPartner.logo!} alt="" width={24} height={21} className="h-5 w-auto" />
            </span>
            <span className="text-sm font-semibold">
              {t.hero.badge}: <span dir="ltr">OLA Energy</span>
            </span>
          </div>

          <h1
            id="hero-title"
            className={cn('text-4xl leading-[1.25] font-extrabold text-balance sm:text-5xl lg:text-6xl', reveal)}
            style={{ animationDelay: '100ms' }}
          >
            {t.hero.titleStart} <span className="text-primary">{t.hero.titleHighlight}</span>
          </h1>

          <p
            className={cn('max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground', reveal)}
            style={{ animationDelay: '200ms' }}
          >
            {t.hero.subtitle}
          </p>

          <div className={cn('flex flex-wrap gap-3', reveal)} style={{ animationDelay: '300ms' }}>
            <a
              href={whatsappLink(t.hero.whatsappGreeting)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'lg' }), 'h-12 gap-2 px-6 text-base')}
            >
              <WhatsAppIcon className="size-5" />
              {t.cta.whatsapp}
            </a>
            <a
              href={phones.mobile.href}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 gap-2 px-6 text-base')}
            >
              <Phone className="size-5 text-primary" aria-hidden="true" />
              {t.cta.call}
            </a>
          </div>

          <dl
            className={cn('grid max-w-lg grid-cols-3 gap-4 border-t pt-6', reveal)}
            style={{ animationDelay: '400ms' }}
          >
            {t.hero.stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <dt className="order-2 text-sm leading-snug text-muted-foreground">{stat.label}</dt>
                <dd className="order-1 font-heading text-3xl font-extrabold text-foreground">
                  <span dir="ltr">{stat.value}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={cn('relative', reveal)} style={{ animationDelay: '250ms' }}>
          <div className="relative overflow-hidden rounded-2xl bg-secondary shadow-xl shadow-primary/10">
            <div className="relative aspect-[4/3] lg:aspect-[5/4]">
              <Image
                src="/images/hero-warehouse.png"
                alt={t.hero.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div aria-hidden="true" className="absolute inset-y-0 start-0 flex">
              <span className="w-3 bg-primary sm:w-4" />
              <span className="w-1 bg-accent" />
            </div>
          </div>

          <div className="absolute -bottom-7 end-4 flex items-center gap-3 rounded-xl border bg-card p-4 shadow-lg sm:end-8">
            <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Truck className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">{t.hero.stockNote}</p>
              <p className="text-sm text-muted-foreground">{t.hero.stockPlace}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
