'use client'
import { PublicLink as Link } from '@/components/demo/public-link'
import { useDemo } from '@/components/demo/demo-provider'
import { useLanguage } from '@/components/language-provider'
import { EmptyState, PageIntro, useCopy } from '@/components/demo/ui'
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
      <button className="text-sm underline" onClick={() => setComparison([])}>
        {c('مسح المقارنة', 'Clear comparison')}
      </button>
    </aside>
  )
}
export function ComparisonPage() {
  const { comparison, products, setComparison } = useDemo()
  const { lang } = useLanguage()
  const c = useCopy()
  const rows = products.filter(
    (p) => comparison.includes(p.id) && p.status === 'published',
  )
  const attributes = Array.from(
    new Set(rows.flatMap((p) => p.specs.map((s) => s.label[lang]))),
  )
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
        {rows.length ? (
          <div className="table-scroll panel" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{c('الخاصية', 'Attribute')}</th>
                  {rows.map((p) => (
                    <th key={p.id}>
                      <Link className="text-primary" href={`/products/${p.id}`}>
                        {p.name[lang]}
                      </Link>
                      <button
                        className="block pt-2 text-xs underline"
                        onClick={() =>
                          setComparison((all) =>
                            all.filter((id) => id !== p.id),
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
                  <th>{c('العبوات', 'Pack options')}</th>
                  {rows.map((p) => (
                    <td key={p.id}>
                      {p.variants.map((v) => v.label[lang]).join(' / ')}
                    </td>
                  ))}
                </tr>
                {attributes.map((label) => (
                  <tr key={label}>
                    <th>{label}</th>
                    {rows.map((p) => (
                      <td key={p.id}>
                        {p.specs.find((s) => s.label[lang] === label)?.value ||
                          c('غير متوفر', 'Not available')}
                      </td>
                    ))}
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
          >
            <Link className="btn-primary" href="/products">
              {c('تصفح المنتجات', 'Browse products')}
            </Link>
          </EmptyState>
        )}
      </div>
    </>
  )
}
