import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'M.A.S Workspace | معاينة الإدارة',
  robots: { index: false, follow: false },
}
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
