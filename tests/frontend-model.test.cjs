const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function loadTypeScript(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', result.outputText)(module, module.exports, require)
  return module.exports
}

const { quoteTotals, validQuantity, phoneE164 } = loadTypeScript('lib/frontend-model.ts')
const { parseCsv } = loadTypeScript('lib/csv-preview.ts')
const line = { id: 'example', description: 'Sample pack', sku: 'DEMO', quantity: 3, unit: 'pack', price: '100.25', discount: '0', tax: '14' }

test('line tax rounds half up, and totals are integer cents', () => {
  const result = quoteTotals([line])
  assert.equal(result.valid, true)
  assert.equal(result.net, 30075)
  assert.equal(result.tax, 4211)
  assert.equal(result.total, 34286)
})
test('sub-cent unit prices round to cents after quantity and discount', () => {
  assert.equal(quoteTotals([{ ...line, quantity: 1, price: '0.005', tax: '0' }]).total, 1)
  assert.equal(quoteTotals([{ ...line, quantity: 1, price: '0.0049', tax: '0' }]).total, 0)
  assert.equal(quoteTotals([{ ...line, quantity: 2, price: '0.005', discount: '0.01', tax: '0' }]).total, 0)
})
test('fractional quantities are allowed for measured units, not packs', () => {
  assert.equal(quoteTotals([{ ...line, quantity: 1.001, unit: 'kg', price: '10', tax: '0' }]).total, 1001)
  assert.equal(quoteTotals([{ ...line, quantity: 1.001 }]).valid, false)
  for (const invalid of [NaN, Infinity, 0, -1, 1e-10, 100000]) assert.equal(validQuantity(invalid, 'kg'), false)
})
test('invalid discounts, rates and unsafe totals cannot be issued', () => {
  assert.equal(quoteTotals([{ ...line, discount: '999999' }]).valid, false)
  assert.equal(quoteTotals([{ ...line, tax: '101' }]).valid, false)
  assert.equal(quoteTotals([{ ...line, price: '-1' }]).valid, false)
  assert.equal(quoteTotals(Array.from({ length: 30 }, (_, i) => ({ ...line, id: String(i), quantity: 99999, price: '100000000' }))).valid, false)
})
test('Egyptian and international telephone links normalize correctly', () => {
  assert.equal(phoneE164('0100 499 8655'), '+201004998655')
  assert.equal(phoneE164('02 / 4804 6114'), '+20248046114')
  assert.equal(phoneE164('+201004998655'), '+201004998655')
  assert.equal(phoneE164('٠١٠٠٤٩٩٨٦٥٥'), '+201004998655')
  assert.equal(phoneE164('0044 12345678'), '+4412345678')
})
test('CSV handles BOM, quoted delimiters, newlines and escaped quotes', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"multi\nline","quoted ""value"""'), [['a', 'b'], ['multi\nline', 'quoted "value"']])
  assert.deepEqual(parseCsv('a,b\n"x,y",z\n'), [['a', 'b'], ['x,y', 'z']])
})
test('CSV rejects unclosed or misplaced quotes', () => {
  assert.throws(() => parseCsv('a,b\n"unclosed,x'))
  assert.throws(() => parseCsv('a,b\nx"y,z'))
})
