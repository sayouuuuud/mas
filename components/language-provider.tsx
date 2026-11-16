'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  dictionaries,
  LANG_COOKIE,
  type Dictionary,
  type Lang,
} from '@/lib/i18n'

type LanguageContextValue = {
  lang: Lang
  t: Dictionary
  toggle: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: React.ReactNode
}) {
  const [storedLang, setLang] = useState<Lang>(initialLang)
  const pathname = usePathname()
  const router = useRouter()
  const prefix = pathname.split('/')[1]
  const lang: Lang = prefix === 'ar' || prefix === 'en' ? prefix : storedLang
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    if (prefix === 'ar' || prefix === 'en') {
      setLang(lang)
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
    }
  }, [lang, prefix])

  const toggle = useCallback(() => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar'
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    setLang(next)
    if (prefix === 'ar' || prefix === 'en')
      router.push(
        `/${next}${pathname.slice(3)}${window.location.search}${window.location.hash}`,
      )
  }, [lang, prefix, pathname, router])

  const value = useMemo(
    () => ({ lang, t: dictionaries[lang], toggle }),
    [lang, toggle],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context)
    throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
