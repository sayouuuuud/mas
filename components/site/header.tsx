'use client'

import { useEffect, useState } from 'react'
import { PublicLink as Link } from '@/components/demo/public-link'
import { usePathname } from 'next/navigation'
import { Globe, Menu, Phone, ShoppingBag, X } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useDemo } from '@/components/demo/demo-provider'
import { Logo } from '@/components/logo'
import { useSiteInfo } from '@/components/demo/content-preview'
import { phones } from '@/lib/site'
import { cn } from '@/lib/utils'

const links = [
  ['/products', 'المنتجات', 'Products'],
  ['/brands', 'العلامات التجارية', 'Brands'],
  ['/sectors', 'القطاعات', 'Sectors'],
  ['/about', 'عن الشركة', 'About'],
  ['/contact', 'تواصل معنا', 'Contact'],
] as const
export function Header() {
  const { phones } = useSiteInfo()
  const { lang, toggle } = useLanguage()
  const { cart, resources } = useDemo()
  const links = resources.navigation
    .filter((r) => r.area === 'header' && r.status === 'published')
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((r) => [r.href, r.nameAr, r.nameEn])
  const rawPathname = usePathname()
  const pathname = rawPathname.replace(/^\/(ar|en)(?=\/|$)/, '') || '/'
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const c = (ar: string, en: string) => (lang === 'ar' ? ar : en)
  const solid = pathname !== '/' || scrolled || open
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 32)
    scroll()
    window.addEventListener('scroll', scroll, { passive: true })
    return () => window.removeEventListener('scroll', scroll)
  }, [])
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])
  useEffect(() => {
    setOpen(false)
  }, [pathname])
  return (
    <>
      <a href="#main-content" className="skip-link">
        {c('انتقل للمحتوى', 'Skip to content')}
      </a>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-colors',
          solid
            ? 'border-b bg-background/95 text-foreground backdrop-blur-lg'
            : 'text-background',
        )}
      >
        <div className="site-container flex min-h-24 items-center justify-between gap-4 py-4">
          <Link href="/" aria-label={c('إم إيه إس — الرئيسية', 'M.A.S — Home')}>
            <Logo inverted={!solid} />
          </Link>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-4 text-sm">
              <a
                href={phones.mobile.href}
                className="hidden items-center gap-2 lg:flex"
              >
                <Phone className="size-3.5" aria-hidden />
                <span dir="ltr">{phones.mobile.display}</span>
              </a>
              <button
                onClick={toggle}
                className="flex min-h-10 items-center gap-2"
                aria-label={c('Switch to English', 'التبديل للعربية')}
              >
                <Globe className="size-4" aria-hidden />
                {c('English', 'العربية')}
              </button>
              <Link
                href="/request-quote"
                aria-label={`${c('طلب عرض السعر، عدد البنود', 'Quote request, item count')}: ${cart.length}`}
                className="flex min-h-10 items-center gap-2"
              >
                <ShoppingBag className="size-4" aria-hidden />
                <span className="hidden sm:inline">
                  {c('طلب عرض سعر', 'Request a quote')}
                </span>
                <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-foreground">
                  {cart.length}
                </span>
              </Link>
              <button
                className="flex size-10 items-center justify-center md:hidden"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={c(
                  open ? 'إغلاق القائمة' : 'فتح القائمة',
                  open ? 'Close navigation' : 'Open navigation',
                )}
              >
                {open ? <X /> : <Menu />}
              </button>
            </div>
            <nav
              aria-label={c('التنقل الرئيسي', 'Main navigation')}
              className="hidden md:block"
            >
              <ul className="flex gap-6 lg:gap-9">
                {links.map(([href, ar, en]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={
                        pathname.startsWith(href) ? 'page' : undefined
                      }
                      className={cn(
                        'nav-link',
                        pathname.startsWith(href) && 'nav-active',
                      )}
                    >
                      {c(ar, en)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            className="border-t bg-background px-6 py-5 text-foreground md:hidden"
            aria-label={c('قائمة الموبايل', 'Mobile navigation')}
          >
            <ul>
              {links.map(([href, ar, en]) => (
                <li key={href}>
                  <Link className="block py-3" href={href}>
                    {c(ar, en)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </>
  )
}
