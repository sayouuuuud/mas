import Image from 'next/image'
import { cn } from '@/lib/utils'

export function Logo({ inverted = false, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background ring-1 ring-border">
        <Image src="/images/logo.png" alt="" width={44} height={44} className="size-11 object-contain" priority />
      </span>
      <span className="flex flex-col gap-1" dir="ltr">
        <span
          className={cn(
            'font-heading text-xl leading-none font-extrabold tracking-wider',
            inverted ? 'text-background' : 'text-primary',
          )}
        >
          M.A.S
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-accent" />
          <span
            className={cn(
              'text-[0.68rem] leading-none font-semibold tracking-[0.06em] whitespace-nowrap uppercase sm:tracking-[0.14em]',
              inverted ? 'text-background/80' : 'text-muted-foreground',
            )}
          >
            Engineering For Trade
          </span>
        </span>
      </span>
    </span>
  )
}
