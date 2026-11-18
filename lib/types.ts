export type LocalizedText = {
  ar: string
  en: string
}

export type PageMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type ProductFamily = 'oils' | 'grease' | 'bearings'
export type PublicationStatus = 'draft' | 'published' | 'archived'
export type AvailabilityStatus = 'available' | 'on_request' | 'unavailable'

export type MediaItem = {
  id: string
  version?: number
  name: string
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' | string
  size: number
  alt: LocalizedText
  kind: 'image' | 'TDS' | 'SDS' | 'catalog'
  visibility?: 'public' | 'private'
  status?: 'uploading' | 'quarantined' | 'ready' | 'rejected' | 'archived'
  path?: string
  url?: string
  scanState?: string
  scanAttempts?: number
  scanError?: string | null
  createdAt?: string
  updatedAt?: string
}

export type UnitRecord = {
  id: string
  version?: number
  name: LocalizedText
  code: string
  precision: number
  usage?: 'sale' | 'measure' | 'both'
  active?: boolean
}

export type AttributeOption = {
  id: string
  code: string
  label: LocalizedText
}

export type AttributeCategoryRule = {
  categoryId: string
  required: boolean
  min?: number
  max?: number
  order?: number
}

export type AttributeRecord = {
  id: string
  version?: number
  name: LocalizedText
  code: string
  type: 'text' | 'number' | 'boolean' | 'option' | 'multi_option'
  unitId?: string | null
  scope: 'product' | 'variant'
  filterable: boolean
  options: AttributeOption[]
  categories: AttributeCategoryRule[]
}

export type ProductSpec = {
  attributeId: string
  value: string | number | boolean | string[]
}

export type ProductVariant = {
  id: string
  label: LocalizedText
  sku: string
  manufacturerPartNumber?: string
  unitId: string | null
  minQuantity: number
  quantityStep: number
  packQuantity?: number | null
  packUnitId?: string | null
  availability: AvailabilityStatus
  active?: boolean
  order?: number
  specifications?: ProductSpec[]
  mediaIds?: string[]
  media?: MediaItem[]
}

export type CatalogProduct = {
  id: string
  version?: number
  slug: string
  name: LocalizedText
  summary: LocalizedText
  description: LocalizedText
  applications?: LocalizedText
  benefits?: LocalizedText
  family: ProductFamily
  categoryId: string | null
  brandId: string | null
  status?: PublicationStatus
  featured?: boolean
  modelCode?: string
  sectorIds: string[]
  variants: ProductVariant[]
  specifications: ProductSpec[]
  mediaIds?: string[]
  mainMediaId?: string | null
  media?: MediaItem[]
  relatedIds?: string[]
  seoTitle?: LocalizedText
  seoDescription?: LocalizedText
  sourceNote?: string
  createdAt?: string
  publishedAt?: string
}

export type ReferenceRecord = {
  id: string
  version?: number
  name: LocalizedText
  slug?: string
  description?: LocalizedText
  status?: PublicationStatus
  order?: number
  productCount?: number
  featured?: boolean
  group?: 'oils' | 'bearings' | 'other'
  parentId?: string | null
  family?: ProductFamily
  logoMediaId?: string | null
  imageMediaId?: string | null
  website?: string | null
  seoTitle?: LocalizedText
  seoDescription?: LocalizedText
  media?: MediaItem[]
}

export type CatalogFacets = {
  total: number
  categories: Array<ReferenceRecord & { count: number }>
  brands: Array<ReferenceRecord & { count: number }>
  sectors: Array<ReferenceRecord & { count: number }>
  availability: Array<{ value: AvailabilityStatus; count: number }>
  packs: Array<{ value: string; count: number }>
  attributes: Array<
    AttributeRecord & { values: Array<{ value: unknown; count: number }> }
  >
}

export type CustomerSnapshot = {
  name: string
  phone: string
  company?: string
  email?: string
  city?: string
  governorate?: string
  preferredChannel?: 'phone' | 'whatsapp' | 'email'
}

export type SalesEvent = {
  id: string
  kind: string
  detail?: { body?: string; from?: string; to?: string; [key: string]: unknown }
  actorId?: string | null
  createdAt: string
}

export type SalesRequestItem = {
  id: string
  variantId?: string | null
  unitId: string
  quantity: number
  snapshot?: {
    name?: LocalizedText
    sku?: string
    label?: LocalizedText
    unit?: LocalizedText
    unitCode?: string
    description?: string
    categoryName?: LocalizedText
    brandName?: LocalizedText
  }
  notes?: string | null
}

