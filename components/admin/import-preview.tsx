'use client'
import { useState } from 'react'
import { useDemo } from '@/components/demo/demo-provider'
import { Field, useCopy } from '@/components/demo/ui'
import { csvDownload } from '@/lib/frontend-model'
import { parseCsv } from '@/lib/csv-preview'
import { bi, type DemoProduct, type CategoryKey } from '@/lib/demo-data'
export function ImportPreview() {
  const { products, setProducts, recordActivity, resources } = useDemo()
  const c = useCopy()
  const [rows, setRows] = useState<DemoProduct[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function inspect(file: File | undefined) {
    setRows([])
    setErrors([])
    setMessage('')
    if (!file) return
    if (file.size > 1024 * 1024) {
      setErrors([c('الحد الأقصى 1MB.', 'Maximum size is 1MB.')])
      return
    }
    setBusy(true)
    try {
      const parsed = parseCsv(await file.text())
      const header = [
        'slug',
        'name_ar',
        'name_en',
        'category',
        'brand',
        'sku',
        'pack',
      ]
      if (
        parsed.length < 2 ||
        header.some((name, i) => parsed[0][i] !== name) ||
        parsed.length > 201
      )
        throw new Error('header')
      const next: DemoProduct[] = []
      const problems: string[] = []
      const usedSkus = new Set(
        products.flatMap((p) => p.variants.map((v) => v.sku.toLowerCase())),
      )
      const usedSlugs = new Set(products.map((p) => p.slug))
      parsed.slice(1).forEach((row, index) => {
        const [slug, ar, en, category, brand, sku, pack] = row.map((value) =>
          value.trim(),
        )
        if (
          row.length !== header.length ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
          !ar?.trim() ||
          !en?.trim() ||
          !['oils', 'grease', 'bearings'].includes(category) ||
          !resources.brands.some(
            (b) => b.id === brand && b.status !== 'archived',
          ) ||
          !sku ||
          !(Number(pack) > 0) ||
          !Number.isFinite(Number(pack)) ||
          usedSkus.has(sku.toLowerCase()) ||
          usedSlugs.has(slug)
        ) {
          problems.push(
            `${c('صف', 'Row')} ${index + 2}: ${c('راجع الحقول والتكرارات والكود والتصنيف.', 'Check fields, duplicates, SKU and category.')}`,
          )
          return
        }
        usedSkus.add(sku.toLowerCase())
        usedSlugs.add(slug)
        const id = `demo-${Date.now() + index}`
        next.push({
          id,
          slug,
          name: bi(ar, en),
          summary: bi('مسودة مستوردة للمراجعة.', 'Imported draft for review.'),
          category: category as CategoryKey,
          brand,
          sectorIds: [],
          image:
            category === 'oils'
              ? '/images/product-oils.png'
              : category === 'grease'
                ? '/images/product-grease.png'
                : '/images/product-bearings.png',
          status: 'draft',
          featured: false,
          specs: [],
          variants: [
            {
              id: `${id}-0`,
              sku,
              pack,
              label: bi(`خيار ${pack}`, `Option ${pack}`),
              availability: 'on_request',
              unit:
                category === 'bearings'
                  ? bi('قطعة', 'piece')
                  : bi('عبوة', 'pack'),
            },
          ],
        })
      })
      setRows(next)
      setErrors(problems)
    } catch {
      setErrors([
        c(
          'ملف CSV غير صالح. استخدم القالب (حتى 200 صف).',
          'Invalid CSV. Use the template (up to 200 rows).',
        ),
      ])
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="panel mb-6 bg-white">
      <summary className="cursor-pointer font-bold">
        {c(
          'استيراد CSV ومعاينة الأخطاء محليًا',
          'Local CSV import & error preview',
        )}
      </summary>
      <div className="mt-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          {c(
            'تُضاف الصفوف كمسودات محلية فقط، دون تعديل المنتجات الحالية. أخطاء الصفوف تمنع التطبيق حتى تصحيح الملف.',
            'Rows become local drafts only. Existing products are unchanged; errors prevent applying the file.',
          )}
        </p>
        <button
          className="btn-outline"
          onClick={() =>
            csvDownload(
              'mas-product-template.csv',
              [
                'slug',
                'name_ar',
                'name_en',
                'category',
                'brand',
                'sku',
                'pack',
              ],
              [
                [
                  'sample-oil',
                  'منتج تجريبي',
                  'Sample product',
                  'oils',
                  'ola-energy',
                  'SAMPLE-001',
                  '20',
                ],
              ],
            )
          }
        >
          {c('تنزيل القالب', 'Download template')}
        </button>
        <Field label={c('ملف CSV', 'CSV file')}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              void inspect(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </Field>
        {busy && (
          <p role="status">{c('جارٍ تحليل الملف محليًا…', 'Parsing locally…')}</p>
        )}
        <ul className="text-sm text-red-700">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
        <p>
          {rows.length} {c('مسودة صالحة للمعاينة', 'valid draft previews')}
        </p>
        {rows.slice(0, 5).map((row) => (
          <p className="text-sm" key={row.id}>
            {row.name.ar} · {row.variants[0].sku}
          </p>
        ))}
        <button
          className="btn-primary"
          disabled={busy || !rows.length || errors.length > 0}
          onClick={() => {
            setProducts((all) => [...all, ...rows])
            recordActivity('products.imported', String(rows.length))
            setMessage(
              c(
                'تمت إضافة المسودات للواجهة فقط.',
                'Drafts added to the interface only.',
              ),
            )
            setRows([])
          }}
        >
          {c('تطبيق المسودات محليًا', 'Apply drafts locally')}
        </button>
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      </div>
    </details>
  )
}
