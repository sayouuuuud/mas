import 'server-only'
import { timingSafeEqual, createHash } from 'node:crypto'
import { z } from 'zod'
import { sanitizeUpload } from './media-processing'
import type { NextRequest } from 'next/server'
import type { RequestScope } from './auth'
import type { Actor, Quotation } from './contracts'
import { response, readBody, limit } from './http'
import { secret } from './environment'
import { ApiError, assert, unavailable } from './errors'
import { requireActor } from './policy'
import { quotationPdf } from './pdf'

export type Job = {
  id: string
  leaseToken: string
  kind: 'scan_media' | 'quotation_pdf' | 'delete_media'
  payload: Record<string, unknown>
}

export type JobResult = {
  id: string
  kind: Job['kind']
  status: 'completed' | 'retry_pending'
  code?: string
}

async function scan(bytes: Buffer, scope: RequestScope) {
  const endpoint = scope.config.scannerUrl
  if (!endpoint) throw unavailable()
  const url = new URL(endpoint)
  assert(
    url.protocol === 'https:' && !url.username && !url.password,
    'Configure a secure malware scanner endpoint.',
  )
  const digest = createHash('sha256').update(bytes).digest('hex')
  const result = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${secret(scope.config.scannerKey, 32)}`,
      'Content-Type': 'application-octet-stream'.replace(
        'application-octet-stream',
        'application/octet-stream',
      ),
      'X-Content-SHA256': digest,
    },
    body: new Uint8Array(bytes),
  })
  if (!result.ok) throw unavailable()
  const verdict = await result.json()
  if (verdict.sha256 !== digest) throw unavailable()
  if (verdict.clean !== true)
    throw new ApiError(
      422,
      'UNSAFE_FILE',
      'The uploaded file did not pass the security scan.',
    )
}

async function execute(job: Job, scope: RequestScope) {
  const storage = scope.service!.storage
  const rpc = scope.repository.rpc?.bind(scope.repository)
  if (!rpc) throw unavailable()

  if (job.kind === 'quotation_pdf') {
    const snapshot = await rpc<{
      quotation: Quotation
      customer: Record<string, unknown>
      company: Record<string, unknown>
    }>('mas_job_snapshot', { p_id: job.id, p_lease: job.leaseToken }, true)
    const bytes = await quotationPdf(
      snapshot.quotation,
      snapshot.customer || {},
      snapshot.company || {},
    )
    const path = `quotations/${snapshot.quotation.id}/r${snapshot.quotation.revision}.pdf`
    const result = await storage
      .from('sales-private')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
    if (result.error) throw unavailable()
    return { pdfPath: path }
  }

  if (job.kind === 'delete_media') {
    const result = await storage
      .from(String(job.payload.bucket))
      .remove([String(job.payload.path)])
    if (result.error) throw unavailable()
    return { deleted: true }
  }

  const media = await rpc<Record<string, unknown>>(
    'mas_job_snapshot',
    { p_id: job.id, p_lease: job.leaseToken },
    true,
  )
  const result = await storage
    .from('quarantine')
    .download(String(media.storagePath))
  if (result.error || !result.data) throw unavailable()
  const bytes = Buffer.from(await result.data.arrayBuffer())
  const sanitized = await sanitizeUpload(
    bytes,
    String(media.mime),
    Number(media.size),
  )
  await scan(bytes, scope)
  const output = sanitized.bytes,
    mime = sanitized.mime
  const bucket =
    media.visibility === 'public' ? 'catalog-public' : 'catalog-private'
  const path = `${media.id}/${createHash('sha256').update(output).digest('hex')}.${mime === 'application/pdf' ? 'pdf' : 'webp'}`
  const uploaded = await storage.from(bucket).upload(path, output, {
    contentType: mime,
    upsert: true,
    cacheControl: '3600',
  })
  if (uploaded.error) throw unavailable()
  const removed = await storage
    .from('quarantine')
    .remove([String(media.storagePath)])
  if (removed.error) throw unavailable()
  return {
    path,
    mime,
    size: output.length,
    sha256: createHash('sha256').update(output).digest('hex'),
  }
}

export async function drainJobs(
  scope: RequestScope,
  options: {
    maxBatches?: number
    batchSize?: number
    timeBudgetMs?: number
  } = {},
): Promise<JobResult[]> {
  if (!scope.service || !scope.repository.rpc) throw unavailable()
  const maxBatches = Math.min(20, Math.max(1, options.maxBatches ?? 6))
  const batchSize = Math.min(5, Math.max(1, options.batchSize ?? 5))
  const deadline = Date.now() + (options.timeBudgetMs ?? 25000)
  const results: JobResult[] = []

  for (let batch = 0; batch < maxBatches && Date.now() < deadline; batch++) {
    const jobs = await scope.repository.rpc<Job[]>(
      'mas_claim_jobs',
      { p_limit: batchSize },
      true,
    )
    if (!jobs.length) break
    for (const job of jobs) {
      try {
        const result = await execute(job, scope)
        await scope.repository.rpc(
          'mas_finish_job',
          {
            p_id: job.id,
            p_lease: job.leaseToken,
            p_result: result,
            p_error: null,
          },
          true,
        )
        results.push({ id: job.id, kind: job.kind, status: 'completed' })
      } catch (error) {
        // Store a safe code, never upstream credentials, URLs or customer data.
        const code =
          error instanceof ApiError ? error.code : 'PROCESSING_FAILED'
        await scope.repository.rpc(
          'mas_finish_job',
          {
            p_id: job.id,
            p_lease: job.leaseToken,
            p_result: {},
            p_error: code,
          },
          true,
        )
        results.push({
          id: job.id,
          kind: job.kind,
          status: 'retry_pending',
          code,
        })
      }
      if (Date.now() >= deadline) break
    }
  }

  return results
}

export async function runJobs(
  request: NextRequest,
  scope: RequestScope,
  path: string[],
) {
  if (path.join('/') !== 'jobs' || !['POST', 'GET'].includes(request.method))
    throw new ApiError(404, 'NOT_FOUND', 'The endpoint is not available.')
  const expected = secret(scope.config.jobSecret, 32),
    supplied =
      request.headers.get('authorization')?.replace(/^Bearer /, '') || ''
  const suppliedBytes = Buffer.from(supplied), expectedBytes = Buffer.from(expected)
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes))
    throw new ApiError(401, 'UNAUTHENTICATED', 'Worker authentication failed.')
  const processed = await drainJobs(scope)
  return response({ processed })
}

export async function adminJobsController(
  request: NextRequest,
  scope: RequestScope,
  actor: Actor,
) {
  requireActor(actor)
  await limit(scope, request, `jobs:${actor.id}`, 20, 600, actor.id)
  if (!scope.service || !scope.repository.rpc) throw unavailable()

  const input = request.body !== null
    ? z
        .object({
          quotationId: z.uuid().optional(),
          mediaId: z.uuid().optional(),
        })
        .strict()
        .parse(await readBody(request))
    : {}

  if (input.quotationId) {
    await scope.repository.rpc(
      'mas_retry_job',
      {
        p_resource: 'quotations',
        p_id: input.quotationId,
        p_actor: actor.id,
        p_aal: actor.aal,
      },
      true,
    )
  }
  if (input.mediaId) {
    await scope.repository.rpc(
      'mas_retry_job',
      {
        p_resource: 'media',
        p_id: input.mediaId,
        p_actor: actor.id,
        p_aal: actor.aal,
      },
      true,
    )
  }

  const processed = await drainJobs(scope)
  const quotation = input.quotationId
    ? await scope.repository.get('quotations', input.quotationId, actor)
    : undefined
  const media = input.mediaId
    ? await scope.repository.get('media', input.mediaId, actor)
    : undefined

  return response({
    processed,
    ...(quotation ? { quotation } : {}),
    ...(media ? { media } : {}),
  })
}
