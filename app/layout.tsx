import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Tajawal } from 'next/font/google'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/components/language-provider'
import { LANG_COOKIE, type Lang } from '@/lib/i18n'
import './globals.css'

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

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
  applicationName: 'M.A.S Engineering For Trade',
  openGraph: {
    title: 'M.A.S Engineering For Trade | خبرة هندسية. توريد تثق به.',
    description: 'زيوت، شحوم ورمان بلي من علامات عالمية، بدعم فني متخصص لقطاع الصناعة والنقل في مصر.',
    locale: 'ar_EG',
    alternateLocale: 'en_GB',
    type: 'website',
  },
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
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className={`${tajawal.variable} ${inter.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
