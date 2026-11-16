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
