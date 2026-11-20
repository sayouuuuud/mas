/** Import the site's approved existing content. Never overwrite records edited in Admin. */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { company, phones, addresses, allBrands, productKeys } from '../lib/site'
import { dictionaries } from '../lib/i18n'
import { configuration } from '../lib/server/environment'
import { resourceSchemas, mediaInput } from '../lib/server/contracts'
import { SupabaseRepository } from '../lib/server/supabase-repository'
import { drainJobs } from '../lib/server/jobs'
import catalogSubcategories from '../content/catalog-subcategories.json'

const config = configuration()
if (!config.serviceKey) throw new Error('Server credential required')
const expected = process.env.IMPORT_EXPECTED_PROJECT
if (!expected || !new URL(config.url).hostname.startsWith(expected))
  throw new Error(
    'Set IMPORT_EXPECTED_PROJECT to the intended Supabase project reference (localhost for local testing).',
  )
const service = createClient(config.url, config.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const repository = new SupabaseRepository(service, service)
const stats = { created: 0, existing: 0, mediaReady: 0 }
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await service.rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}
async function insert(resource: string, data: any, key: string) {
  const schema = resourceSchemas[resource as keyof typeof resourceSchemas]
  if (schema) data = schema.parse(data)
  const row = await rpc('mas_import_initial', {
    p_resource: resource,
    p_data: data,
    p_key: `current-site-v1:${key}`,
  })
  stats[row.imported ? 'created' : 'existing']++
  return row
}
const media = new Map<string, string>()
async function asset(src: string, alt: { ar: string; en: string }) {
  if (media.has(src)) return media.get(src)!
  const bytes = await readFile(path.join(process.cwd(), 'public', src))
  const input = await sharp(bytes, { limitInputPixels: 40000000 })
    .rotate()
    .webp({ quality: 88 })
    .toBuffer()
  const data = mediaInput.parse({
    name: path.basename(src),
    mime: 'image/webp',
    size: input.length,
    alt,
    visibility: 'public',
    kind: 'image',
  })
  let row = await insert('media', data, `asset:${src}`)
  if (row.status === 'uploading') {
    const upload = await service.storage
      .from('quarantine')
      .upload(row.storagePath, input, {
        contentType: 'image/webp',
        upsert: true,
      })
    if (upload.error) throw new Error(`Storage upload failed: ${src}`)
    await rpc('mas_queue_initial_media', { p_id: row.id })
  }
  if (row.status !== 'ready') {
    await drainJobs(
      { config, repository, service },
      { maxBatches: 20, timeBudgetMs: 60000 },
    )
    row = await rpc('mas_import_initial', {
      p_resource: 'media',
      p_data: data,
      p_key: `current-site-v1:asset:${src}`,
    })
  }
  if (row.status !== 'ready')
    throw new Error(`Media processing incomplete: ${src} (${row.status})`)
  stats.mediaReady++
  media.set(src, row.id)
  return row.id
}
const ar = dictionaries.ar,
  en = dictionaries.en
