import { cn } from '@/lib/utils'

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('flex flex-col gap-1 font-sans', className)} dir="ltr">
      <span className={cn('text-4xl leading-none font-bold tracking-wide md:text-5xl', inverted ? 'text-background' : 'text-primary')}>
        M.A.S
      </span>
      <span className={cn('text-sm leading-snug whitespace-nowrap', inverted ? 'text-background/85' : 'text-muted-foreground')}>
        Engineering For Trade
      </span>
    </span>
  )
}
