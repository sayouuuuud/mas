'use client'

import { useLanguage } from '@/components/language-provider'
import { ContactInfo } from '@/components/site/contact-info'
import { QuoteForm } from '@/components/site/quote-form'
import { SectionHeading } from '@/components/site/section-heading'

export function QuoteContact() {
  const { t } = useLanguage()

  return (
    <section id="contact" aria-labelledby="contact-title" className="py-20 md:py-28">
      <div className="site-container flex flex-col gap-12">
        <SectionHeading
          id="contact-title"
          eyebrow={t.quote.eyebrow}
          title={t.quote.title}
          subtitle={t.quote.subtitle}
        />
        <div className="grid items-start gap-12 md:grid-cols-[1.3fr_1fr] lg:gap-20">
          <QuoteForm />
          <ContactInfo />
        </div>
      </div>
    </section>
  )
}