const l = (a: string, b: string) => ({ ar: a, en: b })
const strip = (s: string) => s.replace(/\*/g, '')
const localized = (a: string, b: string) => l(strip(a), strip(b))
async function main() {
  const settings = await insert(
    'settings',
    {
      name: company.name,
      email: company.email,
      phone: phones.mobile.href.slice(4),
      logoMediaId: null,
      officePhone: phones.office.href.slice(4),
      fax: '+20248046115',
      whatsapp: '+201004998655',
      support: company.support,
      currency: 'EGP',
      timezone: 'Africa/Cairo',
    },
    'company',
  )
  for (const [kind, address, phone] of [
    ['hq', addresses.hq, '+20248046114'],
    ['branch', addresses.branch, '+20225751399'],
    ['warehouse', addresses.stores, undefined],
  ] as const)
    await insert(
      'locations',
      {
        kind,
        name:
          kind === 'hq'
            ? l('الإدارة', 'Head office')
            : kind === 'branch'
              ? l('الفرع', 'Branch')
              : l('المخازن', 'Warehouses'),
        address,
        phone,
        published: true,
      },
      `location:${kind}`,
    )
  for (const [i, brand] of allBrands.entries()) {
    const logoMediaId = brand.logo ? await asset(brand.logo, brand.name) : null
    await insert(
      'brands',
      {
        name: brand.name,
        slug: [
          'ola-energy',
          'pennzoil',
          'misr-petroleum',
          'eni',
          'petronas',
          'adnoc',
          'bp',
          'ngv',
          'skf',
          'nsk',
          'fag',
          'ina',
        ][i],
        description: l('', ''),
        logoMediaId,
        featured: i === 0,
        group: i >= 8 ? 'bearings' : 'oils',
        order: i,
        status: 'published',
      },
      `brand:${i}`,
    )
  }
  const units = [
    ['piece', 'قطعة', 'Piece', 'sale', 0],
    ['can', 'عبوة', 'Can', 'sale', 0],
    ['drum', 'برميل', 'Drum', 'sale', 0],
    ['carton', 'كرتونة', 'Carton', 'sale', 0],
    ['set', 'طقم', 'Set', 'sale', 0],
    ['l', 'لتر', 'Litre', 'both', 3],
    ['kg', 'كيلوجرام', 'Kilogram', 'both', 3],
    ['mm', 'ملليمتر', 'Millimetre', 'measure', 3],
  ] as const
  for (const [code, a, b, usage, precision] of units)
    await insert(
      'units',
      { code, name: l(a, b), usage, precision, active: true },
      `unit:${code}`,
    )
  for (const [i, family] of productKeys.entries()) {
    const a = ar.products.items[family],
      b = en.products.items[family]
    const imageMediaId = await asset(
      `/images/product-${family}.png`,
      l(a.imageAlt, b.imageAlt),
    )
    const parent = await insert(
      'categories',
      {
        slug: family,
        family,
        name: l(a.title, b.title),
        description: l(a.body, b.body),
        imageMediaId,
        featured: true,
        order: i,
        status: 'published',
      },
      `category:${family}`,
    )
    for (const [j, [slug, titleAr, titleEn]] of catalogSubcategories[family].entries())
      await insert(
        'categories',
        {
          slug: `${family}-${slug}`,
          family,
          parentId: parent.id,
          name: l(titleAr, titleEn),
          description: l('', ''),
          order: j,
          status: 'published',
        },
        `category:${family}:${j}`,
      )
  }
  for (const [i, key] of Object.keys(ar.sectors.items).entries()) {
    const k = key as keyof typeof ar.sectors.items
    await insert(
      'sectors',
      {
        slug: key,
        name: l(ar.sectors.items[k].title, en.sectors.items[k].title),
        description: l(ar.sectors.items[k].body, en.sectors.items[k].body),
        order: i,
        status: 'published',
      },
      `sector:${key}`,
    )
  }
  const block = async (
    key: string,
    a: any,
    b: any,
    layout: any = {},
    ctaPath?: string,
  ) =>
    insert(
      'content',
      {
        key,
        name: localized(a.title || key, b.title || key),
        body: l(a.body || a.subtitle || '', b.body || b.subtitle || ''),
        ctaLabel: l(a.cta || '', b.cta || ''),
        ctaPath,
        layout: { cards: [], points: [], ...layout },
        mediaIds: Array.from(
          new Set(
            [
              layout.imageMediaId,
              ...(layout.cards || []).map((c: any) => c.imageMediaId),
            ].filter(Boolean),
          ),
        ),
        status: 'published',
      },
      `content:${key}`,
    )
  const slides = []
  for (const [i, src] of [
    '/images/industrial-hero.png',
    '/images/hero-lubricants.png',
    '/images/hero-fleet.png',
    '/images/hero-warehouse.png',
  ].entries())
    slides.push({
      id: `slide-${i}`,
      title: l(ar.hero.slides[i].title, en.hero.slides[i].title),
      body: l(ar.hero.slides[i].imageAlt, en.hero.slides[i].imageAlt),
      imageMediaId: await asset(
        src,
        l(ar.hero.slides[i].imageAlt, en.hero.slides[i].imageAlt),
      ),
      points: [],
    })
  await block(
    'home-hero',
    {
      title: `${ar.hero.titleStart} ${ar.hero.titleHighlight}`,
      body: ar.hero.subtitle,
      cta: ar.cta.quote,
    },
    {
      title: `${en.hero.titleStart} ${en.hero.titleHighlight}`,
      body: en.hero.subtitle,
      cta: en.cta.quote,
    },
    { cards: slides },
    '/request-quote',
  )
  await block('home-products', ar.products, en.products, {
    eyebrow: l(ar.products.eyebrow, en.products.eyebrow),
  })
  await block('about', ar.about, en.about, {
    eyebrow: l(ar.about.eyebrow, en.about.eyebrow),
    imageMediaId: await asset(
      '/images/about-storage.png',
      l(ar.about.imageAlt, en.about.imageAlt),
    ),
    cards: ar.about.points.map((p, i) => ({
      id: `point-${i}`,
      title: l(p.title, en.about.points[i].title),
      body: l(p.body, en.about.points[i].body),
      points: [],
    })),
  })
  await block('partners', ar.partners, en.partners, {
    eyebrow: l(ar.partners.eyebrow, en.partners.eyebrow),
    points: ar.partners.featuredPoints.map((p, i) =>
      l(p, en.partners.featuredPoints[i]),
    ),
    cards: [
      {
        title: allBrands[0].name,
        body: l(ar.partners.featuredBody, en.partners.featuredBody),
        points: [],
      },
    ],
  })
  await block('home-sectors', ar.sectors, en.sectors, {
    eyebrow: l(ar.sectors.eyebrow, en.sectors.eyebrow),
    imageMediaId: await asset(
      '/images/industrial-sectors.png',
      l(ar.sectors.title, en.sectors.title),
    ),
  })
  await block(
    'overview',
    {
      title: 'عن الشركة',
      body: ar.overview.intro + ' ' + ar.overview.statement,
    },
    {
      title: 'Company overview',
      body: en.overview.intro + ' ' + en.overview.statement,
    },
  )
  await block(
    'footer',
    { title: company.name.ar, body: ar.footer.tagline },
    { title: company.name.en, body: en.footer.tagline },
  )
  const nav = [
    ['products', '/products'],
    ['partners', '/#partners'],
    ['about', '/#about'],
    ['sectors', '/#sectors'],
    ['contact', '/contact'],
  ] as const
  for (const area of ['header', 'footer'])
    for (const [i, [key, href]] of nav.entries())
      await insert(
        'navigation',
        {
          area,
          path: href,
          name: l(ar.nav[key], en.nav[key]),
          order: i,
          active: true,
        },
        `nav:${area}:${key}`,
      )
  console.log(
    JSON.stringify({
      ...stats,
      settingsId: settings.id,
      productsImported: 0,
      reason:
        'Source website contains product categories, no SKU specifications.',
    }),
  )
}
main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
