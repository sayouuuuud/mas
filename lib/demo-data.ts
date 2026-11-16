import { allBrands, type Localized } from '@/lib/site'

export const bi = (ar: string, en: string): Localized => ({ ar, en })
export type CategoryKey = 'oils' | 'grease' | 'bearings'
export const categories = [
  {
    id: 'oils',
    name: bi('الزيوت', 'Oils'),
    description: bi(
      'للمحركات والهيدروليك وخطوط الإنتاج.',
      'For engines, hydraulics and production lines.',
    ),
    image: '/images/product-oils.png',
  },
  {
    id: 'grease',
    name: bi('الشحوم', 'Greases'),
    description: bi(
      'للتشحيم والحماية في ظروف التشغيل المختلفة.',
      'Lubrication and protection for demanding conditions.',
    ),
    image: '/images/product-grease.png',
  },
  {
    id: 'bearings',
    name: bi('رمان البلي', 'Bearings'),
    description: bi(
      'مقاسات وأنواع لتطبيقات الحركة الصناعية.',
      'Sizes and types for industrial motion.',
    ),
    image: '/images/product-bearings.png',
  },
] as const
export const brands = allBrands.map((brand) => ({
  ...brand,
  id: brand.name.en.toLowerCase().replaceAll(' ', '-'),
}))
export const sectors = [
  {
    id: 'factories',
    name: bi('المصانع', 'Factories'),
    description: bi(
      'دعم تشغيل خطوط الإنتاج والمعدات الصناعية.',
      'Supporting production lines and industrial machinery.',
    ),
  },
  {
    id: 'fleets',
    name: bi('النقل والأساطيل', 'Transport & fleets'),
    description: bi(
      'حلول توريد لاحتياجات أساطيل النقل.',
      'Supply solutions for transport fleets.',
    ),
  },
  {
    id: 'service',
    name: bi('مراكز خدمة السيارات', 'Service centers'),
    description: bi(
      'منتجات لصيانة المحركات وخدمات السيارات.',
      'Products for engine maintenance and vehicle servicing.',
    ),
  },
  {
    id: 'construction',
    name: bi('المعدات الثقيلة', 'Heavy equipment'),
    description: bi(
      'لتطبيقات المقاولات والمعدات الثقيلة.',
      'For contracting and heavy equipment applications.',
    ),
  },
  {
    id: 'agriculture',
    name: bi('الزراعة', 'Agriculture'),
    description: bi(
      'احتياجات الجرارات والمعدات الزراعية.',
      'For tractors and agricultural machinery.',
    ),
  },
  {
    id: 'power',
    name: bi('محطات الكهرباء', 'Power stations'),
    description: bi(
      'لتطبيقات الطاقة والمعدات الدوارة.',
      'For power generation and rotating equipment.',
    ),
  },
]
export type DemoVariant = {
  id: string
  label: Localized
  sku: string
  pack: string
  availability: 'on_request' | 'unavailable'
  unit: Localized
}
export type DemoProduct = {
  id: string
  slug: string
  name: Localized
  summary: Localized
  category: CategoryKey
  brand: string
  sectorIds: string[]
  image: string
  status: 'published' | 'draft' | 'archived'
  createdAt?: string
  featured: boolean
  description?: Localized
  applications?: Localized
  benefits?: Localized
  seoTitle?: Localized
  seoDescription?: Localized
  relatedIds?: string[]
  mediaIds?: string[]
  mainMediaId?: string
  sourceNote?: string
  specs: { label: Localized; value: string }[]
  variants: DemoVariant[]
}
const rows: [string, string, string, CategoryKey, string, string, string[]][] =
  [
    [
      'engine-oil',
      'زيت محركات متعدد الدرجات',
      'Multigrade engine oil',
      'oils',
      'ola-energy',
      '15W-40',
      ['fleets', 'service'],
    ],
    [
      'hydraulic-oil',
      'زيت هيدروليك صناعي',
      'Industrial hydraulic oil',
      'oils',
      'petronas',
      'ISO VG 46',
      ['factories', 'construction'],
    ],
    [
      'gear-oil',
      'زيت تروس صناعي',
      'Industrial gear oil',
      'oils',
      'eni',
      'ISO VG 220',
      ['factories', 'agriculture'],
    ],
    [
      'transformer-oil',
      'زيت محولات',
      'Transformer oil',
      'oils',
      'misr-petroleum',
      '—',
      ['power'],
    ],
    [
      'lithium-grease',
      'شحم ليثيوم متعدد الاستخدام',
      'Multipurpose lithium grease',
      'grease',
      'bp',
      'NLGI 2',
      ['service', 'agriculture'],
    ],
    [
      'ep-grease',
      'شحم للأحمال الثقيلة',
      'Heavy-duty EP grease',
      'grease',
      'adnoc',
      'NLGI 2',
      ['construction', 'factories'],
    ],
    [
      'heat-grease',
      'شحم لتطبيقات الحرارة',
      'High-temperature grease',
      'grease',
      'ola-energy',
      'NLGI 2',
      ['factories', 'power'],
    ],
    [
      'ball-bearing',
      'رمان بلي كروي',
      'Deep groove ball bearing',
      'bearings',
      'skf',
      '25 × 52 × 15 mm',
      ['factories', 'service'],
    ],
    [
      'roller-bearing',
      'رمان بلي أسطواني',
      'Cylindrical roller bearing',
      'bearings',
      'nsk',
      '30 × 62 × 16 mm',
      ['factories', 'power'],
    ],
    [
      'tapered-bearing',
      'رمان بلي مخروطي',
      'Tapered roller bearing',
      'bearings',
      'fag',
      '35 × 72 × 18 mm',
      ['fleets', 'agriculture'],
    ],
    [
      'needle-bearing',
      'رمان بلي إبري',
      'Needle roller bearing',
      'bearings',
      'ina',
      '20 × 26 × 16 mm',
      ['factories'],
    ],
    [
      'fleet-oil',
      'زيت لمحركات الأساطيل',
      'Fleet engine oil',
      'oils',
      'pennzoil',
      '10W-40',
      ['fleets', 'construction'],
    ],
  ]
