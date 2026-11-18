import { z } from 'zod'
import { phoneE164 } from '../frontend-model'

export const uuid = z.uuid()
export const locale = z.enum(['ar', 'en'])
export const localized = z
  .object({
    ar: z.string().trim().max(10000),
    en: z.string().trim().max(10000),
  })
  .strict()
export const name = z
  .object({
    ar: z.string().trim().min(2).max(160),
    en: z.string().trim().min(2).max(160),
  })
  .strict()
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(180)
export const status = z.enum(['draft', 'published', 'archived'])
// Single administration role: Admin (stored internally as Owner for RPC/RLS compatibility).
export const role = z.enum(['Admin', 'Owner'])
export type Role = z.infer<typeof role>
export type Actor = {
  id: string
  roles: Role[]
  active: boolean
  aal: 'aal1' | 'aal2'
  mfaEnabled?: boolean
}
export const quantity = z
  .number()
  .finite()
  .min(0.001)
  .max(99999)
  .refine(
    (v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 0.000001,
    'Maximum three decimal places.',
  )
export const phone = z
  .string()
  .max(30)
  .regex(/^[+0-9٠-٩\s()-]+$/)
  .transform(phoneE164)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/))
const httpsUrl = z
  .url()
  .refine((v) => new URL(v).protocol === 'https:', 'Use HTTPS.')
const optionalUrl = httpsUrl.optional().nullable()
export const spec = z
  .object({
    attributeId: uuid,
    value: z.union([
      z.string().trim().max(1000),
      z.number().finite(),
      z.boolean(),
      z.array(uuid).max(100),
    ]),
  })
  .strict()
export const variantInput = z
  .object({
    id: uuid.optional(),
    label: name,
    sku: z.string().trim().max(120).default(''),
    manufacturerPartNumber: z.string().trim().max(160).optional(),
    unitId: uuid.nullable().default(null),
    minQuantity: quantity.default(1),
    quantityStep: quantity.default(1),
    packQuantity: z.number().positive().max(1000000).nullable().optional(),
    packUnitId: uuid.nullable().optional(),
    availability: z
      .enum(['available', 'on_request', 'unavailable'])
      .default('on_request'),
    active: z.boolean().default(true),
    order: z.number().int().min(0).max(10000).default(0),
    specifications: z.array(spec).max(100).default([]),
    mediaIds: z.array(uuid).max(20).default([]),
  })
  .strict()
  .refine((v) => Boolean(v.packQuantity) === Boolean(v.packUnitId), {
    message: 'Pack quantity and unit are required together.',
  })
export const productInput = z
  .object({
    name,
    slug,
    summary: localized.default({ ar: '', en: '' }),
    description: localized.default({ ar: '', en: '' }),
    applications: localized.optional(),
    benefits: localized.optional(),
    family: z.enum(['oils', 'grease', 'bearings']),
    categoryId: uuid.nullable().default(null),
    brandId: uuid.nullable().default(null),
    status: status.default('draft'),
    featured: z.boolean().default(false),
    modelCode: z.string().max(120).optional(),
    sectorIds: z.array(uuid).max(50).default([]),
    variants: z.array(variantInput).max(100).default([]),
    specifications: z.array(spec).max(100).default([]),
    mediaIds: z.array(uuid).max(40).default([]),
    mainMediaId: uuid.nullable().optional(),
    relatedIds: z.array(uuid).max(30).default([]),
    seoTitle: localized.optional(),
    seoDescription: localized.optional(),
    sourceNote: z.string().trim().max(2000).optional(),
  })
  .strict()
export type ProductInput = z.infer<typeof productInput>
export type Product = ProductInput & {
  id: string
  version: number
  createdAt: string
  publishedAt?: string
}
export const referenceInput = z
  .object({
    name,
    slug: slug.optional(),
    description: localized.optional(),
    status: status.default('draft'),
    order: z.number().int().min(0).max(10000).default(0),
    featured: z.boolean().default(false),
    group: z.enum(['oils', 'bearings', 'other']).optional(),
    parentId: uuid.nullable().optional(),
    family: z.enum(['oils', 'grease', 'bearings']).optional(),
    logoMediaId: uuid.nullable().optional(),
    imageMediaId: uuid.nullable().optional(),
    website: optionalUrl,
    seoTitle: localized.optional(),
    seoDescription: localized.optional(),
  })
  .strict()
export const unitInput = z
  .object({
    name,
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9_]{0,39}$/),
    usage: z.enum(['sale', 'measure', 'both']).default('both'),
    precision: z.number().int().min(0).max(3).default(0),
    active: z.boolean().default(true),
  })
  .strict()
