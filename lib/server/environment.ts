import 'server-only'
import { unavailable } from './errors'
export function configuration() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw unavailable()
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    )
      throw unavailable()
  } catch {
    throw unavailable()
  }
  const appUrl =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000')
  if (!appUrl) throw unavailable()
  let origin: string
  try {
    const parsed = new URL(appUrl)
    if (
      parsed.username ||
      parsed.password ||
      !['https:', 'http:'].includes(parsed.protocol) ||
      (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')
    )
      throw unavailable()
    origin = parsed.origin
  } catch {
    throw unavailable()
  }
  return {
    url,
    key,
    origin,
    serviceKey:
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    rateLimitSecret: process.env.RATE_LIMIT_SECRET,
    jobSecret: process.env.CRON_SECRET || process.env.JOB_SECRET,
    scannerUrl: process.env.MEDIA_SCANNER_URL,
    scannerKey: process.env.MEDIA_SCANNER_KEY,
  }
}
export function secret(value: string | undefined, minimum = 20) {
  if (!value || value.length < minimum) throw unavailable()
  return value
}
