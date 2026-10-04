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
        <SectionHeading
          id="contact-title"
          eyebrow={t.quote.eyebrow}
          title={t.quote.title}
          subtitle={t.quote.subtitle}
        />
        <div className="grid items-start gap-10 md:grid-cols-[1.3fr_1fr] lg:gap-14">
          <div className="quote-surface rounded-3xl border border-primary/10 bg-card p-6 text-card-foreground sm:p-8 lg:p-10">
            <QuoteForm />
          </div>
          <div className="md:py-8">
            <ContactInfo />
          </div>
        </div>
      </div>
    </section>
  )
}
