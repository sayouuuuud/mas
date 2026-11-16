import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AdminPage } from '@/components/admin/admin-page'
import { initialProducts, initialRequests } from '@/lib/demo-data'
export const metadata: Metadata = {
  title: 'M.A.S | معاينة لوحة الإدارة',
  robots: { index: false, follow: false },
}
const sections = [
  'products',
  'categories',
  'brands',
  'sectors',
  'attributes',
  'media',
  'quote-requests',
  'quotations',
  'customers',
  'inquiries',
  'content',
  'settings',
  'team',
  'audit-log',
  'reports',
  'login',
  'reset-password',
]
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path = [] } = await params
  const [section, id] = path
  if (path.length > 2 || (section && !sections.includes(section))) notFound()
  if (id) {
    const allow =
      section === 'products'
        ? id === 'new' ||
          initialProducts.some((p) => p.id === id) ||
          /^demo-\d+$/.test(id)
        : section === 'quote-requests' || section === 'quotations'
          ? initialRequests.some((r) => r.id === id)
          : [
              'categories',
              'brands',
              'sectors',
              'attributes',
              'customers',
              'inquiries',
              'content',
              'team',
            ].includes(section) && /^[a-z0-9-]+$/.test(id)
    if (!allow) notFound()
  }
  if (section === 'quotations' && !id) notFound()
  return <AdminPage key={path.join('/')} path={path} />
}
