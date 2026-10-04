'use client'

import { Mail, MapPin, Phone } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
import { addresses, company, phones } from '@/lib/site'

const sections = ['partners', 'about', 'products', 'sectors', 'contact'] as const

export function Footer() {
  const { t, lang } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-muted text-foreground">
      <div className="site-container grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.3fr]">
        <div className="flex flex-col gap-5">
          <Logo />
          <p className="max-w-sm leading-relaxed text-muted-foreground">{t.footer.tagline}</p>
          {lang === 'ar' ? <p className="text-sm text-muted-foreground">{company.name.ar}</p> : null}
        </div>

        <nav aria-label={t.footer.quickLinks} className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t.footer.quickLinks}</h2>
          <ul className="flex flex-col gap-2.5">
            {sections.map((key) => (
              <li key={key}>
                <a href={`#${key}`} className="text-muted-foreground transition-colors hover:text-primary">
                  {t.nav[key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t.footer.contactTitle}</h2>
          <ul className="flex flex-col gap-3.5 text-muted-foreground">
            <li>
              <a href={phones.mobile.href} className="flex items-center gap-3 transition-colors hover:text-primary">
                <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span dir="ltr">{phones.mobile.display}</span>
              </a>
            </li>
            <li>
              <a href={`mailto:${company.email}`} className="flex items-center gap-3 transition-colors hover:text-primary">
                <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span dir="ltr">{company.email}</span>
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="leading-relaxed">{addresses.hq[lang]}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="site-container py-6 text-sm text-muted-foreground">
          © {year} M.A.S Engineering For Trade. {t.footer.rights}
        </p>
      </div>
    </footer>
  )
}
