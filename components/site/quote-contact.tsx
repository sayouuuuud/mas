'use client'

import { useLanguage } from '@/components/language-provider'
import { ContactInfo } from '@/components/site/contact-info'
import { QuoteForm } from '@/components/site/quote-form'
import { SectionHeading } from '@/components/site/section-heading'

export function QuoteContact() {
  const { t } = useLanguage()

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-secondary py-20 md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="contact-title"
          eyebrow={t.quote.eyebrow}
          title={t.quote.title}
          subtitle={t.quote.subtitle}
        />
        <div className="grid items-start gap-6 lg:grid-cols-[1.45fr_1fr] lg:gap-8">
          <QuoteForm />
          <ContactInfo />
        </div>
      </div>
    </section>
  )
}
