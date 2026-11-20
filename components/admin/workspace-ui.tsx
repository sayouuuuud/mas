import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'
import type { PublicationStatus } from '@/lib/types'

export const publicationLabels = {
  ar: { published: 'منشور', draft: 'مسودة', archived: 'مؤرشف' },
  en: { published: 'Published', draft: 'Draft', archived: 'Archived' },
} satisfies Record<Lang, Record<PublicationStatus, string>>

const statusTone = {
  published: 'bg-emerald-50 text-emerald-800',
  draft: 'bg-amber-50 text-amber-900',
  archived: 'bg-muted text-muted-foreground',
}

export function WorkspaceHeading({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-3xl leading-tight font-bold sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}

export function WorkspaceSurface({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border bg-card shadow-[0_1px_2px_#172f3a07]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PublicationPill({
  status,
  lang,
}: {
  status?: PublicationStatus
  lang: Lang
}) {
  const value = status || 'draft'
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold',
        statusTone[value],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {publicationLabels[lang][value]}
    </span>
  )
}
