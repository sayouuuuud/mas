'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { dictionaries, LANG_COOKIE, type Dictionary, type Lang } from '@/lib/i18n'

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
  const [lang, setLang] = useState<Lang>(initialLang)

  const toggle = useCallback(() => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar'
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = next
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
    setLang(next)
  }, [lang])

  const value = useMemo(() => ({ lang, t: dictionaries[lang], toggle }), [lang, toggle])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
