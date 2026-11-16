'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import {
  LayoutDashboard,
  Package,
  Layers,
  Tag,
  Factory,
  SlidersHorizontal,
  Image,
  ClipboardList,
  Users,
  Mail,
  FileText,
  Settings,
  Shield,
  History,
  ChartNoAxesCombined,
  Menu,
  X,
  ExternalLink,
  Globe,
  LogOut,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import { AuthStates } from './auth-states'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { DemoNotice, Field, useCopy } from '@/components/demo/ui'

export const adminNavigation = [
  { id: '', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard },
  { id: 'products', ar: 'المنتجات', en: 'Products', icon: Package },
  { id: 'categories', ar: 'التصنيفات', en: 'Categories', icon: Layers },
  { id: 'brands', ar: 'العلامات التجارية', en: 'Brands', icon: Tag },
  { id: 'sectors', ar: 'القطاعات', en: 'Sectors', icon: Factory },
  {
    id: 'attributes',
    ar: 'المواصفات والوحدات',
    en: 'Attributes & units',
    icon: SlidersHorizontal,
  },
  {
    id: 'units',
    ar: 'وحدات البيع والقياس',
    en: 'Units',
    icon: SlidersHorizontal,
  },
  { id: 'media', ar: 'مكتبة الوسائط', en: 'Media library', icon: Image },
  {
    id: 'quote-requests',
    ar: 'طلبات عروض الأسعار',
    en: 'Quote requests',
    icon: ClipboardList,
  },
  { id: 'quotations', ar: 'عروض الأسعار', en: 'Quotations', icon: FileText },
  { id: 'customers', ar: 'العملاء', en: 'Customers', icon: Users },
  { id: 'inquiries', ar: 'الرسائل والاستفسارات', en: 'Inquiries', icon: Mail },
  { id: 'content', ar: 'محتوى الموقع', en: 'Site content', icon: FileText },
  { id: 'navigation', ar: 'قوائم التنقل', en: 'Navigation', icon: Layers },
  { id: 'settings', ar: 'الإعدادات', en: 'Settings', icon: Settings },
  { id: 'team', ar: 'الفريق والصلاحيات', en: 'Team & roles', icon: Shield },
  { id: 'audit-log', ar: 'سجل النشاط', en: 'Activity log', icon: History },
  { id: 'reports', ar: 'التقارير', en: 'Reports', icon: ChartNoAxesCombined },
]
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { toggle } = useLanguage()
  const c = useCopy()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const sync = () => setMobile(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    if (!open || !mobile) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),summary',
        ) || [],
      ).filter((e) => e.getClientRects().length > 0)
    controls()[0]?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key === 'Tab') {
        const nodes = controls()
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [open, mobile])

  const active = adminNavigation.find((n) =>
    n.id ? pathname.startsWith(`/admin/${n.id}`) : pathname === '/admin',
  )
  return (
    <div className="admin-root">
      <a className="skip-link" href="#admin-content">
        {c('انتقل للمحتوى', 'Skip to content')}
      </a>
      {open && (
        <button
          className="admin-scrim lg:hidden"
          aria-label={c('إغلاق القائمة', 'Close navigation')}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        inert={mobile && !open ? true : undefined}
        className={`admin-sidebar ${open ? 'admin-sidebar-open' : ''}`}
      >
        <div className="mb-6 flex items-center justify-between border-b border-white/15 pb-6">
          <Link href="/admin">
            <Logo inverted className="scale-90 origin-top" />
          </Link>
          <button
            className="icon-button lg:hidden"
            onClick={() => setOpen(false)}
            aria-label={c('إغلاق القائمة', 'Close navigation')}
          >
            <X />
          </button>
        </div>
        <p className="mb-3 px-3 text-xs text-white/50">
          {c('مساحة العمل', 'WORKSPACE')}
        </p>
        <nav
          aria-label={c('تنقل الإدارة', 'Administration')}
          className="flex-1"
        >
          <ul className="space-y-2">
            <li>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={`admin-nav-link ${pathname === '/admin' ? 'admin-nav-active' : ''}`}
                aria-current={pathname === '/admin' ? 'page' : undefined}
              >
                <LayoutDashboard className="size-4" />
                {c('لوحة التحكم', 'Dashboard')}
              </Link>
            </li>
            {[
              {
                id: 'sales',
                ar: 'المبيعات والعملاء',
                en: 'Sales & customers',
                pages: [
                  'quote-requests',
                  'quotations',
                  'customers',
                  'inquiries',
                ],
              },
              {
                id: 'catalog',
                ar: 'الكتالوج والمنتجات',
                en: 'Catalog & products',
                pages: [
                  'products',
                  'categories',
                  'brands',
                  'sectors',
                  'attributes',
                  'units',
                  'media',
                ],
              },
              {
                id: 'website',
                ar: 'إدارة الموقع',
                en: 'Website management',
                pages: ['content', 'navigation', 'settings'],
              },
              {
                id: 'insights',
                ar: 'التقارير والنشاط',
                en: 'Reports & activity',
                pages: ['reports', 'audit-log'],
              },
              {
                id: 'access',
                ar: 'الفريق والصلاحيات',
                en: 'Team & access',
                pages: ['team'],
              },
            ].map((group) => (
              <li key={group.id}>
                <details
                  className="admin-nav-group"
                  open={
                    group.pages.some((id) =>
                      pathname.startsWith(`/admin/${id}`),
                    ) || undefined
                  }
                >
                  <summary>
                    <span>{c(group.ar, group.en)}</span>
                    <ChevronDown className="size-4" />
                  </summary>
                  <ul id={`nav-${group.id}`} className="space-y-1">
                    {group.pages.map((id) => {
                      const n = adminNavigation.find((n) => n.id === id)!
                      const activeItem = pathname.startsWith(`/admin/${id}`)
                      return (
                        <li key={id}>
                          <Link
                            href={`/admin/${id}`}
                            onClick={() => setOpen(false)}
                            className={`admin-nav-link ${activeItem ? 'admin-nav-active' : ''}`}
                            aria-current={activeItem ? 'page' : undefined}
                          >
                            <n.icon className="size-4 shrink-0" aria-hidden />
                            {c(n.ar, n.en)}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-1 border-t border-white/15 pt-4">
          <Link className="admin-nav-link" href="/">
            <ExternalLink className="size-4" />
            {c('عرض الموقع', 'View website')}
          </Link>
          <Link className="admin-nav-link" href="/admin/login">
            <LogOut className="size-4" />
            {c('مغادرة المعاينة', 'Leave preview')}
          </Link>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button
              className="icon-button lg:hidden"
              onClick={() => setOpen(true)}
              aria-label={c('فتح قائمة الإدارة', 'Open administration menu')}
            >
              <Menu />
            </button>
            <p className="font-semibold">
              {active
                ? c(active.ar, active.en)
                : c('معاينة عرض السعر', 'Quotation preview')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="icon-button"
              onClick={toggle}
              aria-label={c('Switch to English', 'التبديل للعربية')}
            >
              <Globe className="size-4" />
            </button>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {c('حساب معاينة', 'Preview account')}
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-tint text-sm font-bold text-primary">
              MA
            </span>
          </div>
        </header>
        <main id="admin-content" className="admin-content">
          <DemoNotice admin />
          {children}
        </main>
      </div>
    </div>
  )
}
export function AdminLogin({ reset = false }: { reset?: boolean }) {
  const { toggle } = useLanguage()
  const c = useCopy()
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  return (
    <main className="login-root">
      <section className="login-story">
        <Link href="/">
          <Logo inverted />
        </Link>
        <div className="relative z-10 my-auto max-w-lg py-20">
          <p className="mb-5 text-sm tracking-widest text-accent">
            M.A.S WORKSPACE
          </p>
          <h1 className="text-4xl font-bold leading-snug lg:text-5xl">
            {c(
              'إدارة أدق. خدمة أقرب لعملائك.',
              'Thoughtful management. Closer to your customers.',
            )}
          </h1>
          <p className="mt-6 leading-8 text-white/65">
            {c(
              'المنتجات، المحتوى، وطلبات عروض الأسعار في مساحة عمل واحدة.',
              'Products, content and quote requests in a single workspace.',
            )}
          </p>
        </div>
        <Link href="/" className="relative z-10 text-sm text-white/70">
          {c('العودة للموقع', 'Back to website')}
        </Link>
      </section>
      <section className="login-form">
        <button
          onClick={toggle}
          className="mb-8 flex items-center gap-2 self-end text-sm"
        >
          <Globe className="size-4" />
          {c('English', 'العربية')}
        </button>
        <div className="mx-auto w-full max-w-md">
          <p className="eyebrow">{c('لوحة الإدارة', 'ADMINISTRATION')}</p>
          <h2 className="text-3xl font-bold">
            {reset
              ? c('استعادة كلمة المرور', 'Reset password')
              : c('أهلًا بعودتك', 'Welcome back')}
          </h2>
          <p className="my-4 text-sm leading-7 text-muted-foreground">
            {c(
              'واجهة تجريبية فقط. المصادقة غير متصلة ولن تُرسل بيانات الدخول لأي خدمة.',
              'Interface preview only. Authentication is disconnected and credentials will not be sent to any service.',
            )}
          </p>
          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              setMessage(
                c(
                  'لم يتم تسجيل الدخول أو إرسال بريد. هذه معاينة للواجهة فقط.',
                  'No sign-in or email was performed. This is an interface preview only.',
                ),
              )
            }}
          >
            <Field label={c('البريد الإلكتروني', 'Email address')}>
              <input
                className="control"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                dir="ltr"
              />
            </Field>
            {!reset && (
              <Field label={c('كلمة المرور', 'Password')}>
                <div className="relative">
                  <input
                    className="control pe-12"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    dir="ltr"
                  />
                  <button
                    className="absolute end-1 top-0.5 icon-button"
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={c(
                      show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور',
                      show ? 'Hide password' : 'Show password',
                    )}
                    aria-pressed={show}
                  >
                    {show ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>
            )}
            {!reset && (
              <div className="text-end">
                <Link
                  href="/admin/reset-password"
                  className="text-sm text-primary hover:underline"
                >
                  {c('نسيت كلمة المرور؟', 'Forgot password?')}
                </Link>
              </div>
            )}
            <button className="btn-primary w-full">
              {reset
                ? c('معاينة الاستعادة', 'Preview recovery')
                : c('تسجيل الدخول (غير مفعّل)', 'Sign in (not connected)')}
            </button>
            <p role="status" className="text-sm leading-7 text-primary">
              {message}
            </p>
          </form>
          <AuthStates initial={reset ? 'password' : 'mfa'} />
          <div className="mt-8 border-t pt-6">
            <Link className="btn-outline w-full" href="/admin">
              {c(
                'فتح معاينة الإدارة بدون حساب',
                'Open admin preview without an account',
              )}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {c(
                'المعاينة عامة وتحتوي بيانات صناعية فقط؛ ليست منطقة إدارة مؤمّنة.',
                'The preview is public and uses synthetic data only; it is not a secured admin area.',
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
