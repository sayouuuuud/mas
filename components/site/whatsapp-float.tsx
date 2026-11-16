'use client'

import { WhatsAppIcon } from '@/components/icons'
import { useLanguage } from '@/components/language-provider'
import { useSiteInfo } from '@/components/demo/content-preview'

export function WhatsAppFloat() {
  const { t } = useLanguage()
  const { whatsappHref } = useSiteInfo()

  return (
    <a
      href={`${whatsappHref}?text=${encodeURIComponent(t.whatsappFloat.message)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.whatsappFloat.label}
      title={t.whatsappFloat.label}
      className="fixed end-5 bottom-5 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-foreground"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  )
}
