import test from 'node:test'
import assert from 'node:assert/strict'
import {
  productInput,
  unitInput,
  attributeInput,
  followUpInput,
  contentInput,
  quotationInput,
} from '../../lib/server/contracts'
test('unit and technical attribute codes accept normal business notation', () => {
  assert.equal(
    unitInput.parse({ name: { ar: 'لتر', en: 'Litre' }, code: 'L' }).code,
    'l',
  )
  assert.equal(
    attributeInput.parse({
      name: { ar: 'لزوجة', en: 'Viscosity' },
      code: 'iso_vg',
      type: 'number',
      scope: 'product',
    }).code,
    'iso_vg',
  )
})
test('product drafts do not require publication-only references or selling variants', () => {
  const draft = productInput.parse({
    name: { ar: 'مسودة', en: 'Draft' },
    slug: 'draft',
    family: 'oils',
  })
  assert.equal(draft.categoryId, null)
  assert.equal(draft.brandId, null)
  assert.deepEqual(draft.variants, [])
})
test('structured content retains image references, cards and bilingual points', () => {
  const id = '12345678-1234-4234-8234-123456789abc'
  const data = contentInput.parse({
    key: 'about',
    name: { ar: 'عن الشركة', en: 'About' },
    body: { ar: 'نص', en: 'Body' },
    mediaIds: [id],
    layout: {
      imageMediaId: id,
      cards: [
        {
          title: { ar: 'عنوان', en: 'Title' },
          body: { ar: 'نص', en: 'Body' },
          imageMediaId: id,
        },
      ],
      points: [{ ar: 'نقطة', en: 'Point' }],
    },
  })
  assert.deepEqual(data.mediaIds, [id])
  assert.equal(data.layout?.cards[0].imageMediaId, id)
})
test('quotation lines retain both descriptions independent of PDF language', () => {
  const data = quotationInput.parse({
    locale: 'en',
    currency: 'USD',
    validUntil: '2099-01-01',
    leadTime: 'Week',
    terms: 'Terms',
    lines: [
      {
        description: 'Oil',
        descriptionLocalized: { ar: 'زيت', en: 'Oil' },
        unit: 'l',
        quantity: 1,
        price: '1',
      },
    ],
  })
  assert.equal(data.lines[0].descriptionLocalized?.ar, 'زيت')
})
