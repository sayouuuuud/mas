'use client'

import { api, BackendError } from '@/lib/api-client'
import { phoneE164 } from '@/lib/frontend-model'
import { useLiveQuery } from '@/lib/live-query'
import {
  addresses as defaultAddresses,
  company as defaultCompany,
  phones as defaultPhones,
} from '@/lib/site'
import { usePublicBootstrap } from '@/components/demo/demo-provider'
import type { ContentBlockRecord } from '@/lib/types'

export function usePublicContentBlock(key: string) {
  return useLiveQuery(`/content/${key}`, async () => {
    try {
      const res = await api<ContentBlockRecord>(`/content/${key}`)
      return res.data
    } catch (err) {
      if (err instanceof BackendError && err.status === 404) return null
      throw err
    }
  })
}

export function useContentPreview(key: string) {
  const { data } = usePublicContentBlock(key)
  if (!data) return undefined
  return {
    id: data.id,
    key: data.key,
    nameAr: data.name?.ar || '',
    nameEn: data.name?.en || '',
    bodyAr: data.body?.ar || '',
    bodyEn: data.body?.en || '',
    cta: data.ctaLabel?.ar || '',
    ctaEn: data.ctaLabel?.en || '',
    ctaPath: data.ctaPath || '',
    policyVersion: data.policyVersion || '',
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
  }
}

export function usePublicNavigation() {
  const bootstrap = usePublicBootstrap()
  return {
    data: bootstrap.data?.navigation || [],
    isLoading: bootstrap.isLoading,
    error: bootstrap.error,
  }
}

export function useSiteSettings() {
  const bootstrap = usePublicBootstrap()
  return bootstrap.data?.settings || null
}

export function usePublicLocations() {
  const bootstrap = usePublicBootstrap()
  return {
    data: bootstrap.data?.locations || [],
    isLoading: bootstrap.isLoading,
    error: bootstrap.error,
  }
}

export function useSiteInfo() {
  const s = useSiteSettings()
  const { data: locations = [] } = usePublicLocations()

  const hq = locations.find((l) => l.kind === 'hq')
  const branch = locations.find((l) => l.kind === 'branch')
  const warehouse = locations.find((l) => l.kind === 'warehouse')

  const makePhone = (
    value: string | null | undefined,
    fallback: typeof defaultPhones.mobile,
  ) => (value ? { display: value, href: `tel:${phoneE164(value)}` } : fallback)

  const whatsappDigits = (s?.whatsapp || '201004998655').replace(/\D/g, '')

  return {
    whatsappHref: `https://wa.me/${whatsappDigits}`,
    currency: s?.currency || 'EGP',
    responseTarget: s?.responseTarget || null,
    company: s
      ? {
          name: s.name,
          email: s.email,
          support: s.support || defaultCompany.support,
        }
      : defaultCompany,
    phones: {
      mobile: makePhone(s?.phone, defaultPhones.mobile),
      office: makePhone(hq?.phone, defaultPhones.office),
      branch: makePhone(branch?.phone, defaultPhones.branch),
      fax: defaultPhones.fax,
    },
    addresses: {
      hq: hq?.address || defaultAddresses.hq,
      branch: branch?.address || defaultAddresses.branch,
      stores: warehouse?.address || defaultAddresses.stores,
    },
    locations,
    hours: hq?.hours || branch?.hours || null,
  }
}
