'use client'

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Moon, Sun } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { cn } from '@/lib/utils'

import { THEME_COOKIE, type Theme } from '@/lib/theme'

const ThemeContext = createContext<{
  preference?: Theme
  setPreference: (theme: Theme) => void
} | null>(null)

const systemDarkQuery = '(prefers-color-scheme: dark)'

function subscribeToSystemTheme(listener: () => void) {
  const query = window.matchMedia(systemDarkQuery)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme?: Theme
  children: ReactNode
}) {
  const [preference, setTheme] = useState(initialTheme)

  function setPreference(theme: Theme) {
    document.documentElement.dataset.theme = theme
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
    setTheme(theme)
  }

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error('ThemeProvider is required')
  const { lang } = useLanguage()
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    () => window.matchMedia(systemDarkQuery).matches,
    () => false,
  )

  const dark = theme.preference ? theme.preference === 'dark' : systemDark
  const label = lang === 'ar' ? 'الوضع الداكن' : 'Dark mode'
  return (
    <button
      className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-current/10', className)}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={() => theme.setPreference(dark ? 'light' : 'dark')}
    >
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  )
}
