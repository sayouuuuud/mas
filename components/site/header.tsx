'use client'

import { useState } from 'react'
import { Languages, Menu, X } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const sections = ['partners', 'about', 'products', 'sectors', 'contact'] as const

export function Header() {
  const { t, lang, toggle } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" aria-label="M.A.S Engineering For Trade" className="rounded-lg">
          <Logo />
        </a>

        <nav aria-label={t.nav.primary} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {sections.map((key) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-primary"
                >
                  {t.nav[key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={t.meta.switchLabel}
            className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <Languages className="size-4 text-primary" aria-hidden="true" />
            <span lang={lang === 'ar' ? 'en' : 'ar'}>{t.meta.switchToShort}</span>
          </button>
          <a href="#quote" className={cn(buttonVariants(), 'hidden h-10 px-4 text-sm sm:inline-flex')}>
            {t.cta.quote}
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            className="inline-flex size-10 items-center justify-center rounded-lg border transition-colors hover:bg-secondary lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label={t.nav.primary} className="border-t bg-background lg:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {sections.map((key) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-secondary hover:text-primary"
                >
                  {t.nav[key]}
                </a>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <a
                href="#quote"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants(), 'h-12 w-full text-base')}
              >
                {t.cta.quote}
              </a>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
