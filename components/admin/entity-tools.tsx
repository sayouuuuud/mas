'use client'
import Link from 'next/link'
import { QuickCreate } from './quick-create'
import { useEffect, useState } from 'react'
import {
  api,
  buildApiPath,
  formatApiError,
  uploadAdminMedia,
} from '@/lib/api-client'
import { useLiveQuery, invalidateLiveQueries } from '@/lib/live-query'
import { useLanguage } from '@/components/language-provider'
import { Pagination } from './frontend-tools'

function title(row: any, lang: 'ar' | 'en'): string {
  return typeof row?.name === 'string'
    ? row.name
    : row?.name?.[lang] || row?.reference || row?.code || row?.id || ''
}

export function RemoteSelect({
  resource,
  value,
  onChange,
  label,
  filters = {},
  multiple = false,
}: {
  resource: string
  value: string | string[]
  onChange: (value: any) => void
  label: string
  filters?: Record<string, string>
  multiple?: boolean
}) {
  const { lang } = useLanguage()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const path = buildApiPath(`/admin/${resource}`, {
    page,
    pageSize: 12,
    q: q || undefined,
    ...filters,
  })
  const list = useLiveQuery(path, () => api<any[]>(path))
  const ids = Array.isArray(value) ? value : value ? [value] : []
  const [selected, setSelected] = useState<any[]>([])
  useEffect(() => {
    let active = true
    Promise.all(
      ids.map((id) =>
        api<any>(`/admin/${resource}/${id}`)
          .then((r) => (r.data?.id ? r.data : { id, name: id }))
          .catch(() => ({ id, name: id })),
      ),
    ).then((rows) => {
      if (active) setSelected(rows)
    })
    return () => {
      active = false
    }
  }, [resource, JSON.stringify(ids)])
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold">
        {label}
        <input
          className="control mt-2"
          placeholder={lang === 'ar' ? 'بحث بالاسم…' : 'Search…'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((row) => (
            <button
              type="button"
              className="filter-pill active"
              key={row.id}
              onClick={() =>
                onChange(multiple ? ids.filter((id) => id !== row.id) : '')
              }
            >
              {title(row, lang)} ×
            </button>
          ))}
        </div>
      )}
      <div className="max-h-48 overflow-auto rounded-lg border">
        {list.data?.data.map((row) => (
          <button
            type="button"
            key={row.id}
            aria-pressed={ids.includes(row.id)}
            className={`block w-full px-3 py-2 text-start text-sm hover:bg-muted ${ids.includes(row.id) ? 'bg-muted font-bold' : ''}`}
            onClick={() =>
              onChange(
                multiple
                  ? ids.includes(row.id)
                    ? ids.filter((id) => id !== row.id)
                    : [...ids, row.id]
                  : row.id,
              )
            }
          >
            {title(row, lang)} {row.code && <small>({row.code})</small>}
          </button>
        ))}
        {list.isLoading && <p className="p-3">…</p>}
        {list.error && (
          <p role="alert" className="p-3 text-red-700">
            {formatApiError(list.error, lang)}
          </p>
        )}
        {list.data?.data.length === 0 && (
          <p className="p-3 text-sm">
            {lang === 'ar' ? 'لا توجد نتائج' : 'No results'}
          </p>
        )}
      </div>
      {(list.data?.meta?.totalPages || 0) > 1 && (
        <Pagination
          page={page}
          pages={list.data!.meta!.totalPages}
          total={list.data!.meta!.total}
          onChange={setPage}
        />
      )}
      <QuickCreate
        resource={resource}
        family={filters.family}
        onCreated={(id) => {
          onChange(multiple ? [...ids, id] : id)
          void list.refresh()
        }}
      />
      <Link
        className="text-sm text-primary underline"
        target="_blank"
        href={`/admin/${resource}/new`}
      >
        {lang === 'ar' ? 'إضافة جديد' : 'Add new'} ↗
      </Link>
      <button
        className="ms-3 text-sm text-primary underline"
        type="button"
        onClick={() => void list.refresh()}
      >
        {lang === 'ar' ? 'تحديث القائمة' : 'Refresh'}
      </button>
    </div>
  )
}

