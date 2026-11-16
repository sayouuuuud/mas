'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Inbox,
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
export function DemoNotice({ admin = false }: { admin?: boolean }) {
  const c = useCopy()
  return (
    <div className="demo-notice">
      <FlaskConical className="size-4 shrink-0" aria-hidden />
      <p>
        {admin
          ? c(
              'معاينة واجهات الإدارة — بيانات تجريبية. التعديلات مؤقتة، ولا توجد مصادقة أو عمليات حفظ على خادم.',
              'Admin interface preview — sample data. Changes are temporary; authentication and server storage are not connected.',
            )
          : c(
              'كتالوج تجريبي لمعاينة الواجهة — المنتجات والمواصفات للتوضيح وليست بيانات بيع معتمدة.',
              'Demo catalog — products and specifications illustrate the interface and are not approved sales data.',
            )}
      </p>
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
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <Inbox className="mx-auto mb-4 size-10 text-primary" aria-hidden />
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto my-3 max-w-md text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  )
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'gold'
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
