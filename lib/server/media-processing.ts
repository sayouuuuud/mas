import sharp from 'sharp'
import { PDFDocument, PDFDict, PDFName, PDFArray } from 'pdf-lib'
import { ApiError } from './errors'

export async function sanitizeUpload(
  bytes: Buffer,
  mime: string,
  expectedSize: number,
): Promise<{ bytes: Buffer; mime: string }> {
  const invalid = () =>
    new ApiError(
      422,
      'INVALID_MEDIA',
      'The file contents do not match a supported, safe document or image.',
    )
  if (bytes.length !== expectedSize || bytes.length > 20 * 1024 * 1024)
    throw invalid()
  try {
    if (mime.startsWith('image/')) {
      if (bytes.length > 5 * 1024 * 1024) throw invalid()
      const image = sharp(bytes, {
        limitInputPixels: 40000000,
        failOn: 'warning',
        animated: false,
      })
      const metadata = await image.metadata()
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
        (metadata.pages && metadata.pages !== 1) ||
        `image/${metadata.format}` !== mime
      )
        throw invalid()
      return {
        bytes: await image.rotate().webp({ quality: 88 }).toBuffer(),
        mime: 'image/webp',
      }
    }
    if (
      mime !== 'application/pdf' ||
      bytes.subarray(0, 5).toString() !== '%PDF-'
    )
      throw invalid()
    const pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    })
    if (!pdf.getPageCount() || pdf.getPageCount() > 1000) throw invalid()
    const forbidden = new Set([
      'JS',
      'JavaScript',
      'Launch',
      'EmbeddedFile',
      'EmbeddedFiles',
      'OpenAction',
      'AA',
      'XFA',
      'RichMedia',
      'SubmitForm',
      'ImportData',
    ])
    const visited = new Set<unknown>()
    const inspect = (object: unknown) => {
      if (visited.has(object)) return
      visited.add(object)
      if (visited.size > 100000) throw invalid()
      if (object instanceof PDFName && forbidden.has(object.decodeText()))
        throw invalid()
      if (object instanceof PDFDict)
        for (const [key, value] of object.entries()) {
          if (forbidden.has(key.decodeText())) throw invalid()
          inspect(value)
        }
      if (object instanceof PDFArray)
        for (const value of object.asArray()) inspect(value)
    }
    for (const [, object] of pdf.context.enumerateIndirectObjects())
      inspect(object)
    return { bytes, mime }
  } catch {
    throw invalid()
  }
}
