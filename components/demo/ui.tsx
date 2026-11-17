'use client'

import { PublicLink as Link } from '@/components/demo/public-link'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react'
import { formatApiError } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export function useCopy() {
  const { lang } = useLanguage()
  return (ar: string, en: string) => (lang === 'ar' ? ar : en)
}

export function DirectionArrow({ className }: { className?: string }) {
  const { lang } = useLanguage()
  const Icon = lang === 'ar' ? ArrowLeft : ArrowRight
  return <Icon className={className || 'size-4'} aria-hidden />
}

export function DemoNotice(_props: { admin?: boolean }) {
  return null
}

export function LoadingState({ label }: { label?: string }) {
  const c = useCopy()
  return (
    <div
      role="status"
      aria-live="polite"
      className="panel flex flex-col items-center justify-center gap-3 py-12 text-center"
    >
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">
        {label || c('جارٍ تحميل البيانات…', 'Loading data…')}
      </p>
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  const { lang } = useLanguage()
  const c = useCopy()
  return (
    <div role="alert" className="empty-state border-red-200 bg-red-50/40">
      <AlertTriangle
        className="mx-auto mb-4 size-10 text-red-700"
        aria-hidden
      />
      <h2 className="text-xl font-bold text-foreground">
        {title || c('تعذر تحميل البيانات', 'Unable to load data')}
      </h2>
      <p className="mx-auto my-3 max-w-lg text-sm leading-7 text-red-800">
        {formatApiError(error, lang)}
      </p>
      {onRetry && (
        <button type="button" className="btn-outline mt-2" onClick={onRetry}>
          <RefreshCw className="size-4" />
          {c('إعادة المحاولة', 'Retry')}
        </button>
      )}
    </div>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  children?: ReactNode
}) {
  const c = useCopy()
  const { lang } = useLanguage()
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight
  return (
    <section className="page-intro">
      <div className="site-container">
        <nav
          aria-label={c('مسار الصفحة', 'Breadcrumb')}
          className="mb-7 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-primary">
            {c('الرئيسية', 'Home')}
          </Link>
          <Chevron className="size-3" aria-hidden />
          <span aria-current="page">{title}</span>
        </nav>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>
    </section>
  )
}

export function EmptyState({
  title,
  description,
  children,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <Inbox className="mx-auto mb-4 size-10 text-primary" aria-hidden />
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto my-3 max-w-md text-muted-foreground">
        {description}
      </p>
      {children || action}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'gold' | 'muted' | 'red' | 'blue'
}) {
  return (
    <span className={cn('status-badge', `status-${tone}`)}>{children}</span>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const generatedId = useId()
  let controlId = generatedId
  let attached = false
  function connect(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (node) => {
      if (!isValidElement(node)) return node
      const element = node as ReactElement<{
        id?: string
        children?: ReactNode
        'aria-describedby'?: string
      }>
      if (
        !attached &&
        typeof element.type === 'string' &&
        ['input', 'select', 'textarea'].includes(element.type)
      ) {
        attached = true
        controlId = element.props.id || generatedId
        return cloneElement(element, {
          id: controlId,
          'aria-describedby':
            [
              element.props['aria-describedby'],
              hint ? `${generatedId}-hint` : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      }
      return element.props.children
        ? cloneElement(element, {}, connect(element.props.children))
        : element
    })
  }
  const controls = connect(children)
  return (
    <div className="form-field">
      <label htmlFor={controlId}>{label}</label>
      {controls}
      {hint && (
        <small
          id={`${generatedId}-hint`}
          className="font-normal text-muted-foreground"
        >
          {hint}
        </small>
      )}
    </div>
  )
}

export function RequestStatusBadge({ status }: { status: string }) {
  const c = useCopy()
  const labels: Record<string, [string, string]> = {
    new: ['جديد', 'New'], assigned: ['معيّن', 'Assigned'],
    in_progress: ['قيد المتابعة', 'In progress'], awaiting_customer: ['بانتظار العميل', 'Awaiting customer'],
    quoted: ['تم تقديم عرض', 'Quoted'], won: ['ناجح', 'Won'], lost: ['غير ناجح', 'Lost'], cancelled: ['ملغى', 'Cancelled'],
  }
  const label = labels[status]
  return <Badge tone={status === 'won' ? 'green' : status === 'new' ? 'gold' : 'neutral'}>{label ? c(...label) : status}</Badge>
}
