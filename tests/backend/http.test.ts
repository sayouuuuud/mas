import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { readBody, originGuard, failure } from '../../lib/server/http'
import { csvCell } from '../../lib/server/exports'
import { ApiError } from '../../lib/server/errors'
import { databaseError } from '../../lib/server/supabase-repository'

test('JSON parser enforces MIME, byte limits and valid JSON', async () => {
  await assert.rejects(
    () =>
      readBody(
        new Request('https://example.test', { method: 'POST', body: '{}' }),
      ),
    { status: 415 },
  )
  await assert.rejects(
    () =>
      readBody(
        new Request('https://example.test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"x":"long"}',
        }),
        3,
      ),
    { status: 413 },
  )
  await assert.rejects(
    () =>
      readBody(
        new Request('https://example.test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        }),
      ),
    { status: 400 },
  )
  assert.deepEqual(
    await readBody(
      new Request('https://example.test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"x":1}',
      }),
    ),
    { x: 1 },
  )
})
test('cookie mutations require same-origin; cross-site bearer requests fail', () => {
  assert.throws(
    () =>
      originGuard(
        new NextRequest('https://app.test', {
          headers: { cookie: 'session=x' },
        }),
        'https://app.test',
      ),
    { status: 403 },
  )
  assert.throws(
    () =>
      originGuard(
        new NextRequest('https://app.test', {
          headers: { origin: 'https://evil.test', authorization: 'Bearer a' },
        }),
        'https://app.test',
      ),
    { status: 403 },
  )
  originGuard(
    new NextRequest('https://app.test', {
      headers: { origin: 'https://app.test', cookie: 'session=x' },
    }),
    'https://app.test',
  )
})
test('CSV prevents spreadsheet formula injection including leading whitespace', () => {
  for (const value of ['=1+1', '+cmd', '-2', '@SUM(A1)', '  =1', '\t=2'])
    assert.ok(csvCell(value).startsWith('"\''))
  assert.equal(csvCell('a"b'), '"a""b"')
})
test('unknown backend and database errors never expose raw SQL or secrets', async () => {
  const result = failure(
    new Error('postgres password=secret, customer phone=123'),
  )
  assert.equal(result.status, 500)
  const body = await result.text()
  assert.equal(body.includes('secret'), false)
  assert.equal(body.includes('123'), false)
  assert.throws(
    () => databaseError({ code: 'XX000', message: 'password=secret' }),
    (error) =>
      error instanceof ApiError &&
      error.status === 503 &&
      !error.message.includes('secret'),
  )
})
