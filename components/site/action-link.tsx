'use client'

import type { ComponentProps, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { cn } from '@/lib/utils'

export const actionVariants = cva(
  'group/action inline-flex h-12 shrink-0 items-center gap-3 rounded-full text-base font-medium whitespace-nowrap transition-colors duration-300 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary ps-2 pe-6 text-primary-foreground hover:bg-foreground',
        accent: 'bg-accent ps-2 pe-6 text-accent-foreground hover:bg-background',
        light: 'text-background hover:text-accent',
        plain: 'text-primary hover:text-foreground',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export function ActionIcon({ icon }: { icon?: ReactNode }) {
  const { lang } = useLanguage()
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-current/40 transition-transform duration-300 motion-safe:ltr:group-hover/action:translate-x-0.5 motion-safe:rtl:group-hover/action:-translate-x-0.5"
    >
      {icon ?? <Arrow className="size-4" />}
    </span>
  )
}

type ActionLinkProps = ComponentProps<'a'> & VariantProps<typeof actionVariants> & { icon?: ReactNode }

export function ActionLink({ variant, icon, className, children, ...props }: ActionLinkProps) {
  return (
    <a className={cn(actionVariants({ variant }), className)} {...props}>
      <ActionIcon icon={icon} />
      {children}
    </a>
  )
}
