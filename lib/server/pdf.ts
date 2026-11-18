import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Quotation } from './contracts'
import { quoteTotals } from '../frontend-model'
import { assert } from './errors'

const ARABIC_RE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/
const BIDI_TOKENS =
  /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+(?:\s+[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+)*|\s+|[^\s\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+(?:\s+[^\s\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+)*/g

function tokenizeBidi(text: string): string[] {
  return text.match(BIDI_TOKENS) || []
}

function measureBidi(font: PDFFont, text: string, size: number): number {
  return tokenizeBidi(text).reduce(
    (sum, run) => sum + font.widthOfTextAtSize(run, size),
    0,
  )
}

function drawBidiText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  options: {
    xLeft: number
    xRight: number
    y: number
    size: number
    align?: 'start' | 'end'
    rtl: boolean
    color?: ReturnType<typeof rgb>
  },
) {
  const cleaned = text.replace(/[\u0000-\u001f]/g, ' ').trim()
  if (!cleaned) return
  const lineRtl = options.rtl || ARABIC_RE.test(cleaned)
  const rawTokens = tokenizeBidi(cleaned)
  const tokens = lineRtl ? rawTokens.slice().reverse() : rawTokens
  const totalWidth = tokens.reduce(
    (sum, tk) => sum + font.widthOfTextAtSize(tk, options.size),
    0,
  )
  const alignRight = options.align === 'end' ? !options.rtl : options.rtl
  let x = alignRight
    ? Math.max(options.xLeft, options.xRight - totalWidth)
    : options.xLeft
  const color = options.color || rgb(0.09, 0.19, 0.23)
  for (const tk of tokens) {
    page.drawText(tk, { x, y: options.y, size: options.size, font, color })
    x += font.widthOfTextAtSize(tk, options.size)
  }
}

function wrapParagraphs(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  for (const rawParagraph of text
    .replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ')
    .split('\n')) {
    const paragraph = rawParagraph.trim()
    if (!paragraph) {
      lines.push('')
      continue
    }
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      if (current && measureBidi(font, `${current} ${word}`, size) > maxWidth) {
        lines.push(current)
        current = ''
      }
      if (measureBidi(font, word, size) <= maxWidth) {
        current = current ? `${current} ${word}` : word
      } else {
        for (const ch of word) {
          if (current && measureBidi(font, current + ch, size) > maxWidth) {
            lines.push(current)
            current = ''
          }
          current += ch
        }
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

export async function quotationPdf(
  quotation: Quotation,
  customer: Record<string, unknown>,
  company: Record<string, unknown>,
  logoBytes?: Uint8Array,
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

  const rtl = quotation.locale === 'ar'
  const t = (ar: string, en: string) => (rtl ? ar : en)
  const localized = (value: unknown) =>
    typeof value === 'object' && value
      ? String(
          (value as Record<string, unknown>)[quotation.locale] ||
            (value as Record<string, unknown>).ar ||
            (value as Record<string, unknown>).en ||
            '',
        )
      : String(value || '')

  const title = t('عرض سعر تجاري', 'Commercial Quotation')
  const quoteNo = String(quotation.number || quotation.id)
  document.setTitle(`${title} ${quoteNo}`)
  document.setProducer('M.A.S Engineering For Trade')

  const PAGE_W = 595
  const PAGE_H = 842
  const MARGIN_X = 36
  const CONTENT_W = PAGE_W - MARGIN_X * 2
  const BOTTOM_LIMIT = 64

  const brandDark = rgb(0.07, 0.17, 0.21)
  const brandPrimary = rgb(0.15, 0.5, 0.57)
  const mutedText = rgb(0.36, 0.42, 0.45)
  const lightFill = rgb(0.95, 0.97, 0.98)
  const borderGray = rgb(0.84, 0.88, 0.9)

  const pages: PDFPage[] = []
  let page = document.addPage([PAGE_W, PAGE_H])
  pages.push(page)
  let y = PAGE_H - 44

  const addPage = () => {
    page = document.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    y = PAGE_H - 44
  }

  const ensureSpace = (needed: number, onNewPage?: () => void) => {
    if (y - needed < BOTTOM_LIMIT) {
      addPage()
      onNewPage?.()
    }
  }

  // Top Header Band
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 58,
    width: CONTENT_W,
    height: 66,
    color: brandDark,
  })
  if (logoBytes) {
    const image = await document.embedPng(logoBytes)
    const scale = Math.min(58 / image.width, 46 / image.height)
    page.drawImage(image, {
      x: rtl ? MARGIN_X + 8 : PAGE_W - MARGIN_X - 66,
      y: y - 46,
      width: image.width * scale,
      height: image.height * scale,
    })
  }
  const companyName =
    localized(company.name) ||
    t('إم إيه إس للتجارة الهندسية', 'M.A.S Engineering For Trade')
  drawBidiText(page, font, companyName, {
    xLeft: MARGIN_X + (logoBytes && rtl ? 76 : 16),
    xRight: PAGE_W - MARGIN_X - (logoBytes && !rtl ? 76 : 16),
    y: y - 20,
    size: 16,
    rtl,
    color: rgb(1, 1, 1),
  })
  const companyContact = [company.phone, company.email]
    .filter(Boolean)
    .map(String)
    .join('  |  ')
  if (companyContact) {
    drawBidiText(page, font, companyContact, {
      xLeft: MARGIN_X + 16,
      xRight: PAGE_W - MARGIN_X - 16,
      y: y - 42,
      size: 9.5,
      rtl: false,
      align: rtl ? 'start' : 'end',
      color: rgb(0.82, 0.9, 0.92),
    })
  }
  y -= 76

  // Document Title & Commercial Disclaimer
  drawBidiText(page, font, title, {
    xLeft: MARGIN_X,
    xRight: PAGE_W - MARGIN_X,
    y,
    size: 16,
    rtl,
    color: brandPrimary,
  })
  drawBidiText(
    page,
    font,
    t(
      'عرض سعر تجاري — لا يُعد فاتورة ضريبية',
      'Commercial quotation — not a tax invoice',
    ),
    {
      xLeft: MARGIN_X,
      xRight: PAGE_W - MARGIN_X,
      y: y - 17,
      size: 9.5,
      rtl,
      color: mutedText,
    },
  )
  y -= 36

  // Metadata + Customer Info Cards
  const issuedDate = quotation.issuedAt
    ? String(quotation.issuedAt).slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const metaRows = [
    `${t('رقم العرض', 'Quotation No.')}: ${quoteNo} (R${quotation.revision})`,
    `${t('تاريخ الإصدار', 'Issue Date')}: ${issuedDate}`,
    `${t('صالح حتى', 'Valid Until')}: ${quotation.validUntil}`,
    `${t('العملة', 'Currency')}: ${quotation.currency}`,
  ]
  const customerRows = [
    customer.name ? `${t('العميل', 'Customer')}: ${String(customer.name)}` : '',
    customer.company
      ? `${t('الشركة', 'Company')}: ${String(customer.company)}`
      : '',
    customer.phone ? `${t('الهاتف', 'Phone')}: ${String(customer.phone)}` : '',
    customer.email ? `${t('البريد', 'Email')}: ${String(customer.email)}` : '',
    [customer.city, customer.governorate].filter(Boolean).length
      ? `${t('الموقع', 'Location')}: ${[customer.city, customer.governorate].filter(Boolean).join(' - ')}`
      : '',
  ].filter(Boolean)

  const halfW = (CONTENT_W - 24) / 2
  const wrappedMeta = metaRows.flatMap((row) =>
    wrapParagraphs(font, row, 10, halfW - 8),
  )
  const wrappedCustomer = customerRows.flatMap((row) =>
    wrapParagraphs(font, row, 10, halfW - 8),
  )
  const boxRows = Math.max(wrappedMeta.length, wrappedCustomer.length, 2)
  const boxH = boxRows * 16 + 18
  page.drawRectangle({
    x: MARGIN_X,
    y: y - boxH,
    width: CONTENT_W,
    height: boxH,
    color: lightFill,
    borderColor: borderGray,
    borderWidth: 0.75,
  })

  const metaBox = rtl
    ? { xLeft: PAGE_W - MARGIN_X - 10 - halfW, xRight: PAGE_W - MARGIN_X - 10 }
    : { xLeft: MARGIN_X + 10, xRight: MARGIN_X + 10 + halfW }
  const custBox = rtl
    ? { xLeft: MARGIN_X + 10, xRight: MARGIN_X + 10 + halfW }
    : { xLeft: PAGE_W - MARGIN_X - 10 - halfW, xRight: PAGE_W - MARGIN_X - 10 }

  wrappedMeta.forEach((rowText, idx) => {
    drawBidiText(page, font, rowText, {
      ...metaBox,
      y: y - 18 - idx * 16,
      size: 10,
      rtl,
    })
  })
  wrappedCustomer.forEach((rowText, idx) => {
    drawBidiText(page, font, rowText, {
      ...custBox,
      y: y - 18 - idx * 16,
      size: 10,
      rtl,
    })
  })
  y -= boxH + 18

  // Line Items Table
  const colDefs = [
    { key: 'idx', w: 26, ar: '#', en: '#' },
    { key: 'desc', w: 205, ar: 'البند والكود', en: 'Item & SKU' },
    { key: 'qty', w: 68, ar: 'الكمية', en: 'Qty & Unit' },
    { key: 'price', w: 68, ar: 'سعر الوحدة', en: 'Unit Price' },
    { key: 'disc', w: 54, ar: 'الخصم', en: 'Discount' },
    { key: 'tax', w: 42, ar: 'ضريبة', en: 'Tax %' },
    { key: 'total', w: 60, ar: 'الإجمالي', en: 'Total' },
  ]
  const orderedCols = rtl ? colDefs.slice().reverse() : colDefs

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 22,
      width: CONTENT_W,
      height: 24,
      color: brandPrimary,
    })
    let cursorX = MARGIN_X
    for (const col of orderedCols) {
      drawBidiText(page, font, rtl ? col.ar : col.en, {
        xLeft: cursorX + 4,
        xRight: cursorX + col.w - 4,
        y: y - 15,
        size: 9.5,
        rtl,
        color: rgb(1, 1, 1),
      })
      cursorX += col.w
    }
    y -= 26
  }

  drawTableHeader()

  const moneyFmt = (cents: number) => (cents / 100).toFixed(2)

  quotation.lines.forEach((item, index) => {
    const descLines = wrapParagraphs(
      font,
      item.sku ? `${item.description} (${item.sku})` : item.description,
      9.5,
      195,
    )
    const rowH = Math.max(24, descLines.length * 13 + 10)
    ensureSpace(rowH + 6, drawTableHeader)

    if (index % 2 === 1) {
      page.drawRectangle({
        x: MARGIN_X,
        y: y - rowH + 2,
        width: CONTENT_W,
        height: rowH,
        color: lightFill,
      })
    }
    page.drawLine({
      start: { x: MARGIN_X, y: y - rowH + 2 },
      end: { x: PAGE_W - MARGIN_X, y: y - rowH + 2 },
      thickness: 0.5,
      color: borderGray,
    })

    const values: Record<string, string[]> = {
      idx: [String(index + 1)],
      desc: descLines,
      qty: [`${item.quantity} ${item.unit}`],
      price: [item.price],
      disc: [item.discount || '0'],
      tax: [`${item.tax || '0'}%`],
      total: [moneyFmt(totals.rows[index].total)],
    }

    let cursorX = MARGIN_X
    for (const col of orderedCols) {
      const cellLines = values[col.key] || ['']
      cellLines.forEach((ln, lineIdx) => {
        drawBidiText(page, font, ln, {
          xLeft: cursorX + 4,
          xRight: cursorX + col.w - 4,
          y: y - 13 - lineIdx * 13,
          size: 9.2,
          rtl: col.key === 'desc' ? rtl : false,
        })
      })
      cursorX += col.w
    }
    y -= rowH
  })

  // Totals Summary Box
  y -= 12
  ensureSpace(78)
  const summaryW = 220
  const summaryX = rtl ? MARGIN_X : PAGE_W - MARGIN_X - summaryW
  page.drawRectangle({
    x: summaryX,
    y: y - 66,
    width: summaryW,
    height: 68,
    color: lightFill,
    borderColor: borderGray,
    borderWidth: 0.75,
  })
  const summaryLines = [
    [
      t('الصافي قبل الضريبة', 'Subtotal (Net)'),
      `${moneyFmt(totals.net)} ${quotation.currency}`,
    ],
    [
      t('إجمالي الضريبة المحسوبة', 'Calculated Tax'),
      `${moneyFmt(totals.tax)} ${quotation.currency}`,
    ],
    [
      t('الإجمالي النهائي', 'Grand Total'),
      `${moneyFmt(totals.total)} ${quotation.currency}`,
    ],
  ]
  summaryLines.forEach(([label, val], idx) => {
    const rowY = y - 16 - idx * 20
    const isTotal = idx === 2
    drawBidiText(page, font, `${label}: ${val}`, {
      xLeft: summaryX + 10,
      xRight: summaryX + summaryW - 10,
      y: rowY,
      size: isTotal ? 11 : 9.8,
      rtl,
      color: isTotal ? brandDark : undefined,
    })
  })
  y -= 82

  // Lead Time & Terms
  const drawSection = (heading: string, bodyText: string) => {
    if (!bodyText.trim()) return
    const wrapped = wrapParagraphs(font, bodyText, 10, CONTENT_W - 8)
    ensureSpace(34)
    drawBidiText(page, font, heading, {
      xLeft: MARGIN_X,
      xRight: PAGE_W - MARGIN_X,
      y,
      size: 11,
      rtl,
      color: brandPrimary,
    })
    y -= 16
    for (const ln of wrapped) {
      if (!ln) {
        y -= 8
        continue
      }
      ensureSpace(16)
      drawBidiText(page, font, ln, {
        xLeft: MARGIN_X + 4,
        xRight: PAGE_W - MARGIN_X - 4,
        y,
        size: 10,
        rtl,
      })
      y -= 15
    }
    y -= 8
  }

  drawSection(
    t('مدة التوريد المتوقعة', 'Expected Lead Time'),
    quotation.leadTime,
  )
  drawSection(t('الشروط والأحكام', 'Terms & Conditions'), quotation.terms)

  // Page Numbers Footer
  const totalPages = pages.length
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: PAGE_W - MARGIN_X, y: 42 },
      thickness: 0.5,
      color: borderGray,
    })
    drawBidiText(
      p,
      font,
      rtl
        ? `${quoteNo}  |  صفحة ${idx + 1} من ${totalPages}`
        : `${quoteNo}  |  Page ${idx + 1} of ${totalPages}`,
      {
        xLeft: MARGIN_X,
        xRight: PAGE_W - MARGIN_X,
        y: 26,
        size: 8.5,
        rtl,
        color: mutedText,
      },
    )
  })

  return document.save()
}