export const attributeInput = z
  .object({
    name,
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9_-]{0,79}$/),
    type: z.enum(['text', 'number', 'boolean', 'option', 'multi_option']),
    unitId: uuid.nullable().optional(),
    scope: z.enum(['product', 'variant']),
    filterable: z.boolean().default(false),
    options: z
      .array(
        z.object({ id: uuid.optional(), code: slug, label: name }).strict(),
      )
      .max(100)
      .default([]),
    categories: z
      .array(
        z
          .object({
            categoryId: uuid,
            required: z.boolean(),
            min: z.number().optional(),
            max: z.number().optional(),
            order: z.number().int().min(0).default(0),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .refine(
    (a) => !['option', 'multi_option'].includes(a.type) || a.options.length > 0,
    'Options are required.',
  )
export const customer = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone,
    company: z.string().trim().max(160).optional(),
    email: z.email().max(254).optional(),
    city: z.string().trim().max(120).optional(),
    governorate: z.string().trim().max(120).optional(),
    preferredChannel: z.enum(['phone', 'whatsapp', 'email']).default('phone'),
  })
  .strict()
  .refine((c) => c.preferredChannel !== 'email' || Boolean(c.email), {
    message: 'Email is required for email contact.',
    path: ['email'],
  })
const catalogItem = z
  .object({
    variantId: uuid,
    quantity,
    unitCode: z.string().max(40),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
const freeItem = z
  .object({
    description: z.string().trim().min(3).max(500),
    quantity,
    unitCode: z.string().max(40),
    categoryId: uuid.optional(),
    brandId: uuid.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
export const requestItem = z.union([catalogItem, freeItem])
export const consent = z
  .object({
    accepted: z.literal(true),
    policyVersion: z.string().trim().min(1).max(40),
  })
  .strict()
export const source = z
  .object({
    page: z
      .string()
      .regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/)
      .max(250),
    utmSource: z.string().max(100).optional(),
    utmMedium: z.string().max(100).optional(),
    utmCampaign: z.string().max(100).optional(),
  })
  .strict()
  .refine(
    (v) => !/[?@]/.test(v.page),
    'Do not include query strings or personal information.',
  )
export const requestInput = z
  .object({
    locale,
    customer,
    items: z.array(requestItem).min(1).max(30),
    notes: z.string().trim().max(2000).optional(),
    privacy: consent,
    source,
  })
  .strict()
export const inquiryInput = z
  .object({
    locale,
    customer,
    message: z.string().trim().min(3).max(2000),
    privacy: consent,
    source,
  })
  .strict()
export type RequestInput = z.infer<typeof requestInput>
export type InquiryInput = z.infer<typeof inquiryInput>
export const requestStatus = z.enum([
  'new',
  'assigned',
  'in_progress',
  'awaiting_customer',
  'quoted',
  'won',
  'lost',
  'cancelled',
])
export type RequestStatus = z.infer<typeof requestStatus>
export type Entity = { id: string; version: number; [key: string]: unknown }
export type SalesRequest = Entity & {
  status: RequestStatus
  assignedTo: string | null
  customerSnapshot: z.infer<typeof customer>
  items: Record<string, unknown>[]
}
export const transitionInput = z
  .object({
    version: z.number().int().positive(),
    status: z.string().max(40),
    reason: z.string().trim().max(1000).default(''),
    channel: z.enum(['phone', 'whatsapp', 'email', 'in_person']).optional(),
  })
  .strict()
export const assignmentInput = z
  .object({ version: z.number().int().positive(), assignedTo: uuid.nullable() })
  .strict()
export const followUpInput = z
  .object({
    version: z.number().int().positive(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    followUpAt: z.iso.datetime({ offset: true }).nullable().optional(),
    contactId: uuid.nullable().optional(),
  })
  .strict()
const money = z.string().regex(/^\d{1,9}(\.\d{1,4})?$/)
export const quotationInput = z
  .object({
    locale,
    currency: z.enum(['EGP', 'USD', 'EUR']),
    validUntil: z.iso.date(),
    leadTime: z.string().trim().max(500),
    terms: z.string().trim().max(5000),
    lines: z
      .array(
        z
          .object({
            requestItemId: uuid.nullable().optional(),
            variantId: uuid.nullable().optional(),
            description: z.string().trim().min(2).max(1000),
            descriptionLocalized: localized.optional(),
            sku: z.string().max(120).default(''),
            unit: z.string().max(40),
            quantity,
            price: money,
            discount: z
              .string()
              .regex(/^\d{1,12}(\.\d{1,2})?$/)
              .default('0'),
            tax: z
              .string()
              .regex(/^\d{1,3}(\.\d{1,2})?$/)
              .default('0'),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
export type QuotationInput = z.infer<typeof quotationInput>
export type Quotation = Entity &
  QuotationInput & {
    requestId: string
    status: string
    revision: number
    number?: string
    issuedAt?: string
    pdfPath?: string
    pdfStatus?: 'none' | 'processing' | 'ready' | 'failed'
    pdfError?: string | null
    totals?: unknown
  }
export const contactInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone,
    email: z.email().max(254).nullable().optional(),
    organizationId: uuid.nullable().optional(),
    preferredChannel: z.enum(['phone', 'whatsapp', 'email']),
    notes: z.string().trim().max(2000).optional(),
    active: z.boolean().default(true),
  })
  .strict()
export const organizationInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    city: z.string().trim().max(120).optional(),
    governorate: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
export const contentCard = z
  .object({
    id: z.string().max(80).optional(),
    title: localized,
    body: localized,
    imageMediaId: uuid.nullable().optional(),
    href: z
      .string()
      .max(300)
      .regex(/^\/(?!\/)[a-zA-Z0-9/_?=&%#-]*$/)
      .optional(),
    points: z.array(localized).max(20).default([]),
  })
  .strict()
export const contentLayout = z
  .object({
    imageMediaId: uuid.nullable().optional(),
    cards: z.array(contentCard).max(50).default([]),
    points: z.array(localized).max(20).default([]),
    eyebrow: localized.optional(),
  })
  .strict()
export const contentInput = z
  .object({
    key: slug,
    layout: contentLayout.optional(),
    name,
    body: localized,
    ctaLabel: localized.optional(),
    ctaPath: z
      .string()
      .regex(/^\/(?!\/)[a-zA-Z0-9/_#-]*$/)
      .optional(),
    mediaIds: z.array(uuid).max(20).default([]),
    status: status.default('draft'),
    policyVersion: z.string().max(40).optional(),
    seoTitle: localized.optional(),
    seoDescription: localized.optional(),
  })
  .strict()
export const navigationInput = z
  .object({
    name,
    path: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_#-]*$/),
    area: z.enum(['header', 'footer']),
    order: z.number().int().min(0).max(10000),
    active: z.boolean(),
  })
  .strict()
export const locationInput = z
  .object({
    name,
    kind: z.enum(['hq', 'branch', 'warehouse']),
    address: localized,
    phone: phone.optional(),
    mapUrl: optionalUrl,
    hours: localized.optional(),
    published: z.boolean().default(false),
  })
  .strict()
export const settingsInput = z
  .object({
    name,
    email: z.email(),
    phone,
    whatsapp: z
      .union([phone, z.literal(''), z.null()])
      .optional()
      .transform((v) => v || null),
    logoMediaId: uuid.nullable().optional(),
    officePhone: phone.nullable().optional(),
    fax: phone.nullable().optional(),
    support: localized.optional(),
    currency: z.enum(['EGP', 'USD', 'EUR']),
    timezone: z.literal('Africa/Cairo'),
    responseTarget: localized.optional(),
  })
  .strict()
export const mediaInput = z
  .object({
    name: z.string().trim().min(1).max(180),
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    size: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024),
    alt: localized,
    visibility: z.enum(['public', 'private']).default('public'),
    kind: z.enum(['image', 'TDS', 'SDS', 'catalog']),
  })
  .strict()
  .refine(
    (m) => m.mime === 'application/pdf' || m.size <= 5 * 1024 * 1024,
    'Images must not exceed 5MB.',
  )

// Keep Owner internally in PostgreSQL profiles for RPC/RLS compatibility while
// presenting and validating a single Admin role across API and UI.
const adminRolesInput = z
  .array(role)
  .min(1)
  .max(2)
  .default(['Admin'])
  .transform((): Role[] => ['Owner'])

export const invitationInput = z
  .object({
    email: z.email().max(254),
    displayName: z.string().trim().min(2).max(120),
    roles: adminRolesInput,
  })
  .strict()
export const teamUpdate = z
  .object({
    version: z.number().int().positive(),
    displayName: z.string().trim().min(2).max(120),
    active: z.boolean(),
    roles: adminRolesInput,
  })
  .strict()
export const resourceSchemas = {
  categories: referenceInput,
  brands: referenceInput.omit({ parentId: true, family: true }),
  sectors: referenceInput.omit({
    parentId: true,
    family: true,
    logoMediaId: true,
    website: true,
  }),
  units: unitInput,
  attributes: attributeInput,
  contacts: contactInput,
  organizations: organizationInput,
  content: contentInput,
  navigation: navigationInput,
  locations: locationInput,
  settings: settingsInput,
} as const
export type Resource =
  | keyof typeof resourceSchemas
  | 'products'
  | 'quote_requests'
  | 'inquiries'
  | 'quotations'
  | 'media'
  | 'profiles'
  | 'audit_logs'
  | 'request_events'
  | 'quotation_events'
  | 'jobs'
export const listing = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(24),
    locale: locale.default('ar'),
    q: z.string().trim().max(100).default(''),
    status: z.string().max(40).optional(),
    category: z.string().max(800).optional(),
    brand: z.string().max(800).optional(),
    sector: z.string().max(800).optional(),
    availability: z.enum(['available', 'on_request', 'unavailable']).optional(),
    pack: z.string().max(40).optional(),
    sort: z.enum(['featured', 'name', 'latest']).default('featured'),
    assignedTo: uuid.optional(),
    contactId: uuid.optional(),
    organizationId: uuid.optional(),
    family: z.enum(['oils', 'grease', 'bearings']).optional(),
    kind: z.enum(['image', 'TDS', 'SDS', 'catalog']).optional(),
    usage: z.enum(['sale', 'measure', 'both']).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    requestId: uuid.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    attribute: uuid.optional(),
    value: z.string().max(120).optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Invalid date range.')
export type ListInput = z.infer<typeof listing>
