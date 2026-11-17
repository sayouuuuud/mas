'use client'

import { useLanguage } from '@/components/language-provider'
import { ContactInfo } from '@/components/site/contact-info'
import { ActionLink } from '@/components/site/action-link'
import { SectionHeading } from '@/components/site/section-heading'

export function QuoteContact() {
  const { t, lang } = useLanguage()

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="supply-section relative isolate overflow-hidden bg-background py-20 text-foreground md:py-28"
    >
      <div className="site-container flex flex-col gap-12">
        <SectionHeading
          id="contact-title"
          eyebrow={t.quote.eyebrow}
          title={t.quote.title}
          subtitle={t.quote.subtitle}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
          <div className="rounded-[1.125rem] border bg-background p-6 sm:p-8 lg:p-10">
            <div id="quote">
              <h3 className="text-2xl font-bold">{t.quote.form.title}</h3>
              <p className="my-5 leading-8 text-muted-foreground">
                {lang === 'ar'
                  ? 'اختر المنتجات والكميات من الكتالوج، أو صف احتياجات منشأتك الفنية ليقوم فريق المبيعات بإعداد عرض سعر رسمي مفصل.'
                  : 'Select products and quantities from the catalog, or describe your facility requirements to receive a formal quotation.'}
              </p>
              <ActionLink href="/request-quote">{t.cta.quote}</ActionLink>
            </div>
          </div>
          <ContactInfo />
        </div>
      </div>
    </section>
  )
}
