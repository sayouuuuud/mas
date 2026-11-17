import 'server-only'
import { unavailable } from './errors'

function parseOrigin(raw: string | undefined | null, requireHttps: boolean): string | null {
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !['https:', 'http:'].includes(parsed.protocol) ||
      (requireHttps && parsed.protocol !== 'https:')
    )
      return null
    return parsed.origin
  } catch {
    return null
  }
}

export function configuration() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw unavailable()
  const isProdNode = process.env.NODE_ENV === 'production'
  const localOrigin = parseOrigin(url, false)
  const localUrl = localOrigin ? new URL(url) : null
  const allowLocalHttp =
    !isProdNode &&
    localUrl?.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(localUrl.hostname)
  if (!parseOrigin(url, true) && !allowLocalHttp) throw unavailable()

  const vercelEnv = process.env.VERCEL_ENV
  const vercelDeploymentOrigin = process.env.VERCEL_URL
    ? parseOrigin(`https://${process.env.VERCEL_URL}`, true)
    : null
  const vercelBranchOrigin = process.env.VERCEL_BRANCH_URL
    ? parseOrigin(`https://${process.env.VERCEL_BRANCH_URL}`, true)
    : null
  const vercelProdOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? parseOrigin(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`, true)
    : null

  const configuredOrigin = parseOrigin(
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL,
    isProdNode,
  )
  const fallbackOrigin = isProdNode
    ? vercelEnv === 'preview'
      ? vercelBranchOrigin || vercelDeploymentOrigin
      : vercelProdOrigin
    : 'http://localhost:3000'
  const origin = configuredOrigin || fallbackOrigin
  if (!origin) throw unavailable()

  const allowedOrigins = new Set<string>([origin])
  if (vercelEnv === 'preview') {
    if (vercelDeploymentOrigin) allowedOrigins.add(vercelDeploymentOrigin)
    if (vercelBranchOrigin) allowedOrigins.add(vercelBranchOrigin)
  }
  if (vercelEnv === 'production' && vercelProdOrigin && configuredOrigin === vercelProdOrigin) {
    allowedOrigins.add(vercelProdOrigin)
  }
  for (const extra of (process.env.ALLOWED_ORIGINS || '').split(',')) {
    const parsed = parseOrigin(extra.trim(), isProdNode)
    if (parsed) allowedOrigins.add(parsed)
  }
  if (!isProdNode) {
    allowedOrigins.add('http://localhost:3000')
    allowedOrigins.add('http://127.0.0.1:3000')
    const devRedirect = parseOrigin(
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
      false,
    )
    if (devRedirect) allowedOrigins.add(devRedirect)
  }

  return {
    url,
    key,
    origin,
    allowedOrigins,
    allowDevWorkspaceOrigin: !isProdNode,
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
