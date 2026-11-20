'use client'
import { useSiteInfo } from '@/components/demo/content-preview'
import { cn } from '@/lib/utils'

export function Logo({
  inverted = false,
  compact = false,
  className,
}: {
  inverted?: boolean
  compact?: boolean
  className?: string
}) {
  const { logo, company } = useSiteInfo()
  if (logo)
    return (
      <img
        src={logo}
        alt={company.name.en || 'M.A.S Engineering For Trade'}
        className={cn('h-16 w-auto max-w-52 object-contain', compact && 'max-sm:h-12 max-sm:max-w-28', className)}
      />
    )
  return (
    <span className={cn('flex flex-col gap-1 font-sans', className)} dir="ltr">
      <span
        className={cn(
          'text-4xl leading-none font-bold tracking-wide md:text-5xl',
          compact && 'max-sm:text-3xl',
          inverted ? 'text-on-brand' : 'text-primary',
        )}
      >
        M.A.S
      </span>
      <span
        className={cn(
          'text-sm leading-snug whitespace-nowrap',
          compact && 'max-sm:text-xs',
          inverted ? 'text-on-brand/85' : 'text-muted-foreground',
        )}
      >
        Engineering For Trade
      </span>
    </span>
  )
}
