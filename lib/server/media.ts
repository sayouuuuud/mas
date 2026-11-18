import 'server-only'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { RequestScope } from './auth'
import type { Actor } from './contracts'
import { mediaInput, localized, listing } from './contracts'
import { readBody, response, limit } from './http'
import { assert, missing, unavailable } from './errors'
import { requireActor } from './policy'
import { drainJobs } from './jobs'
import { mediaProcessingMode } from './environment'

export async function mediaController(
  request: NextRequest,
  scope: RequestScope,
  actor: Actor,
  path: string[],
) {
  requireActor(actor)
  if (!scope.service) throw unavailable()
  const [id, action] = path
  if (request.method === 'GET' && !id) {
    const input = listing.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    )
    const result = await scope.repository.list(
      'media',
      {
        page: input.page,
        pageSize: input.pageSize,
        q: input.q,
        status: input.status,
        visibility: input.visibility,
        ...(input.kind ? { kind: input.kind } : {}),
      },
      actor,
    )
    return response(result.data, 200, {
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / input.pageSize),
    })
  }
  if (request.method === 'POST' && !id) {
    await limit(scope, request, `media:${actor.id}`, 30, 600, actor.id)
    const input = mediaInput.parse(await readBody(request))
    assert(
      (input.kind === 'image') === input.mime.startsWith('image/'),
      'The media type and document kind do not match.',
    )
    const mediaId = randomUUID(),
      storagePath = `${actor.id}/${mediaId}`
    const row = await scope.repository.command({
      resource: 'media',
      action: 'create',
      actor,
      data: { ...input, id: mediaId, storagePath, status: 'uploading' },
    })
    const result = await scope.service.storage
      .from('quarantine')
      .createSignedUploadUrl(storagePath, { upsert: false })
    if (result.error) throw unavailable()
    return response(
      {
        media: row,
        upload: {
          url: result.data.signedUrl,
          token: result.data.token,
          path: storagePath,
          contentType: input.mime,
        },
      },
      201,
    )
  }
  if (!id || path.length > 2 || !z.uuid().safeParse(id).success) throw missing()
  const row = await scope.repository.get('media', id, actor)
  if (!row) throw missing()
  if (request.method === 'GET' && !action) return response(row)
  if (request.method === 'GET' && action === 'download') {
    assert(row.status === 'ready', 'The file is not ready.')
    const bucket =
      row.visibility === 'public' ? 'catalog-public' : 'catalog-private'
    const result = await scope.service.storage
      .from(bucket)
      .createSignedUrl(String(row.path), 60, { download: true })
    if (result.error) throw unavailable()
    return response({ url: result.data.signedUrl, expiresIn: 60 })
  }
  if (request.method === 'POST' && action === 'complete') {
    const input = z
      .object({ version: z.number().int().positive() })
      .strict()
      .parse(await readBody(request))
    assert(
      row.status === 'uploading',
      'This upload has already been completed.',
    )
    const queued = await scope.repository.command({
      resource: 'media',
      action: 'complete_upload',
      id,
      version: input.version,
      data: {},
      actor,
    })
    if (mediaProcessingMode(scope.config) !== 'quarantine') {
      try {
        await drainJobs(scope, {
          maxBatches: 3,
          batchSize: 3,
          timeBudgetMs: 18000,
        })
        const updated = await scope.repository.get('media', id, actor)
        if (updated)
          return response(updated, updated.status === 'ready' ? 200 : 202)
      } catch {
        // Keep the durable quarantined state when background scanning fails.
      }
    }
    return response(queued, 202)
  }
  if (request.method === 'PATCH' && !action) {
    const input = z
      .object({
        version: z.number().int().positive(),
        name: z.string().trim().min(1).max(180),
        alt: localized,
      })
      .strict()
      .parse(await readBody(request))
    return response(
      await scope.repository.command({
        resource: 'media',
        action: 'update',
        id,
        version: input.version,
        data: { name: input.name, alt: input.alt },
        actor,
      }),
    )
  }
  if (request.method === 'DELETE' && !action) {
    const input = z
      .object({ version: z.number().int().positive() })
      .strict()
      .parse(await readBody(request))
    const deleted = await scope.repository.command({
      resource: 'media',
      action: 'delete',
      id,
      version: input.version,
      data: {},
      actor,
    })
    try {
      await drainJobs(scope, {
        maxBatches: 2,
        batchSize: 3,
        timeBudgetMs: 8000,
      })
    } catch {
      // Deletion job stays queued in mas.jobs if storage cleanup is delayed.
    }
    return response(deleted)
  }
  throw missing()
}
