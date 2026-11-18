'use client'

import Image from 'next/image'
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import Autoplay from 'embla-carousel-autoplay'
import Fade from 'embla-carousel-fade'
import { Pause, Play } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

const SLIDE_DELAY = 6000

import { useContentPreview } from '@/components/demo/content-preview'

const pad = (value: number) => String(value).padStart(2, '0')

type HeroProps = { children: ReactNode; footer: ReactNode }
type Slide = {
  title: { ar: string; en: string }
  body: { ar: string; en: string }
  url: string
}
export function HeroSlider(props: HeroProps) {
  const content = useContentPreview('home-hero')
  const slides = (content?.layout?.cards || []).flatMap((card) => {
    const url = content?.media.find((m) => m.id === card.imageMediaId)?.url
    return url ? [{ ...card, url }] : []
  })
  if (!slides.length)
    return (
      <section
        id="top"
        aria-labelledby="hero-title"
        className="bg-foreground text-background"
      >
        <div className="site-container py-40">{props.children}</div>
      </section>
    )
  return (
    <LoadedHeroSlider
      key={slides.map((s) => s.url).join('|')}
      {...props}
      slides={slides}
    />
  )
}
function LoadedHeroSlider({
  children,
  footer,
  slides,
}: HeroProps & { slides: Slide[] }) {
  const { t, lang } = useLanguage()
  const images = slides.map((card) => card.url)
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [running, setRunning] = useState(false)
  const [timerRun, setTimerRun] = useState(0)
  const plugins = useMemo(
    () => [
      Fade(),
      Autoplay({
        delay: SLIDE_DELAY,
        playOnInit: false,
        stopOnInteraction: false,
        stopOnMouseEnter: false,
        stopOnFocusIn: false,
      }),
    ],
    [],
  )

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      setPaused(true)
  }, [])

  useEffect(() => {
    if (!api) return
    const updateSlide = () => setCurrent(api.selectedScrollSnap())
    const handleTimerSet = () => {
      setRunning(true)
      setTimerRun((run) => run + 1)
    }
    const handleTimerStopped = () => setRunning(false)

    updateSlide()
    api.on('select', updateSlide)
    api.on('reInit', updateSlide)
    api.on('autoplay:timerset', handleTimerSet)
    api.on('autoplay:timerstopped', handleTimerStopped)
    return () => {
      api.off('select', updateSlide)
      api.off('reInit', updateSlide)
      api.off('autoplay:timerset', handleTimerSet)
      api.off('autoplay:timerstopped', handleTimerStopped)
      api.plugins().autoplay?.stop()
    }
  }, [api])

  useEffect(() => {
    const autoplay = api?.plugins().autoplay
    if (!autoplay) return
    if (paused) autoplay.stop()
    else autoplay.play()
  }, [api, paused])

  const goTo = (index: number) => {
    if (!api) return
    api.scrollTo(index)
    api.plugins().autoplay?.reset()
  }

  return (
    <section id="top" aria-labelledby="hero-title">
      <Carousel
        setApi={setApi}
        opts={{
          loop: true,
          direction: lang === 'ar' ? 'rtl' : 'ltr',
          duration: 35,
          watchDrag: false,
        }}
        plugins={plugins}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        aria-label={t.hero.carouselLabel}
        data-ready={Boolean(api)}
        data-current-slide={current + 1}
        data-autoplay={running}
        style={{ '--slide-delay': `${SLIDE_DELAY}ms` } as CSSProperties}
        className="isolate flex min-h-160 overflow-hidden bg-foreground text-background md:min-h-176 lg:min-h-192"
      >
        <div className="absolute inset-0 -z-20 [&_[data-slot=carousel-content]]:h-full">
          <CarouselContent className="ml-0 h-full">
            {images.map((src, index) => (
              <CarouselItem
                key={src}
                aria-label={`${t.hero.slide} ${index + 1} ${t.hero.of} ${images.length}: ${slides[index]?.title[lang] || ''}`}
                aria-hidden={current !== index}
                className="relative h-full pl-0"
              >
                <Image
                  src={src}
                  alt={slides[index]?.body[lang] || ''}
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
        <div
          aria-hidden="true"
          className="hero-shade pointer-events-none absolute inset-0 -z-10"
        />
        <div className="site-container pointer-events-none flex flex-col justify-end gap-12 pt-44 pb-6 md:gap-16 md:pt-52 md:pb-8">
          {children}
          <div className="pointer-events-auto flex flex-col gap-4 border-t border-background/25 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {footer}
            <div className="flex items-center gap-4 md:gap-6">
              <p
                aria-hidden="true"
                className="hidden items-baseline gap-3 text-sm lg:flex"
              >
                <span dir="ltr" className="tabular-nums">
                  <span className="font-bold text-background">
                    {pad(current + 1)}
                  </span>
                  <span className="text-background/60">{` / ${pad(images.length)}`}</span>
                </span>
                <span className="text-background/85">
                  {slides[current]?.title[lang] || ''}
                </span>
              </p>
              <div
                role="group"
                aria-label={t.hero.chooseSlide}
                className="flex items-center gap-1.5"
              >
                {images.map((src, index) => {
                  const active = index === current
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => goTo(index)}
                      aria-label={`${t.hero.slide} ${index + 1} ${t.hero.of} ${images.length}: ${slides[index]?.title[lang] || ''}`}
                      aria-current={active ? 'true' : undefined}
                      className="group/dot flex h-10 w-10 items-center md:w-14"
                    >
                      <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-background/30 transition-colors group-hover/dot:bg-background/60">
                        {active ? (
                          <span
                            key={running ? timerRun : 'static'}
                            className={cn(
                              'absolute inset-0 rounded-full bg-accent',
                              running && 'slide-progress',
                            )}
                          />
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? t.hero.playSlides : t.hero.pauseSlides}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-background/30 transition-colors hover:bg-background hover:text-foreground"
              >
                {paused ? (
                  <Play
                    className="size-3.5"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                ) : (
                  <Pause
                    className="size-3.5"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  )
}
