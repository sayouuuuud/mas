'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { ProductOption } from '@/lib/site'

type QuoteContextValue = {
  product: ProductOption | ''
  setProduct: (product: ProductOption | '') => void
}

const QuoteContext = createContext<QuoteContextValue | null>(null)

export function QuoteProvider({ children }: { children: React.ReactNode }) {
  const [product, setProduct] = useState<ProductOption | ''>('')
  const value = useMemo(() => ({ product, setProduct }), [product])
  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>
}

export function useQuote() {
  const context = useContext(QuoteContext)
  if (!context) throw new Error('useQuote must be used within QuoteProvider')
  return context
}
