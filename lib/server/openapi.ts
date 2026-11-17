// API inventory is served without requiring a database connection.
const json = (schema: Record<string, unknown>) => ({
  'application/json': { schema },
})
const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
}
const body = (schema: Record<string, unknown>) => ({
  required: true,
  content: json(schema),
})
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const operation = (
  summary: string,
  secured = false,
  schema?: Record<string, unknown>,
) => ({
  summary,
  ...(secured ? { security: [{ sessionCookie: [] }, { bearerAuth: [] }] } : {}),
  ...(schema ? { requestBody: body(schema) } : {}),
  responses: {
    '200': { description: 'Success: { data, meta? }' },
    '201': { description: 'Resource created' },
    '202': { description: 'Processing queued' },
    '401': { description: 'No active staff session' },
    '403': { description: 'Role, MFA or origin check failed' },
    '404': { description: 'Absent or inaccessible resource' },
    '409': { description: 'Version, identifier or idempotency conflict' },
    '422': { description: 'Validation or workflow constraint failed' },
    '429': { description: 'Rate limit reached' },
    '503': { description: 'Configuration or upstream unavailable' },
  },
})
const paths: Record<string, unknown> = {
  '/health': {
    get: operation('Readiness (owner, policy, settings and units)'),
  },
  '/catalog/products': {
    get: operation('Published products; search, filters and pagination'),
  },
  '/catalog/products/{id}': {
    parameters: [
      { ...id, schema: { type: 'string', description: 'UUID or slug' } },
    ],
    get: operation(
      'Published product and active variants; internal fields excluded',
    ),
  },
  '/catalog/facets': {
    get: operation('Counts for the current catalog filters'),
  },
  '/content/{key}': {
    parameters: [
      { name: 'key', in: 'path', required: true, schema: { type: 'string' } },
    ],
    get: operation(
      'Published content; reserved keys: navigation, locations, settings, units',
    ),
  },
  '/quote-requests': {
    post: {
      ...operation(
        'Create RFQ atomically; requires an Idempotency-Key',
        false,
        ref('RFQ'),
      ),
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', minLength: 16, maxLength: 100 },
        },
      ],
    },
  },
  '/inquiries': {
    post: {
      ...operation(
        'Create inquiry atomically; requires an Idempotency-Key',
        false,
        ref('Inquiry'),
      ),
      parameters: [
        {
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
          schema: { type: 'string', minLength: 16, maxLength: 100 },
        },
      ],
    },
  },
  '/auth/login': {
    post: operation('Staff email/password sign-in; may require MFA', false, {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
      },
      additionalProperties: false,
    }),
  },
  '/auth/logout': { post: operation('Sign out this session', true) },
  '/auth/recover': {
    post: operation('Send generic password recovery response', false, {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
      additionalProperties: false,
    }),
  },
  '/auth/callback': {
    get: operation(
      'Exchange one-use PKCE code and redirect to password update',
    ),
  },
  '/auth/me': {
    get: operation('Current verified staff identity and MFA requirement', true),
  },
  '/auth/password': {
    post: operation('Update password (12–128 characters)', true),
  },
  '/auth/mfa/factors': { get: operation('Own MFA factors', true) },
  '/auth/mfa/enroll': {
    post: operation('Enroll TOTP; sensitive response must not be logged', true),
  },
  '/auth/mfa/challenge': { post: operation('Challenge own TOTP factor', true) },
  '/auth/mfa/unenroll': {
    post: operation(
      'Remove own factor after aal2 verification; privileged roles retain a verified factor',
      true,
    ),
  },
  '/auth/mfa/verify': {
    post: operation('Verify factorId, challengeId and six-digit code', true),
  },
  '/admin/me': {
    get: operation(
      'Current active admin identity; requires MFA (aal2)',
      true,
    ),
  },
  '/admin/jobs': {
    post: operation(
      'Drain pending background jobs and optionally retry quotation PDF or quarantined media scan',
      true,
      {
        type: 'object',
        properties: {
          quotationId: { type: 'string', format: 'uuid' },
          mediaId: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
      },
    ),
  },
  '/admin/reports': {
    get: operation('Sales and request summary report', true),
  },
  '/admin/exports': {
    post: operation('Audited CSV export, at most 1,000 records', true),
  },
  '/admin/imports/preview': {
    post: operation('Validate CSV and sign a 15-minute preview token', true),
  },
  '/admin/imports/apply': {
    post: operation(
      'Revalidate CSV and apply all drafts in one transaction',
      true,
    ),
  },
  '/admin/products/bulk': {
    post: operation(
      'Atomic unpublish/archive, 1–100 {id, version} items',
      true,
    ),
  },
  '/internal/jobs': {
    get: operation('Process one persistent job; worker bearer secret required'),
    post: operation(
      'Process one persistent job; worker bearer secret required',
    ),
  },
}
for (const resource of ['categories', 'brands', 'sectors']) {
  paths[`/catalog/${resource}`] = { get: operation(`Published ${resource}`) }
  paths[`/catalog/${resource}/{id}`] = {
    parameters: [{ ...id, schema: { type: 'string' } }],
    get: operation(`Published ${resource} detail by UUID or slug`),
  }
}
for (const resource of [
  'products',
  'categories',
  'brands',
  'sectors',
  'attributes',
  'units',
  'contacts',
  'organizations',
  'content',
  'navigation',
  'locations',
  'settings',
  'media',
  'team',
  'quote-requests',
  'inquiries',
  'quotations',
  'audit-log',
]) {
  const mutable = [
    'products',
    'categories',
    'brands',
    'sectors',
    'attributes',
    'units',
    'contacts',
    'organizations',
    'content',
    'navigation',
    'locations',
    'settings',
  ].includes(resource)
  paths[`/admin/${resource}`] = {
    get: operation(`List ${resource}; role and assignment scope applied`, true),
    ...(mutable || resource === 'media' || resource === 'team'
      ? {
          post: operation(
            `Create ${resource}; see contracts.ts for strict resource schema`,
            true,
          ),
        }
      : {}),
  }
  if (resource === 'audit-log') continue
  paths[`/admin/${resource}/{id}`] = {
    parameters: [id],
    get: operation(`Read ${resource} within staff scope`, true),
    ...(mutable ||
    ['team', 'media', 'quote-requests', 'inquiries', 'quotations'].includes(
      resource,
    )
      ? { patch: operation(`Update ${resource} with expected version`, true) }
      : {}),
    ...(mutable || resource === 'media'
      ? {
          delete: operation(
            `Delete ${resource} with expected version; dependencies protected`,
            true,
            ref('Version'),
          ),
        }
      : {}),
  }
}
for (const resource of [
  'products',
  'categories',
  'brands',
  'sectors',
  'content',
])
  for (const action of ['publish', 'archive', 'unpublish'])
    paths[`/admin/${resource}/{id}/${action}`] = {
      parameters: [id],
      post: operation(`${action} ${resource}`, true, ref('Version')),
    }
