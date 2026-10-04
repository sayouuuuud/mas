'use client'

import { Building2, Headset, Mail, MapPin, Phone, Printer, Store, Warehouse } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons'
import { useLanguage } from '@/components/language-provider'
import { addresses, company, phones, whatsappLink } from '@/lib/site'

type Row = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href?: string
  external?: boolean
}

export function ContactInfo() {
  const { t, lang } = useLanguage()
  const c = t.quote.contact

  const rows: Row[] = [
    { icon: Phone, label: c.mobile, value: phones.mobile.display, href: phones.mobile.href },
    {
      icon: WhatsAppIcon,
      label: c.whatsapp,
      value: phones.mobile.display,
      href: whatsappLink(t.whatsappFloat.message),
      external: true,
    },
    { icon: Building2, label: c.office, value: phones.office.display, href: phones.office.href },
    { icon: Store, label: c.branch, value: phones.branch.display, href: phones.branch.href },
    { icon: Printer, label: c.fax, value: phones.fax.display },
    { icon: Mail, label: c.email, value: company.email, href: `mailto:${company.email}` },
  ]

  const locations = [
    { icon: Building2, label: c.hq, value: addresses.hq[lang] },
    { icon: Store, label: c.branchAddress, value: addresses.branch[lang] },
    { icon: Warehouse, label: c.stores, value: addresses.stores[lang] },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div id="contact-direct" className="flex flex-col gap-4 border-t pt-8">
        <h3 className="text-lg font-bold">{c.title}</h3>
        <ul className="flex flex-col divide-y">
          {rows.map((row) => {
            const Icon = row.icon
            const content = (
              <>
                <span className="flex size-8 shrink-0 items-center justify-center text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span dir="ltr" className="truncate text-start font-semibold">
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
                    {...(row.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="flex items-center gap-4 rounded-lg py-3 transition-colors hover:text-primary"
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
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Headset className="size-4 shrink-0 text-foreground" aria-hidden="true" />
          <span>
            {c.support}: <span className="font-semibold">{company.support[lang]}</span>
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-4 border-t pt-8">
        <h3 className="text-lg font-bold">{c.addressesTitle}</h3>
        <ul className="flex flex-col gap-4">
          {locations.map((location) => {
            const Icon = location.icon
            return (
              <li key={location.label} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {location.label}
                  </span>
                  <span className="leading-relaxed font-medium">{location.value}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
