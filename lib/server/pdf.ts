import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Quotation } from './contracts'
import { quoteTotals } from '../frontend-model'
import { assert } from './errors'

export async function quotationPdf(
  quotation: Quotation,
  customer: Record<string, unknown>,
  company: Record<string, unknown>,
): Promise<Uint8Array> {
  const totals = quoteTotals(
    quotation.lines.map((line, i) => ({ ...line, id: String(i) })),
  )
  assert(totals.valid, 'Invalid quotation amounts.')
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const fontRoot = path.join(process.cwd(), 'public', 'fonts')
  const font = await document.embedFont(
    await readFile(path.join(fontRoot, 'tajawal-regular.ttf')),
    { subset: true },
  )
  const title = quotation.locale === 'ar' ? 'عرض سعر' : 'Quotation'
  document.setTitle(`${title} ${quotation.number || quotation.id}`)
  document.setProducer('M.A.S')
  let page = document.addPage([595, 842]),
    y = 790
  const line = (text: string, size = 11) => {
    const runs = (value: string) =>
      value.match(
        /[\u0600-\u06ff]+(?:\s+[\u0600-\u06ff]+)*|[^\u0600-\u06ff]+/g,
      ) || []
    const width = (value: string) =>
      runs(value).reduce(
        (sum, run) => sum + font.widthOfTextAtSize(run, size),
        0,
      )
    for (const paragraph of text
      .replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ')
      .split('\n')) {
      let current = ''
      const flush = () => {
        if (y < 55) {
          page = document.addPage([595, 842])
          y = 790
        }
        const rtl = /^[^a-zA-Z\u0600-\u06ff]*[\u0600-\u06ff]/.test(current)
        const parts = runs(current)
        if (rtl) parts.reverse()
        let x = rtl ? 555 - width(current) : 40
        for (const part of parts) {
          page.drawText(part, {
            x,
            y,
            size,
            font,
            color: rgb(0.09, 0.19, 0.23),
          })
          x += font.widthOfTextAtSize(part, size)
        }
        y -= size + 9
      }
      for (const word of paragraph.split(/\s+/)) {
        if (current && width(current + ' ' + word) > 515) {
          flush()
          current = ''
        }
        // Split unusually long identifiers instead of writing outside the page.
        for (const char of (current ? ' ' : '') + word) {
          if (current && width(current + char) > 515) {
            flush()
            current = ''
          }
          current += char
        }
      }
      if (current) flush()
    }
  }
  const localized = (value: unknown) =>
    typeof value === 'object' && value
      ? String((value as Record<string, unknown>)[quotation.locale] || '')
      : String(value || '')
  const t = (ar: string, en: string) => (quotation.locale === 'ar' ? ar : en)
  const pair = (label: string, value: string) => {
    line(label, 10)
    line(value, 12)
  }
  line(localized(company.name) || 'M.A.S Engineering For Trade', 18)
  line(title, 18)
  line(`${quotation.number || quotation.id} | Rev ${quotation.revision}`, 12)
  if (customer.name) pair(t('العميل', 'Customer'), String(customer.name))
  if (customer.company) line(String(customer.company))
  const contact = [customer.phone, customer.email].filter(Boolean).join(' | ')
  if (contact) line(contact)
  pair(
    t('الصلاحية والعملة', 'Validity and currency'),
    `${quotation.validUntil} | ${quotation.currency}`,
  )
  y -= 10
  quotation.lines.forEach((item, i) => {
    line(item.description, 12)
    line(`#${i + 1} | ${item.sku}`)
    pair(
      t('الكمية والوحدة وسعر الوحدة', 'Quantity, unit and unit price'),
      `${item.quantity} | ${item.unit} | ${item.price}`,
    )
    pair(
      t('الخصم والضريبة وإجمالي البند', 'Discount, tax and line total'),
      `${item.discount} | ${item.tax}% | ${(totals.rows[i].total / 100).toFixed(2)} ${quotation.currency}`,
    )
  })
  y -= 10
  pair(
    t('الصافي', 'Net'),
    `${(totals.net / 100).toFixed(2)} ${quotation.currency}`,
  )
  pair(
    t('الضريبة', 'Tax'),
    `${(totals.tax / 100).toFixed(2)} ${quotation.currency}`,
  )
  pair(
    t('الإجمالي', 'Total'),
    `${(totals.total / 100).toFixed(2)} ${quotation.currency}`,
  )
  pair(t('مدة التوريد', 'Lead time'), quotation.leadTime)
  pair(t('الشروط', 'Terms'), quotation.terms)
  return document.save()
}
