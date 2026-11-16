'use client'
import { phoneE164 } from '@/lib/frontend-model'
import { useDemo } from './demo-provider'
export function useContentPreview(id: string) {
  const { resources } = useDemo()
  const row = resources.content.find((r) => r.id === id)
  if (!row) return undefined
  if (row.status === 'published' && row.previewUpdated === 'yes') return row
  if (row.publishedSnapshot) {
    try {
      return JSON.parse(row.publishedSnapshot) as typeof row
    } catch {
      return undefined
    }
  }
  return undefined
}
export function useSiteSettings() {
  const { resources } = useDemo()
  return resources.settings?.[0]
}

import { addresses, company, phones } from '@/lib/site'
export function useSiteInfo() {
  const { resources } = useDemo()
  const s = resources.settings?.[0]
  const phone = (value: string | undefined, fallback: typeof phones.mobile) =>
    value ? { display: value, href: `tel:${phoneE164(value)}` } : fallback
  return {
    whatsappHref: `https://wa.me/${s?.whatsapp || '201004998655'}`,
    company: s
      ? {
          name: { ar: s.nameAr, en: s.nameEn },
          email: s.email,
          support: {
            ar: s.supportAr || company.support.ar,
            en: s.supportEn || company.support.en,
          },
        }
      : company,
    phones: {
      mobile: phone(s?.mobile, phones.mobile),
      office: phone(s?.office, phones.office),
      branch: phone(s?.branchPhone, phones.branch),
      fax: { display: s?.fax || phones.fax.display },
    },
    addresses: s
      ? {
          hq: { ar: s.hqAr, en: s.hqEn },
          branch: { ar: s.branchAr, en: s.branchEn },
          stores: { ar: s.storesAr, en: s.storesEn },
        }
      : addresses,
    hours: s ? { ar: s.hoursAr, en: s.hoursEn } : null,
  }
}
