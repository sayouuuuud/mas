'use client'
import { useUnsavedForm } from './form-state'
import { PublicationPill } from './workspace-ui'
import { usePublicContentBlock } from '@/components/demo/content-preview'
import { ContentLayoutEditor } from './layout-editor'
import { MediaPicker, RemoteSelect, RelationsPanel } from './entity-tools'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  Download,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  useCopy,
} from '@/components/demo/ui'
import { useLanguage } from '@/components/language-provider'
import { useAdminSession } from './admin-shell'
import { Pagination } from './frontend-tools'
import {
  api,
  listAllRecords,
  BackendError,
  buildApiPath,
  downloadServerExport,
  formatApiError,
  saveResource,
  uploadAdminMedia,
} from '@/lib/api-client'
import { invalidateLiveQueries, useLiveQuery } from '@/lib/live-query'
import type {
  AdminQuoteRequest,
  AdminTeamMember,
  AttributeRecord,
  CategoryRecord,
  CompanySettingsRecord,
  MediaAssetRecord,
  OrganizationRecord,
  PublishStatus,
  UnitRecord,
} from '@/lib/types'

const SECTION_META: Record<
  string,
  {
    ar: string
    en: string
    publishable?: boolean
    exportResource?: 'contacts'
  }
> = {
  categories: { ar: 'التصنيفات', en: 'Categories', publishable: true },
  brands: { ar: 'العلامات التجارية', en: 'Brands', publishable: true },
  sectors: { ar: 'القطاعات الصناعية', en: 'Sectors', publishable: true },
  attributes: { ar: 'قاموس المواصفات الفنية', en: 'Technical Attributes' },
  units: { ar: 'وحدات البيع والقياس', en: 'Selling & Measure Units' },
  customers: {
    ar: 'جهات اتصال العملاء',
    en: 'Customer Contacts',
    exportResource: 'contacts',
  },
  organizations: { ar: 'المؤسسات والشركات', en: 'Organizations' },
  content: {
    ar: 'محتوى الموقع والسياسات',
    en: 'Site Content & Policies',
    publishable: true,
  },
  navigation: { ar: 'قوائم التنقل', en: 'Navigation Menus' },
  locations: { ar: 'الفروع والمخازن', en: 'Locations & Branches' },
  team: { ar: 'حسابات الأدمن', en: 'Administrator Accounts' },
}

