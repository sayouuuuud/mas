'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
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
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)
  const plugins = useMemo(() => [Fade(), Autoplay({ delay: 6000, playOnInit: false, stopOnInteraction: true })], [])
  const PreviousIcon = lang === 'ar' ? ChevronRight : ChevronLeft
  const NextIcon = lang === 'ar' ? ChevronLeft : ChevronRight
  const RotationIcon = playing ? Pause : Play

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(preference.matches)
      setPlaying(!preference.matches)
    }
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!api) return
    const update = () => setCurrent(api.selectedScrollSnap())
    const pause = () => setPlaying(false)
    update()
    api.on('select', update)
    api.on('reInit', update)
    api.on('pointerDown', pause)
    return () => {
      api.off('select', update)
      api.off('reInit', update)
      api.off('pointerDown', pause)
    }
  }, [api])

  useEffect(() => {
    if (!api) return
    const autoplay = api.plugins().autoplay
    const sync = () => {
      if (playing && !hovered) autoplay.play(reducedMotion)
      else autoplay.stop()
    }
    sync()
    api.on('reInit', sync)
    return () => {
      api.off('reInit', sync)
      autoplay.stop()
    }
  }, [api, playing, hovered, reducedMotion])

  const goTo = (index: number) => {
    setPlaying(false)
    api?.scrollTo(index, reducedMotion)
  }

  return (
    <section id="top" aria-labelledby="hero-title">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, direction: lang === 'ar' ? 'rtl' : 'ltr', duration: 35 }}
        plugins={plugins}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        aria-label={t.hero.carouselLabel}
        data-ready={Boolean(api)}
        data-current-slide={current + 1}
        data-autoplay={playing}
        className="isolate flex min-h-160 overflow-hidden bg-foreground text-background md:min-h-176 lg:min-h-192"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setPlaying(false)
        }}
        onFocusCapture={(event) => {
          if (!(event.target as HTMLElement).closest('[data-rotation-control]')) setPlaying(false)
        }}
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
                  loading={index === 0 ? undefined : 'eager'}
                  sizes="100vw"
                  draggable={false}
                  className="object-cover object-[42%_center] md:object-center"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-foreground/55" />
        <div className="site-container pointer-events-none flex flex-col justify-end gap-12 pt-44 pb-8 md:gap-16 md:pt-52 md:pb-10">
          {children}
          <div className="pointer-events-auto flex flex-col gap-4 border-t border-background/25 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {footer}
            <div className="flex items-center gap-1 sm:gap-2">
              <span aria-hidden="true" dir="ltr" className="shrink-0 pe-1 font-sans text-sm tabular-nums whitespace-nowrap text-background/85 sm:pe-2">
                {String(current + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
              <Button
                type="button"
                variant="overlay"
                size="icon-lg"
                className="size-11 rounded-full"
                aria-label={t.hero.previousSlide}
                disabled={!api}
                onClick={() => { setPlaying(false); api?.scrollPrev(reducedMotion) }}
              >
                <PreviousIcon aria-hidden="true" />
              </Button>
              <div className="flex items-center" aria-label={t.hero.carouselLabel}>
                {images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    aria-label={`${t.hero.slide} ${index + 1}: ${t.hero.slides[index].title}`}
                    aria-current={current === index ? 'true' : undefined}
                    disabled={!api}
                    className="flex h-11 w-7 items-center justify-center sm:w-8"
                    onClick={() => goTo(index)}
                  >
                    <span className={cn('h-1 rounded-full transition-all motion-reduce:transition-none', current === index ? 'w-6 bg-accent' : 'w-2 bg-background/45')} />
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="overlay"
                size="icon-lg"
                className="size-11 rounded-full"
                aria-label={t.hero.nextSlide}
                disabled={!api}
                onClick={() => { setPlaying(false); api?.scrollNext(reducedMotion) }}
              >
                <NextIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="overlay"
                size="icon-lg"
                className="size-11 rounded-full"
                data-rotation-control
                aria-label={playing ? t.hero.pauseSlides : t.hero.playSlides}
                disabled={!api}
                onClick={() => setPlaying((value) => !value)}
              >
                <RotationIcon aria-hidden="true" />
              </Button>
              <span className="sr-only" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
                {t.hero.slides[current].title}
              </span>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  )
}
