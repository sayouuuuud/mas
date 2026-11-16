import { brands, categories, sectors } from '@/lib/demo-data'
export type FieldDef = {
  key: string
  ar: string
  en: string
  type?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'email'
    | 'url'
    | 'number'
    | 'date'
    | 'tel'
    | 'number'
    | 'url'
    | 'tel'
    | 'date'
  options?: string[]
  required?: boolean
  min?: number
  max?: number
}
export type ResourceRow = { id: string; [key: string]: string }
export type ResourceConfig = {
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
export const resourceConfigs: Record<string, ResourceConfig> = {
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
      image: c.image,
      description: c.description.ar,
      descriptionEn: c.description.en,
      parent: '',
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
      logo: b.logo || '',
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

const statusField: FieldDef = {
  key: 'status',
  ar: 'الحالة',
  en: 'Status',
  type: 'select',
  options: ['draft', 'published', 'archived'],
}
const seoFields: FieldDef[] = [
  { key: 'seoTitleAr', ar: 'عنوان البحث عربي', en: 'Arabic SEO title' },
  { key: 'seoTitleEn', ar: 'عنوان البحث إنجليزي', en: 'English SEO title' },
  {
    key: 'seoDescriptionAr',
    ar: 'وصف البحث عربي',
    en: 'Arabic SEO description',
    type: 'textarea',
  },
  {
    key: 'seoDescriptionEn',
    ar: 'وصف البحث إنجليزي',
    en: 'English SEO description',
    type: 'textarea',
  },
  {
    key: 'order',
    ar: 'ترتيب الظهور',
    en: 'Display order',
    type: 'number',
    min: 0,
  },
  statusField,
]
for (const section of ['categories', 'brands', 'sectors'])
  resourceConfigs[section].fields.push(...seoFields)
resourceConfigs.categories.fields.push({
  key: 'image',
  ar: 'صورة المجموعة',
  en: 'Category image',
})
resourceConfigs.brands.fields.push({
  key: 'logo',
  ar: 'رابط الشعار',
  en: 'Logo path',
})
resourceConfigs.brands.fields.find((f) => f.key === 'website')!.type = 'url'
resourceConfigs.sectors.fields.push({
  key: 'image',
  ar: 'صورة القطاع',
  en: 'Sector image',
})
resourceConfigs.attributes.fields.push(
  {
    key: 'scope',
    ar: 'مستوى الخاصية',
    en: 'Attribute scope',
    type: 'select',
    options: ['product', 'variant'],
  },
  {
    key: 'category',
    ar: 'التصنيف المرتبط',
    en: 'Category',
    type: 'select',
    options: categories.map((c) => c.id),
  },
  {
    key: 'required',
    ar: 'إلزامية للنشر',
    en: 'Required for publishing',
    type: 'select',
    options: ['no', 'yes'],
  },
  {
    key: 'filterable',
    ar: 'تظهر في الفلاتر',
    en: 'Show in filters',
    type: 'select',
    options: ['yes', 'no'],
  },
)
resourceConfigs.customers.fields.push(
  { key: 'phone', ar: 'رقم الهاتف التجريبي', en: 'Sample phone', type: 'tel' },
  {
    key: 'notes',
    ar: 'ملاحظات داخلية',
    en: 'Internal notes',
    type: 'textarea',
  },
)
resourceConfigs.inquiries.fields.push(
  { key: 'email', ar: 'البريد التجريبي', en: 'Sample email', type: 'email' },
  { key: 'owner', ar: 'مسؤول المتابعة', en: 'Assigned owner' },
  {
    key: 'followUpAt',
    ar: 'موعد المتابعة',
    en: 'Follow-up date',
    type: 'date',
  },
)
resourceConfigs.content.fields.push(
  { key: 'ctaUrl', ar: 'وجهة زر الإجراء', en: 'CTA destination' },
  { key: 'image', ar: 'صورة القسم', en: 'Section image' },
  ...seoFields,
)
resourceConfigs.content.rows.push(
  {
    id: 'home-features',
    nameAr: 'مزايا الشركة',
    nameEn: 'Company features',
    bodyAr: 'دعم فني متخصص وتوريد موثوق.',
    bodyEn: 'Specialist support and dependable supply.',
  },
  {
    id: 'navigation',
    nameAr: 'قائمة التنقل',
    nameEn: 'Navigation',
    bodyAr: 'المنتجات، العلامات، القطاعات، عن الشركة، التواصل.',
    bodyEn: 'Products, brands, sectors, about and contact.',
  },
  {
    id: 'footer',
    nameAr: 'تذييل الموقع',
    nameEn: 'Footer',
    bodyAr: 'إم إيه إس للتجارة الهندسية.',
    bodyEn: 'M.A.S Engineering For Trade.',
  },
)
resourceConfigs.units = {
  ar: 'وحدات البيع والقياس',
  en: 'Sales & measurement units',
  description: [
    'تعريف الوحدات ودقة الكمية بالمعاينة المحلية.',
    'Configure units and quantity precision in the local preview.',
  ],
  fields: [
    { key: 'nameAr', ar: 'الاسم عربي', en: 'Arabic name', required: true },
    { key: 'nameEn', ar: 'الاسم إنجليزي', en: 'English name', required: true },
    { key: 'code', ar: 'الكود', en: 'Code', required: true },
    {
      key: 'precision',
      ar: 'المنازل العشرية',
      en: 'Decimal places',
      type: 'number',
      min: 0,
      max: 3,
    },
    statusField,
  ],
  rows: [
    {
      id: 'pack',
      nameAr: 'عبوة',
      nameEn: 'pack',
      code: 'pack',
      precision: '0',
    },
    {
      id: 'piece',
      nameAr: 'قطعة',
      nameEn: 'piece',
      code: 'piece',
      precision: '0',
    },
    { id: 'kg', nameAr: 'كجم', nameEn: 'kg', code: 'kg', precision: '3' },
    {
      id: 'liter',
      nameAr: 'لتر',
      nameEn: 'liter',
      code: 'liter',
      precision: '3',
    },
  ],
}
resourceConfigs.navigation = {
  ar: 'قوائم التنقل',
  en: 'Navigation',
  description: [
    'روابط الهيدر والفوتر محليًا.',
    'Local header and footer links.',
  ],
  fields: [
    { key: 'nameAr', ar: 'العنوان عربي', en: 'Arabic label', required: true },
    {
      key: 'nameEn',
      ar: 'العنوان إنجليزي',
      en: 'English label',
      required: true,
    },
    {
      key: 'href',
      ar: 'مسار الصفحة الداخلي',
      en: 'Internal page path',
      required: true,
    },
    {
      key: 'area',
      ar: 'موضع الظهور',
      en: 'Placement',
      type: 'select',
      options: ['header', 'footer'],
    },
    { key: 'order', ar: 'الترتيب', en: 'Order', type: 'number', min: 0 },
    statusField,
  ],
  rows: [
    ['products', 'المنتجات', 'Products'],
    ['brands', 'العلامات التجارية', 'Brands'],
    ['sectors', 'القطاعات', 'Sectors'],
    ['about', 'عن الشركة', 'About'],
    ['contact', 'تواصل معنا', 'Contact'],
  ].flatMap(([id, nameAr, nameEn], index) =>
    ['header', 'footer'].map((area) => ({
      id: `${area}-${id}`,
      nameAr,
      nameEn,
      href: `/${id}`,
      area,
      order: String(index),
      status: 'published',
    })),
  ),
}

for (const config of Object.values(resourceConfigs)) {
  const seen = new Set<string>()
  config.fields = config.fields.filter((field) => {
    if (seen.has(field.key)) return false
    seen.add(field.key)
    return true
  })
}
