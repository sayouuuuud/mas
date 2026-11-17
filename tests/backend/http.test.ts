import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import {
  readBody,
  originGuard,
  resolveTrustedOrigin,
  failure,
} from '../../lib/server/http'
import { csvCell } from '../../lib/server/exports'
import { ApiError } from '../../lib/server/errors'
import { convert, databaseError } from '../../lib/server/supabase-repository'

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

test('cookie mutations require allowlisted origin; Host header is never trusted', () => {
  const allowed = new Set(['https://app.test', 'https://preview.app.test'])
  assert.throws(
    () =>
      originGuard(
        new NextRequest('https://app.test', {
          headers: { cookie: 'session=x' },
        }),
        allowed,
      ),
    { status: 403 },
  )
  assert.throws(
    () =>
      originGuard(
        new NextRequest('https://evil.test', {
          headers: {
            host: 'evil.test',
            origin: 'https://evil.test',
            cookie: 'session=x',
          },
        }),
        allowed,
      ),
    { status: 403 },
  )
  assert.throws(
    () =>
      originGuard(
        new NextRequest('https://app.test', {
          headers: { origin: 'https://evil.test', authorization: 'Bearer a' },
        }),
        allowed,
      ),
    { status: 403 },
  )
  originGuard(
    new NextRequest('https://app.test', {
      headers: { origin: 'https://preview.app.test', cookie: 'session=x' },
    }),
    allowed,
  )
  assert.equal(
    resolveTrustedOrigin(
      new NextRequest('https://evil.test', {
        headers: { host: 'evil.test', origin: 'https://evil.test' },
      }),
      { origin: 'https://app.test', allowedOrigins: allowed },
    ),
    'https://app.test',
  )
  assert.equal(
    resolveTrustedOrigin(
      new NextRequest('https://preview.app.test', {
        headers: { origin: 'https://preview.app.test' },
      }),
      { origin: 'https://app.test', allowedOrigins: allowed },
    ),
    'https://preview.app.test',
  )
})

test('CSV prevents spreadsheet formula injection including leading whitespace', () => {
  for (const value of ['=1+1', '+cmd', '-2', '@SUM(A1)', '  =1', '\t=2'])
    assert.ok(csvCell(value).startsWith('"\''))
  assert.equal(csvCell('a"b'), '"a""b"')
})

test('convert preserves report status and source keys while camelCasing row columns', () => {
  const converted = convert({
    overdue_follow_ups: 2,
    by_status: { in_progress: 3, awaiting_customer: 1 },
    by_source: { google_ads: 4 },
  })
  assert.equal(converted.overdueFollowUps, 2)
  assert.equal(converted.byStatus.in_progress, 3)
  assert.equal(converted.byStatus.awaiting_customer, 1)
  assert.equal(converted.bySource.google_ads, 4)
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
