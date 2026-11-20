'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { usePublicContentBlock } from '@/components/demo/content-preview'
import { usePublicBootstrap } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'

const MINIMUM_VISIBLE_MS = 550
const MAXIMUM_VISIBLE_MS = 4000
const FADE_OUT_MS = 180

export function StartupScreen() {
  const pathname = usePathname()
  const { lang } = useLanguage()
  const [entryPath] = useState(pathname)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const active =
    !dismissed &&
    pathname === entryPath &&
    entryPath.split('/')[1] !== 'admin'
  const isHome = entryPath === '/' || entryPath === '/ar' || entryPath === '/en'
  const bootstrap = usePublicBootstrap(active)
  const hero = usePublicContentBlock(active && isHome ? 'home-hero' : null)
  const ready = minimumElapsed && !bootstrap.isLoading && !hero.isLoading

  useEffect(() => {
    if (pathname !== entryPath) setDismissed(true)
  }, [entryPath, pathname])

  useEffect(() => {
    if (!active) return
    const minimum = window.setTimeout(() => setMinimumElapsed(true), MINIMUM_VISIBLE_MS)
    const timeout = window.setTimeout(() => setDismissed(true), MAXIMUM_VISIBLE_MS)
    return () => {
      window.clearTimeout(minimum)
      window.clearTimeout(timeout)
    }
  }, [active])

  useEffect(() => {
    if (!active || !ready) return
    const timer = window.setTimeout(() => setDismissed(true), FADE_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [active, ready])

  if (!active) return null

  return (
    <>
      <div
        className="site-startup-screen fixed inset-0 z-[200] grid place-items-center bg-foreground px-6 text-background"
        data-ready={ready ? '' : undefined}
        role="status"
        aria-hidden={ready ? true : undefined}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <div dir="ltr" className="flex flex-col items-center gap-2" aria-hidden="true">
            <span className="text-5xl leading-none font-bold tracking-wide sm:text-6xl">
              M.A.S
            </span>
            <span className="text-sm text-background/85 sm:text-base">
              Engineering For Trade
            </span>
          </div>
          <span
            className="size-9 rounded-full border-2 border-background/20 border-t-background motion-safe:animate-spin"
            aria-hidden="true"
          />
          <span className="sr-only">
            {lang === 'ar' ? 'جارٍ تحميل الموقع…' : 'Loading the website…'}
          </span>
        </div>
      </div>
      <noscript>
        <style>{'.site-startup-screen{display:none}'}</style>
      </noscript>
    </>
  )
}
