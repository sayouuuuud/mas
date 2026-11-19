// Real local Auth, REST, Storage and app; no API interception. Creates isolated acceptance fixtures.
const fs = require('node:fs'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  { chromium } = require('playwright')
fs.mkdirSync('work/mvp-acceptance', { recursive: true })
const base = process.env.E2E_URL || 'http://localhost:3100',
  creds = JSON.parse(
    fs.readFileSync(
      process.env.E2E_CREDENTIALS_FILE || 'work/e2e/credentials.json',
    ),
  )
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Acceptance fixtures run only on an isolated local application',
)
assert.equal(creds.url, 'http://localhost:55431')
function totp(s) {
  let b = ''
  for (const ch of s)
    b += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      .indexOf(ch)
      .toString(2)
      .padStart(5, '0')
  const key = Buffer.from(b.match(/.{8}/g).map((x) => parseInt(x, 2))),
    n = Buffer.alloc(8)
  n.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = crypto.createHmac('sha1', key).update(n).digest(),
    o = h[19] & 15
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1e6).toString().padStart(6, '0')
}
;(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  })
  const results = []
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    })
    await ctx.addCookies([{ name: 'mas-lang', value: 'en', url: base }])
    const p = await ctx.newPage()
    p.setDefaultTimeout(20000)
    p.on('dialog', (dialog) => dialog.accept())
    await p.goto(base + '/admin/login', { waitUntil: 'networkidle' })
    await p.getByLabel('Email address', { exact: true }).fill(creds.email)
    await p.getByLabel('Password', { exact: true }).fill(creds.password)
    await p.getByRole('button', { name: 'Sign in', exact: true }).click()
    await p
      .getByLabel('6-digit verification code', { exact: true })
      .fill(totp(creds.totp))
    const done = p.waitForResponse((r) => r.url().endsWith('/mfa/verify'))
    await p
      .getByRole('button', { name: 'Verify & continue', exact: true })
      .click()
    assert.equal((await done).status(), 200)
    await p.waitForURL(base + '/admin')
    async function api(path, method = 'GET', data) {
      const r = await ctx.request.fetch(base + '/api/v1' + path, {
          method,
          data,
          headers: { Origin: base },
        }),
        j = await r.json()
      assert.ok(r.ok(), path + ' ' + r.status() + ' ' + JSON.stringify(j))
      return j.data
    }
    const run = Date.now().toString()
    const checks = []
    const ok = (name) => {
      checks.push(name)
      console.log('PASS ' + name)
    }
    const categories = await api('/admin/categories?pageSize=48'),
      brands = await api('/admin/brands?pageSize=48'),
      units = await api('/admin/units?pageSize=48')
    const category = categories.find((x) => x.slug === 'bearings'),
      brand = brands.find((x) => x.slug === 'skf'),
      unit = units.find((x) => x.code === 'piece')
    assert.ok(category && brand && unit)
    let product = await api('/admin/products', 'POST', {
      name: { ar: 'منتج قبول محلي ' + run, en: 'LOCAL ACCEPTANCE ' + run },
      slug: 'acceptance-' + run,
      family: 'bearings',
    })
    assert.equal(product.variants.length, 0)
    ok('Incomplete product draft persists')
    product = await api('/admin/products/' + product.id, 'PATCH', {
      version: product.version,
      data: {
        name: product.name,
        slug: product.slug,
        family: 'bearings',
        summary: { ar: 'منتج للاختبار المحلي', en: 'Local test product' },
        description: {
          ar: 'لا يمثل منتجًا تجاريًا',
          en: 'Not a commercial product',
        },
        categoryId: category.id,
        brandId: brand.id,
        variants: [
          {
            label: { ar: 'قطعة اختبار', en: 'Test piece' },
            unitId: unit.id,
            sku: '',
            minQuantity: 1,
            quantityStep: 1,
            active: true,
            availability: 'available',
          },
        ],
      },
    })
    assert.match(product.variants[0].sku, /^MAS-/)
    ok('Selling unit and generated internal SKU persist')
    await p.goto(base + '/admin/products/' + product.id, {
      waitUntil: 'networkidle',
    })
    await p.getByRole('tab', { name: 'Specifications', exact: true }).click()
    await p
      .getByLabel('Specifications and standards')
      .fill('TEST API SN/CF\nTEST ACEA A3/B4')
    await p.getByRole('tab', { name: 'Packs & sizes', exact: true }).click()
    await p.getByLabel('Pack size', { exact: true }).fill('4')
    await p.getByRole('button', { name: 'Add size', exact: true }).click()
    await p.getByRole('heading', { name: '4 Litre', exact: true }).waitFor()
    await p.getByRole('tab', { name: 'Product details', exact: true }).click()
    const mediaResponse = p.waitForResponse(
      (r) => r.url().includes('/admin/media/') && r.url().endsWith('/complete'),
    )
    await p
      .locator('input[type=file]')
      .first()
      .setInputFiles('public/images/product-bearings.png')
    assert.ok((await mediaResponse).ok())
    await p.getByText('product-bearings.png: Ready', { exact: true }).waitFor()
    const save = p.waitForResponse(
      (r) =>
        r.url().endsWith('/admin/products/' + product.id) &&
        r.request().method() === 'PATCH',
    )
    await p.getByRole('button', { name: 'Save changes', exact: true }).click()
    assert.ok((await save).ok())
    product = await api('/admin/products/' + product.id)
    assert.ok(product.mainMediaId)
    ok('Manual image upload from product form is processed and saved')
    const published = p.waitForResponse((r) => r.url().endsWith('/publish'))
    await p.getByRole('button', { name: 'Publish', exact: true }).click()
    assert.ok((await published).ok())
    product = await api('/admin/products/' + product.id)
    assert.equal(product.status, 'published')
    const publicProduct = await api('/catalog/products/' + product.slug)
    assert.equal(publicProduct.name.en, product.name.en)
    assert.ok(publicProduct.media[0].url)
    ok('Published product and processed image appear in public catalog')
    assert.deepEqual(publicProduct.standards, [
      'TEST API SN/CF',
      'TEST ACEA A3/B4',
    ])
    const fourLitrePack = publicProduct.variants.find(
      (variant) => variant.packQuantity === 4,
    )
    assert.equal(fourLitrePack.label.en, '4 Litre')
    const productPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
    })
    await productPage.goto(base + '/en/products/' + product.slug, {
      waitUntil: 'networkidle',
    })
    await productPage
      .getByRole('heading', { name: 'Specifications', exact: true })
      .waitFor()
    await productPage.getByText('TEST API SN/CF', { exact: true }).waitFor()
    await productPage
      .getByRole('button', { name: '4 Litre', exact: true })
      .click()
    assert.equal(
      await productPage
        .getByRole('button', { name: '4 Litre', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    )
    assert.equal(
      await productPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    )
    await productPage
      .getByRole('button', { name: 'Add to quote request', exact: true })
      .click()
    await productPage
      .getByRole('link', { name: 'Review quote request', exact: true })
      .waitFor()
    await productPage.close()
    ok(
      'Specifications and a generated pack round-trip from the editor to the public mobile product page and the RFQ cart',
    )
    const oils = await api('/catalog/products?family=oils')
    assert.ok(!oils.some((x) => x.id === product.id))
    ok('Family filter excludes unrelated published product')
    const policy = await api('/content/privacy')
    const receiptResponse = await ctx.request.post(
      base + '/api/v1/quote-requests',
      {
        headers: {
          Origin: base,
          'Idempotency-Key': 'acceptance-request-' + run,
        },
        data: {
          locale: 'en',
          customer: {
            name: 'LOCAL ACCEPTANCE Customer',
            phone: '+2010' + run.slice(-8),
            company: 'LOCAL ACCEPTANCE Organization',
            preferredChannel: 'phone',
          },
          items: [
            {
              variantId: product.variants[0].id,
              quantity: 2,
              unitCode: unit.code,
            },
          ],
          privacy: { accepted: true, policyVersion: policy.policyVersion },
          source: { page: '/en/request-quote' },
        },
      },
    )
    assert.ok(receiptResponse.ok(), await receiptResponse.text())
    const receipt = (await receiptResponse.json()).data
    const requests = await api(
      '/admin/quote-requests?q=' + encodeURIComponent(receipt.reference),
    )
    let request = await api('/admin/quote-requests/' + requests[0].id)
    assert.ok(request.contactId)
    const customer = await api('/admin/customers/' + request.contactId)
    assert.ok(customer.organizationId)
    assert.equal(customer.requestCount, 1)
    ok(
      'Visitor RFQ reaches admin and atomically links customer and organization',
    )
    const related = await api('/admin/quote-requests?contactId=' + customer.id)
    assert.equal(related.length, 1)
    const del = await ctx.request.delete(
      base + '/api/v1/admin/customers/' + customer.id,
      { headers: { Origin: base }, data: { version: customer.version } },
    )
    assert.equal(del.status(), 422)
    ok('Customer history is filterable and protected against deletion')
    request = await api(
      '/admin/quote-requests/' + request.id + '/assign',
      'POST',
      { version: request.version, assignedTo: creds.userId },
    )
    request = await api(
      '/admin/quote-requests/' + request.id + '/transitions',
      'POST',
      { version: request.version, status: 'in_progress', reason: '' },
    )
    let quote = await api(
      '/admin/quote-requests/' + request.id + '/quotations',
      'POST',
      {
        locale: 'en',
        currency: 'EGP',
        validUntil: '2099-01-01',
        leadTime: 'Test only',
        terms: 'LOCAL TEST - no commercial validity',
        lines: [
          {
            description: 'English acceptance description',
            descriptionLocalized: {
              ar: 'وصف قبول عربي',
              en: 'English acceptance description',
            },
            variantId: product.variants[0].id,
            sku: product.variants[0].sku,
            unit: 'piece',
            quantity: 2,
            price: '10',
            discount: '0',
            tax: '14',
          },
        ],
      },
    )
    await p.goto(base + '/admin/quotations/' + quote.id, {
      waitUntil: 'networkidle',
    })
    assert.equal(
      await p.getByLabel('Arabic description', { exact: true }).inputValue(),
      'وصف قبول عربي',
    )
    assert.equal(
      await p.getByLabel('English description', { exact: true }).inputValue(),
      'English acceptance description',
    )
    ok('Quotation reload retains Arabic and English independently')
    quote = await api('/admin/quotations/' + quote.id + '/issue', 'POST', {
      version: quote.version,
      status: 'issued',
    })
    for (let i = 0; i < 10; i++) {
      quote = await api('/admin/quotations/' + quote.id)
      if (quote.pdfStatus === 'ready') break
      await new Promise((r) => setTimeout(r, 500))
    }
    assert.equal(quote.pdfStatus, 'ready')
    const link = await api('/admin/quotations/' + quote.id + '/download')
    const pdf = await ctx.request.get(link.url)
    assert.ok(pdf.ok())
    const bytes = await pdf.body()
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
    ok(
      'Issued quotation generates and downloads a real PDF from private Storage',
    )
    const pages = [
      '/admin',
      '/admin/products',
      '/admin/categories',
      '/admin/brands',
      '/admin/sectors',
      '/admin/attributes',
      '/admin/units',
      '/admin/media',
      '/admin/quote-requests',
      '/admin/inquiries',
      '/admin/quotations',
      '/admin/customers',
      '/admin/organizations',
      '/admin/content',
      '/admin/navigation',
      '/admin/locations',
      '/admin/settings',
      '/admin/team',
      '/admin/audit-log',
      '/admin/reports',
      '/admin/security',
      '/admin/customers/' + customer.id,
      '/admin/organizations/' + customer.organizationId,
      '/admin/categories/' + category.id,
    ]
    const errors = []
    p.on('pageerror', (e) => errors.push(e.message))
    for (const path of pages) {
      await p.goto(base + path, { waitUntil: 'networkidle' })
      assert.equal(
        (await p.locator('h1').count()) > 0 || path === '/en',
        true,
        path,
      )
      await p.setViewportSize({ width: 390, height: 950 })
      await p.waitForTimeout(40)
      const widths = await p.evaluate(() => ({
        width: innerWidth,
        document: document.documentElement.scrollWidth,
      }))
      assert.ok(
        widths.document <= widths.width + 1,
        path + ' overflow ' + JSON.stringify(widths),
      )
      await p.setViewportSize({ width: 1440, height: 1050 })
    }
    assert.deepEqual(errors, [])
    ok(
      'Admin routes and customer relation pages render without uncaught errors or mobile overflow',
    )
    const visitor = await browser.newContext()
    const publicPage = await visitor.newPage()
    await publicPage.goto(base + '/en', { waitUntil: 'networkidle' })
    await publicPage.locator('#partners img').first().waitFor()
    await publicPage.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 80))
      }
    })
    await publicPage.waitForTimeout(600)
    const imgs = await publicPage.locator('img').evaluateAll(
      async (xs) =>
        await Promise.all(
          xs
            .filter((x) => x.getAttribute('src')?.includes('/storage/v1/'))
            .map(async (x) => {
              x.loading = 'eager'
              await x.decode().catch(() => {})
              return { src: x.src, loaded: x.complete && x.naturalWidth > 0 }
            }),
        ),
    )
    assert.ok(imgs.length >= 20)
    assert.ok(imgs.every((x) => x.loaded))
    ok(
      'Home page renders database-backed catalog, partners, sectors and Storage images',
    )
    fs.writeFileSync(
      'work/mvp-acceptance/results.json',
      JSON.stringify(
        {
          checks,
          productId: product.id,
          requestId: request.id,
          quotationId: quote.id,
          pdfBytes: bytes.length,
          publicStorageImages: imgs.length,
        },
        null,
        2,
      ),
    )
    await ctx.storageState({ path: 'work/mvp-acceptance/admin-state.json' })
    fs.chmodSync('work/mvp-acceptance/admin-state.json', 0o600)
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e.stack)
  process.exit(1)
})
