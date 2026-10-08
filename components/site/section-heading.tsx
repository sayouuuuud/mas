import { Fragment } from 'react'
import { cn } from '@/lib/utils'

/** Renders `*phrase*` segments of a title in bold, keeping the rest light. */
export function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split('*').map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-bold">
            {part}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  tone = 'light',
  className,
}: {
  id: string
  eyebrow: string
  title: string
  subtitle?: string
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    <div className={cn('flex max-w-2xl flex-col gap-5', className)}>
      <p
        className={cn(
          'flex items-center gap-3 text-sm font-medium [html[lang=en]_&]:tracking-[0.16em] [html[lang=en]_&]:uppercase',
          tone === 'dark' ? 'text-accent' : 'text-primary',
        )}
      >
        <span aria-hidden="true" className="h-px w-8 bg-current" />
        {eyebrow}
      </p>
      <h2 id={id} className="font-sans text-3xl leading-snug font-light text-balance sm:text-4xl lg:text-5xl">
        <Emphasis text={title} />
      </h2>
      {subtitle ? (
        <p className={cn('text-lg leading-relaxed text-pretty', tone === 'dark' ? 'text-background/85' : 'text-muted-foreground')}>
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}
