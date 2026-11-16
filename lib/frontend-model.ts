export type PreviewMedia = {
  id: string
  name: string
  url: string
  mime: string
  size: number
  altAr: string
  altEn: string
  status: 'ready' | 'archived'
}
export type PreviewAudit = {
  id: string
  at: string
  action: string
  entity: string
}
export type QuoteLine = {
  id: string
  description: string
  sku: string
  quantity: number
  unit: string
  price: string
  discount: string
  tax: string
}
export type PreviewQuotation = {
  id: string
  requestId: string
  revision: number
  state:
    | 'draft'
    | 'issued'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'expired'
    | 'superseded'
  locale: 'ar' | 'en'
  currency: 'EGP' | 'USD' | 'EUR'
  validUntil: string
  leadTime: string
  terms: string
  lines: QuoteLine[]
  createdAt: string
  sentAt?: string
  channel?: string
}
export function csvDownload(
  name: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const cell = (value: string | number) => {
    const raw = String(value)
    return (
      '"' +
      (/^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""') +
      '"'
    )
  }
  const blob = new Blob(
    [
      '\uFEFF' +
        [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n'),
    ],
    { type: 'text/csv;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function validQuantity(value: number, unit: string) {
  return (
    Number.isFinite(value) &&
    value >= 0.001 &&
    value <= 99999 &&
    (unit === 'pack' || unit === 'piece'
      ? Number.isInteger(value)
      : Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001)
  )
}
function scaled(value: string, digits: number) {
  const [whole, decimal = ''] = value.split('.')
  return (
    BigInt(whole || '0') * BigInt(10 ** digits) +
    BigInt(decimal.padEnd(digits, '0').slice(0, digits) || '0')
  )
}
function roundedDivide(value: bigint, divisor: bigint) {
  return (value + divisor / BigInt(2)) / divisor
}
// Decimal arithmetic uses BigInt; monetary outputs are integer cents.
export function quoteTotals(lines: QuoteLine[]) {
  let valid = lines.length > 0
  const rows = lines.map((line) => {
    const price = Number(line.price),
      qty = Number(line.quantity),
      discount = Number(line.discount || 0),
      tax = Number(line.tax || 0)
    const okay =
      line.description.trim() &&
      line.unit.trim() &&
      /^\d+(\.\d{1,4})?$/.test(line.price) &&
      validQuantity(qty, line.unit) &&
      price <= 100000000 &&
      /^\d+(\.\d{1,2})?$/.test(line.discount || '0') &&
      /^\d+(\.\d{1,2})?$/.test(line.tax || '0') &&
      discount <= qty * price &&
      tax >= 0 &&
      tax <= 100
    if (!okay) {
      valid = false
      return { net: 0, tax: 0, total: 0 }
    }
    const raw = scaled(line.price, 4) * scaled(qty.toFixed(3), 3)
    const discountScaled = scaled(line.discount || '0', 2) * BigInt(100000)
    if (discountScaled > raw) {
      valid = false
      return { net: 0, tax: 0, total: 0 }
    }
    const net = Number(roundedDivide(raw - discountScaled, BigInt(100000)))
    const taxCents = Number(
      roundedDivide(BigInt(net) * scaled(line.tax || '0', 2), BigInt(10000)),
    )
    return { net, tax: taxCents, total: net + taxCents }
  })
  return {
    valid:
      valid &&
      ['net', 'tax', 'total'].every((key) =>
        Number.isSafeInteger(
          rows.reduce((sum, row) => sum + row[key as keyof typeof row], 0),
        ),
      ),
    rows,
    net: rows.reduce((s, r) => s + r.net, 0),
    tax: rows.reduce((s, r) => s + r.tax, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
  }
}
export function phoneE164(value: string) {
  const digits = value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^0-9]/g, '')
  return (
    '+' +
    (digits.startsWith('00')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? '20' + digits.slice(1)
        : digits)
  )
}
