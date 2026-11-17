import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

function getSiteOrigin() {
  try {
    return new URL(process.env.SITE_URL || 'https://mas-eg.com').origin
  } catch {
    return 'https://mas-eg.com'
  }
}

const STATIC_PATHS = [
  '',
  '/products',
  '/categories',
  '/brands',
  '/sectors',
  '/about',
  '/contact',
  '/request-quote',
  '/privacy',
  '/terms',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin()
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const locale of ['ar', 'en'] as const) {
    for (const suffix of STATIC_PATHS) {
      entries.push({
        url: `${origin}/${locale}${suffix}`,
        lastModified: now,
        changeFrequency: suffix === '/products' ? 'daily' : 'weekly',
        priority: suffix === '' ? 1 : suffix === '/products' ? 0.9 : 0.7,
      })
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) return entries

  try {
    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    for (const [resource, prefix] of [
      ['products', 'products'],
      ['categories', 'categories'],
      ['brands', 'brands'],
      ['sectors', 'sectors'],
    ] as const) {
      const { data } = await client.rpc('mas_list', {
        p_resource: resource,
        p_filters: { page: 1, pageSize: 500 },
        p_private: false,
      })
      const rows = Array.isArray(data?.data) ? data.data : []
      for (const row of rows) {
        const slug = row?.slug || row?.id
        if (!slug) continue
        for (const locale of ['ar', 'en'] as const) {
          entries.push({
            url: `${origin}/${locale}/${prefix}/${slug}`,
            lastModified: row?.publishedAt ? new Date(row.publishedAt) : now,
            changeFrequency: 'weekly',
            priority: resource === 'products' ? 0.8 : 0.6,
          })
        }
      }
    }
  } catch {
    // Keep base sitemap available even if database is temporarily unreachable.
  }

  return entries
}
