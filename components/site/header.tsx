'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Globe2, Menu, Phone, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
import { phones } from '@/lib/site'
import { cn } from '@/lib/utils'

const sections = ['about', 'products', 'partners', 'sectors', 'contact'] as const

export function Header() {
  const { t, lang, toggle } = useLanguage()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 32)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background text-foreground transition-shadow duration-300 motion-reduce:transition-none',
        scrolled && 'shadow-sm',
      )}
    >
      <div className="site-container flex min-h-20 items-center justify-between gap-4 py-3 md:min-h-26">
        <a href="#top" onClick={() => setOpen(false)} aria-label="M.A.S Engineering For Trade" className="flex shrink-0">
          <Logo />
        </a>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-end gap-5 text-sm md:gap-6">
            <a href={phones.mobile.href} className="hidden items-center gap-2 text-muted-foreground hover:text-primary md:inline-flex">
              <Phone className="size-3.5" aria-hidden="true" />
              <span dir="ltr">{phones.mobile.display}</span>
            </a>
            <button
              type="button"
              onClick={toggle}
              aria-label={t.meta.switchLabel}
              className="inline-flex min-h-10 items-center gap-2 font-medium hover:text-primary md:min-h-6"
            >
              <Globe2 className="hidden size-4 sm:block" aria-hidden="true" />
              <span lang={lang === 'ar' ? 'en' : 'ar'}>{t.meta.switchTo}</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
              className="flex size-10 items-center justify-center rounded-lg border md:hidden"
            >
              {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
          <div className="hidden items-center gap-6 md:flex lg:gap-10">
            <nav aria-label={t.nav.primary}>
              <ul className="flex items-center gap-5 lg:gap-7">
                {sections.map((key) => (
                  <li key={key}>
                    <a href={`#${key}`} className="header-link inline-block py-1 text-base font-medium">
                      {t.nav[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <a href="#quote" className={cn(buttonVariants(), 'hidden h-10 gap-3 px-4 lg:inline-flex')}>
              {t.cta.quote}
              <Arrow data-icon="inline-end" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" aria-label={t.nav.primary} className="border-t bg-background text-foreground md:hidden">
          <ul className="site-container flex flex-col gap-1 py-5">
            {sections.map((key) => (
              <li key={key}>
                <a href={`#${key}`} onClick={() => setOpen(false)} className="block py-3 text-lg hover:text-primary">
                  {t.nav[key]}
                </a>
              </li>
            ))}
            <li>
              <a href="#quote" onClick={() => setOpen(false)} className="inline-block py-3 text-lg font-bold text-primary">
                {t.cta.quote}
              </a>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
