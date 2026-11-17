import 'server-only'
import { NextResponse } from 'next/server'
import type { Actor } from './contracts'
import type { BackendService } from './services'
import type { Filters } from './repository'
import { ApiError } from './errors'
import { requireActor } from './policy'

// Spreadsheet programs interpret these prefixes even inside quoted CSV cells.
export function csvCell(value: unknown): string {
  let text =
    value == null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function createExport(
  service: BackendService,
  actor: Actor,
  resource:
    | 'products'
    | 'quote_requests'
    | 'contacts'
    | 'inquiries'
    | 'quotations',
  filters?: Filters,
) {
  requireActor(actor)
  const query = { ...filters, page: 1, pageSize: 1000 }
  const result = await service.list(resource, query, actor)
  if (result.total > 1000)
    throw new ApiError(
      422,
      'EXPORT_TOO_LARGE',
      'Narrow the filters to at most 1,000 records.',
    )
  const fields =
    resource === 'products'
      ? ['id', 'slug', 'name', 'status', 'categoryId', 'brandId']
      : resource === 'contacts'
        ? ['id', 'name', 'phone', 'email', 'organizationId']
        : resource === 'inquiries'
          ? ['id', 'reference', 'status', 'customerSnapshot', 'message', 'createdAt']
          : resource === 'quotations'
            ? ['id', 'number', 'revision', 'requestId', 'status', 'currency', 'validUntil', 'totals']
            : [
                'id',
                'reference',
                'status',
                'customerSnapshot',
                'assignedTo',
                'createdAt',
              ]
  await service.repository.command({
    resource: 'audit_logs',
    action: 'export',
    actor,
    data: { resource, count: result.data.length },
  })
  const csv =
    '\uFEFF' +
    [
      fields.map(csvCell).join(','),
      ...result.data.map((row) =>
        fields.map((field) => csvCell(row[field])).join(','),
      ),
    ].join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${resource}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
