'use client'

import {
  Building2,
  Headset,
  Mail,
  Phone,
  Printer,
  Store,
  Warehouse,
} from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons'
import { useLanguage } from '@/components/language-provider'
import { useSiteInfo } from '@/components/demo/content-preview'

type Row = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href?: string
  external?: boolean
}

function IconBadge({ icon: Icon }: { icon: Row['icon'] }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-on-brand/20 text-accent">
      <Icon className="size-4" />
    </span>
  )
}

export function ContactInfo() {
  const { t, lang } = useLanguage()
  const { company, phones, addresses, whatsappHref } = useSiteInfo()
  const c = t.quote.contact

  const rows: Row[] = [
    {
      icon: Phone,
      label: c.mobile,
      value: phones.mobile.display,
      href: phones.mobile.href,
    },
    {
      icon: WhatsAppIcon,
      label: c.whatsapp,
      value: phones.mobile.display,
      href: `${whatsappHref}?text=${encodeURIComponent(t.whatsappFloat.message)}`,
      external: true,
    },
    {
      icon: Building2,
      label: c.office,
      value: phones.office.display,
      href: phones.office.href,
    },
    {
      icon: Store,
      label: c.branch,
      value: phones.branch.display,
      href: phones.branch.href,
    },
    { icon: Printer, label: c.fax, value: phones.fax.display },
    {
      icon: Mail,
      label: c.email,
      value: company.email,
      href: `mailto:${company.email}`,
    },
  ]

  const locations = [
    { icon: Building2, label: c.hq, value: addresses.hq[lang] },
    { icon: Store, label: c.branchAddress, value: addresses.branch[lang] },
    { icon: Warehouse, label: c.stores, value: addresses.stores[lang] },
  ]

  return (
    <div className="flex flex-col gap-8 rounded-[1.125rem] bg-brand-dark p-6 text-on-brand sm:p-8 lg:p-10">
      <div id="contact-direct" className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">{c.title}</h3>
        <ul className="flex flex-col divide-y divide-background/10">
          {rows.map((row) => {
            const content = (
              <>
                <IconBadge icon={row.icon} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-on-brand/60">
                    {row.label}
                  </span>
                  <span dir="ltr" className="truncate text-start font-bold">
                    {row.value}
                  </span>
                </span>
              </>
            )
            return (
              <li key={row.label}>
                {row.href ? (
                  <a
                    href={row.href}
                    {...(row.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className="flex items-center gap-4 py-3 transition-colors hover:text-accent"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="flex items-center gap-4 py-3">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="flex items-center gap-2 text-sm text-on-brand/70">
          <Headset className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span>
            {c.support}:{' '}
            <span className="font-bold text-on-brand">
              {company.support[lang]}
            </span>
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t border-on-brand/15 pt-8">
        <h3 className="text-lg font-bold">{c.addressesTitle}</h3>
        <ul className="flex flex-col gap-4">
          {locations.map((location) => (
            <li key={location.label} className="flex items-start gap-4">
              <IconBadge icon={location.icon} />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-on-brand/60">
                  {location.label}
                </span>
                <span className="leading-relaxed font-medium">
                  {location.value}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
