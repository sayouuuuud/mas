import { cn } from '@/lib/utils'

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  align = 'start',
}: {
  id: string
  eyebrow: string
  title: string
  subtitle?: string
  align?: 'start' | 'center'
}) {
  return (
    <div className={cn('flex max-w-2xl flex-col gap-4', align === 'center' && 'mx-auto items-center text-center')}>
      <p className="flex items-center gap-3 text-sm font-semibold text-primary">
        <span aria-hidden="true" className="h-0.5 w-8 rounded-full bg-accent" />
        {eyebrow}
      </p>
      <h2 id={id} className="text-3xl leading-tight font-extrabold text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle ? <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}
