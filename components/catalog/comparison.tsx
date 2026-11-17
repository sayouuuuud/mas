'use client'

import { PublicLink as Link } from '@/components/demo/public-link'
import { useDemo } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageIntro,
  useCopy,
} from '@/components/demo/ui'
import { api, BackendError } from '@/lib/api-client'
import { useLiveQuery } from '@/lib/live-query'
import { formatSpecValue, type CatalogProduct, type ProductSpec } from '@/lib/types'
import { useCatalogData } from '@/components/demo/demo-provider'
import { usePublicAttributes } from './catalog'

export function ComparisonToggle({ id }: { id: string }) {
  const { comparison, setComparison } = useDemo()
  const c = useCopy()
  return (
    <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={comparison.includes(id)}
        disabled={!comparison.includes(id) && comparison.length >= 3}
        onChange={(e) =>
          setComparison((all) =>
            e.target.checked ? [...all, id] : all.filter((x) => x !== id),
          )
        }
      />
      {c('أضف للمقارنة (حتى 3)', 'Compare (up to 3)')}
    </label>
  )
}

export function ComparisonTray() {
  const { comparison, setComparison } = useDemo()
  const c = useCopy()
  if (!comparison.length) return null
  return (
    <aside className="comparison-tray">
      <Link className="btn-primary" href="/compare">
        {c('مقارنة المنتجات', 'Compare products')} ({comparison.length}/3)
      </Link>
      <button
        type="button"
        className="text-sm underline"
        onClick={() => setComparison([])}
      >
        {c('مسح المقارنة', 'Clear comparison')}
      </button>
    </aside>
  )
}

export function ComparisonPage() {
  const { comparison, setComparison } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()

  const queryKey = comparison.length
    ? `/catalog/products/compare?ids=${comparison.join(',')}`
    : null

  const compareQuery = useLiveQuery(queryKey, async () => {
    const results = await Promise.all(
      comparison.map(async (slugOrId) => {
        try {
          const res = await api<CatalogProduct>(
            `/catalog/products/${slugOrId}`,
          )
          return res.data
        } catch (err) {
          if (err instanceof BackendError && err.status === 404) return null
          throw err
        }
      }),
    )
    return results.filter(
      (item): item is CatalogProduct => Boolean(item),
    )
  })

  const { units } = useCatalogData()
  const attributes = usePublicAttributes().data || []
  const rows = compareQuery.data || []
  const specMap = new Map<string, ProductSpec>()
  for (const p of rows) {
    for (const sp of p.specifications || []) {
      if (!specMap.has(sp.attributeId)) {
        specMap.set(sp.attributeId, sp)
      }
    }
  }
  const specEntries = Array.from(specMap.values())

  return (
    <>
      <PageIntro
        title={c('مقارنة المنتجات', 'Compare products')}
        description={c(
          'مقارنة مواصفات للعرض فقط، وليست إثبات تكافؤ فني.',
          'Specification comparison only, not evidence of technical equivalence.',
        )}
      />
      <div className="site-container page-section">
        {compareQuery.isLoading ? (
          <LoadingState />
        ) : compareQuery.error ? (
          <ErrorState
            error={compareQuery.error}
            onRetry={() => void compareQuery.refresh()}
          />
        ) : rows.length ? (
          <div className="table-scroll panel" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{c('الخاصية', 'Attribute')}</th>
                  {rows.map((p) => (
                    <th key={p.id}>
                      <Link
                        className="text-primary"
                        href={`/products/${p.slug}`}
                      >
                        {lang === 'ar' ? p.name.ar : p.name.en}
                      </Link>
                      <button
                        type="button"
                        className="block pt-2 text-xs underline"
                        onClick={() =>
                          setComparison((all) =>
                            all.filter((id) => id !== p.id && id !== p.slug),
                          )
                        }
                      >
                        {c('إزالة', 'Remove')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>{c('العبوات المتاحة', 'Pack options')}</th>
                  {rows.map((p) => (
                    <td key={p.id}>
                      {p.variants
                        .map((v) => (lang === 'ar' ? v.label.ar : v.label.en))
                        .join(' / ')}
                    </td>
                  ))}
                </tr>
                {specEntries.map((metaSpec) => (
                  <tr key={metaSpec.attributeId}>
                    <th>
                      {attributes.find(a => a.id === metaSpec.attributeId)?.name[lang] || metaSpec.attributeId}
                    </th>
                    {rows.map((p) => {
                      const spec = (p.specifications || []).find(
                        (s) => s.attributeId === metaSpec.attributeId,
                      )
                      return (
                        <td key={p.id}>
                          {spec ? formatSpecValue(spec, attributes.find(a => a.id === spec.attributeId), units.find(u => u.id === attributes.find(a => a.id === spec.attributeId)?.unitId), lang).value : c('غير متوفر', 'Not available')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={c('اختر منتجات للمقارنة', 'Select products to compare')}
            description={c(
              'يمكنك مقارنة حتى 3 منتجات من الكتالوج.',
              'Compare up to three products from the catalog.',
            )}
            action={
              <Link className="btn-primary" href="/products">
                {c('تصفح المنتجات', 'Browse products')}
              </Link>
            }
          />
        )}
      </div>
    </>
  )
}
