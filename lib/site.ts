export type Localized = { ar: string; en: string }

export const company = {
  name: { ar: 'إم إيه إس للتجارة الهندسية', en: 'M.A.S Engineering For Trade' },
  support: { ar: 'م. عبدالله محمد', en: 'Eng. Abdullah Mohamed' },
  email: 'mas.eg13@yahoo.com',
} as const

export type PhoneEntry = {
  display: string
  href?: string
}

export const phones = {
  mobile: { display: '0100 499 8655', href: 'tel:+201004998655' },
  office: { display: '02 / 4804 6114', href: 'tel:+20248046114' },
  fax: { display: '02 / 4804 6115' },
  branch: { display: '02 / 2575 1399', href: 'tel:+20225751399' },
} satisfies Record<string, PhoneEntry>

export const addresses = {
  hq: {
    ar: '128 شارع 15 مايو، برج الكوثر، شبرا الخيمة',
    en: '128 15th of May St., Al Kawthar Tower, Shubra El Kheima',
  },
  branch: {
    ar: '11ب عمارات معروف، من شارع الشيخ معروف، قصر النيل',
    en: '11B Maarouf Buildings, off El Sheikh Maarouf St., Qasr El Nil',
  },
  stores: { ar: 'قليوب، القليوبية', en: 'Qalyub, Qalyubia' },
} satisfies Record<string, Localized>

const WHATSAPP_NUMBER = '201004998655'

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export type Partner = {
  name: Localized
  logo?: string
  width?: number
  height?: number
}

export const featuredPartner: Partner = {
  name: { ar: 'OLA Energy', en: 'OLA Energy' },
  logo: '/partners/ola.png',
  width: 330,
  height: 285,
}

export const oilPartners: Partner[] = [
  { name: { ar: 'Pennzoil', en: 'Pennzoil' }, logo: '/partners/pennzoil.png', width: 960, height: 544 },
  { name: { ar: 'مصر للبترول', en: 'Misr Petroleum' }, logo: '/partners/misr.png', width: 330, height: 336 },
  { name: { ar: 'Eni', en: 'Eni' }, logo: '/partners/eni.png', width: 500, height: 194 },
  { name: { ar: 'Petronas', en: 'Petronas' }, logo: '/partners/petronas.png', width: 500, height: 499 },
  { name: { ar: 'ADNOC', en: 'ADNOC' }, logo: '/partners/adnoc.png', width: 960, height: 465 },
  { name: { ar: 'bp', en: 'bp' }, logo: '/partners/bp.png', width: 330, height: 439 },
  { name: { ar: 'NGV', en: 'NGV' } },
]

export const bearingPartners: Partner[] = [
  { name: { ar: 'SKF', en: 'SKF' }, logo: '/partners/skf.png', width: 960, height: 232 },
  { name: { ar: 'NSK', en: 'NSK' }, logo: '/partners/nsk.png', width: 960, height: 383 },
  { name: { ar: 'FAG', en: 'FAG' }, logo: '/partners/fag.png', width: 960, height: 322 },
  { name: { ar: 'INA', en: 'INA' }, logo: '/partners/ina.png', width: 500, height: 500 },
]

export const allBrands: Partner[] = [featuredPartner, ...oilPartners, ...bearingPartners]

export const productKeys = ['oils', 'grease', 'bearings'] as const
export type ProductKey = (typeof productKeys)[number]
export type ProductOption = ProductKey | 'other'
