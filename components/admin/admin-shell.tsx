'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from 'react'
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
  Building2,
  Mail,
  FileText,
  MapPin,
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
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { MfaVerificationPanel, PasswordUpdatePanel } from './auth-states'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { ErrorState, Field, LoadingState, useCopy } from '@/components/demo/ui'
import { authApi, BackendError, formatApiError } from '@/lib/api-client'
import {
  clearPrivateLiveQueries,
  invalidateLiveQueries,
  useLiveQuery,
} from '@/lib/live-query'
import type { AdminSession } from '@/lib/types'

const AdminSessionContext = createContext<AdminSession | null>(null)

export function useAdminSession() {
  return useContext(AdminSessionContext)
}

export const adminNavigation = [
  { id: '', ar: 'نظرة عامة', en: 'Overview', icon: LayoutDashboard },
  { id: 'products', ar: 'المنتجات', en: 'Products', icon: Package },
  { id: 'categories', ar: 'التصنيفات', en: 'Categories', icon: Layers },
  { id: 'brands', ar: 'العلامات التجارية', en: 'Brands', icon: Tag },
  { id: 'sectors', ar: 'القطاعات', en: 'Sectors', icon: Factory },
  {
    id: 'attributes',
    ar: 'المواصفات الفنية',
    en: 'Attributes',
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
  {
    id: 'organizations',
    ar: 'المؤسسات والشركات',
    en: 'Organizations',
    icon: Building2,
  },
  { id: 'inquiries', ar: 'الرسائل والاستفسارات', en: 'Inquiries', icon: Mail },
  { id: 'content', ar: 'محتوى الموقع', en: 'Site content', icon: FileText },
  { id: 'navigation', ar: 'قوائم التنقل', en: 'Navigation', icon: Layers },
  { id: 'locations', ar: 'الفروع والمخازن', en: 'Locations', icon: MapPin },
  { id: 'settings', ar: 'الإعدادات', en: 'Settings', icon: Settings },
  { id: 'security', ar: 'أمان حسابي', en: 'Account security', icon: Shield },
  { id: 'team', ar: 'حسابات الأدمن', en: 'Admin accounts', icon: Shield },
  { id: 'audit-log', ar: 'سجل التدقيق', en: 'Audit log', icon: History },
  { id: 'reports', ar: 'التقارير', en: 'Reports', icon: ChartNoAxesCombined },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { toggle } = useLanguage()
  const c = useCopy()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<unknown>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const authQuery = useLiveQuery(
    '/auth/me',
    async () => (await authApi.me()).data,
    { staleTimeMs: 10000 },
  )

  const canLoadAdminMe = Boolean(
    authQuery.data && authQuery.data.active && (authQuery.data.mfaEnabled === false || authQuery.data.aal === 'aal2'),
  )

  const adminMeQuery = useLiveQuery(
    canLoadAdminMe ? '/admin/me' : null,
    async () => (await authApi.adminMe()).data,
    { staleTimeMs: 15000 },
  )

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

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(null)
    try {
      await authApi.logout()
      clearPrivateLiveQueries()
      router.replace('/admin/login')
    } catch (error) {
      setSignOutError(error)
    } finally {
      setSigningOut(false)
    }
  }

  if (signOutError) return <div className="mx-auto max-w-xl px-6 py-24"><ErrorState error={signOutError} onRetry={() => void handleSignOut()} title={c('تعذر إتمام تسجيل الخروج', 'Sign out could not be completed')} /></div>

  if (authQuery.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <LoadingState
          label={c(
            'جارٍ التحقق من جلسة الأدمن…',
            'Verifying administrator session…',
          )}
        />
      </div>
    )
  }

  if (authQuery.error) {
    if (
      authQuery.error instanceof BackendError &&
      (authQuery.error.status === 401 || authQuery.error.status === 403)
    ) {
      return <AdminLogin />
    }
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <ErrorState
          error={authQuery.error}
          onRetry={() => void authQuery.refresh()}
          title={c('تعذر التحقق من خدمة المصادقة', 'Authentication service unavailable')}
        />
      </div>
    )
  }

  const session = authQuery.data
  if (!session || !session.active) {
    return <AdminLogin />
  }

  if ((session.mfaEnabled !== false && session.aal !== 'aal2') || session.mfaRequired) {
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
                'تأكيد الهوية بخطوتين لحماية الإدارة.',
                'Two-factor protection for workspace security.',
              )}
            </h1>
            <p className="mt-6 leading-8 text-white/65">
              {c(
                'أكمل التحقق الثنائي للوصول إلى الكتالوج وطلبات عروض الأسعار والإعدادات.',
                'Complete two-factor verification to access catalog, quote requests and settings.',
              )}
            </p>
          </div>
          <Link href="/" className="relative z-10 text-sm text-white/70">
            {c('العودة للموقع', 'Back to website')}
          </Link>
        </section>
        <section className="login-form">
          <div className="mx-auto w-full max-w-md">
            <MfaVerificationPanel
              onVerified={async () => {
                invalidateLiveQueries('/auth/me')
                invalidateLiveQueries('/admin/me')
                await authQuery.refresh()
              }}
              onSignOut={handleSignOut}
            />
          </div>
        </section>
      </main>
    )
  }

  const fullSession: AdminSession = adminMeQuery.data || session

  const active = adminNavigation.find((n) =>
    n.id ? pathname.startsWith(`/admin/${n.id}`) : pathname === '/admin',
  )

  return (
    <AdminSessionContext.Provider value={fullSession}>
      <div className="admin-root">
        <a className="skip-link" href="#admin-content">
          {c('انتقل للمحتوى', 'Skip to content')}
        </a>
        {open && (
          <button
            type="button"
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
              type="button"
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
                    'organizations',
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
                  pages: ['content', 'navigation', 'locations', 'settings'],
                },
                {
                  id: 'insights',
                  ar: 'التقارير والتدقيق',
                  en: 'Reports & audit',
                  pages: ['reports', 'audit-log'],
                },
                {
                  id: 'access',
                  ar: 'إدارة الوصول',
                  en: 'Access control',
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
                        const n = adminNavigation.find((item) => item.id === id)!
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
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              className="admin-nav-link w-full text-start"
            >
              <LogOut className="size-4" />
              {signingOut
                ? c('جارٍ الخروج…', 'Signing out…')
                : c('تسجيل الخروج', 'Sign out')}
            </button>
          </div>
        </aside>
        <div className="admin-workspace">
          <header className="admin-topbar">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="icon-button lg:hidden"
                onClick={() => setOpen(true)}
                aria-label={c('فتح قائمة الإدارة', 'Open administration menu')}
              >
                <Menu />
              </button>
              <p className="font-semibold">
                {active ? c(active.ar, active.en) : c('لوحة الإدارة', 'Administration')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="icon-button"
                onClick={toggle}
                aria-label={c('Switch to English', 'التبديل للعربية')}
              >
                <Globe className="size-4" />
              </button>
              <span className="hidden text-sm text-muted-foreground sm:block">
                {c('الأدمن · AAL2', 'Admin · AAL2')}
              </span>
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-tint text-xs font-bold text-primary">
                AD
              </span>
            </div>
          </header>
          <main id="admin-content" className="admin-content">
            {children}
          </main>
        </div>
      </div>
    </AdminSessionContext.Provider>
  )
}

export function AdminLogin({ reset = false }: { reset?: boolean }) {
  const { lang, toggle } = useLanguage()
  const c = useCopy()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPasswordUpdateStage = reset && searchParams.get('stage') === 'update'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mfaStep, setMfaStep] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (reset) {
        const res = await authApi.recover(email.trim())
        setMessage(
          c(
            'إذا كان هذا البريد مسجلًا ومؤهلًا، فستصلك تعليمات الاستعادة.',
            res.data.message,
          ),
        )
        return
      }
      const res = await authApi.login(email.trim(), password)
      setPassword('')
      if (res.data.mfaRequired) {
        setMfaStep(true)
        return
      }
      invalidateLiveQueries('/auth/me')
      invalidateLiveQueries('/admin/me')
      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

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
              'المنتجات، المحتوى، وطلبات عروض الأسعار في مساحة عمل مؤمّنة للأدمن.',
              'Products, content and quote requests in a secured admin workspace.',
            )}
          </p>
        </div>
        <Link href="/" className="relative z-10 text-sm text-white/70">
          {c('العودة للموقع', 'Back to website')}
        </Link>
      </section>
      <section className="login-form">
        <button
          type="button"
          onClick={toggle}
          className="mb-8 flex items-center gap-2 self-end text-sm"
        >
          <Globe className="size-4" />
          {c('English', 'العربية')}
        </button>
        <div className="mx-auto w-full max-w-md">
          <p className="eyebrow">{c('لوحة الإدارة', 'ADMINISTRATION')}</p>
          <h2 className="text-3xl font-bold">
            {isPasswordUpdateStage
              ? c('تعيين كلمة المرور', 'Update password')
              : reset
                ? c('استعادة كلمة المرور', 'Reset password')
                : c('تسجيل دخول الأدمن', 'Admin sign in')}
          </h2>

          {isPasswordUpdateStage ? (
            <PasswordUpdatePanel
              onCompleted={(mfaRequired) => {
                if (mfaRequired) {
                  setMfaStep(true)
                } else {
                  router.push('/admin')
                }
              }}
            />
          ) : mfaStep ? (
            <MfaVerificationPanel
              onVerified={() => {
                invalidateLiveQueries('/auth/me')
                invalidateLiveQueries('/admin/me')
                router.push('/admin')
                router.refresh()
              }}
              onSignOut={async () => {
                await authApi.logout()
                clearPrivateLiveQueries()
                setMfaStep(false)
              }}
            />
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <Field label={c('البريد الإلكتروني', 'Email address')}>
                <input
                  className="control"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
              <div className="flex items-center justify-between text-sm">
                {reset ? (
                  <Link
                    href="/admin/login"
                    className="text-primary hover:underline"
                  >
                    {c('العودة لتسجيل الدخول', 'Back to sign in')}
                  </Link>
                ) : (
                  <span />
                )}
                {!reset && (
                  <Link
                    href="/admin/reset-password"
                    className="text-primary hover:underline"
                  >
                    {c('نسيت كلمة المرور؟', 'Forgot password?')}
                  </Link>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {reset
                  ? c('إرسال رابط الاستعادة', 'Send recovery link')
                  : c('تسجيل الدخول', 'Sign in')}
              </button>
              {message && (
                <p role="status" className="text-sm leading-7 text-primary">
                  {message}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
