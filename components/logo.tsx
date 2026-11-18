'use client'
import { useSiteInfo } from '@/components/demo/content-preview'
import { cn } from '@/lib/utils'

export function Logo({
  inverted = false,
  className,
}: {
  inverted?: boolean
  className?: string
}) {
  const { logo, company } = useSiteInfo()
  if (logo)
    return (
      <img
        src={logo}
        alt={company.name.en}
        className={cn('h-16 w-auto max-w-52 object-contain', className)}
      />
    )
  return (
    <span className={cn('flex flex-col gap-1 font-sans', className)} dir="ltr">
      <span
        className={cn(
          'text-4xl leading-none font-bold tracking-wide md:text-5xl',
          inverted ? 'text-background' : 'text-primary',
        )}
      >
        {company.name.en}
      </span>
      <span
        className={cn(
          'text-sm leading-snug whitespace-nowrap',
          inverted ? 'text-background/85' : 'text-muted-foreground',
        )}
      >
        {company.name.ar}
      </span>
    </span>
  )
}
