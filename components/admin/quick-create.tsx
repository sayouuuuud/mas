'use client'
import { useState } from 'react'
import { api, formatApiError } from '@/lib/api-client'
import { useLanguage } from '@/components/language-provider'
import { invalidateLiveQueries } from '@/lib/live-query'
export function QuickCreate({
  resource,
  family,
  onCreated,
}: {
  resource: string
  family?: string
  onCreated: (id: string) => void
}) {
  const { lang } = useLanguage()
  const c = (a: string, b: string) => (lang === 'ar' ? a : b)
  const [open, setOpen] = useState(false),
    [ar, setAr] = useState(''),
    [en, setEn] = useState(''),
    [code, setCode] = useState(''),
    [phone, setPhone] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const bilingual = ['categories', 'brands', 'sectors', 'units'].includes(
    resource,
  )
  if (!bilingual && !['customers', 'organizations'].includes(resource))
    return null
  async function save() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const slug = en
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const name = { ar: ar.trim(), en: en.trim() }
      let data: any
      if (resource === 'units')
        data = {
          name,
          code: code.trim() || slug.replace(/-/g, '_'),
          precision: 0,
          usage: 'sale',
          active: true,
        }
      else if (resource === 'organizations') data = { name: ar.trim() }
      else if (resource === 'customers')
        data = {
          name: ar.trim(),
          phone,
          preferredChannel: 'phone',
          active: true,
        }
      else
        data = {
          name,
          slug: code.trim() || slug,
          description: { ar: '', en: '' },
          status: 'draft',
          ...(resource === 'categories' ? { family: family || 'oils' } : {}),
        }
      let row = (
        await api<any>(`/admin/${resource}`, { method: 'POST', body: data })
      ).data
      if (['categories', 'brands', 'sectors'].includes(resource))
        row = (
          await api<any>(`/admin/${resource}/${row.id}/publish`, {
            method: 'POST',
            body: { version: row.version },
          })
        ).data
      invalidateLiveQueries(`/admin/${resource}`)
      onCreated(row.id)
      setOpen(false)
      setAr('')
      setEn('')
      setCode('')
      setPhone('')
    } catch (e) {
      setError(formatApiError(e, lang))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-sm text-primary underline"
        onClick={() => setOpen(!open)}
      >
        {c('إضافة سريعة وربط', 'Quick create and link')}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
          <label className="block text-sm">
            {bilingual
              ? c('الاسم بالعربية', 'Arabic name')
              : c('الاسم', 'Name')}
            <input
              className="control mt-1"
              value={ar}
              onChange={(e) => setAr(e.target.value)}
            />
          </label>
          {bilingual && (
            <>
              <label className="block text-sm">
                {c('الاسم بالإنجليزية', 'English name')}
                <input
                  className="control mt-1"
                  dir="ltr"
                  value={en}
                  onChange={(e) => setEn(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                {c(
                  'الرمز (اختياري، يتولد من الاسم الإنجليزي)',
                  'Code (optional, derived from English name)',
                )}
                <input
                  className="control mt-1"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            </>
          )}
          {resource === 'customers' && (
            <label className="block text-sm">
              {c('الهاتف', 'Phone')}
              <input
                className="control mt-1"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? '…' : c('حفظ وربط', 'Save and link')}
          </button>
          {['categories', 'brands', 'sectors'].includes(resource) && (
            <p className="text-xs text-muted-foreground">
              {c(
                'سيتم نشر السجل الجديد لإتاحته عند نشر المنتج.',
                'The new record will be published for product publication.',
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
