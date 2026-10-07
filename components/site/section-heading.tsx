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
      <p className="flex items-center gap-3 text-sm font-bold text-primary [html[lang=en]_&]:tracking-[0.12em] [html[lang=en]_&]:uppercase">
        <span aria-hidden="true" className="h-px w-7 bg-primary/60" />
        {eyebrow}
      </p>
      <h2 id={id} className="font-sans text-3xl leading-snug font-bold text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {subtitle ? <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}
