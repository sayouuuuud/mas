import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
      for (let page = 1; ; page++) {
      const { data, error } = await client.rpc('mas_list', {
        p_resource: resource,
        p_filters: { page, pageSize: 48 },
        p_private: false,
      })
      if (error) throw new Error('SITEMAP_UNAVAILABLE')
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
      if (rows.length < 48 || page * 48 >= Number(data?.total || 0)) break
      }
    }
  } catch {
    // Keep base sitemap available even if database is temporarily unreachable.
  }

  return entries
}
