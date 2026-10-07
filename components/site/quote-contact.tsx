'use client'

import { useLanguage } from '@/components/language-provider'
import { ContactInfo } from '@/components/site/contact-info'
import { QuoteForm } from '@/components/site/quote-form'
import { SectionHeading } from '@/components/site/section-heading'

export function QuoteContact() {
  const { t } = useLanguage()

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-muted py-20 text-foreground md:py-28">
      <div className="site-container flex flex-col gap-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
          <SectionHeading id="contact-title" eyebrow={t.quote.eyebrow} title={t.quote.title} />
          <p className="max-w-md text-base leading-relaxed text-pretty text-muted-foreground">{t.quote.subtitle}</p>
        </div>
        <div className="grid items-start gap-10 md:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div className="rounded-2xl bg-card p-6 text-card-foreground sm:p-8 lg:p-10">
            <QuoteForm />
          </div>
          <div className="md:py-2">
            <ContactInfo />
          </div>
        </div>
      </div>
    </section>
  )
}
