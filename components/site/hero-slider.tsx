'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'
import { useLanguage } from '@/components/language-provider'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'

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
  const [autoplayActive, setAutoplayActive] = useState(false)
  const plugins = useMemo(() => [
    Fade(),
    Autoplay({
      delay: 6000,
      playOnInit: false,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnFocusIn: false,
    }),
  ], [])

  useEffect(() => {
    if (!api) return
    const autoplay = api.plugins().autoplay
    const updateSlide = () => setCurrent(api.selectedScrollSnap())
    const updatePlayback = () => {
      const active = !document.hidden
      if (active) autoplay.play(false)
      else autoplay.stop()
      setAutoplayActive(active)
    }

    updateSlide()
    updatePlayback()
    api.on('select', updateSlide)
    api.on('reInit', updateSlide)
    api.on('reInit', updatePlayback)
    document.addEventListener('visibilitychange', updatePlayback)
    return () => {
      api.off('select', updateSlide)
      api.off('reInit', updateSlide)
      api.off('reInit', updatePlayback)
      document.removeEventListener('visibilitychange', updatePlayback)
      autoplay.stop()
    }
  }, [api])

  return (
    <section id="top" aria-labelledby="hero-title">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, direction: lang === 'ar' ? 'rtl' : 'ltr', duration: 35, watchDrag: false }}
        plugins={plugins}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        aria-label={t.hero.carouselLabel}
        data-ready={Boolean(api)}
        data-current-slide={current + 1}
        data-autoplay={autoplayActive}
        className="isolate flex min-h-160 overflow-hidden bg-foreground text-background md:min-h-176 lg:min-h-192"
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
          <div className="pointer-events-auto border-t border-background/25 pt-5">
            {footer}
          </div>
        </div>
      </Carousel>
    </section>
  )
}
