'use client'

import { useRef, useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Badge, useCopy } from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { downloadText } from './frontend-tools'
import { api, formatApiError } from '@/lib/api-client'

const CSV_TEMPLATE = [
  'slug,name_ar,name_en,family,category,brand,sku,unit,pack_quantity,pack_unit',
  'industrial-hydraulic-oil-68,زيت هيدروليك صناعي 68,Industrial Hydraulic Oil 68,oils,,,MAS-HYD-68-20L,drum,20,L',
].join('\n')

type PreviewProduct = {
  slug: string
  nameAr: string
  nameEn: string
  family: 'oils' | 'grease' | 'bearings'
  variants: Array<{ sku: string | null; unitCode: string }>
}

export function ImportPreview({
  onImported,
}: {
  onImported: () => Promise<void> | void
}) {
  const c = useCopy()
  const { lang } = useLanguage()
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<{
    products: PreviewProduct[]
    count: number
    token: string
    expiresAt: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function runServerPreview(rawCsv: string) {
    setCsvText(rawCsv)
    setPreview(null)
    setMessage('')
    setErrorMsg('')
    if (!rawCsv.trim()) return

    setBusy(true)
    try {
      const res = await api<{
        products: PreviewProduct[]
        count: number
        token: string
        expiresAt: string
      }>('/admin/imports/preview', {
        method: 'POST',
        body: { csv: rawCsv },
      })
      setPreview(res.data)
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function applyServerImport() {
    if (busy || !preview || !csvText.trim()) return
    setBusy(true)
    setErrorMsg('')
    setMessage('')
    try {
      const res = await api<{ count: number; ids: string[] }>(
        '/admin/imports/apply',
        {
          method: 'POST',
          body: { csv: csvText, token: preview.token },
        },
      )
      setPreview(null)
      setCsvText('')
      setMessage(
        c(
          `تم استيراد ${res.data.count} منتج كمسودة في معاملة ذرية واحدة.`,
          `Atomically imported ${res.data.count} draft product(s).`,
        ),
      )
      await onImported()
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel mb-5 space-y-4 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {c('معاينة واستيراد المنتجات الذري عبر CSV', 'Atomic CSV Product Import')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {c(
              'يتحقق الخادم من الرموز والتصنيفات ووحدات البيع النشطة أولًا، وتفشل العملية بالكامل إذا وُجد خطأ في أي صف.',
              'Server validates slugs, categories and active selling units first; rolls back completely if any row fails.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadText('mas-products-template.csv', CSV_TEMPLATE)
            }
          >
            {c('تنزيل القالب المعتمد', 'Download CSV template')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (file) await runServerPreview(await file.text())
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {c('اختيار ملف CSV للمعاينة', 'Choose CSV for preview')}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-sm text-red-800"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {preview && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="green">
              {preview.count} {c('منتج صالح للاستيراد', 'valid product(s)')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {c('رمز المعاينة صالح حتى:', 'Preview token valid until:')}{' '}
              {new Date(preview.expiresAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>{c('الاسم بالعربية', 'Arabic name')}</th>
                  <th>{c('العائلة', 'Family')}</th>
                  <th>{c('المتغيرات / الوحدات', 'Variants / Units')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.products.map((p) => (
                  <tr key={p.slug}>
                    <td dir="ltr" className="font-mono text-xs">
                      {p.slug}
                    </td>
                    <td>{p.nameAr}</td>
                    <td>{p.family}</td>
                    <td dir="ltr" className="font-mono text-xs">
                      {p.variants
                        .map((v) => `${v.sku || 'no-sku'} (${v.unitCode})`)
                        .join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void applyServerImport()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {c(
                'تأكيد الاستيراد كمسودات',
                'Confirm atomic import as drafts',
              )}
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={() => {
                setPreview(null)
                setCsvText('')
              }}
            >
              {c('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="text-sm font-medium text-primary">
          {message}
        </p>
      )}
    </div>
  )
}
