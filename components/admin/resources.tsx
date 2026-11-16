'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Search, ImagePlus, FileText, Trash2, Save } from 'lucide-react'
import { brands, categories, sectors } from '@/lib/demo-data'
import { useLanguage } from '@/components/language-provider'
import { Badge, EmptyState, Field, useCopy } from '@/components/demo/ui'
import { addresses, company, phones } from '@/lib/site'

type FieldDef = {
  key: string
  ar: string
  en: string
  type?: 'text' | 'textarea' | 'select' | 'email'
  options?: string[]
  required?: boolean
}
type ResourceRow = { id: string; [key: string]: string }
type ResourceConfig = {
  ar: string
  en: string
  description: [string, string]
  fields: FieldDef[]
  rows: ResourceRow[]
}
const nameFields: FieldDef[] = [
  { key: 'nameAr', ar: 'الاسم بالعربية', en: 'Arabic name', required: true },
  {
    key: 'nameEn',
    ar: 'الاسم بالإنجليزية',
    en: 'English name',
    required: true,
  },
  { key: 'slug', ar: 'الرابط المختصر', en: 'Slug', required: true },
  { key: 'description', ar: 'الوصف', en: 'Description', type: 'textarea' },
  {
    key: 'descriptionEn',
    ar: 'الوصف بالإنجليزية',
    en: 'English description',
    type: 'textarea',
  },
]
const resourceConfigs: Record<string, ResourceConfig> = {
  categories: {
    ar: 'التصنيفات',
    en: 'Categories',
    description: [
      'مجموعات المنتجات وترتيبها وبنية العرض.',
      'Product categories, ordering and presentation.',
    ],
    fields: [
      ...nameFields,
      {
        key: 'parent',
        ar: 'التصنيف الأعلى',
        en: 'Parent category',
        type: 'select',
        options: ['—', ...categories.map((c) => c.name.ar)],
      },
    ],
    rows: categories.map((c) => ({
      id: c.id,
      nameAr: c.name.ar,
      nameEn: c.name.en,
      slug: c.id,
      description: c.description.ar,
      descriptionEn: c.description.en,
      parent: '—',
    })),
  },
  brands: {
    ar: 'العلامات التجارية',
    en: 'Brands',
    description: [
      'بيانات العلامات وظهورها في الموقع.',
      'Brand details and website presentation.',
    ],
    fields: [
      ...nameFields,
      {
        key: 'website',
        ar: 'الموقع الرسمي (اختياري)',
        en: 'Official website (optional)',
      },
    ],
    rows: brands.map((b) => ({
      id: b.id,
      nameAr: b.name.ar,
      nameEn: b.name.en,
      slug: b.id,
      description: '',
      descriptionEn: '',
      website: '',
    })),
  },
  sectors: {
    ar: 'القطاعات',
    en: 'Sectors',
    description: [
      'المحتوى الخاص بكل قطاع وخدماته.',
      'Content for each sector and its applications.',
    ],
    fields: nameFields,
    rows: sectors.map((s) => ({
      id: s.id,
      nameAr: s.name.ar,
      nameEn: s.name.en,
      slug: s.id,
      description: s.description.ar,
      descriptionEn: s.description.en,
    })),
  },
  attributes: {
    ar: 'المواصفات والوحدات',
    en: 'Attributes & units',
    description: [
      'تعريف شكل المواصفات الفنية ووحداتها للكتالوج.',
      'Define catalog specification types and units.',
    ],
    fields: [
      {
        key: 'nameAr',
        ar: 'اسم الخاصية عربي',
        en: 'Arabic attribute',
        required: true,
      },
      {
        key: 'nameEn',
        ar: 'اسم الخاصية إنجليزي',
        en: 'English attribute',
        required: true,
      },
      { key: 'code', ar: 'الكود', en: 'Code', required: true },
      {
        key: 'type',
        ar: 'نوع القيمة',
        en: 'Value type',
        type: 'select',
        options: ['number', 'text', 'option', 'boolean'],
      },
      {
        key: 'unit',
        ar: 'الوحدة',
        en: 'Unit',
        type: 'select',
        options: ['—', 'mm', 'kg', 'L', '°C', 'rpm'],
      },
      {
        key: 'choices',
        ar: 'خيارات القيمة (مفصولة بفاصلة)',
        en: 'Options (comma separated)',
      },
    ],
    rows: [
      {
        id: 'diameter',
        nameAr: 'القطر الداخلي',
        nameEn: 'Bore diameter',
        code: 'bore',
        type: 'number',
        unit: 'mm',
        choices: '',
      },
      {
        id: 'grade',
        nameAr: 'درجة اللزوجة',
        nameEn: 'Viscosity grade',
        code: 'grade',
        type: 'option',
        unit: '—',
        choices: 'ISO VG 46, ISO VG 68',
      },
      {
        id: 'pack',
        nameAr: 'سعة العبوة',
        nameEn: 'Pack size',
        code: 'pack',
        type: 'number',
        unit: 'L',
        choices: '',
      },
    ],
  },
  customers: {
    ar: 'العملاء',
    en: 'Customers',
    description: [
      'جهات اتصال تجريبية؛ لا تدخل بيانات عملاء حقيقيين في المعاينة.',
      'Synthetic contacts; do not enter real customer data in this preview.',
    ],
    fields: [
      { key: 'nameAr', ar: 'اسم العميل', en: 'Contact name', required: true },
      { key: 'organization', ar: 'الشركة', en: 'Company' },
      { key: 'city', ar: 'المدينة', en: 'City' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', type: 'email' },
      {
        key: 'notes',
        ar: 'ملاحظات داخلية تجريبية',
        en: 'Sample internal notes',
        type: 'textarea',
      },
    ],
    rows: [
      {
        id: 'demo-customer-1',
        nameAr: 'عميل تجريبي ١',
        nameEn: 'Sample customer 1',
        organization: 'شركة صناعية تجريبية',
        city: 'القاهرة',
        email: 'customer@example.com',
        notes: 'بيانات صناعية للعرض فقط.',
      },
      {
        id: 'demo-customer-2',
        nameAr: 'عميل تجريبي ٢',
        nameEn: 'Sample customer 2',
        organization: 'أسطول نقل تجريبي',
        city: 'القليوبية',
        email: '',
        notes: '',
      },
    ],
  },
  inquiries: {
    ar: 'الرسائل والاستفسارات',
    en: 'Inquiries',
    description: [
      'صندوق استفسارات توضيحي مع معاينة الحالة والرد الداخلي.',
      'Sample inbox with status and internal reply previews.',
    ],
    fields: [
      { key: 'nameAr', ar: 'المرسل', en: 'Sender', required: true },
      {
        key: 'message',
        ar: 'الرسالة',
        en: 'Message',
        type: 'textarea',
        required: true,
      },
      {
        key: 'status',
        ar: 'الحالة',
        en: 'Status',
        type: 'select',
        options: ['new', 'assigned', 'in_progress', 'resolved', 'spam'],
      },
      {
        key: 'reply',
        ar: 'ملاحظة / مسودة رد (لن تُرسل)',
        en: 'Note / reply draft (not sent)',
        type: 'textarea',
      },
    ],
    rows: [
      {
        id: 'demo-inquiry-1',
        nameAr: 'عميل تجريبي',
        nameEn: 'Sample sender',
        message: 'استفسار تجريبي عن توريد منتجات للمصنع.',
        status: 'new',
        reply: '',
      },
    ],
  },
  team: {
    ar: 'الفريق والصلاحيات',
    en: 'Team & roles',
    description: [
      'تصور لواجهة الأدوار؛ لا يتم إنشاء حساب أو إرسال دعوة أو فرض صلاحية.',
      'Role interface preview; no accounts, invitations or permissions are created.',
    ],
    fields: [
      {
        key: 'nameAr',
        ar: 'اسم الموظف التجريبي',
        en: 'Sample employee name',
        required: true,
      },
      {
        key: 'email',
        ar: 'البريد التجريبي',
        en: 'Sample email',
        type: 'email',
        required: true,
      },
      {
        key: 'role',
        ar: 'الدور المعروض',
        en: 'Displayed role',
        type: 'select',
        options: [
          'Owner',
          'Catalog Manager',
          'Content Editor',
          'Sales Manager',
          'Sales Agent',
        ],
      },
      {
        key: 'status',
        ar: 'الحالة المعروضة',
        en: 'Displayed status',
        type: 'select',
        options: ['active', 'inactive'],
      },
    ],
    rows: [
      {
        id: 'demo-owner',
        nameAr: 'مدير تجريبي',
        nameEn: 'Preview owner',
        email: 'owner@example.com',
        role: 'Owner',
        status: 'active',
      },
      {
        id: 'demo-sales',
        nameAr: 'موظف مبيعات تجريبي',
        nameEn: 'Preview sales agent',
        email: 'sales@example.com',
        role: 'Sales Agent',
        status: 'active',
      },
    ],
  },
  content: {
    ar: 'محتوى الموقع',
    en: 'Site content',
    description: [
      'مسودات تحرير المحتوى باللغتين. هذه التعديلات لا تغيّر الموقع المنشور.',
      'Bilingual content drafts. These edits do not change the published website.',
    ],
    fields: [
      {
        key: 'nameAr',
        ar: 'عنوان القسم عربي',
        en: 'Arabic heading',
        required: true,
      },
      {
        key: 'nameEn',
        ar: 'عنوان القسم إنجليزي',
        en: 'English heading',
        required: true,
      },
      { key: 'bodyAr', ar: 'النص عربي', en: 'Arabic body', type: 'textarea' },
      {
        key: 'bodyEn',
        ar: 'النص إنجليزي',
        en: 'English body',
        type: 'textarea',
      },
      { key: 'cta', ar: 'عنوان زر الإجراء عربي', en: 'Arabic call to action' },
      {
        key: 'ctaEn',
        ar: 'عنوان زر الإجراء إنجليزي',
        en: 'English call to action',
      },
    ],
    rows: [
      {
        id: 'home-hero',
        nameAr: 'خبرة هندسية. توريد تثق به.',
        nameEn: 'Engineering expertise. Supply you can trust.',
        bodyAr: 'زيوت وشحوم ورمان بلي لمختلف الاستخدامات.',
        bodyEn: 'Oils, greases and bearings for a range of applications.',
        cta: 'استكشف المنتجات',
        ctaEn: 'Explore products',
      },
      {
        id: 'about',
        nameAr: 'عن الشركة',
        nameEn: 'About us',
        bodyAr: 'إم إيه إس للتجارة الهندسية.',
        bodyEn: 'M.A.S Engineering For Trade.',
        cta: '',
        ctaEn: '',
      },
      {
        id: 'privacy',
        nameAr: 'سياسة الخصوصية — مسودة',
        nameEn: 'Privacy policy — draft',
        bodyAr: 'تحتاج اعتماد الشركة قبل الإطلاق.',
        bodyEn: 'Requires company approval before launch.',
        cta: '',
        ctaEn: '',
      },
      {
        id: 'terms',
        nameAr: 'شروط الاستخدام — مسودة',
        nameEn: 'Terms — draft',
        bodyAr: 'تحتاج مراجعة واعتماد.',
        bodyEn: 'Requires review and approval.',
        cta: '',
        ctaEn: '',
      },
    ],
  },
}
export function ResourceWorkspace({
  section,
  id,
}: {
  section: string
  id?: string
}) {
  const config = resourceConfigs[section]
  const c = useCopy()
  const { lang } = useLanguage()
  const [rows, setRows] = useState(config.rows)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<ResourceRow | null>(() =>
    id === 'new'
      ? { id: `new-${Date.now()}` }
      : config.rows.find((r) => r.id === id) || null,
  )
  const [message, setMessage] = useState('')
  const filtered = rows.filter((r) =>
    Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase()),
  )
  const primaryColumns = config.fields
    .filter((f) => f.key !== 'nameEn' && f.type !== 'textarea')
    .slice(0, 4)
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c(config.ar, config.en)}</h1>
          <p>{c(...config.description)}</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setSelected({ id: `new-${Date.now()}` })
            setMessage('')
          }}
        >
          <Plus className="size-4" />
          {c('إضافة تجريبية', 'Add sample')}
        </button>
      </div>
      <p role="status" className="mb-4 text-sm text-primary">
        {message}
      </p>
      <div
        className={`grid items-start gap-6 ${selected ? 'xl:grid-cols-[1.2fr_1fr]' : ''}`}
      >
        <section className="panel bg-white">
          <label className="mb-5 block">
            <span className="sr-only">{c('بحث', 'Search')}</span>
            <input
              className="control"
              placeholder={c('ابحث في القائمة…', 'Search entries…')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {filtered.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label={c(
                'جدول قابل للتمرير أفقيًا',
                'Horizontally scrollable table',
              )}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    {primaryColumns.map((f) => (
                      <th key={f.key}>{c(f.ar, f.en)}</th>
                    ))}
                    <th>{c('الإجراء', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      {primaryColumns.map((f) => (
                        <td key={f.key}>
                          {f.key === 'nameAr' && lang === 'en' && r.nameEn
                            ? r.nameEn
                            : r[f.key] || '—'}
                        </td>
                      ))}
                      <td>
                        <button
                          className="text-primary underline"
                          onClick={() => {
                            setSelected({ ...r })
                            setMessage('')
                          }}
                        >
                          {c('فتح', 'Open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={c('لا توجد نتائج', 'No results')}
              description={c(
                'جرّب كلمة أخرى أو أضف سجلًا تجريبيًا.',
                'Try another term or add a sample entry.',
              )}
            />
          )}
        </section>
        {selected && (
          <form
            className="panel space-y-5 bg-white"
            onSubmit={(e) => {
              e.preventDefault()
              if (!String(selected.nameAr || '').trim()) {
                setMessage(c('اكتب الاسم أولًا.', 'Enter a name first.'))
                return
              }
              if (
                selected.slug &&
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selected.slug)
              ) {
                setMessage(
                  c(
                    'الرابط يستخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات.',
                    'Use lowercase letters, numbers and hyphens for the slug.',
                  ),
                )
                return
              }
              if (
                selected.slug &&
                rows.some(
                  (r) => r.id !== selected.id && r.slug === selected.slug,
                )
              ) {
                setMessage(
                  c(
                    'هذا الرابط مستخدم بالفعل.',
                    'This slug is already in use.',
                  ),
                )
                return
              }
              if (
                section === 'categories' &&
                selected.parent === selected.nameAr
              ) {
                setMessage(
                  c(
                    'لا يمكن جعل التصنيف أبًا لنفسه.',
                    'A category cannot be its own parent.',
                  ),
                )
                return
              }
              setRows((all) =>
                all.some((r) => r.id === selected.id)
                  ? all.map((r) => (r.id === selected.id ? { ...selected } : r))
                  : [...all, { ...selected }],
              )
              setMessage(
                c(
                  'التعديل موجود في هذه المعاينة فقط؛ لا توجد كتابة على خادم.',
                  'This edit exists only in this preview; nothing was written to a server.',
                ),
              )
            }}
          >
            <div className="flex justify-between gap-3">
              <h2 className="font-bold">
                {c('تحرير سجل تجريبي', 'Edit sample entry')}
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-muted-foreground"
              >
                {c('إغلاق', 'Close')}
              </button>
            </div>
            {config.fields.map((f) => (
              <Field
                key={f.key}
                label={`${c(f.ar, f.en)}${f.required ? ' *' : ''}`}
              >
                {f.type === 'textarea' ? (
                  <textarea
                    className="control"
                    rows={4}
                    maxLength={2000}
                    required={f.required}
                    value={selected[f.key] || ''}
                    onChange={(e) =>
                      setSelected({ ...selected, [f.key]: e.target.value })
                    }
                  />
                ) : f.type === 'select' ? (
                  <select
                    className="control"
                    value={selected[f.key] || ''}
                    onChange={(e) =>
                      setSelected({ ...selected, [f.key]: e.target.value })
                    }
                  >
                    <option value="">{c('اختر…', 'Choose…')}</option>
                    {f.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="control"
                    maxLength={254}
                    type={f.type === 'email' ? 'email' : 'text'}
                    required={f.required}
                    value={selected[f.key] || ''}
                    onChange={(e) =>
                      setSelected({ ...selected, [f.key]: e.target.value })
                    }
                  />
                )}
              </Field>
            ))}
            <button className="btn-primary">
              <Save className="size-4" />
              {c('تطبيق في المعاينة', 'Apply to preview')}
            </button>
          </form>
        )}
      </div>
      {section === 'team' && (
        <div className="panel mt-6 bg-white">
          <h2 className="mb-4 font-bold">
            {c('ملخص الأدوار المخطط لها', 'Planned role summary')}
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              Owner —{' '}
              {c(
                'إدارة الفريق والإعدادات.',
                'Team and settings administration.',
              )}
            </li>
            <li>
              Catalog Manager —{' '}
              {c(
                'المنتجات والتصنيفات والوسائط.',
                'Products, categories and media.',
              )}
            </li>
            <li>
              Content Editor — {c('محتوى الموقع فقط.', 'Site content only.')}
            </li>
            <li>
              Sales Manager —{' '}
              {c(
                'كل الطلبات والإسناد والعروض.',
                'All requests, assignment and quotations.',
              )}
            </li>
            <li>
              Sales Agent —{' '}
              {c('الطلبات المسندة إليه فقط.', 'Assigned requests only.')}
            </li>
          </ul>
        </div>
      )}
    </>
  )
}

export function MediaWorkspace() {
  const c = useCopy()
  const [files, setFiles] = useState<
    { id: string; name: string; url: string; image: boolean; size: number }[]
  >([])
  const [message, setMessage] = useState('')
  const localUrls = useRef(new Set<string>())
  const trackUrl = (file: File) => {
    const url = URL.createObjectURL(file)
    localUrls.current.add(url)
    return url
  }
  useEffect(() => {
    const urls = localUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('مكتبة الوسائط', 'Media library')}</h1>
          <p>
            {c(
              'معاينة ملفات محلية فقط. لا يتم رفع أو فحص أو نشر أي ملف.',
              'Local file previews only. No files are uploaded, scanned or published.',
            )}
          </p>
        </div>
      </div>
      <label className="upload-zone">
        <ImagePlus className="mx-auto mb-4 size-10 text-primary" />
        <strong>
          {c(
            'اختر صورًا أو ملفات PDF للمعاينة',
            'Choose images or PDFs to preview',
          )}
        </strong>
        <span className="mt-2 block text-sm text-muted-foreground">
          JPG / PNG / WebP ≤ 5 MB · PDF ≤ 20 MB
        </span>
        <input
          className="mt-5 block max-w-full text-sm"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            const list = Array.from(e.target.files || [])
            let rejected = false
            const valid = list.filter((f) => {
              const ok =
                [
                  'image/jpeg',
                  'image/png',
                  'image/webp',
                  'application/pdf',
                ].includes(f.type) &&
                f.size <= (f.type === 'application/pdf' ? 20 : 5) * 1024 * 1024
              if (!ok) rejected = true
              return ok
            })
            setFiles((old) => [
              ...old,
              ...valid.map((f) => ({
                id: crypto.randomUUID(),
                name: f.name,
                url: trackUrl(f),
                image: f.type.startsWith('image/'),
                size: f.size,
              })),
            ])
            setMessage(
              rejected
                ? c(
                    'استُبعدت ملفات غير مدعومة أو أكبر من الحد.',
                    'Unsupported or oversized files were excluded.',
                  )
                : c(
                    'تم اختيار الملفات محليًا؛ لم يتم رفعها.',
                    'Files selected locally; nothing was uploaded.',
                  ),
            )
            e.target.value = ''
          }}
        />
      </label>
      <p role="status" className="my-4 text-sm text-primary">
        {message}
      </p>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((f) => (
          <div key={f.id} className="panel min-w-0 bg-white">
            {f.image ? (
              <img
                src={f.url}
                alt={f.name}
                className="mb-4 aspect-video w-full rounded-lg object-contain"
              />
            ) : (
              <FileText className="my-8 size-12 text-primary" />
            )}
            <p className="truncate text-sm font-bold">{f.name}</p>
            <div className="mt-3 flex items-center justify-between">
              <Badge>{c('محلي فقط', 'Local only')}</Badge>
              <button
                className="icon-button"
                aria-label={`${c('إزالة', 'Remove')} ${f.name}`}
                onClick={() => {
                  URL.revokeObjectURL(f.url)
                  localUrls.current.delete(f.url)
                  setFiles((all) => all.filter((x) => x.id !== f.id))
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <h2 className="mb-5 mt-10 text-xl font-bold">
        {c('الصور الحالية في المشروع', 'Existing project images')}
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {categories.map((cat) => (
          <div className="panel bg-white" key={cat.id}>
            <Image
              src={cat.image}
              alt={c(cat.name.ar, cat.name.en)}
              width={300}
              height={220}
              className="mb-4 aspect-video w-full rounded-lg object-cover"
            />
            <p>{c(cat.name.ar, cat.name.en)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{cat.image}</p>
          </div>
        ))}
      </div>
    </>
  )
}
export function SettingsWorkspace() {
  const c = useCopy()
  const [message, setMessage] = useState('')
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{c('إعدادات الموقع', 'Site settings')}</h1>
          <p>
            {c(
              'واجهة إعداد البيانات العامة. لا تدخل مفاتيح أو أسرار هنا.',
              'Public information settings preview. Do not enter keys or secrets here.',
            )}
          </p>
        </div>
      </div>
      <form
        className="panel space-y-7 bg-white"
        onSubmit={(e) => {
          e.preventDefault()
          setMessage(
            c(
              'تمت مراجعة النموذج محليًا. لم تتغير بيانات الموقع أو أي إعداد خارجي.',
              'Form checked locally. Website data and external settings were not changed.',
            ),
          )
        }}
      >
        <h2 className="text-xl font-bold">
          {c('بيانات الشركة', 'Company details')}
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={c('الاسم عربي', 'Arabic name')}>
            <input
              className="control"
              defaultValue={company.name.ar}
              required
            />
          </Field>
          <Field label={c('الاسم إنجليزي', 'English name')}>
            <input
              className="control"
              defaultValue={company.name.en}
              required
            />
          </Field>
          <Field label={c('البريد العام', 'Public email')}>
            <input
              className="control"
              type="email"
              defaultValue={company.email}
              required
              dir="ltr"
            />
          </Field>
          <Field label={c('الموبايل العام', 'Public phone')}>
            <input
              className="control"
              type="tel"
              defaultValue={phones.mobile.display}
              dir="ltr"
            />
          </Field>
        </div>
        <h2 className="border-t pt-6 text-xl font-bold">
          {c('الفروع والعناوين', 'Locations')}
        </h2>
        {Object.entries(addresses).map(([key, a]) => (
          <div key={key} className="grid gap-5 md:grid-cols-2">
            <Field
              label={c(
                `${key === 'hq' ? 'الإدارة' : key === 'branch' ? 'الفرع' : 'المخازن'} — عربي`,
                `${key} — Arabic`,
              )}
            >
              <input className="control" defaultValue={a.ar} />
            </Field>
            <Field label={c('العنوان إنجليزي', 'English address')}>
              <input className="control" defaultValue={a.en} />
            </Field>
          </div>
        ))}
        <div className="grid gap-5 border-t pt-6 md:grid-cols-2">
          <Field
            label={c('العملة الافتراضية للعرض', 'Default quotation currency')}
          >
            <select className="control">
              <option>EGP</option>
            </select>
          </Field>
          <Field label={c('المنطقة الزمنية', 'Timezone')}>
            <input className="control" value="Africa/Cairo" readOnly />
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">
          {c(
            'لا توجد أي إعدادات Supabase أو تكاملات متصلة في هذه المرحلة.',
            'No Supabase settings or integrations are connected at this stage.',
          )}
        </p>
        <button className="btn-primary">
          {c('مراجعة الإعدادات التجريبية', 'Review sample settings')}
        </button>
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      </form>
    </>
  )
}
export { resourceConfigs }
