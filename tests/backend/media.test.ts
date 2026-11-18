import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { sanitizeUpload } from '../../lib/server/media-processing'

test('images are decoded and re-encoded; mismatched MIME and declared sizes fail', async () => {
  const image = await sharp({
    create: { width: 20, height: 20, channels: 3, background: '#123456' },
  })
    .png()
    .toBuffer()
  const result = await sanitizeUpload(image, 'image/png', image.length)
  assert.equal(result.mime, 'image/webp')
  assert.equal((await sharp(result.bytes).metadata()).format, 'webp')
  await assert.rejects(
    () => sanitizeUpload(image, 'image/jpeg', image.length),
    { code: 'INVALID_MEDIA' },
  )
  await assert.rejects(
    () => sanitizeUpload(image, 'image/png', image.length + 1),
    { code: 'INVALID_MEDIA' },
  )
  await assert.rejects(
    () => sanitizeUpload(Buffer.from('not-an-image'), 'image/png', 12),
    { code: 'INVALID_MEDIA' },
  )
})
test('PDF parser rejects malformed files and active JavaScript in inline dictionaries', async () => {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage()
  const bytes = Buffer.from(await pdf.save())
  assert.equal(
    (await sanitizeUpload(bytes, 'application/pdf', bytes.length)).mime,
    'application/pdf',
  )
  page.node.set(
    PDFName.of('Annots'),
    pdf.context.obj([
      {
        Type: 'Annot',
        Subtype: 'Link',
        A: { S: 'JavaScript', JS: PDFString.of('alert(1)') },
      },
    ]),
  )
  const unsafe = Buffer.from(await pdf.save())
  await assert.rejects(
    () => sanitizeUpload(unsafe, 'application/pdf', unsafe.length),
    { code: 'INVALID_MEDIA' },
  )
  await assert.rejects(
    () => sanitizeUpload(Buffer.from('%PDF-not-valid'), 'application/pdf', 14),
    { code: 'INVALID_MEDIA' },
  )
})

test('validation-only processing still rejects invalid uploads; required mode keeps files quarantined without a scanner', async () => {
  const { drainJobs } = await import('../../lib/server/jobs')
  const { mediaProcessingMode } = await import('../../lib/server/environment')
  assert.equal(mediaProcessingMode({}), 'quarantine')
  assert.equal(mediaProcessingMode({ mediaScanMode: 'validation-only' }), 'quarantine')
  assert.equal(mediaProcessingMode({ mediaScanMode: 'validation_only' }), 'validation_only')
  assert.equal(mediaProcessingMode({ scannerUrl: 'https://scanner.example', scannerKey: 'x'.repeat(32) }), 'antivirus')
  const valid = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#123456' } }).png().toBuffer()
  for (const scenario of [
    { mode: 'validation_only', bytes: valid, completed: true },
    { mode: 'required', bytes: valid, completed: false },
    { mode: 'validation_only', bytes: Buffer.from('invalid-image'), completed: false },
  ]) {
    const uploads: Array<{ bytes: Buffer; mime: string }> = []
    const removed: string[] = []
    let pending = true
    let finish: Record<string, any> | undefined
    const scope: any = {
      config: { mediaScanMode: scenario.mode },
      service: { storage: { from: () => ({
        download: async () => ({ data: new Blob([new Uint8Array(scenario.bytes)]), error: null }),
        upload: async (_path: string, bytes: Buffer, options: { contentType: string }) => {
          uploads.push({ bytes, mime: options.contentType }); return { error: null }
        },
        remove: async (paths: string[]) => { removed.push(...paths); return { error: null } },
      }) } },
      repository: { rpc: async (name: string, args: Record<string, any>) => {
        if (name === 'mas_claim_jobs') {
          if (!pending) return []
          pending = false
          return [{ id: 'job', leaseToken: 'lease', kind: 'scan_media', payload: {} }]
        }
        if (name === 'mas_job_snapshot') return {
          id: 'media', storagePath: 'quarantine/original', mime: 'image/png',
          size: scenario.bytes.length, visibility: 'public',
        }
        if (name === 'mas_finish_job') { finish = args; return {} }
      } },
    }
    const [result] = await drainJobs(scope)
    assert.equal(result.status, scenario.completed ? 'completed' : 'retry_pending')
    assert.equal(uploads.length, scenario.completed ? 1 : 0)
    assert.equal(removed.length, scenario.completed ? 1 : 0)
    assert.equal(finish?.p_error === null, scenario.completed)
    if (scenario.completed) {
      assert.equal(uploads[0].mime, 'image/webp')
      assert.equal((await sharp(uploads[0].bytes).metadata()).format, 'webp')
    }
  }
})
