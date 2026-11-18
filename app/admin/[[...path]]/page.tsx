import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AdminPage } from '@/components/admin/admin-page'

export const metadata: Metadata = {
  title: 'M.A.S | لوحة الإدارة',
  robots: { index: false, follow: false },
}

const SECTIONS = [
  'products',
  'categories',
  'brands',
  'sectors',
  'attributes',
  'units',
  'media',
  'quote-requests',
  'quotations',
  'customers',
  'organizations',
  'inquiries',
  'content',
  'navigation',
  'locations',
  'settings',
  'security',
  'team',
  'audit-log',
  'reports',
  'login',
  'reset-password',
] as const

const VALID_ID =
  /^(?:new|[a-z0-9]+(?:-[a-z0-9]+)*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path = [] } = await params
  const [section, id] = path

  if (
    path.length > 2 ||
    (section && !(SECTIONS as readonly string[]).includes(section))
  ) {
    notFound()
  }

  if (id) {
    if (
      ['media', 'settings', 'security', 'audit-log', 'reports', 'login', 'reset-password'].includes(
        section,
      )
    ) {
      notFound()
    }
    if (!VALID_ID.test(id)) notFound()
  }

  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-sm text-muted-foreground" role="status">
          جارٍ تحميل مساحة الإدارة / Loading workspace…
        </div>
      }
    >
      <AdminPage key={path.join('/')} path={path} />
    </Suspense>
  )
}