function toSlug(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function ResourceWorkspace({
  section,
  id,
}: {
  section: string
  id?: string
}) {
  const c = useCopy()
  const { lang } = useLanguage()
  const router = useRouter()
  const meta = SECTION_META[section] || { ar: section, en: section }

  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const listPath = !id
    ? buildApiPath(`/admin/${section}`, {
        page,
        pageSize: 15,
        q: q.trim() || undefined,
      })
    : null

  const listQuery = useLiveQuery(listPath, async () => {
    if (!listPath) throw new Error('Detail mode')
    const res = await api<any[]>(listPath)
    return {
      data: res.data,
      meta: res.meta || {
        page: 1,
        pageSize: 15,
        total: res.data.length,
        totalPages: 1,
      },
    }
  })

  if (id) {
    return <ResourceEditor section={section} id={id} />
  }

  const rows = listQuery.data?.data || []
  const pagination = listQuery.data?.meta || {
    page: 1,
    pageSize: 15,
    total: 0,
    totalPages: 1,
  }

  async function handleDelete(row: any) {
    if (busy) return
    if (
      !window.confirm(
        c('هل أنت متأكد من حذف هذا السجل؟', 'Delete this record permanently?'),
      )
    ) {
      return
    }
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      await api(`/admin/${section}/${row.id || row.id}`, {
        method: 'DELETE',
        body: { version: row.version },
      })
      invalidateLiveQueries(`/admin/${section}`)
      invalidateLiveQueries(
        (key) =>
          key.startsWith('/public/') ||
          key.startsWith('/catalog/') ||
          key.startsWith('/content/'),
      )
      await listQuery.refresh()
      setFeedback(c('تم حذف السجل بنجاح.', 'Record deleted.'))
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  function displayRowTitle(row: any) {
    if (section === 'team') return row.displayName
    if (row.name && typeof row.name === 'object') {
      return lang === 'ar' ? row.name.ar : row.name.en
    }
    return row.name || row.key || row.code || row.id
  }

  function displayRowSub(row: any) {
    if (section === 'team')
      return c('الدور الوحيد: الأدمن', 'Single role: Admin')
    if (section === 'customers')
      return [row.phone, row.email].filter(Boolean).join(' · ')
    if (section === 'organizations')
      return [row.city, row.governorate].filter(Boolean).join(' — ')
    if (section === 'units') return `${row.code} · precision: ${row.precision}`
    if (section === 'attributes')
      return `${row.code} · ${row.type} (${row.scope})`
    if (section === 'navigation') return `${row.area} · ${row.path}`
    if (section === 'locations') return `${row.kind} · ${row.phone || ''}`
    if (section === 'content')
      return `key: ${row.key}${row.policyVersion ? ` · ${row.policyVersion}` : ''}`
    return row.slug ? `/${row.slug}` : ''
  }

  function displayRowBadge(row: any) {
    if (row.status === 'published' || row.status === 'draft' || row.status === 'archived')
      return <PublicationPill status={row.status} lang={lang} />
    if (typeof row.active === 'boolean') {
      return (
        <Badge tone={row.active ? 'green' : 'muted'}>
          {row.active ? c('نشط', 'Active') : c('معطّل', 'Inactive')}
        </Badge>
      )
    }
    if (typeof row.published === 'boolean') {
      return (
        <Badge tone={row.published ? 'green' : 'muted'}>
          {row.published ? c('منشور', 'Published') : c('مخفي', 'Hidden')}
        </Badge>
      )
    }
    return null
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c(meta.ar, meta.en)}</h1>
          <p>
            {section === 'team'
              ? c(
                  'نموذج وصول موحد بدور وحيد هو «الأدمن» مع حماية آخر حساب نشط.',
                  'Single-role access model (Admin) with last-active-admin protection.',
                )
              : c(
                  'إدارة السجلات الحية المحفوظة في قاعدة البيانات مع التحقق من الإصدارات.',
                  'Manage live database records with optimistic concurrency protection.',
                )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {meta.exportResource && (
            <button
              type="button"
              className="btn-outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await downloadServerExport(meta.exportResource!, {
                    q: q.trim() || undefined,
                  })
                  invalidateLiveQueries('/admin/audit-log')
                } catch (err) {
                  setErrorMsg(formatApiError(err, lang))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Download className="size-4" />
              CSV
            </button>
          )}
          <Link href={`/admin/${section}/new`} className="btn-primary">
            <Plus className="size-4" />
            {section === 'team'
              ? c('دعوة أدمن جديد', 'Invite Admin')
              : c('إضافة سجل', 'New record')}
          </Link>
        </div>
      </div>

      {feedback && (
        <p role="status" className="mb-4 text-sm font-medium text-primary">
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="panel bg-white">
        {section !== 'team' && (
          <div className="mb-4">
            <input
              className="control"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder={c('بحث…', 'Search…')}
            />
          </div>
        )}

        {listQuery.isLoading ? (
          <LoadingState />
        ) : listQuery.error ? (
          <ErrorState
            error={listQuery.error}
            onRetry={() => void listQuery.refresh()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={c('لا توجد سجلات بعد', 'No records yet')}
            description={c(
              'ابدأ بإضافة أول سجل في هذا القسم.',
              'Create your first record in this section.',
            )}
            action={
              <Link href={`/admin/${section}/new`} className="btn-primary">
                <Plus className="size-4" />
                {c('إضافة سجل جديد', 'Create record')}
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table admin-responsive-table" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader">{c('الاسم / البيان', 'Name')}</th>
                  <th role="columnheader">{c('التفاصيل', 'Details')}</th>
                  <th role="columnheader">{c('الحالة', 'Status')}</th>
                  <th role="columnheader" />
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.map((row) => {
                  const rowId = row.id
                  return (
                    <tr role="row" key={rowId}>
                      <td role="cell" data-label={c('الاسم / البيان', 'Name')} className="font-semibold">{displayRowTitle(row)}</td>
                      <td role="cell" data-label={c('التفاصيل', 'Details')}
                        dir="ltr"
                        className="font-mono text-xs text-muted-foreground"
                      >
                        {displayRowSub(row)}
                      </td>
                      <td role="cell" data-label={c('الحالة', 'Status')}>{displayRowBadge(row)}</td>
                      <td role="cell" data-label={c('الإجراءات', 'Actions')} className="text-end">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/${section}/${rowId}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {c('تحرير', 'Edit')}
                          </Link>
                          {section !== 'team' && (
                            <button
                              type="button"
                              disabled={busy}
                              className="text-xs text-red-700 hover:underline"
                              onClick={() => void handleDelete(row)}
                            >
                              {c('حذف', 'Delete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.total > 0 && (
          <Pagination
            page={pagination.page}
            pages={Math.max(1, pagination.totalPages)}
            total={pagination.total}
            onChange={setPage}
          />
        )}
      </div>
    </>
  )
}

function ResourceEditor({ section, id }: { section: string; id: string }) {
  const c = useCopy()
  const { lang } = useLanguage()
  const router = useRouter()
  const session = useAdminSession()
  const isNew = id === 'new'
  const meta = SECTION_META[section] || { ar: section, en: section }

  const detailQuery = useLiveQuery(
    !isNew && section !== 'team' ? `/admin/${section}/${id}` : null,
    async () => (await api<any>(`/admin/${section}/${id}`)).data,
  )

  const teamListQuery = useLiveQuery(
    section === 'team' && !isNew ? '/admin/team?page=1&pageSize=48' : null,
    async () =>
      (await api<AdminTeamMember[]>('/admin/team?page=1&pageSize=48')).data,
  )

  const categoriesQuery = useLiveQuery(
    ['categories', 'attributes'].includes(section)
      ? '/admin/categories?page=1&pageSize=48'
      : null,
    async () => await listAllRecords<CategoryRecord>('categories'),
  )

  const unitsQuery = useLiveQuery(
    section === 'attributes' ? '/admin/units?page=1&pageSize=48' : null,
    async () => await listAllRecords<UnitRecord>('units'),
  )

  const record =
    section === 'team'
      ? (teamListQuery.data || []).find((m) => m.id === id)
      : detailQuery.data

  const publishedContent = usePublicContentBlock(
    section === 'content' && !isNew ? record?.key || null : null,
  )

  const [form, setForm] = useState<Record<string, any>>({})
  const [attrOptions, setAttrOptions] = useState<
    Array<{ id?: string; code: string; label: { ar: string; en: string } }>
  >([])
  const [attrCategoryRules, setAttrCategoryRules] = useState<
    Array<{ categoryId: string; required: boolean; min: string; max: string }>
  >([])
  const [initializedKey, setInitializedKey] = useState('')
  const [baseVersion, setBaseVersion] = useState<number>()
  const { markDirty, markSaved } = useUnsavedForm()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isNew && initializedKey !== `new:${section}`) {
      const parentId =
        section === 'categories'
          ? new URLSearchParams(window.location.search).get('parentId') || ''
          : ''
      setForm({
        nameAr: '',
        nameEn: '',
        slug: '',
        key: '',
        code: '',
        family: 'oils',
        parentId,
        imageMediaId: '',
        logoMediaId: '',
        website: '',
        order: 0,
        precision: 0,
        active: true,
        published: true,
        status: 'draft',
        descriptionAr: '',
        descriptionEn: '',
        bodyAr: '',
        bodyEn: '',
        ctaLabelAr: '',
        ctaLabelEn: '',
        ctaPath: '',
        policyVersion: '',
        type: 'text',
        scope: 'product',
        unitId: '',
        filterable: false,
        area: 'header',
        path: '/',
        kind: 'hq',
        addressAr: '',
        addressEn: '',
        hoursAr: '',
        hoursEn: '',
        phone: '',
        mapUrl: '',
        email: '',
        namePlain: '',
        city: '',
        governorate: '',
        notes: '',
        organizationId: '',
        preferredChannel: 'phone',
        displayName: '',
        seoTitleAr: '',
        seoTitleEn: '',
        seoDescAr: '',
        seoDescEn: '',
      })
      setAttrOptions([])
      setAttrCategoryRules([])
      setInitializedKey(`new:${section}`)
    } else if (!isNew && record && !initializedKey) {
      setBaseVersion(record.version)
      setForm({
        nameAr: record.name?.ar || '',
        nameEn: record.name?.en || '',
        slug: record.slug || '',
        key: record.key || '',
        mediaIds: (record.mediaIds || []).filter(
          (mediaId: string) =>
            ![
              record.layout?.imageMediaId,
              ...(record.layout?.cards || []).map(
                (card: any) => card.imageMediaId,
              ),
            ].includes(mediaId),
        ),
        layout: record.layout || { cards: [], points: [] },
        featured: !!record.featured,
        group: record.group || 'other',
        usage: record.usage || 'both',
        code: record.code || '',
        family: record.family || 'oils',
        parentId: record.parentId || '',
        imageMediaId: record.imageMediaId || '',
        logoMediaId: record.logoMediaId || '',
        website: record.website || '',
        order: Number(record.order || 0),
        precision: Number(record.precision || 0),
        active: record.active !== false,
        published: record.published !== false,
        status: record.status || 'draft',
        descriptionAr: record.description?.ar || '',
        descriptionEn: record.description?.en || '',
        bodyAr: record.body?.ar || '',
        bodyEn: record.body?.en || '',
        ctaLabelAr: record.ctaLabel?.ar || '',
        ctaLabelEn: record.ctaLabel?.en || '',
        ctaPath: record.ctaPath || '',
        policyVersion: record.policyVersion || '',
        type: record.type || 'text',
        scope: record.scope || 'product',
        unitId: record.unitId || '',
        filterable: Boolean(record.filterable),
        area: record.area || 'header',
        path: record.path || '/',
        kind: record.kind || 'hq',
        addressAr: record.address?.ar || '',
        addressEn: record.address?.en || '',
        hoursAr: record.hours?.ar || '',
        hoursEn: record.hours?.en || '',
        phone: record.phone || '',
        mapUrl: record.mapUrl || '',
        email: record.email || '',
        namePlain: typeof record.name === 'string' ? record.name : '',
        city: record.city || '',
        governorate: record.governorate || '',
        notes: record.notes || '',
        organizationId: record.organizationId || '',
        preferredChannel: record.preferredChannel || 'phone',
        displayName: record.displayName || '',
        seoTitleAr: record.seoTitle?.ar || '',
        seoTitleEn: record.seoTitle?.en || '',
        seoDescAr: record.seoDescription?.ar || '',
        seoDescEn: record.seoDescription?.en || '',
      })
      if (section === 'attributes') {
        const attr = record as AttributeRecord
        setAttrOptions(attr.options || [])
        setAttrCategoryRules(
          (attr.categories || []).map((r) => ({
            categoryId: r.categoryId,
            required: Boolean(r.required),
            min: r.min != null ? String(r.min) : '',
            max: r.max != null ? String(r.max) : '',
          })),
        )
      }
      setInitializedKey(`${section}:${id}:${record.version}`)
    }
  }, [isNew, record, section, id, initializedKey])

  if (!isNew && (detailQuery.isLoading || teamListQuery.isLoading)) {
    return <LoadingState />
  }
  if (!isNew && !record) {
    return (
      <ErrorState
        error={detailQuery.error || teamListQuery.error}
        onRetry={() =>
          void (section === 'team'
            ? teamListQuery.refresh()
            : detailQuery.refresh())
        }
      />
    )
  }

  const contentKey = (form.key || '').trim().toLowerCase()
  const isPrivacyPolicy = contentKey === 'privacy'

  const mainCategories = (categoriesQuery.data || []).filter(
    (category) => !category.parentId && category.id !== id,
  ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const selectedParent = categoriesQuery.data?.find(
    (category) => category.id === form.parentId,
  )
  const isMainCategory = section === 'categories' && !isNew && !record?.parentId &&
    record?.slug === record?.family

  function buildPayload() {
    switch (section) {
      case 'categories':
        return {
          slug: form.slug || toSlug(form.nameEn || form.nameAr),
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          description: {
            ar: form.descriptionAr.trim(),
            en: form.descriptionEn.trim(),
          },
          family: selectedParent?.family || form.family,
          featured: Boolean(form.featured),
          parentId: form.parentId || null,
          imageMediaId: form.imageMediaId || null,
          order: Number(form.order || 0),
          seoTitle: { ar: form.seoTitleAr.trim(), en: form.seoTitleEn.trim() },
          seoDescription: {
            ar: form.seoDescAr.trim(),
            en: form.seoDescEn.trim(),
          },
          status: form.status as PublishStatus,
        }
      case 'brands':
        return {
          slug: form.slug || toSlug(form.nameEn || form.nameAr),
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          description: {
            ar: form.descriptionAr.trim(),
            en: form.descriptionEn.trim(),
          },
          website: form.website.trim() || null,
          group: form.group || 'other',
          featured: !!form.featured,
          logoMediaId: form.logoMediaId || null,
          imageMediaId: form.imageMediaId || null,
          order: Number(form.order || 0),
          seoTitle: { ar: form.seoTitleAr.trim(), en: form.seoTitleEn.trim() },
          seoDescription: {
            ar: form.seoDescAr.trim(),
            en: form.seoDescEn.trim(),
          },
          status: form.status as PublishStatus,
        }
      case 'sectors':
        return {
          slug: form.slug || toSlug(form.nameEn || form.nameAr),
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          description: {
            ar: form.descriptionAr.trim(),
            en: form.descriptionEn.trim(),
          },
          imageMediaId: form.imageMediaId || null,
          order: Number(form.order || 0),
          seoTitle: { ar: form.seoTitleAr.trim(), en: form.seoTitleEn.trim() },
          seoDescription: {
            ar: form.seoDescAr.trim(),
            en: form.seoDescEn.trim(),
          },
          status: form.status as PublishStatus,
        }
      case 'units':
        return {
          code: form.code.trim(),
          usage: form.usage || 'both',
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          precision: Number(form.precision || 0),
          active: Boolean(form.active),
        }
      case 'attributes': {
        const parsedOptions = ['option', 'multi_option'].includes(form.type)
          ? attrOptions
          : []
        return {
          code: form.code.trim().toLowerCase(),
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          type: form.type,
          scope: form.scope,
          unitId: form.unitId || null,
          filterable: Boolean(form.filterable),
          options: parsedOptions,
          categories: attrCategoryRules.map((r, idx) => ({
            categoryId: r.categoryId,
            required: r.required,
            ...(r.min !== '' ? { min: Number(r.min) } : {}),
            ...(r.max !== '' ? { max: Number(r.max) } : {}),
            order: idx,
          })),
        }
      }
      case 'customers':
        return {
          organizationId: form.organizationId || null,
          name: form.namePlain.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim(),
          preferredChannel: form.preferredChannel,
          notes: form.notes.trim() || undefined,
          active: Boolean(form.active),
        }
      case 'organizations':
        return {
          name: form.namePlain.trim(),
          city: form.city.trim() || undefined,
          governorate: form.governorate.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }
      case 'content':
        return {
          key: contentKey,
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          body: { ar: form.bodyAr.trim(), en: form.bodyEn.trim() },
          ctaLabel: { ar: form.ctaLabelAr.trim(), en: form.ctaLabelEn.trim() },
          ctaPath: form.ctaPath.trim() || undefined,
          policyVersion: form.policyVersion.trim() || undefined,
          mediaIds: Array.from(
            new Set(
              [
                ...(form.mediaIds || []),
                form.layout?.imageMediaId,
                ...(form.layout?.cards || []).map(
                  (card: any) => card.imageMediaId,
                ),
              ].filter(Boolean),
            ),
          ),
          layout: form.layout || { cards: [], points: [] },
          seoTitle: { ar: form.seoTitleAr.trim(), en: form.seoTitleEn.trim() },
          seoDescription: {
            ar: form.seoDescAr.trim(),
            en: form.seoDescEn.trim(),
          },
          status: form.status as PublishStatus,
        }
      case 'navigation':
        return {
          area: form.area,
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          path: form.path.trim().startsWith('/')
            ? form.path.trim()
            : `/${form.path.trim()}`,
          order: Number(form.order || 0),
          active: Boolean(form.active),
        }
      case 'locations':
        return {
          kind: form.kind,
          name: { ar: form.nameAr.trim(), en: form.nameEn.trim() },
          address: { ar: form.addressAr.trim(), en: form.addressEn.trim() },
          phone: form.phone.trim() || undefined,
          mapUrl: form.mapUrl.trim() || null,
          hours: { ar: form.hoursAr.trim(), en: form.hoursEn.trim() },
          published: Boolean(form.published),
        }
      default:
        return {}
    }
  }

  function contentValidationError(publishing: boolean) {
    if ((form.nameAr || '').trim().length < 2)
      return c(
        'اكتب الاسم بالعربية (حرفان على الأقل).',
        'Enter an Arabic name with at least two characters.',
      )
    if ((form.nameEn || '').trim().length < 2)
      return c(
        'اكتب الاسم بالإنجليزية (حرفان على الأقل).',
        'Enter an English name with at least two characters.',
      )
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(contentKey))
      return c(
        'اكتب مفتاح المحتوى بحروف إنجليزية أو أرقام، واستخدم شرطة للفصل، مثل home-hero.',
        'Enter a content key using English letters, numbers and single hyphens, such as home-hero.',
      )
    if (publishing && isPrivacyPolicy) {
      if (!form.bodyAr.trim() || !form.bodyEn.trim())
        return c(
          'أضف نص سياسة الخصوصية بالعربية والإنجليزية قبل النشر.',
          'Add both the Arabic and English privacy policy text before publishing.',
        )
      if (!form.policyVersion.trim())
        return c(
          'أدخل رقم إصدار سياسة الخصوصية قبل النشر.',
          'Enter a privacy policy version before publishing.',
        )
    }
    return ''
  }

  async function handleSubmit(e?: FormEvent, publishing = false) {
    e?.preventDefault()
    if (busy) return null
    setErrorMsg('')
    setFeedback('')
    if (section === 'content') {
      const error = contentValidationError(publishing)
      if (error) {
        setErrorMsg(error)
        return null
      }
    }
    if (
      section === 'categories' &&
      (isNew || Boolean(record?.parentId)) &&
      !selectedParent
    ) {
      setErrorMsg(c('اختر التصنيف الرئيسي أولًا.', 'Choose a main category first.'))
      return null
    }
    setBusy(true)
    try {
      if (section === 'team') {
        if (isNew) {
          await api('/admin/team', {
            method: 'POST',
            body: {
              email: form.email.trim(),
              displayName: form.displayName.trim(),
              roles: ['Admin'],
            },
          })
          invalidateLiveQueries('/admin/team')
          router.replace('/admin/team')
          return null
        } else {
          await api(`/admin/team/${id}`, {
            method: 'PATCH',
            body: {
              version: record.version,
              displayName: form.displayName.trim(),
              active: Boolean(form.active),
              roles: ['Admin'],
            },
          })
          invalidateLiveQueries('/admin/team')
          await teamListQuery.refresh()
          setFeedback(
            c('تم تحديث حساب الأدمن بنجاح.', 'Admin account updated.'),
          )
          return record
        }
      }

      const payload = buildPayload()
      const saved = await saveResource<any>(
        `/admin/${section}`,
        payload,
        isNew ? undefined : id,
        baseVersion,
      )
      markSaved()
      invalidateLiveQueries(`/admin/${section}`)
      invalidateLiveQueries(
        (key) =>
          key.startsWith('/public/') ||
          key.startsWith('/catalog/') ||
          key.startsWith('/content/'),
      )
      if (isNew) {
        router.replace(`/admin/${section}/${saved.id}`)
      } else {
        await detailQuery.refresh()
        setInitializedKey('')
      }
      setFeedback(c('تم حفظ السجل بنجاح.', 'Record saved successfully.'))
      return saved
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function runPublishAction(action: 'publish' | 'unpublish' | 'archive') {
    if (busy || !meta.publishable) return
    const saved = await handleSubmit(undefined, action === 'publish')
    if (!saved) return
    setBusy(true)
    setErrorMsg('')
    try {
      await api(`/admin/${section}/${saved.id}/${action}`, {
        method: 'POST',
        body: { version: saved.version },
      })
      markSaved()
      invalidateLiveQueries(`/admin/${section}`)
      invalidateLiveQueries(
        (key) =>
          key.startsWith('/public/') ||
          key.startsWith('/catalog/') ||
          key.startsWith('/content/'),
      )
      if (isNew) {
        router.replace(`/admin/${section}/${saved.id}`)
      } else {
        await detailQuery.refresh()
        setInitializedKey('')
      }
      setFeedback(
        action === 'publish'
          ? c('تم النشر بنجاح.', 'Published successfully.')
          : action === 'unpublish'
            ? c('تمت الإعادة إلى المسودة.', 'Moved back to draft.')
            : c('تمت الأرشفة.', 'Archived.'),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  const isSelfTeam = section === 'team' && !isNew && session?.id === id

  return (
    <form onChangeCapture={markDirty} onSubmit={handleSubmit}>
      <div className="admin-heading">
        <div>
          <Link href={`/admin/${section}`} className="text-sm text-primary">
            {c('العودة للقائمة', 'Back to list')}
          </Link>
          <h1 className="mt-2">
            {isNew
              ? `${c('إضافة', 'New')} — ${c(meta.ar, meta.en)}`
              : `${c('تحرير', 'Edit')} — ${c(meta.ar, meta.en)}`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {section === 'team' && isNew
              ? c('إرسال دعوة الأدمن', 'Send Admin Invitation')
              : section === 'content' ? c('حفظ المسودة', 'Save draft') : c('حفظ', 'Save')}
          </button>
          {meta.publishable && record?.status !== 'published' && (
            <button
              type="button"
              disabled={busy}
              className="btn-outline"
              onClick={() => void runPublishAction('publish')}
            >
              <Send className="size-4" />
              {c('نشر', 'Publish')}
            </button>
          )}
          {meta.publishable && record?.status === 'published' && (
            <button
              type="button"
              disabled={busy}
              className="btn-outline"
              onClick={() => void runPublishAction('unpublish')}
            >
              <EyeOff className="size-4" />
              {c('إلغاء النشر', 'Unpublish')}
            </button>
          )}
          {meta.publishable && !isNew && record?.status !== 'archived' && (
            <button
              type="button"
              disabled={busy}
              className="btn-outline"
              onClick={() => void runPublishAction('archive')}
            >
              <Archive className="size-4" />
              {c('أرشفة', 'Archive')}
            </button>
          )}
        </div>
      </div>

      {section === 'content' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <PublicationPill status={record?.status} lang={lang} />
          {publishedContent.data && (
            <span className="text-muted-foreground">
              {c('توجد نسخة متاحة للزوار', 'A version is live')}
              {publishedContent.data.policyVersion && <> · <bdi>{publishedContent.data.policyVersion}</bdi></>}
            </span>
          )}
          <span className="text-muted-foreground">
            {c('الحفظ يجهّز مسودة. استخدم نشر لإتاحتها للزوار.', 'Saving prepares a draft. Publish it to make it live.')}
          </span>
        </div>
      )}

      {feedback && (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 text-sm font-medium text-primary"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-5 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="panel grid gap-5 bg-white md:grid-cols-2">
        {section === 'team' ? (
          <>
            {isNew && (
              <Field
                label={c('البريد الإلكتروني للأدمن', 'Admin email address')}
              >
                <input
                  type="email"
                  required
                  dir="ltr"
                  className="control"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            )}
            <Field label={c('الاسم المعروض', 'Display name')}>
              <input
                required
                className="control"
                value={form.displayName || ''}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />
            </Field>
            <Field label={c('مستوى الصلاحية', 'Access role')}>
              <input
                className="control bg-muted/50"
                disabled
                value={c(
                  'الأدمن (كامل الصلاحيات مع MFA)',
                  'Admin (Full access + MFA)',
                )}
              />
            </Field>
            {!isNew && (
              <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
                <input
                  type="checkbox"
                  disabled={isSelfTeam}
                  checked={Boolean(form.active)}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                {isSelfTeam
                  ? c(
                      'الحساب نشط (لا يمكن للأدمن تعطيل حسابه الشخصي)',
                      'Active (cannot deactivate your own account)',
                    )
                  : c('الحساب نشط ومسموح له بالدخول', 'Account active')}
              </label>
            )}
          </>
        ) : section === 'customers' ? (
          <>
            <Field label={c('اسم جهة الاتصال', 'Contact name')}>
              <input
                required
                className="control"
                value={form.namePlain || ''}
                onChange={(e) =>
                  setForm({ ...form, namePlain: e.target.value })
                }
              />
            </Field>
            <Field label={c('المؤسسة / الشركة', 'Organization')}>
              <RemoteSelect
                resource="organizations"
                value={form.organizationId || ''}
                onChange={(organizationId: string) =>
                  setForm({ ...form, organizationId })
                }
                label={c('المؤسسة', 'Organization')}
              />
            </Field>
            <Field label={c('الهاتف', 'Phone')}>
              <input
                required
                dir="ltr"
                className="control"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label={c('البريد الإلكتروني', 'Email')}>
              <input
                type="email"
                dir="ltr"
                className="control"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={c('القناة المفضلة', 'Preferred channel')}>
              <select
                className="control"
                value={form.preferredChannel || 'phone'}
                onChange={(e) =>
                  setForm({ ...form, preferredChannel: e.target.value })
                }
              >
                <option value="phone">{c('هاتف', 'Phone')}</option>
                <option value="whatsapp">{c('واتساب', 'WhatsApp')}</option>
                <option value="email">{c('بريد إلكتروني', 'Email')}</option>
              </select>
            </Field>
            <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={Boolean(form.active)}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              {c('عميل نشط', 'Active contact')}
            </label>
            <div className="md:col-span-2">
              <Field label={c('ملاحظات المبيعات', 'Sales notes')}>
                <textarea
                  rows={3}
                  className="control"
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </>
        ) : section === 'organizations' ? (
          <>
            <Field
              label={c('اسم الشركة / المؤسسة', 'Company / Organization name')}
            >
              <input
                required
                className="control"
                value={form.namePlain || ''}
                onChange={(e) =>
                  setForm({ ...form, namePlain: e.target.value })
                }
              />
            </Field>
            <Field label={c('المدينة', 'City')}>
              <input
                className="control"
                value={form.city || ''}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label={c('المحافظة', 'Governorate')}>
              <input
                className="control"
                value={form.governorate || ''}
                onChange={(e) =>
                  setForm({ ...form, governorate: e.target.value })
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Field label={c('ملاحظات', 'Notes')}>
                <textarea
                  rows={3}
                  className="control"
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label={c('الاسم بالعربية', 'Arabic name')}>
              <input
                required
                maxLength={section === 'content' ? 160 : undefined}
                className="control"
                value={form.nameAr || ''}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              />
            </Field>
            <Field label={c('الاسم بالإنجليزية', 'English name')}>
              <input
                required
                maxLength={section === 'content' ? 160 : undefined}
                dir="ltr"
                className="control"
                value={form.nameEn || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setForm((prev) => ({
                    ...prev,
                    nameEn: val,
                    slug:
                      isNew && (!prev.slug || prev.slug === toSlug(prev.nameEn))
                        ? toSlug(val)
                        : prev.slug,
                  }))
                }}
              />
            </Field>

            {['categories', 'brands', 'sectors'].includes(section) && (
              <>
                <Field label={c('رمز الرابط اللاتيني (Slug)', 'URL slug')}>
                  <input
                    required
                    dir="ltr"
                    className="control font-mono"
                    value={form.slug || ''}
                    onChange={(e) =>
                      setForm({ ...form, slug: toSlug(e.target.value) })
                    }
                  />
                </Field>
                <Field label={c('ترتيب العرض', 'Display order')}>
                  <input
                    type="number"
                    className="control"
                    value={form.order ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, order: Number(e.target.value) })
                    }
                  />
                </Field>
                {section === 'categories' && (
                  <Field label={c('التصنيف الرئيسي', 'Main category')}>
                    {isMainCategory ? (
                      <input
                        className="control"
                        readOnly
                        value={form[lang === 'ar' ? 'nameAr' : 'nameEn'] || ''}
                      />
                    ) : (
                      <select
                        className="control"
                        required={isNew || Boolean(record?.parentId)}
                        disabled={categoriesQuery.isLoading}
                        value={form.parentId || ''}
                        onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                      >
                        <option value="">{c('اختر التصنيف الرئيسي', 'Choose a main category')}</option>
                        {[...mainCategories, ...(selectedParent?.parentId ? [selectedParent] : [])].map(
                          (category) => (
                            <option key={category.id} value={category.id}>
                              {category.name[lang]}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </Field>
                )}
                {section === 'brands' && (
                  <>
                    <Field label={c('مجموعة العلامة', 'Brand group')}>
                      <select
                        className="control"
                        value={form.group || 'other'}
                        onChange={(e) =>
                          setForm({ ...form, group: e.target.value })
                        }
                      >
                        <option value="oils">
                          {c('الزيوت والشحوم', 'Lubricants')}
                        </option>
                        <option value="bearings">
                          {c('الرولمان بلي', 'Bearings')}
                        </option>
                        <option value="other">{c('أخرى', 'Other')}</option>
                      </select>
                    </Field>
                    <label>
                      <input
                        type="checkbox"
                        checked={!!form.featured}
                        onChange={(e) =>
                          setForm({ ...form, featured: e.target.checked })
                        }
                      />{' '}
                      {c('مميزة على الرئيسية', 'Featured on homepage')}
                    </label>
                    <Field
                      label={c('الموقع الرسمي للعلامة', 'Official website')}
                    >
                      <input
                        type="url"
                        dir="ltr"
                        className="control"
                        placeholder="https://example.com"
                        value={form.website || ''}
                        onChange={(e) =>
                          setForm({ ...form, website: e.target.value })
                        }
                      />
                    </Field>
                    <Field label={c('شعار العلامة', 'Brand logo')}>
                      <MediaPicker
                        value={form.logoMediaId || ''}
                        onChange={(logoMediaId: string) =>
                          setForm({ ...form, logoMediaId })
                        }
                        label={c('شعار العلامة', 'Brand logo')}
                        alt={{ ar: form.nameAr, en: form.nameEn }}
                      />
                    </Field>
                  </>
                )}
                <Field label={c('صورة الغلاف', 'Cover image')}>
                  <MediaPicker
                    value={form.imageMediaId || ''}
                    onChange={(imageMediaId: string) =>
                      setForm({ ...form, imageMediaId })
                    }
                    label={c('الصورة', 'Image')}
                    alt={{ ar: form.nameAr, en: form.nameEn }}
                  />
                </Field>
                <Field label={c('الوصف بالعربية', 'Arabic description')}>
                  <textarea
                    rows={3}
                    className="control"
                    value={form.descriptionAr || ''}
                    onChange={(e) =>
                      setForm({ ...form, descriptionAr: e.target.value })
                    }
                  />
                </Field>
                <Field label={c('الوصف بالإنجليزية', 'English description')}>
                  <textarea
                    rows={3}
                    dir="ltr"
                    className="control"
                    value={form.descriptionEn || ''}
                    onChange={(e) =>
                      setForm({ ...form, descriptionEn: e.target.value })
                    }
                  />
                </Field>
              </>
            )}

            {section === 'units' && (
              <>
                <Field label={c('اختيار وحدة شائعة', 'Common unit preset')}>
                  <select
                    className="control"
                    defaultValue=""
                    onChange={(e) => {
                      const presets: Record<string, any> = {
                        piece: ['قطعة', 'Piece', 'sale', 0],
                        can: ['عبوة', 'Can', 'sale', 0],
                        drum: ['برميل', 'Drum', 'sale', 0],
                        l: ['لتر', 'Litre', 'both', 3],
                        kg: ['كيلوجرام', 'Kilogram', 'both', 3],
                        mm: ['ملليمتر', 'Millimetre', 'measure', 3],
                      }
                      const v = presets[e.target.value]
                      if (v)
                        setForm({
                          ...form,
                          code: e.target.value,
                          nameAr: v[0],
                          nameEn: v[1],
                          usage: v[2],
                          precision: v[3],
                          active: true,
                        })
                    }}
                  >
                    <option value="">{c('إدخال يدوي…', 'Custom…')}</option>
                    <option value="piece">{c('قطعة', 'Piece')}</option>
                    <option value="can">{c('عبوة', 'Can')}</option>
                    <option value="drum">{c('برميل', 'Drum')}</option>
                    <option value="l">{c('لتر', 'Litre')}</option>
                    <option value="kg">{c('كجم', 'Kilogram')}</option>
                    <option value="mm">
                      {c('ملليمتر (قياس فني)', 'Millimetre (measurement)')}
                    </option>
                  </select>
                </Field>
                <Field label={c('استخدام الوحدة', 'Unit use')}>
                  <select
                    className="control"
                    value={form.usage || 'both'}
                    onChange={(e) =>
                      setForm({ ...form, usage: e.target.value })
                    }
                  >
                    <option value="sale">
                      {c(
                        'تعبئة وبيع (عبوة، برميل، قطعة)',
                        'Selling / packaging',
                      )}
                    </option>
                    <option value="measure">
                      {c('قياس فني فقط (مم)', 'Technical measurement only')}
                    </option>
                    <option value="both">
                      {c('بيع وقياس (لتر، كجم)', 'Selling and measurement')}
                    </option>
                  </select>
                </Field>
                <Field
                  label={c(
                    'الرمز الفني للوحدة (مثل L أو kg أو drum)',
                    'Unit code (e.g. L, kg, drum, pc)',
                  )}
                >
                  <input
                    required
                    dir="ltr"
                    className="control font-mono"
                    value={form.code || ''}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </Field>
                <Field
                  label={c(
                    'عدد الخانات العشرية المسموحة (0..3)',
                    'Decimal precision (0..3)',
                  )}
                >
                  <input
                    type="number"
                    min={0}
                    max={3}
                    className="control"
                    value={form.precision ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, precision: Number(e.target.value) })
                    }
                  />
                </Field>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(form.active)}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  {c('وحدة بيع نشطة متاحة في الكتالوج والطلبات', 'Active unit')}
                </label>
              </>
            )}

            {section === 'attributes' && (
              <>
                {isNew && (
                  <div className="md:col-span-2">
                    <Field
                      label={c(
                        'بدء من قالب مواصفة',
                        'Start from a specification template',
                      )}
                    >
                      <select
                        className="control"
                        defaultValue=""
                        onChange={(e) => {
                          const templates: Record<string, any> = {
                            iso_vg: [
                              'درجة اللزوجة ISO VG',
                              'ISO VG viscosity grade',
                              'number',
                              'product',
                            ],
                            sae: ['درجة SAE', 'SAE grade', 'text', 'product'],
                            nlgi: [
                              'درجة قوام NLGI',
                              'NLGI consistency grade',
                              'text',
                              'product',
                            ],
                            bore_diameter: [
                              'القطر الداخلي',
                              'Bore diameter',
                              'number',
                              'variant',
                            ],
                            outer_diameter: [
                              'القطر الخارجي',
                              'Outer diameter',
                              'number',
                              'variant',
                            ],
                            width: ['العرض', 'Width', 'number', 'variant'],
                          }
                          const v = templates[e.target.value]
                          if (v) {
                            setForm({
                              ...form,
                              code: e.target.value,
                              nameAr: v[0],
                              nameEn: v[1],
                              type: v[2],
                              scope: v[3],
                              filterable: true,
                            })
                            setAttrOptions([])
                          }
                        }}
                      >
                        <option value="">
                          {c('خاصية مخصصة…', 'Custom specification…')}
                        </option>
                        <option value="iso_vg">ISO VG</option>
                        <option value="sae">SAE</option>
                        <option value="nlgi">NLGI</option>
                        <option value="bore_diameter">
                          {c(
                            'قطر داخلي لرولمان البلي',
                            'Bearing bore diameter',
                          )}
                        </option>
                        <option value="outer_diameter">
                          {c(
                            'قطر خارجي لرولمان البلي',
                            'Bearing outer diameter',
                          )}
                        </option>
                        <option value="width">
                          {c('عرض رولمان البلي', 'Bearing width')}
                        </option>
                      </select>
                    </Field>
                  </div>
                )}

                <Field
                  label={c(
                    'الرمز البرمجي (حروف صغيرة وأرقام و _)',
                    'Attribute code (lowercase_snake_case)',
                  )}
                >
                  <input
                    required
                    dir="ltr"
                    className="control font-mono"
                    placeholder="iso_vg"
                    value={form.code || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, '_'),
                      })
                    }
                  />
                </Field>
                <Field label={c('نوع القيمة', 'Data type')}>
                  <select
                    className="control"
                    value={form.type || 'text'}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="text">{c('نص', 'Text')}</option>
                    <option value="number">{c('رقم', 'Number')}</option>
                    <option value="boolean">{c('نعم / لا', 'Boolean')}</option>
                    <option value="option">
                      {c('اختيار مفرد من قائمة', 'Single option')}
                    </option>
                    <option value="multi_option">
                      {c('اختيار متعدد', 'Multi option')}
                    </option>
                  </select>
                </Field>
                <Field label={c('نطاق الخاصية', 'Scope')}>
                  <select
                    className="control"
                    value={form.scope || 'product'}
                    onChange={(e) =>
                      setForm({ ...form, scope: e.target.value })
                    }
                  >
                    <option value="product">
                      {c('على مستوى المنتج', 'Product level')}
                    </option>
                    <option value="variant">
                      {c('على مستوى المتغير', 'Variant level')}
                    </option>
                  </select>
                </Field>
                <Field
                  label={c(
                    'وحدة القياس المرتبطة (اختياري)',
                    'Measurement unit',
                  )}
                >
                  <select
                    className="control"
                    value={form.unitId || ''}
                    onChange={(e) =>
                      setForm({ ...form, unitId: e.target.value })
                    }
                  >
                    <option value="">{c('بدون وحدة', 'None')}</option>
                    {(unitsQuery.data || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-3 text-sm font-medium md:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.filterable)}
                    onChange={(e) =>
                      setForm({ ...form, filterable: e.target.checked })
                    }
                  />
                  {c('متاح كمرشح بحث في الكتالوج', 'Filterable in catalog')}
                </label>

                {['option', 'multi_option'].includes(form.type) && (
                  <div className="md:col-span-2 space-y-3">
                    <h3 className="font-semibold">
                      {c('القيم المتاحة', 'Available options')}
                    </h3>
                    {attrOptions.map((option, i) => (
                      <div
                        key={option.id || i}
                        className="grid gap-2 rounded border p-3 sm:grid-cols-4"
                      >
                        <label className="text-sm">
                          {c('الرمز', 'Code')}
                          <input
                            className="control"
                            dir="ltr"
                            value={option.code}
                            onChange={(e) =>
                              setAttrOptions((prev) =>
                                prev.map((o, n) =>
                                  n === i ? { ...o, code: e.target.value } : o,
                                ),
                              )
                            }
                          />
                        </label>
                        {(['ar', 'en'] as const).map((l) => (
                          <label className="text-sm" key={l}>
                            {l === 'ar' ? 'العربية' : 'English'}
                            <input
                              className="control"
                              dir={l === 'ar' ? 'rtl' : 'ltr'}
                              value={option.label[l]}
                              onChange={(e) =>
                                setAttrOptions((prev) =>
                                  prev.map((o, n) =>
                                    n === i
                                      ? {
                                          ...o,
                                          label: {
                                            ...o.label,
                                            [l]: e.target.value,
                                          },
                                        }
                                      : o,
                                  ),
                                )
                              }
                            />
                          </label>
                        ))}
                        <button
                          type="button"
                          className="text-red-700"
                          onClick={() =>
                            setAttrOptions((prev) =>
                              prev.filter((_, n) => n !== i),
                            )
                          }
                        >
                          {c('حذف القيمة', 'Delete option')}
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() =>
                        setAttrOptions((prev) => [
                          ...prev,
                          { code: '', label: { ar: '', en: '' } },
                        ])
                      }
                    >
                      {c('إضافة قيمة', 'Add option')}
                    </button>
                  </div>
                )}

                <div className="md:col-span-2 space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm">
                      {c(
                        'قواعد ربط الخاصية بالتصنيفات (إلزامي للنشر / حدود رقمية)',
                        'Category rules (required to publish / numeric bounds)',
                      )}
                    </strong>
                    <button
                      type="button"
                      className="btn-outline text-xs"
                      onClick={() => {
                        const firstCat = categoriesQuery.data?.[0]?.id || ''
                        if (!firstCat) return
                        setAttrCategoryRules((prev) => [
                          ...prev,
                          {
                            categoryId: firstCat,
                            required: true,
                            min: '',
                            max: '',
                          },
                        ])
                      }}
                    >
                      <Plus className="size-3.5" />
                      {c('إضافة قاعدة تصنيف', 'Add category rule')}
                    </button>
                  </div>
                  {attrCategoryRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto_100px_100px_auto] sm:items-center"
                    >
                      <select
                        className="control"
                        value={rule.categoryId}
                        onChange={(e) =>
                          setAttrCategoryRules((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, categoryId: e.target.value }
                                : r,
                            ),
                          )
                        }
                      >
                        {(categoriesQuery.data || []).map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {lang === 'ar' ? cat.name.ar : cat.name.en}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={rule.required}
                          onChange={(e) =>
                            setAttrCategoryRules((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, required: e.target.checked }
                                  : r,
                              ),
                            )
                          }
                        />
                        {c('إلزامي', 'Required')}
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Min"
                        className="control text-xs"
                        value={rule.min}
                        onChange={(e) =>
                          setAttrCategoryRules((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, min: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Max"
                        className="control text-xs"
                        value={rule.max}
                        onChange={(e) =>
                          setAttrCategoryRules((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, max: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="icon-button text-red-700"
                        onClick={() =>
                          setAttrCategoryRules((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {section === 'content' && (
              <>
                <Field
                  label={c('مفتاح المحتوى', 'Content key')}
                  hint={c(
                    'أمثلة: privacy للخصوصية، terms للشروط، home-hero لمقدمة الرئيسية.',
                    'Examples: privacy for the privacy policy, terms for the terms, and home-hero for the homepage introduction.',
                  )}
                >
                  <input
                    required
                    dir="ltr"
                    maxLength={180}
                    className="control font-mono"
                    placeholder="privacy"
                    value={form.key || ''}
                    onChange={(e) =>
                      setForm({ ...form, key: e.target.value })
                    }
                  />
                </Field>
                {(isPrivacyPolicy || form.policyVersion) && (
                  <Field
                    label={c('إصدار سياسة الخصوصية', 'Privacy policy version')}
                    hint={c(
                      'الإصدار مطلوب للنشر. بعد تعديل النص المنشور، احفظ التعديل كمسودة وانشره برقم إصدار جديد.',
                      'A version is required to publish. After editing published text, save it as a draft and publish it with a new version.',
                    )}
                  >
                    <input
                      dir="ltr"
                      maxLength={40}
                      className="control font-mono"
                      placeholder="1.0"
                      value={form.policyVersion || ''}
                      onChange={(e) =>
                        setForm({ ...form, policyVersion: e.target.value })
                      }
                    />
                  </Field>
                )}
                <Field label={c('النص بالعربية', 'Arabic body')}>
                  <textarea
                    rows={6}
                    maxLength={10000}
                    className="control"
                    value={form.bodyAr || ''}
                    onChange={(e) =>
                      setForm({ ...form, bodyAr: e.target.value })
                    }
                  />
                </Field>
                <Field label={c('النص بالإنجليزية', 'English body')}>
                  <textarea
                    rows={6}
                    maxLength={10000}
                    dir="ltr"
                    className="control"
                    value={form.bodyEn || ''}
                    onChange={(e) =>
                      setForm({ ...form, bodyEn: e.target.value })
                    }
                  />
                </Field>
                {!isPrivacyPolicy && (
                  <div className="md:col-span-2">
                    <ContentLayoutEditor
                      value={form.layout || { cards: [], points: [] }}
                      onChange={(layout: any) => {
                        markDirty()
                        setForm({ ...form, layout })
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {section === 'navigation' && (
              <>
                <Field label={c('منطقة القائمة', 'Navigation area')}>
                  <select
                    className="control"
                    value={form.area || 'header'}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  >
                    <option value="header">
                      {c('الشريط العلوي', 'Header')}
                    </option>
                    <option value="footer">{c('التذييل', 'Footer')}</option>
                  </select>
                </Field>
                <Field
                  label={c(
                    'المسار الداخلي (يبدأ بـ /)',
                    'Path (starts with /)',
                  )}
                >
                  <input
                    required
                    dir="ltr"
                    className="control font-mono"
                    placeholder="/products"
                    value={form.path || '/'}
                    onChange={(e) => setForm({ ...form, path: e.target.value })}
                  />
                </Field>
                <Field label={c('الترتيب', 'Order')}>
                  <input
                    type="number"
                    className="control"
                    value={form.order ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, order: Number(e.target.value) })
                    }
                  />
                </Field>
                <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(form.active)}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  {c('رابط مفعل', 'Active link')}
                </label>
              </>
            )}

            {section === 'locations' && (
              <>
                <Field label={c('نوع الموقع', 'Location kind')}>
                  <select
                    className="control"
                    value={form.kind || 'hq'}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  >
                    <option value="hq">
                      {c('المقر الرئيسي', 'Headquarters')}
                    </option>
                    <option value="branch">{c('فرع', 'Branch')}</option>
                    <option value="warehouse">{c('مخزن', 'Warehouse')}</option>
                  </select>
                </Field>
                <Field label={c('الهاتف', 'Phone')}>
                  <input
                    dir="ltr"
                    className="control"
                    value={form.phone || ''}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </Field>
                <Field label={c('العنوان بالعربية', 'Arabic address')}>
                  <input
                    required
                    className="control"
                    value={form.addressAr || ''}
                    onChange={(e) =>
                      setForm({ ...form, addressAr: e.target.value })
                    }
                  />
                </Field>
                <Field label={c('العنوان بالإنجليزية', 'English address')}>
                  <input
                    required
                    dir="ltr"
                    className="control"
                    value={form.addressEn || ''}
                    onChange={(e) =>
                      setForm({ ...form, addressEn: e.target.value })
                    }
                  />
                </Field>
                <Field label={c('مواعيد العمل بالعربية', 'Arabic hours')}>
                  <input
                    className="control"
                    value={form.hoursAr || ''}
                    onChange={(e) =>
                      setForm({ ...form, hoursAr: e.target.value })
                    }
                  />
                </Field>
                <Field label={c('مواعيد العمل بالإنجليزية', 'English hours')}>
                  <input
                    dir="ltr"
                    className="control"
                    value={form.hoursEn || ''}
                    onChange={(e) =>
                      setForm({ ...form, hoursEn: e.target.value })
                    }
                  />
                </Field>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(form.published)}
                    onChange={(e) =>
                      setForm({ ...form, published: e.target.checked })
                    }
                  />
                  {c('منشور في صفحة تواصل معنا', 'Published on Contact page')}
                </label>
              </>
            )}
          </>
        )}
      </div>
      {!isNew &&
        [
          'customers',
          'organizations',
          'categories',
          'brands',
          'sectors',
        ].includes(section) && <RelationsPanel resource={section} id={id} />}
    </form>
  )
}

export function MediaWorkspace() {
  const c = useCopy()
  const { lang } = useLanguage()
  const session = useAdminSession()
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectedId, setSelectedId] = useState<string>('')
  const [uploadVisibility, setUploadVisibility] = useState<
    'public' | 'private'
  >('public')
  const [uploadAltAr, setUploadAltAr] = useState('')
  const [uploadAltEn, setUploadAltEn] = useState('')
  const [editName, setEditName] = useState('')
  const [editAltAr, setEditAltAr] = useState('')
  const [editAltEn, setEditAltEn] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const mediaPath = buildApiPath('/admin/media', {
    page,
    pageSize: 12,
    q: q || undefined,
  })
  const mediaQuery = useLiveQuery(mediaPath, () =>
    api<MediaAssetRecord[]>(mediaPath),
  )
  const files = mediaQuery.data?.data || []
  const selected = files.find((f) => f.id === selectedId) || files[0] || null

  useEffect(() => {
    if (!selected) return
    setEditName(selected.name)
    setEditAltAr(selected.alt?.ar || '')
    setEditAltEn(selected.alt?.en || '')
  }, [selected?.id, selected?.version])

  async function handleFileSelect(file: File) {
    if (busy) return
    setBusy(true)
    setErrorMsg('')
    setFeedback('')
    try {
      const kind = file.type === 'application/pdf' ? 'catalog' : 'image'
      const uploaded = await uploadAdminMedia(file, {
        name: file.name,
        alt: {
          ar: uploadAltAr.trim() || file.name,
          en: uploadAltEn.trim() || file.name,
        },
        visibility: uploadVisibility,
        kind,
      })
      setSelectedId(uploaded.id)
      invalidateLiveQueries('/admin/media')
      await mediaQuery.refresh()
      setFeedback(
        uploaded.status === 'quarantined'
          ? c(
              'تم رفع الملف إلى منطقة الحجر الأمني (quarantined) وجدولة معالجة الملف.',
              'File uploaded to quarantine and queued for file processing.',
            )
          : c('تم رفع الملف بنجاح.', 'File uploaded successfully.'),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>
            {c('مكتبة الوسائط والنشرات الفنية', 'Media & Technical Documents')}
          </h1>
          <p>
            {c(
              'رفع الصور وملفات TDS/SDS مع الحجر الأمني الإلزامي وفحص النصوص البديلة قبل النشر العام.',
              'Upload images and TDS/SDS PDFs with mandatory security quarantine and bilingual alt text.',
            )}
          </p>
        </div>

      </div>

      {session && session.mediaScannerConfigured === false && (
        <div className="panel mb-6 flex items-start gap-3 border-amber-300 bg-amber-50/80 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div>
            <strong>
              {c(
                'فاحص الملفات الأمني الخارجي غير مضبوط في متغيرات البيئة الحالية:',
                'External malware scanner is not configured in current environment:',
              )}
            </strong>{' '}
            {session.mediaProcessingMode === 'validation_only'
              ? c(
                  'الملفات تُفحص للتأكد من النوع والحجم وسلامة البنية. تُعاد معالجة الصور وتُرفض مستندات PDF ذات المحتوى النشط قبل إتاحتها للنشر. لا يُجرى فحص فيروسات خارجي في هذا الوضع.',
                  'Files are checked for type, size and valid structure. Images are re-encoded and PDFs with active content are rejected before publication. This mode does not perform external antivirus scanning.',
                )
              : c(
                  'ستبقى الملفات المرفوعة في حالة الحجر الأمني (quarantined) ولن تُرقّى إلى ready للنشر العام حتى ضبط MEDIA_SCANNER_URL و MEDIA_SCANNER_KEY.',
                  'Uploaded files remain strictly in quarantined status and will not be promoted to ready until MEDIA_SCANNER_URL and MEDIA_SCANNER_KEY are configured.',
                )}
          </div>
        </div>
      )}

      <div className="panel mb-6 grid gap-4 bg-white md:grid-cols-3">
        <Field
          label={c('مستوى ظهور الملف الجديد', 'Visibility for next upload')}
        >
          <select
            className="control"
            value={uploadVisibility}
            onChange={(e) => setUploadVisibility(e.target.value as any)}
          >
            <option value="public">
              {c(
                'عام (للكتالوج بعد المعالجة)',
                'Public (catalog after processing)',
              )}
            </option>
            <option value="private">
              {c('خاص (للإدارة فقط)', 'Private (admin only)')}
            </option>
          </select>
        </Field>
        <Field
          label={c('النص البديل بالعربية قبل الرفع', 'Default Arabic alt text')}
        >
          <input
            className="control"
            value={uploadAltAr}
            onChange={(e) => setUploadAltAr(e.target.value)}
          />
        </Field>
        <Field
          label={c(
            'النص البديل بالإنجليزية قبل الرفع',
            'Default English alt text',
          )}
        >
          <input
            className="control"
            dir="ltr"
            value={uploadAltEn}
            onChange={(e) => setUploadAltEn(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              void (async () => {
                for (const file of files) await handleFileSelect(file)
              })()
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {c('رفع صورة أو PDF', 'Upload image or PDF')}
          </button>
        </div>
      </div>

      {feedback && (
        <p role="status" className="mb-4 text-sm font-medium text-primary">
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-4 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="mb-4">
        <input
          aria-label={c('بحث في مكتبة الوسائط', 'Search media library')}
          placeholder={c('بحث بالاسم أو النوع…', 'Search by name or type…')}
          className="control"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </div>
      {mediaQuery.data && (
        <Pagination
          page={page}
          pages={Math.max(1, mediaQuery.data.meta?.totalPages || 1)}
          total={mediaQuery.data.meta?.total || 0}
          onChange={setPage}
        />
      )}
      {mediaQuery.isLoading ? (
        <LoadingState />
      ) : mediaQuery.error ? (
        <ErrorState
          error={mediaQuery.error}
          onRetry={() => void mediaQuery.refresh()}
        />
      ) : files.length === 0 ? (
        <EmptyState
          title={c('مكتبة الوسائط فارغة', 'Media library is empty')}
          description={c(
            'ارفع صور المنتجات أو النشرات الفنية بصيغة JPEG أو PNG أو WebP أو PDF.',
            'Upload JPEG, PNG, WebP images or PDF data sheets.',
          )}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="panel grid gap-4 bg-white sm:grid-cols-2 xl:grid-cols-3">
            {files.map((f) => {
              const activeCard = selected?.id === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  className={`rounded-xl border p-4 text-start transition ${
                    activeCard ? 'border-primary ring-2 ring-primary/15' : ''
                  }`}
                >
                  <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    {f.kind === 'image' && f.url ? (
                      <img
                        src={f.url}
                        alt={f.alt?.[lang] || f.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <FileText className="size-8" />
                    )}
                  </div>
                  <strong className="block truncate text-sm">{f.name}</strong>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={
                        f.status === 'ready'
                          ? 'green'
                          : f.status === 'quarantined'
                            ? 'gold'
                            : 'red'
                      }
                    >
                      {f.status}
                    </Badge>
                    <Badge tone="muted">{f.visibility}</Badge>
                  </div>
                </button>
              )
            })}
          </div>

          {selected && (
            <div className="panel space-y-4 bg-white">
              <h2 className="text-lg font-bold">
                {c('خصائص الملف المحدد', 'Selected asset metadata')}
              </h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <p dir="ltr" className="font-mono">
                  {selected.mime} · {(selected.size / 1024).toFixed(1)} KB
                </p>
                <p>
                  {c('حالة الفحص:', 'File status:')}{' '}
                  <strong>{selected.status}</strong>
                </p>
                {(selected as any).usedBy?.length > 0 && (
                  <div>
                    <strong>{c('مستخدم في', 'Used by')}</strong>
                    {(selected as any).usedBy.map((item: any) => (
                      <Link
                        key={item.id}
                        className="block text-primary underline"
                        href={`/admin/${item.resource}/${item.id}`}
                      >
                        {item.name?.[lang] || item.name || item.resource}
                      </Link>
                    ))}
                  </div>
                )}
                {selected.scanError && (
                  <p className="text-amber-800">{selected.scanError}</p>
                )}
              </div>

              <Field label={c('اسم الملف المعروض', 'Display name')}>
                <input
                  className="control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </Field>
              <Field
                label={c('النص البديل بالعربية (Alt AR)', 'Arabic alt text')}
              >
                <input
                  className="control"
                  value={editAltAr}
                  onChange={(e) => setEditAltAr(e.target.value)}
                />
              </Field>
              <Field
                label={c(
                  'النص البديل بالإنجليزية (Alt EN)',
                  'English alt text',
                )}
              >
                <input
                  className="control"
                  dir="ltr"
                  value={editAltEn}
                  onChange={(e) => setEditAltEn(e.target.value)}
                />
              </Field>

              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setErrorMsg('')
                  setFeedback('')
                  try {
                    await api(`/admin/media/${selected.id}`, {
                      method: 'PATCH',
                      body: {
                        version: selected.version,
                        name: editName.trim(),
                        alt: { ar: editAltAr.trim(), en: editAltEn.trim() },
                      },
                    })
                    invalidateLiveQueries('/admin/media')
                    await mediaQuery.refresh()
                    setFeedback(
                      c('تم تحديث بيانات الملف.', 'Asset metadata saved.'),
                    )
                  } catch (err) {
                    setErrorMsg(formatApiError(err, lang))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Check className="size-4" />
                {c('حفظ البيانات البديلة', 'Save metadata')}
              </button>

              {selected.status === 'quarantined' && (
                <button
                  type="button"
                  className="btn-outline w-full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setErrorMsg('')
                    try {
                      await api('/admin/jobs', {
                        method: 'POST',
                        body: { mediaId: selected.id },
                      })
                      await mediaQuery.refresh()
                      setFeedback(
                        c(
                          'تمت محاولة الفحص الأمني وتحديث حالة الملف.',
                          'Media scan executed and status refreshed.',
                        ),
                      )
                    } catch (err) {
                      setErrorMsg(formatApiError(err, lang))
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <RefreshCw className="size-4" />
                  {c('تشغيل الفحص الأمني الآن', 'Run malware scan now')}
                </button>
              )}

              {selected.status === 'ready' && (
                <button
                  type="button"
                  className="btn-outline w-full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setErrorMsg('')
                    try {
                      const res = await api<{ url: string }>(
                        `/admin/media/${selected.id}/download`,
                      )
                      window.open(res.data.url, '_blank', 'noopener,noreferrer')
                    } catch (err) {
                      setErrorMsg(formatApiError(err, lang))
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Download className="size-4" />
                  {c('فتح / تنزيل الملف الموقّع', 'Open signed file URL')}
                </button>
              )}

              <button
                type="button"
                className="btn-outline w-full text-red-700"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      c(
                        'حذف هذا الملف نهائيًا؟',
                        'Delete this file permanently?',
                      ),
                    )
                  ) {
                    return
                  }
                  setBusy(true)
                  setErrorMsg('')
                  try {
                    await api(`/admin/media/${selected.id}`, {
                      method: 'DELETE',
                      body: { version: selected.version },
                    })
                    setSelectedId('')
                    invalidateLiveQueries('/admin/media')
                    await mediaQuery.refresh()
                    setFeedback(c('تم حذف الملف.', 'Asset deleted.'))
                  } catch (err) {
                    setErrorMsg(formatApiError(err, lang))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Trash2 className="size-4" />
                {c('حذف الملف', 'Delete file')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function SettingsWorkspace() {
  const c = useCopy()
  const { lang } = useLanguage()

  const settingsQuery = useLiveQuery(
    '/admin/settings?page=1&pageSize=1',
    async () =>
      (await api<CompanySettingsRecord[]>('/admin/settings?page=1&pageSize=1'))
        .data,
  )

  const current = settingsQuery.data?.[0] || null

  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [logoMediaId, setLogoMediaId] = useState('')
  const [officePhone, setOfficePhone] = useState('')
  const [fax, setFax] = useState('')
  const [currency, setCurrency] = useState('EGP')
  const [supportAr, setSupportAr] = useState('')
  const [supportEn, setSupportEn] = useState('')
  const [responseTargetAr, setResponseTargetAr] = useState('')
  const [responseTargetEn, setResponseTargetEn] = useState('')
  const [initializedKey, setInitializedKey] = useState('')

  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (current && initializedKey !== `${current.id}:${current.version}`) {
      setNameAr(current.name?.ar || '')
      setNameEn(current.name?.en || '')
      setLogoMediaId(current.logoMediaId || '')
      setOfficePhone(current.officePhone || '')
      setFax(current.fax || '')
      setCurrency(current.currency || 'EGP')
      setEmail(current.email || '')
      setPhone(current.phone || '')
      setWhatsapp(current.whatsapp || '')
      setSupportAr(current.support?.ar || '')
      setSupportEn(current.support?.en || '')
      setResponseTargetAr(current.responseTarget?.ar || '')
      setResponseTargetEn(current.responseTarget?.en || '')
      setInitializedKey(`${current.id}:${current.version}`)
    }
  }, [current, initializedKey])

  if (settingsQuery.isLoading) return <LoadingState />
  if (settingsQuery.error) {
    return (
      <ErrorState
        error={settingsQuery.error}
        onRetry={() => void settingsQuery.refresh()}
      />
    )
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setFeedback('')
    setErrorMsg('')
    try {
      const payload = {
        name: { ar: nameAr.trim(), en: nameEn.trim() },
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        support: { ar: supportAr.trim(), en: supportEn.trim() },
        logoMediaId: logoMediaId || null,
        officePhone: officePhone || null,
        fax: fax || null,
        currency,
        timezone: 'Africa/Cairo',
        responseTarget: {
          ar: responseTargetAr.trim(),
          en: responseTargetEn.trim(),
        },
      }
      await saveResource<CompanySettingsRecord>(
        '/admin/settings',
        payload,
        current?.id,
        current?.version,
      )
      invalidateLiveQueries('/admin/settings')
      invalidateLiveQueries('/public/bootstrap')
      await settingsQuery.refresh()
      setFeedback(
        c(
          'تم حفظ إعدادات الشركة وتحديث الموقع العام.',
          'Company settings saved and public website refreshed.',
        ),
      )
    } catch (err) {
      setErrorMsg(formatApiError(err, lang))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div className="admin-heading">
        <div>
          <h1>{c('إعدادات الشركة العامة', 'Company Settings')}</h1>
          <p>
            {c(
              'البيانات الرسمية للشركة وقنوات التواصل والمنطقة الزمنية المعتمدة (Africa/Cairo).',
              'Official company profile, contact channels and Africa/Cairo operational settings.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/locations" className="btn-outline">
            {c('إدارة الفروع والمخازن', 'Manage locations')}
          </Link>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {c('حفظ الإعدادات', 'Save settings')}
          </button>
        </div>
      </div>

      {feedback && (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 text-sm font-medium text-primary"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {feedback}
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="mb-5 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="panel grid gap-5 bg-white md:grid-cols-2">
        {' '}
        <div className="md:col-span-2">
          <MediaPicker
            value={logoMediaId}
            onChange={setLogoMediaId}
            label={c('شعار الشركة', 'Company logo')}
            alt={{ ar: nameAr, en: nameEn }}
          />
        </div>
        <Field label={c('الهاتف الأرضي', 'Office phone')}>
          <input
            className="control"
            dir="ltr"
            value={officePhone}
            onChange={(e) => setOfficePhone(e.target.value)}
          />
        </Field>
        <Field label={c('الفاكس', 'Fax')}>
          <input
            className="control"
            dir="ltr"
            value={fax}
            onChange={(e) => setFax(e.target.value)}
          />
        </Field>
        <Field label={c('العملة الافتراضية', 'Default currency')}>
          <select
            className="control"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>EGP</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </Field>
        <Field label={c('اسم الشركة بالعربية', 'Company name (Arabic)')}>
          <input
            required
            className="control"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </Field>
        <Field label={c('اسم الشركة بالإنجليزية', 'Company name (English)')}>
          <input
            required
            dir="ltr"
            className="control"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </Field>
        <Field label={c('البريد الإلكتروني الرسمي', 'Official email')}>
          <input
            type="email"
            required
            dir="ltr"
            className="control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={c('هاتف المبيعات الرئيسي', 'Primary sales phone')}>
          <input
            required
            dir="ltr"
            className="control"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field
          label={c(
            'رقم واتساب الأعمال (اختياري)',
            'WhatsApp number (optional)',
          )}
        >
          <input
            dir="ltr"
            className="control"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </Field>
        <Field label={c('العملة والمنطقة الزمنية', 'Currency & Timezone')}>
          <input
            disabled
            dir="ltr"
            className="control bg-muted/50 font-mono"
            value="EGP · Africa/Cairo"
          />
        </Field>
        <Field label={c('نبذة الدعم بالعربية', 'Support note (Arabic)')}>
          <input
            className="control"
            value={supportAr}
            onChange={(e) => setSupportAr(e.target.value)}
          />
        </Field>
        <Field label={c('نبذة الدعم بالإنجليزية', 'Support note (English)')}>
          <input
            dir="ltr"
            className="control"
            value={supportEn}
            onChange={(e) => setSupportEn(e.target.value)}
          />
        </Field>
        <Field
          label={c('مستهدف سرعة الرد بالعربية', 'Response target (Arabic)')}
        >
          <input
            className="control"
            placeholder="خلال يوم عمل واحد"
            value={responseTargetAr}
            onChange={(e) => setResponseTargetAr(e.target.value)}
          />
        </Field>
        <Field
          label={c('مستهدف سرعة الرد بالإنجليزية', 'Response target (English)')}
        >
          <input
            dir="ltr"
            className="control"
            placeholder="Within one business day"
            value={responseTargetEn}
            onChange={(e) => setResponseTargetEn(e.target.value)}
          />
        </Field>
      </div>
    </form>
  )
}
