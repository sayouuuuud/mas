import test from 'node:test'
import assert from 'node:assert/strict'
import { configuration } from '../../lib/server/environment'

test('local Supabase HTTP is restricted to loopback development environments', () => {
  const before = { ...process.env }
  try {
    process.env.SUPABASE_PUBLISHABLE_KEY = 'local-test-key'
    process.env.SITE_URL = 'https://app.example.test'
    const check = (url: string, production: boolean, accepted: boolean) => {
      process.env.SUPABASE_URL = url
      Object.assign(process.env, { NODE_ENV: production ? 'production' : 'development' })
      if (accepted) assert.equal(configuration().url, url)
      else assert.throws(configuration, { status: 503 })
    }
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      check(`http://${host}:54321`, false, true)
      check(`http://${host}:54321`, true, false)
    }
    for (const url of ['http://db.example.test', 'http://localhost.example.test', 'http://localhost@evil.test', 'http://localhost:54321?token=x', 'http://localhost:54321#x']) {
      check(url, false, false)
    }
    check('https://project.supabase.co', true, true)
    check('https://project.supabase.co', false, true)
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]
    Object.assign(process.env, before)
  }
})
