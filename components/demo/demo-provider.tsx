'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, BackendError } from '@/lib/api-client'
import { useLiveQuery } from '@/lib/live-query'
import {
  resolveReferenceImage,
  type LocalizedText,
  type ReferenceRecord,
  type UnitRecord,
  type NavigationRecord,
  type SettingsRecord,
  type LocationRecord,
} from '@/lib/types'

export type CartItem = {
  variantId: string
  quantity: number
  productId?: string
  productSlug?: string
  productName?: LocalizedText
  variantLabel?: LocalizedText
  sku?: string
  unitCode?: string
  unitName?: LocalizedText
  precision?: number
  minQuantity?: number
  quantityStep?: number
}

export type SubmissionReceipt = {
  reference: string
  receivedAt: string
  kind: 'request' | 'inquiry'
  itemCount: number
}

type VisitorWorkspaceValue = {
  comparison: string[]
  setComparison: React.Dispatch<React.SetStateAction<string[]>>
  lastSubmission: SubmissionReceipt | null
  setLastSubmission: React.Dispatch<
    React.SetStateAction<SubmissionReceipt | null>
  >
  cart: CartItem[]
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>
  hydrated: boolean
  addToCart: (
    variantId: string,
    quantity: number,
    meta?: Omit<CartItem, 'variantId' | 'quantity'>,
  ) => void
}

const CART_STORAGE_KEY = 'mas-rfq-cart'
const RECEIPT_STORAGE_KEY = 'mas-last-submission'
const COMPARE_STORAGE_KEY = 'mas-comparison'

const DemoContext = createContext<VisitorWorkspaceValue | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [comparison, setComparison] = useState<string[]>([])
  const [lastSubmission, setLastSubmission] =
    useState<SubmissionReceipt | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const rawCart: unknown = JSON.parse(
        sessionStorage.getItem(CART_STORAGE_KEY) || '[]',
      )
      if (Array.isArray(rawCart)) {
        setCart(
          rawCart
            .filter(
              (item): item is CartItem =>
                Boolean(item) &&
                typeof item === 'object' &&
                typeof (item as CartItem).variantId === 'string' &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  (item as CartItem).variantId,
                ) &&
                Number.isFinite((item as CartItem).quantity) &&
                (item as CartItem).quantity >= 0.001 &&
                (item as CartItem).quantity <= 99999,
            )
            .slice(0, 30),
        )
      }
      const rawReceipt: unknown = JSON.parse(
        sessionStorage.getItem(RECEIPT_STORAGE_KEY) || 'null',
      )
      if (
        rawReceipt &&
        typeof rawReceipt === 'object' &&
        typeof (rawReceipt as SubmissionReceipt).reference === 'string'
      ) {
        setLastSubmission(rawReceipt as SubmissionReceipt)
      }
      const rawCompare: unknown = JSON.parse(
        sessionStorage.getItem(COMPARE_STORAGE_KEY) || '[]',
      )
      if (Array.isArray(rawCompare)) {
        setComparison(
          rawCompare
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .slice(0, 3),
        )
      }
    } catch {
      // Session storage may be unavailable in restricted contexts.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // Keep in-memory state when storage is blocked.
    }
  }, [cart, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      if (lastSubmission) {
        sessionStorage.setItem(
          RECEIPT_STORAGE_KEY,
          JSON.stringify(lastSubmission),
        )
      } else {
        sessionStorage.removeItem(RECEIPT_STORAGE_KEY)
      }
    } catch {
      // Ignore storage errors
    }
  }, [lastSubmission, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(comparison))
    } catch {
      // Ignore storage errors
    }
  }, [comparison, hydrated])

  function addToCart(
    variantId: string,
    quantity: number,
    meta?: Omit<CartItem, 'variantId' | 'quantity'>,
  ) {
    if (!Number.isFinite(quantity) || quantity < 0.001 || quantity > 99999)
      return
    setCart((current) => {
      const found = current.find((item) => item.variantId === variantId)
      if (found)
        return current.map((item) =>
          item.variantId === variantId
            ? {
                ...item,
                ...meta,
                quantity: Math.min(
                  99999,
                  Number((item.quantity + quantity).toFixed(3)),
                ),
              }
            : item,
        )
      return current.length < 30
        ? [...current, { variantId, quantity, ...meta }]
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

export function usePublicBootstrap() {
  return useLiveQuery('/public/bootstrap', async () => {
    const res = await api<{
      navigation?: NavigationRecord[]
      settings?: SettingsRecord | null
      locations?: LocationRecord[]
      categories?: ReferenceRecord[]
    }>('/public/bootstrap')
    return res.data
  })
}

export function useCatalogData() {
  const categoriesQuery = useLiveQuery(
    '/catalog/categories?pageSize=48',
    async () =>
      (await api<ReferenceRecord[]>('/catalog/categories?pageSize=48')).data,
  )
  const brandsQuery = useLiveQuery(
    '/catalog/brands?pageSize=48',
    async () =>
      (await api<ReferenceRecord[]>('/catalog/brands?pageSize=48')).data,
  )
  const sectorsQuery = useLiveQuery(
    '/catalog/sectors?pageSize=48',
    async () =>
      (await api<ReferenceRecord[]>('/catalog/sectors?pageSize=48')).data,
  )
  const unitsQuery = useLiveQuery('/content/units', async () => {
    try {
      const res = await api<{ items: UnitRecord[] }>('/content/units')
      return res.data.items || []
    } catch (err) {
      if (err instanceof BackendError && err.status === 404) return []
      throw err
    }
  })

  const error =
    categoriesQuery.error ||
    brandsQuery.error ||
    sectorsQuery.error ||
    unitsQuery.error
  const isLoading =
    categoriesQuery.isLoading ||
    brandsQuery.isLoading ||
    sectorsQuery.isLoading ||
    unitsQuery.isLoading

  return {
    isLoading,
    error,
    refresh: async () => {
      await Promise.all([
        categoriesQuery.refresh(),
        brandsQuery.refresh(),
        sectorsQuery.refresh(),
        unitsQuery.refresh(),
      ])
    },
    units: unitsQuery.data || [],
    categories: (categoriesQuery.data || []).map((row) => ({
      ...row,
      slug: row.slug || row.id,
      description: row.description || { ar: '', en: '' },
      image: resolveReferenceImage(row, 'image') || '/images/product-oils.png',
      status: 'published' as const,
      parent: row.parentId || '',
    })),
    brands: (brandsQuery.data || []).map((row) => ({
      ...row,
      slug: row.slug || row.id,
      logo: resolveReferenceImage(row, 'logo'),
      description: row.description || { ar: '', en: '' },
      website: row.website || '',
      status: 'published' as const,
    })),
    sectors: (sectorsQuery.data || []).map((row) => ({
      ...row,
      slug: row.slug || row.id,
      image: resolveReferenceImage(row, 'image'),
      description: row.description || { ar: '', en: '' },
      status: 'published' as const,
    })),
  }
}
