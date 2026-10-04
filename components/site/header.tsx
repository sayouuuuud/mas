'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
import { phones } from '@/lib/site'
import { cn } from '@/lib/utils'

const sections = ['about', 'products', 'partners', 'sectors', 'contact'] as const

export function Header() {
  const { t, lang, toggle } = useLanguage()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const solid = scrolled || open

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
        'fixed inset-x-0 top-0 z-40 transition-colors duration-300 motion-reduce:transition-none',
        solid ? 'border-b border-border bg-background/95 text-foreground backdrop-blur-lg' : 'text-background',
      )}
    >
      <div className="site-container flex min-h-24 items-center justify-between gap-6 py-4 md:min-h-28 md:py-5">
        <a href="#top" onClick={() => setOpen(false)} aria-label="M.A.S Engineering For Trade">
          <Logo inverted={!solid} />
        </a>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-end gap-5 text-sm md:gap-7">
            <a href={phones.mobile.href} dir="ltr" className="hidden transition-opacity hover:opacity-70 md:block">
              {phones.mobile.display}
            </a>
            <a href="#quote" className="hidden underline-offset-4 hover:underline md:block">
              {t.cta.quote}
            </a>
            <button
              type="button"
              onClick={toggle}
              aria-label={t.meta.switchLabel}
              className="min-h-10 min-w-10 font-medium underline-offset-4 hover:underline md:min-h-6"
            >
              <span lang={lang === 'ar' ? 'en' : 'ar'}>{t.meta.switchTo}</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
              className="flex size-10 items-center justify-center md:hidden"
            >
              {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
            </button>
          </div>
          <nav aria-label={t.nav.primary} className="hidden md:block">
            <ul className="flex items-center gap-5 lg:gap-9">
              {sections.map((key) => (
                <li key={key}>
                  <a href={`#${key}`} className="inline-block py-1 text-base font-medium underline-offset-8 hover:underline">
                    {t.nav[key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
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
