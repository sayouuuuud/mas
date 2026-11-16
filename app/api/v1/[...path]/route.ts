import type { NextRequest } from 'next/server'
import { handle } from '@/lib/server/controller'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
async function dispatch(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, (await context.params).path)
}
export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PATCH,
  dispatch as DELETE,
}