export const initialProducts: DemoProduct[] = rows.map(
  ([slug, ar, en, category, brand, spec, sectorIds], i) => ({
    id: slug,
    slug,
    name: bi(ar, en),
    category,
    brand,
    sectorIds,
    summary: bi(
      'نموذج منتج لتوضيح بيانات الكتالوج واختيار المواصفات والعبوة المناسبة.',
      'A sample catalog entry to demonstrate specifications and pack selection.',
    ),
    description: bi(
      'بيانات توضيحية لمعاينة صفحة المنتج. القيم الفنية والاعتمادات تحتاج مراجعة الشركة قبل الاستخدام التجاري.',
      'Illustrative product detail content. Technical values and approvals require company review before commercial use.',
    ),
    applications: bi(
      'تُراجع ملاءمة المنتج مع الفريق الفني وفق متطلبات المعدة.',
      'Confirm suitability with the technical team against equipment requirements.',
    ),
    benefits: bi(
      'عرض منظم للمواصفات والعبوات وتجهيز استفسار فني واضح.',
      'Organized specifications and pack options for a clear technical inquiry.',
    ),
    image: categories.find((c) => c.id === category)!.image,
    status: 'published',
    createdAt: new Date(Date.UTC(2026, 10, 1 + i)).toISOString(),
    featured: i < 3,
    specs: [
      {
        label: bi(
          category === 'bearings' ? 'الأبعاد التجريبية' : 'الدرجة التجريبية',
          category === 'bearings' ? 'Sample dimensions' : 'Sample grade',
        ),
        value: spec,
      },
    ],
    variants: (category === 'bearings'
      ? ['1']
      : category === 'grease'
        ? ['18', '180']
        : ['20', '208']
    ).map((pack, n) => ({
      id: `${slug}-${n}`,
      sku: `DEMO-${String(i + 1).padStart(3, '0')}-${n + 1}`,
      pack,
      label:
        category === 'bearings'
          ? bi('قطعة واحدة', 'Single piece')
          : category === 'grease'
            ? bi(`عبوة ${pack} كجم`, `${pack} kg pack`)
            : bi(`عبوة ${pack} لتر`, `${pack} L pack`),
      availability: i === 10 ? 'unavailable' : 'on_request',
      unit: category === 'bearings' ? bi('قطعة', 'piece') : bi('عبوة', 'pack'),
    })),
  }),
)

export type DemoRequest = {
  id: string
  company: string
  name: string
  status: string
  owner: string
  date: string
  priority: string
  notes: string[]
  phone?: string
  email?: string
  followUpAt?: string
  closeReason?: string
  customerId?: string
  events?: { id: string; at: string; action: string; text: string }[]
  items: {
    snapshot?: {
      name: Localized
      sku: string
      label: Localized
      unit: Localized
    }
    variantId?: string
    description?: string
    quantity: number
    unit?: string
  }[]
}
export const initialRequests: DemoRequest[] = [
  {
    id: 'DEMO-RFQ-001',
    company: 'شركة صناعية تجريبية',
    name: 'عميل تجريبي ١',
    status: 'new',
    owner: '',
    date: '2026-11-16',
    priority: 'normal',
    notes: [],
    items: [{ variantId: 'hydraulic-oil-0', quantity: 5 }],
  },
  {
    id: 'DEMO-RFQ-002',
    company: 'أسطول نقل تجريبي',
    name: 'عميل تجريبي ٢',
    status: 'in_progress',
    owner: 'موظف المبيعات',
    date: '2026-11-15',
    priority: 'high',
    notes: ['ملاحظة تجريبية: مطلوب تأكيد العبوة المناسبة.'],
    items: [{ variantId: 'engine-oil-0', quantity: 10 }],
  },
  {
    id: 'DEMO-RFQ-003',
    company: 'ورشة صيانة تجريبية',
    name: 'عميل تجريبي ٣',
    status: 'quoted',
    owner: 'موظف المبيعات',
    date: '2026-11-14',
    priority: 'normal',
    notes: [],
    items: [{ variantId: 'ball-bearing-0', quantity: 20 }],
  },
]
export const requestStatuses = [
  ['new', 'جديد', 'New'],
  ['assigned', 'تم الإسناد', 'Assigned'],
  ['in_progress', 'قيد المتابعة', 'In progress'],
  ['awaiting_customer', 'بانتظار العميل', 'Awaiting customer'],
  ['quoted', 'تم تجهيز عرض', 'Quotation prepared'],
  ['won', 'مقبول تجريبيًا', 'Accepted (demo)'],
  ['lost', 'مغلق', 'Closed'],
  ['cancelled', 'ملغي', 'Cancelled'],
] as const