export function MediaPicker({
  value,
  onChange,
  label,
  kind = 'image',
  alt = { ar: 'صورة', en: 'Image' },
  multiple = false,
}: {
  value: string | string[]
  onChange: (value: any) => void
  label: string
  kind?: 'image' | 'TDS' | 'SDS' | 'catalog' | 'all'
  alt?: { ar: string; en: string }
  multiple?: boolean
}) {
  const { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [documentKind, setDocumentKind] = useState<'TDS' | 'SDS' | 'catalog'>(
    'TDS',
  )
  const [messages, setMessages] = useState<string[]>([])
  const ids = Array.isArray(value) ? value : value ? [value] : []
  const path = buildApiPath('/admin/media', {
    page,
    pageSize: 12,
    q: q || undefined,
    kind: kind === 'all' ? undefined : kind,
    status: 'ready',
    visibility: 'public',
  })
  const list = useLiveQuery(open ? path : null, () => api<any[]>(path))
  const [selected, setSelected] = useState<any[]>([])
  useEffect(() => {
    let active = true
    Promise.all(
      ids.map((id) =>
        api<any>(`/admin/media/${id}`)
          .then((r) => (r.data?.id ? r.data : { id, name: id }))
          .catch(() => ({ id, name: id })),
      ),
    ).then((rows) => {
      if (active) setSelected(rows)
    })
    return () => {
      active = false
    }
  }, [JSON.stringify(ids)])
  function choose(id: string) {
    onChange(
      multiple
        ? ids.includes(id)
          ? ids.filter((v) => v !== id)
          : [...ids, id]
        : id,
    )
    if (!multiple) setOpen(false)
  }
  async function upload(files: FileList | null) {
    if (!files || busy) return
    setBusy(true)
    setMessages([])
    const added: string[] = []
    for (const file of Array.from(files)) {
      try {
        let asset = await uploadAdminMedia(file, {
          alt: { ar: alt.ar || file.name, en: alt.en || file.name },
          visibility: 'public',
          kind:
            kind === 'all'
              ? file.type.startsWith('image/')
                ? 'image'
                : documentKind
              : kind,
        })
        for (
          let i = 0;
          i < 15 &&
          !['ready', 'rejected', 'deleted'].includes(asset.status || '');
          i++
        ) {
          await new Promise((r) => setTimeout(r, 1000))
          asset = (await api<any>(`/admin/media/${asset.id}`)).data
        }
        if (asset.status === 'ready') added.push(asset.id)
        setMessages((prev) => [
          ...prev,
          `${file.name}: ${asset.status === 'ready' ? (lang === 'ar' ? 'تم الرفع' : 'Ready') : lang === 'ar' ? 'قيد المعالجة أو مرفوض؛ راجع المكتبة' : 'Processing or rejected; see library'}`,
        ])
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          `${file.name}: ${formatApiError(e, lang)}`,
        ])
      }
    }
    if (added.length)
      onChange(
        multiple
          ? Array.from(new Set([...ids, ...added]))
          : added[added.length - 1],
      )
    invalidateLiveQueries('/admin/media')
    await list.refresh()
    setBusy(false)
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{label}</h3>
      {kind === 'all' && (
        <label className="block text-sm">
          {lang === 'ar'
            ? 'نوع مستند PDF للرفع القادم'
            : 'PDF type for next upload'}
          <select
            className="control mt-1"
            value={documentKind}
            onChange={(e) =>
              setDocumentKind(e.target.value as 'TDS' | 'SDS' | 'catalog')
            }
          >
            <option value="TDS">TDS</option>
            <option value="SDS">SDS</option>
            <option value="catalog">
              {lang === 'ar' ? 'كتالوج' : 'Catalog'}
            </option>
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        {selected.map((asset, index) => (
          <div key={asset.id} className="w-28 rounded border p-2">
            {asset.url && asset.kind === 'image' && (
              <img
                src={asset.url}
                alt={asset.alt?.[lang] || asset.name}
                className="h-20 w-full object-contain"
              />
            )}
            <p className="truncate text-xs">{asset.name}</p>
            <button
              type="button"
              className="text-xs text-red-700"
              onClick={() =>
                onChange(multiple ? ids.filter((id) => id !== asset.id) : '')
              }
            >
              {lang === 'ar' ? 'إزالة' : 'Remove'}
            </button>
            {multiple && index > 0 && (
              <button
                type="button"
                className="ms-2 text-xs text-primary"
                onClick={() => {
                  const next = [...ids]
                  ;[next[index - 1], next[index]] = [
                    next[index],
                    next[index - 1],
                  ]
                  onChange(next)
                }}
              >
                ↑
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-outline"
          onClick={() => setOpen(!open)}
        >
          {lang === 'ar' ? 'اختيار من المكتبة' : 'Choose from library'}
        </button>
        <label
          className={`btn-primary cursor-pointer ${busy ? 'opacity-50' : ''}`}
        >
          {busy
            ? lang === 'ar'
              ? 'جارٍ الرفع والتحقق…'
              : 'Uploading & validating…'
            : lang === 'ar'
              ? 'رفع من الجهاز'
              : 'Upload from device'}
          <input
            aria-label={label}
            type="file"
            className="sr-only"
            multiple={multiple}
            disabled={busy}
            accept={
              kind === 'image'
                ? 'image/png,image/jpeg,image/webp'
                : kind === 'all'
                  ? 'image/png,image/jpeg,image/webp,application/pdf'
                  : 'application/pdf'
            }
            onChange={(e) => {
              void upload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {messages.map((m, i) => (
        <p role="status" className="text-sm" key={i}>
          {m}
        </p>
      ))}
      {open && (
        <div className="space-y-3">
          <input
            aria-label={lang === 'ar' ? 'بحث في الملفات' : 'Search media'}
            className="control"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {list.data?.data.map((asset) => (
              <button
                type="button"
                key={asset.id}
                className={`rounded-lg border p-2 text-start ${ids.includes(asset.id) ? 'border-primary bg-muted' : ''}`}
                onClick={() => choose(asset.id)}
              >
                {asset.kind === 'image' && asset.url && (
                  <img
                    src={asset.url}
                    alt={asset.alt?.[lang] || asset.name}
                    className="h-24 w-full object-contain"
                  />
                )}
                <span className="block truncate text-xs">{asset.name}</span>
              </button>
            ))}
          </div>
          {list.error && <p role="alert">{formatApiError(list.error, lang)}</p>}
          {list.data && (
            <Pagination
              page={page}
              pages={Math.max(1, list.data.meta?.totalPages || 1)}
              total={list.data.meta?.total || 0}
              onChange={setPage}
            />
          )}
        </div>
      )}
    </section>
  )
}

export function RelationsPanel({
  resource,
  id,
}: {
  resource: string
  id: string
}) {
  const { lang } = useLanguage()
  const sections =
    resource === 'customers' || resource === 'organizations'
      ? [
          'quote-requests',
          'inquiries',
          'quotations',
          ...(resource === 'organizations' ? ['customers'] : []),
        ]
      : ['products']
  const [tab, setTab] = useState(sections[0])
  const [page, setPage] = useState(1)
  const filter =
    resource === 'customers'
      ? { contactId: id }
      : resource === 'organizations'
        ? { organizationId: id }
        : {
            [resource === 'categories'
              ? 'category'
              : resource === 'brands'
                ? 'brand'
                : 'sector']: id,
          }
  const path = buildApiPath(`/admin/${tab}`, { page, pageSize: 10, ...filter })
  const list = useLiveQuery(path, () => api<any[]>(path))
  const names: Record<string, string> = {
    'quote-requests': 'طلبات الأسعار',
    inquiries: 'الاستفسارات',
    quotations: 'عروض الأسعار',
    customers: 'جهات الاتصال',
    products: 'المنتجات المرتبطة',
  }
  return (
    <section className="panel mt-6 bg-card">
      <h2 className="mb-4 text-xl font-bold">
        {lang === 'ar' ? 'السجلات المرتبطة' : 'Related records'}
      </h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            type="button"
            key={s}
            className={`filter-pill ${tab === s ? 'active' : ''}`}
            onClick={() => {
              setTab(s)
              setPage(1)
            }}
          >
            {lang === 'ar' ? names[s] : s}
          </button>
        ))}
      </div>
      {tab === 'products' && (
        <Link
          className="btn-outline mb-4"
          href={`/admin/products/new?${new URLSearchParams({ [resource === 'categories' ? 'categoryId' : resource === 'brands' ? 'brandId' : 'sectorId']: id })}`}
        >
          {lang === 'ar' ? 'إضافة منتج مرتبط' : 'Add linked product'}
        </Link>
      )}
      <div className="divide-y">
        {list.data?.data.map((row) => (
          <Link
            className="flex justify-between gap-3 py-3 text-primary"
            key={row.id}
            href={`/admin/${tab}/${row.id}`}
          >
            <span>{title(row, lang)}</span>
            <span>{row.status || row.phone}</span>
          </Link>
        ))}
      </div>
      {list.isLoading && <p>…</p>}
      {list.error && <p role="alert">{formatApiError(list.error, lang)}</p>}
      {list.data?.data.length === 0 && (
        <p>{lang === 'ar' ? 'لا توجد سجلات مرتبطة' : 'No linked records'}</p>
      )}
      {list.data && (
        <Pagination
          page={page}
          pages={Math.max(1, list.data.meta?.totalPages || 1)}
          total={list.data.meta?.total || 0}
          onChange={setPage}
        />
      )}
    </section>
  )
}
