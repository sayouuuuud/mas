'use client'

import { useEffect, useRef } from 'react'

export function ScrollEdgeBlur() {
  const edgeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const edge = edgeRef.current
    if (!edge) return

    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)')
    let idleTimer: number | undefined

    const clearBlur = () => {
      window.clearTimeout(idleTimer)
      idleTimer = undefined
      edge.removeAttribute('data-scrolling')
    }

    const onScroll = () => {
      if (window.scrollY <= 0) {
        clearBlur()
        return
      }

      if (idleTimer === undefined) edge.setAttribute('data-scrolling', '')
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(clearBlur, 180)
    }

    function updatePreference() {
      if (motion.matches) {
        window.addEventListener('scroll', onScroll, { passive: true })
      } else {
        window.removeEventListener('scroll', onScroll)
        clearBlur()
      }
    }

    updatePreference()
    motion.addEventListener('change', updatePreference)
    return () => {
      motion.removeEventListener('change', updatePreference)
      window.removeEventListener('scroll', onScroll)
      clearBlur()
    }
  }, [])

  return <div ref={edgeRef} className="scroll-edge-blur" aria-hidden="true" />
}
