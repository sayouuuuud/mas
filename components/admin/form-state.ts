'use client'
import { useCallback, useEffect, useState } from 'react'
export function useUnsavedForm() {
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) return
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const navigate = (event: MouseEvent) => {
      const a = (event.target as Element)?.closest('a')
      if (
        !a ||
        a.target === '_blank' ||
        a.hasAttribute('download') ||
        event.ctrlKey ||
        event.metaKey
      )
        return
      const target = new URL(a.href, location.href)
      if (
        target.href === location.href ||
        (target.hash && target.pathname === location.pathname)
      )
        return
      if (
        !window.confirm(
          document.documentElement.lang === 'ar'
            ? 'عندك تغييرات لم تُحفظ. تريد مغادرة الصفحة؟'
            : 'You have unsaved changes. Leave this page?',
        )
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', navigate, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', navigate, true)
    }
  }, [dirty])
  return {
    dirty,
    markDirty: useCallback(() => setDirty(true), []),
    markSaved: useCallback(() => setDirty(false), []),
  }
}
