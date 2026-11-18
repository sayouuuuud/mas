import test from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { authController } from '../../lib/server/auth-controller'
import { requireActor } from '../../lib/server/policy'

const actorId = '00000000-0000-4000-8000-000000000001'
const oldId = '00000000-0000-4000-8000-000000000002'
const newId = '00000000-0000-4000-8000-000000000003'
function fixture(
  options: {
    badCode?: boolean
    aal?: string
    targetVerified?: boolean
    removeFails?: boolean
  } = {},
) {
  let aal = options.aal || 'aal2'
  const events: string[] = []
  const factors = [
    { id: oldId, factor_type: 'totp', status: 'verified' },
    {
      id: newId,
      factor_type: 'totp',
      status: options.targetVerified ? 'verified' : 'unverified',
    },
  ]
  const scope: any = {
    config: { rateLimitSecret: 'x'.repeat(32) },
    actor: async () => ({
      id: actorId,
      active: true,
      roles: ['Owner'],
      aal,
      mfaEnabled: true,
    }),
    repository: {
      rateLimit: async () => ({ allowed: true }),
      rpc: async (
        name: string,
        args: Record<string, unknown>,
        service: boolean,
      ) => {
        assert.equal(name, 'mas_set_mfa_requirement')
        assert.equal(service, true)
        assert.equal(args.p_actor, actorId)
        assert.equal(args.p_aal, 'aal2')
        events.push('preference')
        return { mfaEnabled: args.p_required }
      },
    },
    user: {
      auth: {
        mfa: {
          listFactors: async () => ({ data: { all: factors }, error: null }),
          challengeAndVerify: async () => {
            events.push('verify')
            if (options.badCode) return { error: { status: 422 } }
            aal = 'aal2'
            return { error: null }
          },
          unenroll: async ({ factorId }: { factorId: string }) => {
            events.push('remove:' + factorId)
            return { error: options.removeFails ? { status: 503 } : null }
          },
        },
      },
    },
  }
  const call = (body: object) =>
    authController(
      new NextRequest('https://app.test/api/v1/auth/mfa/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      ['mfa', 'settings'],
      scope,
    )
  return { scope, events, call }
}

test('MFA settings verify a fresh code before changing only the authenticated account', async () => {
  const f = fixture()
  const response = await f.call({
    enabled: false,
    factorId: oldId,
    code: '123456',
  })
  assert.deepEqual((await response.json()).data, {
    mfaEnabled: false,
    replaced: false,
  })
  assert.deepEqual(f.events, ['verify', 'preference'])
  const bad = fixture({ badCode: true })
  await assert.rejects(
    () => bad.call({ enabled: false, factorId: oldId, code: '123456' }),
    { code: 'INVALID_MFA_CODE' },
  )
  assert.deepEqual(bad.events, ['verify'])
  await assert.rejects(() =>
    f.call({ enabled: false, factorId: oldId, code: '123456', actorId: newId }),
  )
})

test('rotation verifies and enables the replacement before removing older keys; errors retain recoverable state', async () => {
  const f = fixture()
  await f.call({
    enabled: true,
    replace: true,
    factorId: newId,
    code: '123456',
  })
  assert.deepEqual(f.events, ['verify', 'preference', 'remove:' + oldId])
  const bad = fixture({ badCode: true })
  await assert.rejects(
    () =>
      bad.call({
        enabled: true,
        replace: true,
        factorId: newId,
        code: '123456',
      }),
    { code: 'INVALID_MFA_CODE' },
  )
  assert.deepEqual(bad.events, ['verify'])
  const partial = fixture({ removeFails: true })
  await assert.rejects(
    () =>
      partial.call({
        enabled: true,
        replace: true,
        factorId: newId,
        code: '123456',
      }),
    { code: 'MFA_REPLACEMENT_INCOMPLETE' },
  )
  assert.deepEqual(partial.events, ['verify', 'preference', 'remove:' + oldId])
})

test('password-only sessions cannot replace an existing verified key using an unverified factor', async () => {
  const f = fixture({ aal: 'aal1' })
  await assert.rejects(
    () =>
      f.call({ enabled: true, replace: true, factorId: newId, code: '123456' }),
    { code: 'MFA_REQUIRED' },
  )
  assert.deepEqual(f.events, [])
  await assert.rejects(
    () => f.call({ enabled: false, factorId: newId, code: '123456' }),
    { status: 422 },
  )
})

test('MFA defaults to required; opting out does not bypass active-account or Admin checks', () => {
  const actor: any = {
    id: actorId,
    active: true,
    roles: ['Owner'],
    aal: 'aal1',
  }
  assert.throws(() => requireActor(actor), { code: 'MFA_REQUIRED' })
  assert.doesNotThrow(() => requireActor({ ...actor, mfaEnabled: false }))
  assert.throws(
    () => requireActor({ ...actor, mfaEnabled: false, active: false }),
    { status: 401 },
  )
  assert.throws(
    () => requireActor({ ...actor, mfaEnabled: false, roles: ['Sales Agent'] }),
    { status: 403 },
  )
})
