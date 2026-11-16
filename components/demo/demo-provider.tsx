'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  initialProducts,
  initialRequests,
  type DemoProduct,
  type DemoRequest,
} from '@/lib/demo-data'

export type CartItem = { variantId: string; quantity: number }
type DemoContextValue = {
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
  const [products, setProducts] = useState(initialProducts)
  const [requests, setRequests] = useState(initialRequests)
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
                Number.isInteger(item.quantity) &&
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
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99999) return
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