export type QuoteRequestStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_customer'
  | 'quoted'
  | 'won'
  | 'lost'
  | 'cancelled'

export type QuoteRequestRecord = {
  id: string
  version: number
  reference: string
  locale: 'ar' | 'en'
  status: QuoteRequestStatus
  assignedTo: string | null
  contactId?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  followUpAt?: string | null
  notes?: string | null
  source?: Record<string, unknown>
  privacy?: { policyVersion: string }
  sourceInquiryId?: string
  customerSnapshot: CustomerSnapshot
  itemCount?: number
  items?: SalesRequestItem[]
  events?: SalesEvent[]
  createdAt: string
  updatedAt?: string
}

export type InquiryStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'spam'

export type InquiryRecord = {
  id: string
  version: number
  reference: string
  locale: 'ar' | 'en'
  status: InquiryStatus
  assignedTo: string | null
  contactId?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  followUpAt?: string | null
  message: string
  convertedRequestId?: string | null
  customerSnapshot: CustomerSnapshot
  events?: SalesEvent[]
  createdAt: string
  updatedAt?: string
}

export type QuotationStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'superseded'

export type QuotationLineRecord = {
  requestItemId?: string | null
  variantId?: string | null
  descriptionLocalized?: LocalizedText
  description: string
  sku: string
  unit: string
  quantity: number
  price: string
  discount: string
  tax: string
}

export type QuotationRecord = {
  id: string
  version: number
  requestId: string
  seriesId?: string
  revision: number
  number?: string
  status: QuotationStatus
  locale: 'ar' | 'en'
  currency: 'EGP' | 'USD' | 'EUR'
  validUntil: string
  leadTime: string
  terms: string
  lines: QuotationLineRecord[]
  totals?: {
    net: number
    tax: number
    total: number
    lines?: Array<{ net: number; tax: number; total: number }>
  }
  customerSnapshot?: CustomerSnapshot
  companySnapshot?: Record<string, unknown>
  issuedAt?: string
  pdfPath?: string
  pdfStatus?: 'none' | 'processing' | 'ready' | 'failed'
  pdfError?: string | null
  pdfAttempts?: number
  delivery?: { channel: string; at: string; actorId: string }
  response?: { reason: string; at: string; actorId: string }
  events?: SalesEvent[]
  createdAt: string
  updatedAt?: string
}

export type ContactRecord = {
  id: string
  version: number
  name: string
  phone: string
  email?: string | null
  organizationId?: string | null
  preferredChannel: 'phone' | 'whatsapp' | 'email'
  notes?: string
  active: boolean
  createdAt?: string
}

export type OrganizationRecord = {
  id: string
  version: number
  name: string
  city?: string
  governorate?: string
  notes?: string
  createdAt?: string
}

export type ContentRecord = {
  id: string
  version?: number
  key: string
  name: LocalizedText
  layout?: {
    imageMediaId?: string | null
    cards: Array<{
      id?: string
      title: LocalizedText
      body: LocalizedText
      imageMediaId?: string | null
      href?: string
      points: LocalizedText[]
    }>
    points: LocalizedText[]
    eyebrow?: LocalizedText
  }
  body: LocalizedText
  ctaLabel?: LocalizedText
  ctaPath?: string
  mediaIds?: string[]
  media?: MediaItem[]
  status?: PublicationStatus
  policyVersion?: string
  seoTitle?: LocalizedText
  seoDescription?: LocalizedText
}

export type NavigationRecord = {
  id: string
  version?: number
  name: LocalizedText
  path: string
  area: 'header' | 'footer'
  order: number
  active?: boolean
}

export type LocationRecord = {
  id: string
  version?: number
  name: LocalizedText
  kind: 'hq' | 'branch' | 'warehouse'
  address: LocalizedText
  phone?: string
  mapUrl?: string | null
  hours?: LocalizedText
  published?: boolean
}

export type SettingsRecord = {
  logoMediaId?: string | null
  officePhone?: string | null
  fax?: string | null
  media?: MediaAssetRecord[]
  id: string
  version?: number
  name: LocalizedText
  email: string
  phone: string
  whatsapp: string
  support?: LocalizedText
  currency: 'EGP' | 'USD' | 'EUR'
  timezone: 'Africa/Cairo'
  responseTarget?: LocalizedText
}

export type TeamMemberRecord = {
  id: string
  version: number
  email?: string | null
  displayName: string
  active: boolean
  roles: Array<'Admin' | 'Owner'>
  createdAt?: string
  updatedAt?: string
}