for (const resource of ['quote-requests', 'inquiries'])
  for (const action of ['assign', 'events', 'transitions'])
    paths[`/admin/${resource}/{id}/${action}`] = {
      parameters: [id],
      post: operation(
        `${action} within request scope; expected version required`,
        true,
      ),
    }
paths['/admin/inquiries/{id}/convert'] = {
  parameters: [id],
  post: operation(
    'Convert inquiry once with validated catalog/free items',
    true,
  ),
}
paths['/admin/quote-requests/{id}/quotations'] = {
  parameters: [id],
  post: operation(
    'Create quotation draft; amounts recalculated on server',
    true,
  ),
}
for (const action of ['issue', 'revise', 'transitions'])
  paths[`/admin/quotations/{id}/${action}`] = {
    parameters: [id],
    post: operation(`${action} quotation; issued revisions immutable`, true),
  }
paths['/admin/quotations/{id}/download'] = {
  parameters: [id],
  get: operation(
    'Private PDF URL valid for 60 seconds; requires completed PDF job',
    true,
  ),
}
paths['/admin/products/{id}/variants'] = {
  parameters: [id],
  post: operation(
    'Append variant with {version, data}; full product validation',
    true,
  ),
}
paths['/admin/media/{id}/complete'] = {
  parameters: [id],
  post: operation(
    'Queue scan for uploaded bytes; no immediate publication',
    true,
    ref('Version'),
  ),
}
paths['/admin/media/{id}/download'] = {
  parameters: [id],
  get: operation('Ready media download URL valid for 60 seconds', true),
}

const localized = {
  type: 'object',
  required: ['ar', 'en'],
  properties: { ar: { type: 'string' }, en: { type: 'string' } },
  additionalProperties: false,
}
const customer = {
  type: 'object',
  required: ['name', 'phone'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 120 },
    phone: { type: 'string' },
    company: { type: 'string' },
    email: { type: 'string', format: 'email' },
    city: { type: 'string' },
    governorate: { type: 'string' },
    preferredChannel: { enum: ['phone', 'whatsapp', 'email'] },
  },
  additionalProperties: false,
}
const shared = {
  locale: { enum: ['ar', 'en'] },
  customer,
  privacy: {
    type: 'object',
    required: ['accepted', 'policyVersion'],
    properties: {
      accepted: { const: true },
      policyVersion: { type: 'string' },
    },
    additionalProperties: false,
  },
  source: {
    type: 'object',
    required: ['page'],
    properties: {
      page: { type: 'string', pattern: '^/(?!/)[a-zA-Z0-9/_-]*$' },
      utmSource: { type: 'string' },
      utmMedium: { type: 'string' },
      utmCampaign: { type: 'string' },
    },
    additionalProperties: false,
  },
}
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'M.A.S B2B API',
    version: '1.0.0',
    description:
      'Catalog and RFQ only. No checkout, payments or public customer accounts. See docs/BACKEND.ar.md and lib/server/contracts.ts for field and workflow details.',
  },
  servers: [{ url: '/api/v1' }],
  paths,
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-<project>-auth-token',
      },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Localized: localized,
      Version: {
        type: 'object',
        required: ['version'],
        properties: { version: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
      RFQ: {
        type: 'object',
        required: ['locale', 'customer', 'items', 'privacy', 'source'],
        properties: {
          ...shared,
          notes: { type: 'string', maxLength: 2000 },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 30,
            items: {
              oneOf: [
                {
                  type: 'object',
                  required: ['variantId', 'quantity', 'unitCode'],
                  properties: {
                    variantId: { type: 'string', format: 'uuid' },
                    quantity: {
                      type: 'number',
                      minimum: 0.001,
                      maximum: 99999,
                    },
                    unitCode: { type: 'string' },
                    notes: { type: 'string' },
                  },
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  required: ['description', 'quantity', 'unitCode'],
                  properties: {
                    description: { type: 'string', minLength: 3 },
                    quantity: {
                      type: 'number',
                      minimum: 0.001,
                      maximum: 99999,
                    },
                    unitCode: { type: 'string' },
                    categoryId: { type: 'string', format: 'uuid' },
                    brandId: { type: 'string', format: 'uuid' },
                    notes: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              ],
            },
          },
        },
        additionalProperties: false,
      },
      Inquiry: {
        type: 'object',
        required: ['locale', 'customer', 'message', 'privacy', 'source'],
        properties: {
          ...shared,
          message: { type: 'string', minLength: 3, maxLength: 2000 },
        },
        additionalProperties: false,
      },
    },
  },
}
