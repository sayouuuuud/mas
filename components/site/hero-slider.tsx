'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'
import { useLanguage } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

const images = [
  '/images/industrial-hero.png',
  '/images/hero-lubricants.png',
  '/images/hero-fleet.png',
  '/images/hero-warehouse.png',
]

export function HeroSlider({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const { t, lang } = useLanguage()
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [autoplayActive, setAutoplayActive] = useState(false)
  const plugins = useMemo(() => [
    Fade(),
    Autoplay({ delay: 7000, playOnInit: false, stopOnInteraction: false, stopOnFocusIn: false }),
  ], [])

  useEffect(() => {
    if (!api) return
    const autoplay = api.plugins().autoplay
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const root = api.rootNode()
    const updateSlide = () => setCurrent(api.selectedScrollSnap())
    const updatePlayback = () => {
      const active = !paused && !document.hidden && !motion.matches && !root.matches(':hover') && !root.contains(document.activeElement)
      if (active) autoplay.play(false)
      else autoplay.stop()
      setAutoplayActive(active)
    }
    const handleFocusOut = () => queueMicrotask(updatePlayback)

    updateSlide()
    updatePlayback()
    api.on('select', updateSlide)
    api.on('reInit', updateSlide)
    api.on('reInit', updatePlayback)
    document.addEventListener('visibilitychange', updatePlayback)
    motion.addEventListener('change', updatePlayback)
    root.addEventListener('mouseenter', updatePlayback)
    root.addEventListener('mouseleave', updatePlayback)
    root.addEventListener('focusin', updatePlayback)
    root.addEventListener('focusout', handleFocusOut)
    return () => {
      api.off('select', updateSlide)
      api.off('reInit', updateSlide)
      api.off('reInit', updatePlayback)
      document.removeEventListener('visibilitychange', updatePlayback)
      motion.removeEventListener('change', updatePlayback)
      root.removeEventListener('mouseenter', updatePlayback)
      root.removeEventListener('mouseleave', updatePlayback)
      root.removeEventListener('focusin', updatePlayback)
      root.removeEventListener('focusout', handleFocusOut)
      autoplay.stop()
    }
  }, [api, paused])

  return (
    <section id="top" aria-labelledby="hero-title" className="pt-20 md:pt-26">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, direction: lang === 'ar' ? 'rtl' : 'ltr', duration: 35, watchDrag: false }}
        plugins={plugins}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        aria-label={t.hero.carouselLabel}
        data-ready={Boolean(api)}
        data-current-slide={current + 1}
        data-autoplay={autoplayActive}
        className="hero-scene isolate flex overflow-hidden bg-foreground text-background"
      >
        <div className="absolute inset-0 -z-20 [&_[data-slot=carousel-content]]:h-full">
          <CarouselContent className="ml-0 h-full">
            {images.map((src, index) => (
              <CarouselItem
                key={src}
                aria-label={`${t.hero.slide} ${index + 1} ${t.hero.of} ${images.length}: ${t.hero.slides[index].title}`}
                aria-hidden={current !== index}
                className="relative h-full pl-0"
              >
                <Image
                  src={src}
                  alt={t.hero.slides[index].imageAlt}
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  draggable={false}
                  className="object-cover object-[35%_center] md:object-center"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
        <div aria-hidden="true" className="hero-shade pointer-events-none absolute inset-0 -z-10" />
        <div className="site-container pointer-events-none flex flex-col gap-8 py-8 md:py-10">
          <div className="flex flex-1 items-center py-6 md:py-8">{children}</div>
          <div className="pointer-events-auto flex flex-col gap-5">
            {footer}
            <div className="flex items-center gap-5 border-t border-background/25">
              <div className="flex flex-1 items-stretch gap-3 md:gap-6">
                {t.hero.slides.map((slide, index) => (
                  <button
                    key={images[index]}
                    type="button"
                    onClick={() => api?.scrollTo(index)}
                    aria-label={`${t.hero.slide} ${index + 1}: ${slide.title}`}
                    aria-current={current === index ? 'true' : undefined}
                    className={cn(
                      'hero-slide-selector min-h-11 flex-1 border-t-2 py-3 text-start text-sm transition-colors motion-reduce:transition-none',
                      current === index ? 'border-background text-background' : 'border-transparent text-background/60 hover:text-background',
                    )}
                  >
                    <span className="hidden md:inline">{slide.title}</span>
                    <span className="block h-1 w-6 rounded-full bg-current md:hidden" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <Button
                variant="overlay"
                size="icon"
                className="size-10 rounded-full"
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? t.hero.playSlides : t.hero.pauseSlides}
                aria-pressed={paused}
              >
                {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  )
}
