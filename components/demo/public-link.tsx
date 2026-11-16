'use client'
import NextLink from 'next/link'
import type { ComponentProps } from 'react'
import { useLanguage } from '@/components/language-provider'
export function usePublicHref() {
  const { lang } = useLanguage()
  return (href: string) =>
    href.startsWith('/') &&
    !href.startsWith('//') &&
    !/^\/(ar|en|admin)(\/|$)/.test(href)
      ? `/${lang}${href === '/' ? '' : href}`
      : href
}
export function PublicLink({
  href,
  ...props
}: ComponentProps<typeof NextLink>) {
  const localize = usePublicHref()
  return (
    <NextLink
      {...props}
      href={typeof href === 'string' ? localize(href) : href}
    />
  )
}
