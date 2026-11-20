import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './fonts.css'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/components/language-provider'
import { LANG_COOKIE, type Lang } from '@/lib/i18n'
import './globals.css'
import { DemoProvider } from '@/components/demo/demo-provider'

const siteOrigin = (() => {
  try {
    return new URL(process.env.SITE_URL || 'https://mas-eg.com').origin
  } catch {
    return 'https://mas-eg.com'
  }
})()

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: 'M.A.S Engineering For Trade | توزيع الزيوت والشحوم ورمان البلي',
    template: '%s | M.A.S Engineering For Trade',
  },
  description:
    'إم إيه إس للتجارة الهندسية — موزع زيوت وشحوم ورمان بلي من أكبر العلامات العالمية للمصانع والأساطيل ومراكز الخدمة. اطلب عرض سعر الآن.',
  keywords: [
    'زيوت صناعية',
    'شحوم',
    'رمان بلي',
    'OLA Energy',
    'lubricants Egypt',
    'bearings Egypt',
    'M.A.S Engineering For Trade',
  ],
  alternates: {
    canonical: '/ar',
    languages: {
      ar: '/ar',
      en: '/en',
    },
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#267F92',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const lang: Lang = cookieStore.get(LANG_COOKIE)?.value === 'en' ? 'en' : 'ar'

  return (
    <html
      data-scroll-behavior="smooth"
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="bg-background"
    >
      <body className="font-sans antialiased">
        <LanguageProvider initialLang={lang}>
          <DemoProvider>{children}</DemoProvider>
        </LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
