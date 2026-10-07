import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-sans', className)} dir="ltr">
      <Image src="/images/logo.png" alt="" width={72} height={72} className="size-14 shrink-0 rounded-full md:size-16" />
      <span className="flex flex-col gap-1">
        <span className={cn('text-3xl leading-none font-bold tracking-wide md:text-4xl', inverted ? 'text-background' : 'text-primary')}>
          M.A.S
        </span>
        <span className={cn('text-sm leading-snug whitespace-nowrap', inverted ? 'text-background/75' : 'text-muted-foreground')}>
          Engineering For Trade
        </span>
      </span>
    </span>
  )
}
