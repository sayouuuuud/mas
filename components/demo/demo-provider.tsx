'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import {
  initialProducts,
  initialRequests,
  type DemoProduct,
  type DemoRequest,
} from '@/lib/demo-data'

import { resourceConfigs, type ResourceRow } from '@/lib/demo-resources'
import type {
  PreviewAudit,
  PreviewMedia,
  PreviewQuotation,
} from '@/lib/frontend-model'

export type CartItem = { variantId: string; quantity: number }
type DemoContextValue = {
  comparison: string[]
  setComparison: React.Dispatch<React.SetStateAction<string[]>>
  lastSubmission: {
    reference: string
    kind: 'request' | 'inquiry'
    itemCount: number
  } | null
  setLastSubmission: React.Dispatch<
    React.SetStateAction<{
      reference: string
      kind: 'request' | 'inquiry'
      itemCount: number
    } | null>
  >
  resources: Record<string, ResourceRow[]>
  setResources: React.Dispatch<
    React.SetStateAction<Record<string, ResourceRow[]>>
  >
  audit: PreviewAudit[]
  recordActivity: (action: string, entity: string) => void
  media: PreviewMedia[]
  setMedia: React.Dispatch<React.SetStateAction<PreviewMedia[]>>
  trackMediaUrl: (file: File) => string
  quotations: PreviewQuotation[]
  setQuotations: React.Dispatch<React.SetStateAction<PreviewQuotation[]>>
  products: DemoProduct[]
  setProducts: React.Dispatch<React.SetStateAction<DemoProduct[]>>
  requests: DemoRequest[]
  setRequests: React.Dispatch<React.SetStateAction<DemoRequest[]>>
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  hydrated: boolean
  addToCart: (variantId: string, quantity: number) => void
}
const DemoContext = createContext<DemoContextValue | null>(null)
export function DemoProvider({ children }: { children: ReactNode }) {
  const [comparison, setComparison] = useState<string[]>([])
  const [lastSubmission, setLastSubmission] = useState<{
    reference: string
    kind: 'request' | 'inquiry'
    itemCount: number
  } | null>(null)
  const [resources, setResources] = useState<Record<string, ResourceRow[]>>(
    () =>
      Object.fromEntries(
        Object.entries(resourceConfigs).map(([key, config]) => [
          key,
          config.rows.map((row) => ({
            status: 'published',
            order: '0',
            ...row,
          })),
        ]),
      ),
  )
  const [audit, setAudit] = useState<PreviewAudit[]>([])
  const [media, setMedia] = useState<PreviewMedia[]>([])
  const [quotations, setQuotations] = useState<PreviewQuotation[]>([])
  const mediaUrls = useRef(new Set<string>())
  const trackMediaUrl = (file: File) => {
    const url = URL.createObjectURL(file)
    mediaUrls.current.add(url)
    return url
  }
  useEffect(() => {
    const urls = mediaUrls.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])
  const recordActivity = useCallback(
    (action: string, entity: string) =>
      setAudit((all) =>
        [
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            action,
            entity,
          },
          ...all,
        ].slice(0, 500),
      ),
    [],
  )
  const [products, setProducts] = useState(initialProducts)
  const [requests, setRequests] = useState<DemoRequest[]>(() =>
    initialRequests.map((request) => ({
      ...request,
      items: request.items.map((item) => {
        const p = initialProducts.find((p) =>
          p.variants.some((v) => v.id === item.variantId),
        )
        const v = p?.variants.find((v) => v.id === item.variantId)
        return {
          ...item,
          ...(p && v
            ? {
                snapshot: {
                  name: { ...p.name },
                  sku: v.sku,
                  label: { ...v.label },
                  unit: { ...v.unit },
                },
              }
            : {}),
        }
      }),
    })),
  )
  const [cart, setCart] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(
        sessionStorage.getItem('mas-demo-cart') || '[]',
      )
      if (Array.isArray(raw))
        setCart(
          raw
            .filter(
              (item): item is CartItem =>
                !!item &&
                typeof item === 'object' &&
                typeof item.variantId === 'string' &&
                Number.isFinite(item.quantity) &&
                item.quantity > 0 &&
                item.quantity <= 99999 &&
                initialProducts.some((p) =>
                  p.variants.some((v) => v.id === item.variantId),
                ),
            )
            .slice(0, 30),
        )
    } catch {
      /* Storage can be unavailable; keep an in-memory cart. */
    }
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem('mas-demo-cart', JSON.stringify(cart))
      } catch {
        /* In-memory fallback. */
      }
    }
  }, [cart, hydrated])
  function addToCart(variantId: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity < 0.001 || quantity > 99999)
      return
    setCart((current) => {
      const found = current.find((item) => item.variantId === variantId)
      if (found)
        return current.map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.min(99999, item.quantity + quantity) }
            : item,
        )
      return current.length < 30
        ? [...current, { variantId, quantity }]
        : current
    })
  }
  return (
    <DemoContext.Provider
      value={{
        comparison,
        setComparison,
        lastSubmission,
        setLastSubmission,
        resources,
        setResources,
        audit,
        recordActivity,
        media,
        setMedia,
        trackMediaUrl,
        quotations,
        setQuotations,
        products,
        setProducts,
        requests,
        setRequests,
        cart,
        setCart,
        addToCart,
        hydrated,
      }}
    >
      {children}
    </DemoContext.Provider>
  )
}
export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('DemoProvider is required')
  return context
}

export function useCatalogData() {
  const { resources } = useDemo()
  return {
    categories: resources.categories.map((row) => ({
      id: row.id,
      name: { ar: row.nameAr, en: row.nameEn },
      description: { ar: row.description || '', en: row.descriptionEn || '' },
      image: row.image || '/images/product-oils.png',
      status: row.status,
      parent: row.parent || '',
    })),
    brands: resources.brands.map((row) => ({
      id: row.id,
      name: { ar: row.nameAr, en: row.nameEn },
      logo: row.logo || undefined,
      description: { ar: row.description || '', en: row.descriptionEn || '' },
      website: row.website || '',
      status: row.status,
    })),
    sectors: resources.sectors.map((row) => ({
      id: row.id,
      name: { ar: row.nameAr, en: row.nameEn },
      description: { ar: row.description || '', en: row.descriptionEn || '' },
      status: row.status,
    })),
  }
}
