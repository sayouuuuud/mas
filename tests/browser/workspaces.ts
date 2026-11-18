// Contract tests use intercepted API responses; they do not claim live Auth or persistence.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { productInput, quotationInput } from '../../lib/server/contracts'
import { randomUUID } from 'node:crypto'
const ids = Array.from({ length: 10 }, () => randomUUID())
const base = process.env.BASE_URL || 'http://localhost:3000'
const now = '2026-11-17T12:00:00Z'
const name = { ar: 'منتج اختبار', en: 'Contract product' }
const unit = {
  id: ids[0],
  version: 1,
  code: 'piece',
  name: { ar: 'قطعة', en: 'Piece' },
  precision: 0,
  active: true,
}
const category = {
  id: ids[1],
  version: 1,
  slug: 'oils',
  name,
  status: 'published',
}
const brand = {
  id: ids[2],
  version: 1,
  slug: 'brand',
  name,
  status: 'published',
}
let product: any = {
  id: ids[3],
  version: 1,
  slug: 'contract-product',
  name,
  summary: name,
  description: name,
  applications: { ar: 'تطبيق قديم', en: 'Old application' },
  benefits: name,
  family: 'oils',
  categoryId: category.id,
  brandId: brand.id,
  status: 'draft',
  sectorIds: [],
  specifications: [],
  variants: [
    {
      id: ids[4],
      sku: 'CONTRACT-1',
      label: name,
      unitId: unit.id,
      minQuantity: 1,
      quantityStep: 1,
      availability: 'available',
      active: true,
      specifications: [],
      mediaIds: [],
    },
  ],
}
let request: any = {
  id: ids[5],
  version: 1,
  reference: 'TEST-RFQ',
  locale: 'ar',
  status: 'in_progress',
  assignedTo: null,
  customerSnapshot: { name: 'Test Customer', phone: '+201012345678' },
  createdAt: now,
  items: [
    {
      id: ids[7],
      variantId: ids[4],
      unitId: unit.id,
      quantity: 2,
      snapshot: {
        name,
        sku: 'CONTRACT-1',
        label: name,
        unit: unit.name,
        unitCode: 'piece',
      },
    },
  ],
  events: [],
}
let quotation: any
let conflict = false
const writes: any[] = []
;(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    })
    await context.addCookies([{ name: 'mas-lang', value: 'en', url: base }])
    const page = await context.newPage()
    page.on('dialog', (dialog) => dialog.accept())
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/api/v1/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname.replace('/api/v1', ''),
        method = req.method()
      const ok = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify({
            data,
            meta: {
              page: 1,
              pageSize: 48,
              total: Array.isArray(data) ? data.length : 1,
              totalPages: 1,
            },
          }),
        })
      try {
        if (path === '/auth/me' || path === '/admin/me')
          return ok({
            id: ids[9],
            role: 'Admin',
            roles: ['Owner'],
            active: true,
            aal: 'aal2',
          })
        if (path === '/admin/products/' + product.id) {
          if (method === 'GET') return ok(product)
          const input = req.postDataJSON()
          writes.push({ path, ...input })
          if (conflict)
            return route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                error: { code: 'CONFLICT', message: 'Conflict' },
              }),
            })
          const data = productInput.parse(input.data)
          assert.equal(input.version, product.version)
          product = { ...product, ...data, version: product.version + 1 }
          return ok(product)
        }
        if (path === `/admin/quote-requests/${request.id}/events`) {
          const input = req.postDataJSON()
          assert.equal(input.version, request.version)
          assert.equal(typeof input.body, 'string')
          writes.push({ path, ...input })
          request = {
            ...request,
            version: request.version + 1,
            events: [
              {
                id: randomUUID(),
                kind: 'note',
                detail: { body: input.body },
                createdAt: now,
              },
            ],
          }
          return ok(request)
        }
        if (path === `/admin/quote-requests/${request.id}/quotations`) {
          const input = quotationInput.parse(req.postDataJSON())
          writes.push({ path, ...input })
          quotation = {
            ...input,
            id: ids[6],
            version: 1,
            status: 'draft',
            revision: 1,
            requestId: request.id,
            createdAt: now,
          }
          return ok(quotation, 201)
        }
        if (path === `/admin/quotations/${ids[6]}/issue`) {
          const input = req.postDataJSON()
          assert.equal(input.version, quotation.version)
          assert.equal(input.status, 'issued')
          writes.push({ path, ...input })
          quotation = {
            ...quotation,
            status: 'issued',
            version: quotation.version + 1,
            number: 'TEST-Q-1',
            pdfStatus: 'processing',
          }
          return ok(quotation)
        }
        if (path === `/admin/quotations/${ids[6]}`) {
          if (method === 'PATCH') {
            const input = req.postDataJSON()
            const data = quotationInput.parse(input.data)
            quotation = {
              ...quotation,
              ...data,
              version: quotation.version + 1,
            }
            return ok(quotation)
          }
          return ok(quotation)
        }
        if (path === `/admin/quote-requests/${request.id}`) return ok(request)
        if (path === '/admin/categories') return ok([category])
        if (path === '/admin/brands') return ok([brand])
        if (path === '/admin/units') return ok([unit])
        if (path === '/admin/products') return ok([product])
        if (path === '/admin/quotations')
          return ok(quotation ? [quotation] : [])
        if (path === '/public/bootstrap')
          return ok({ navigation: [], locations: [], settings: null })
        return ok([])
      } catch (error) {
        errors.push(String(error))
        return route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: String(error) },
          }),
        })
      }
    })
    await page.goto(`${base}/admin/products/${product.id}`, {
      waitUntil: 'networkidle',
    })
    await page.getByRole('tab').nth(1).click()
    await page
      .getByLabel('Arabic applications (one per line)', { exact: true })
      .fill('تطبيق جديد')
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await page.getByText('Product saved successfully.').waitFor()
    assert.equal(product.applications.ar, 'تطبيق جديد')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab').nth(1).click()
    assert.equal(
      await page
        .getByLabel('Arabic applications (one per line)', { exact: true })
        .inputValue(),
      'تطبيق جديد',
    )
    conflict = true
    await page
      .getByLabel('Arabic applications (one per line)', { exact: true })
      .fill('مدخلات محفوظة بعد التعارض')
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click()
    await page
      .getByText(
        'Conflict detected or this record was modified elsewhere. Refresh and try again.',
        { exact: true },
      )
      .waitFor()
    assert.equal(
      await page
        .getByLabel('Arabic applications (one per line)', { exact: true })
        .inputValue(),
      'مدخلات محفوظة بعد التعارض',
    )
    conflict = false
    await page.getByRole('button',{name:'Save changes',exact:true}).click()
    await page.getByText('Product saved successfully.',{exact:true}).waitFor()
    await page.goto(`${base}/admin/quote-requests/${request.id}`,{waitUntil:'networkidle'})
    await page
      .getByPlaceholder(
        'Add an internal follow-up note persisted to the database…',
      )
      .fill('Contract note')
    await page.getByRole('button', { name: 'Save note', exact: true }).click()
    await page.getByText('Contract note', { exact: true }).waitFor()
    await page.goto(`${base}/admin/quotations/new?requestId=${request.id}`, {
      waitUntil: 'networkidle',
    })
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await page.waitForURL(`**/admin/quotations/${ids[6]}`)
    assert.equal(quotation.lines[0].description.includes('منتج اختبار'), true)
    assert.equal(quotation.locale, 'ar')
    await page
      .getByRole('button', { name: 'Issue & freeze', exact: true })
      .click()
    await page.getByText('TEST-Q-1', { exact: false }).first().waitFor()
    assert.equal(quotation.pdfStatus, 'processing')
    assert.equal(
      await page
        .getByRole('button', { name: 'Download Official PDF', exact: true })
        .count(),
      0,
    )
    assert.deepEqual(errors, [])
    console.log(
      `PASS: workspace product save/reload, 409 input retention, versioned notes, quotation draft/issue/processing (${writes.length} intercepted writes).`,
    )
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