export type AuditLogRecord = {
  actorName?: string | null
  entityName?: string | LocalizedText | null
  id: string
  actorId?: string | null
  resource: string
  entityId?: string | null
  action: string
  beforeVersion?: number | null
  afterVersion?: number | null
  detail?: { body?: string; from?: string; to?: string; [key: string]: unknown }
  createdAt: string
}

export type ReportsSummary = {
  requests: number
  inquiries: number
  quotations: number
  overdueFollowUps: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
}

export type AdminSession = {
  id: string
  role: 'Admin'
  roles: Array<'Admin' | 'Owner'>
  active: boolean
  aal: 'aal1' | 'aal2'
  mfaRequired?: boolean
  mfaEnabled?: boolean
  mediaScannerConfigured?: boolean
  mediaProcessingMode?: 'antivirus' | 'validation_only' | 'quarantine'
  jobsConfigured?: boolean
}

export type MfaFactor = {
  id: string
  type: string
  status: 'verified' | 'unverified'
  name?: string
}

export function familyFallbackImage(family?: ProductFamily): string {
  if (family === 'grease') return '/images/product-grease.png'
  if (family === 'bearings') return '/images/product-bearings.png'
  return '/images/product-oils.png'
}

export function resolveProductImage(product: {
  family?: ProductFamily
  mainMediaId?: string | null
  media?: MediaItem[]
}): string {
  const main = product.media?.find(
    (m) =>
      m.id === product.mainMediaId && m.url && m.mime?.startsWith('image/'),
  )
  if (main?.url) return main.url
  const firstImage = product.media?.find(
    (m) => m.url && m.mime?.startsWith('image/'),
  )
  if (firstImage?.url) return firstImage.url
  return familyFallbackImage(product.family)
}

export function resolveReferenceImage(
  ref: {
    family?: ProductFamily
    imageMediaId?: string | null
    logoMediaId?: string | null
    media?: MediaItem[]
  },
  kind: 'image' | 'logo' = 'image',
): string | undefined {
  const targetId = kind === 'logo' ? ref.logoMediaId : ref.imageMediaId
  const exact = ref.media?.find((m) => m.id === targetId && m.url)
  if (exact?.url) return exact.url
  const first = ref.media?.find((m) => m.url && m.mime?.startsWith('image/'))
  if (first?.url) return first.url
  return kind === 'image' ? familyFallbackImage(ref.family) : undefined
}

export function formatSpecValue(
  spec: ProductSpec,
  attribute: AttributeRecord | undefined,
  unit: UnitRecord | undefined,
  lang: 'ar' | 'en',
): { label: string; value: string } {
  const label = attribute?.name?.[lang] || spec.attributeId
  if (typeof spec.value === 'boolean') {
    return {
      label,
      value: spec.value
        ? lang === 'ar'
          ? 'نعم'
          : 'Yes'
        : lang === 'ar'
          ? 'لا'
          : 'No',
    }
  }
  if (Array.isArray(spec.value)) {
    const mapped = spec.value.map((optionId) => {
      const opt = attribute?.options?.find((o) => o.id === optionId)
      return opt ? opt.label[lang] : optionId
    })
    return { label, value: mapped.join('، ') }
  }
  if (attribute?.type === 'option') {
    const opt = attribute.options?.find((o) => o.id === String(spec.value))
    if (opt) return { label, value: opt.label[lang] }
  }
  const suffix = unit ? ` ${unit.name[lang]}` : ''
  return { label, value: `${spec.value}${suffix}` }
}

// Shared names used by the connected workspaces. These are the API records.
export type BrandRecord = ReferenceRecord
export type CategoryRecord = ReferenceRecord
export type SectorRecord = ReferenceRecord
export type MediaAssetRecord = MediaItem
export type ProductDetailRecord = CatalogProduct & { version: number }
export type PublishStatus = PublicationStatus
export type AdminQuoteRequest = QuoteRequestRecord
export type AdminInquiry = InquiryRecord
export type AdminTeamMember = TeamMemberRecord
export type CompanySettingsRecord = SettingsRecord
export type ContentBlockRecord = ContentRecord
export type CustomerContact = ContactRecord

// Editor-only fields; serialized to ProductSpec before submitting.
export type SpecificationInput = {
  attributeId: string
  valueText?: string | null
  valueNumber?: number | null
  valueBoolean?: boolean | null
  optionId?: string | null
  optionIds?: string[]
}
