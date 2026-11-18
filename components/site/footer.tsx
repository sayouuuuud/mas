'use client'

import { ArrowUp, Mail, MapPin, Phone } from 'lucide-react'
import { PublicLink as Link } from '@/components/demo/public-link'
import {
  useSiteInfo,
  useContentPreview,
  usePublicNavigation,
} from '@/components/demo/content-preview'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'

const DEFAULT_FOOTER_LINKS = [
  ['/products', 'المنتجات', 'Products'],
  ['/brands', 'العلامات التجارية', 'Brands'],
  ['/sectors', 'القطاعات', 'Sectors'],
  ['/about', 'عن الشركة', 'About'],
  ['/contact', 'تواصل معنا', 'Contact'],
] as const

export function Footer() {
  const { company, phones, addresses } = useSiteInfo()
  const content = useContentPreview('footer')
  const { data: navItems = [] } = usePublicNavigation()
  const { t, lang } = useLanguage()
  const year = new Date().getFullYear()

  const footerRows = navItems
    .filter((r) => r.area === 'footer')
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))

  const links: ReadonlyArray<readonly [string, string, string]> =
    footerRows.length > 0
      ? footerRows.map((r) => [r.path, r.name.ar, r.name.en] as const)
      : DEFAULT_FOOTER_LINKS

  return (
    <footer className="bg-foreground text-background">
      <div className="site-container grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.3fr] lg:py-20">
        <div className="flex flex-col gap-5">
          <Logo inverted />
          <p className="max-w-sm leading-relaxed text-background/70">
            {content ? (lang === 'ar' ? content.bodyAr : content.bodyEn) : ''}
          </p>
          {lang === 'ar' ? (
            <p className="text-sm text-background/60">{company.name.ar}</p>
          ) : null}
        </div>

        <nav aria-label={t.footer.quickLinks} className="flex flex-col gap-5">
          <h2 className="flex items-center gap-3 text-sm font-bold text-accent">
            <span aria-hidden="true" className="h-px w-6 bg-current" />
            {t.footer.quickLinks}
          </h2>
          <ul className="flex flex-col gap-3">
            {links.map(([href, ar, en]) => (
              <li key={`${href}-${en}`}>
                <Link
                  href={href}
                  className="text-background/75 transition-colors hover:text-background"
                >
                  {lang === 'ar' ? ar : en}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-5">
          <h2 className="flex items-center gap-3 text-sm font-bold text-accent">
            <span aria-hidden="true" className="h-px w-6 bg-current" />
            {t.footer.contactTitle}
          </h2>
          <ul className="flex flex-col gap-4 text-background/75">
            <li>
              <a
                href={phones.mobile.href}
                className="flex items-center gap-3 transition-colors hover:text-background"
              >
                <Phone
                  className="size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <span dir="ltr">{phones.mobile.display}</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${company.email}`}
                className="flex items-center gap-3 transition-colors hover:text-background"
              >
                <Mail
                  className="size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <span dir="ltr">{company.email}</span>
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin
                className="mt-1 size-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              <span className="leading-relaxed">{addresses.hq[lang]}</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-background/15">
        <div className="site-container flex items-center justify-between gap-6 py-6 text-sm text-background/60">
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy">
              {lang === 'ar' ? 'الخصوصية' : 'Privacy'}
            </Link>
            <Link href="/terms">{lang === 'ar' ? 'الشروط' : 'Terms'}</Link>
          </div>
          <p>
            © {year} {company.name[lang]}. {t.footer.rights}
          </p>
          <a
            href="#main-content"
            className="group flex shrink-0 items-center gap-3 transition-colors hover:text-background"
          >
            <span className="hidden sm:inline">{t.footer.backToTop}</span>
            <span className="flex size-9 items-center justify-center rounded-full border border-background/25 transition-transform duration-300 motion-safe:group-hover:-translate-y-0.5">
              <ArrowUp className="size-4" aria-hidden="true" />
            </span>
            <span className="sr-only sm:hidden">{t.footer.backToTop}</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
