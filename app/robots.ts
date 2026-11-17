import type { MetadataRoute } from 'next'

function getSiteOrigin() {
  try {
    return new URL(process.env.SITE_URL || 'https://mas-eg.com').origin
  } catch {
    return 'https://mas-eg.com'
  }
}

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin()
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/ar', '/en'],
        disallow: [
          '/admin',
          '/api',
          '/compare',
          '/ar/compare',
          '/en/compare',
          '/request-quote/success',
          '/ar/request-quote/success',
          '/en/request-quote/success',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  }
}
