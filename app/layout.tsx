import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './fonts.css'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/components/language-provider'
import { LANG_COOKIE, type Lang } from '@/lib/i18n'
import './globals.css'
import { DemoProvider } from '@/components/demo/demo-provider'

export const metadata: Metadata = {
  title: 'M.A.S Engineering For Trade | توزيع الزيوت والشحوم ورمان البلي',
  description:
    'إم إيه إس للتجارة الهندسية — موزع زيوت وشحوم ورمان بلي من أكبر العلامات العالمية: OLA Energy، Pennzoil، مصر للبترول، Eni، Petronas، ADNOC، bp، SKF، NSK، FAG، INA. اطلب عرض سعر الآن.',
  keywords: [
    'زيوت',
    'شحوم',
    'رمان بلي',
    'OLA Energy',
    'lubricants Egypt',
    'bearings Egypt',
    'M.A.S Engineering For Trade',
  ],
  generator: 'v0.app',
  icons: {
    icon: '/images/logo.png',
    apple: '/images/logo.png',
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
