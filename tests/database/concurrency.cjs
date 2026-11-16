const test = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const container = process.argv[2]
if (!/^mas-db-tests-\d+$/.test(container || ''))
  throw new Error('Use the isolated database test runner.')

function query(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      'mas_test',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ])
    let output = '',
      error = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      error += chunk
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0
        ? resolve(output.trim().split('\n').at(-1))
        : reject(new Error(error)),
    )
    child.stdin.end(
      `select set_config('request.jwt.claims','{"role":"service_role"}',false);\n${sql}`,
    )
  })
}

test('concurrent submissions, versions, limits and job leases use database locks', async () => {
  const owner = '00000000-0000-4000-8000-000000000001'
  await query(`
    insert into auth.users values('${owner}','owner@example.test');
    insert into mas.profiles(id,display_name,roles) values('${owner}','Test Owner',array['Owner']);
    select public.mas_command('units','create',null,null,'{"name":{"ar":"قطعة","en":"Piece"},"code":"piece","precision":0,"active":true}','${owner}','aal2');
    with policy as (select public.mas_command('content','create',null,null,'{"key":"privacy","name":{"ar":"الخصوصية","en":"Privacy"},"body":{"ar":"اختبار","en":"Test"},"status":"draft","policyVersion":"v1","mediaIds":[]}','${owner}','aal2') row)
    select public.mas_command('content','publish',(row->>'id')::uuid,1,'{}','${owner}','aal2') from policy;
  `)
  const payload = JSON.stringify({
    locale: 'ar',
    customer: { name: 'Test Customer', phone: '+201012345678' },
    items: [
      { description: 'Concurrency item', quantity: 1, unitCode: 'piece' },
    ],
    privacy: { accepted: true, policyVersion: 'v1' },
    source: { page: '/ar/request-quote' },
  })
  const receipts = await Promise.all(
    Array.from({ length: 12 }, () =>
      query(
        `select public.mas_submit('request','${payload}','concurrent-key-0001','same-hash');`,
      ).then(JSON.parse),
    ),
  )
  assert.equal(new Set(receipts.map((row) => row.reference)).size, 1)
  assert.equal(receipts.filter((row) => !row.replayed).length, 1)
  assert.equal(
    await query(
      "select count(*) from mas.entities where resource='quote_requests';",
    ),
    '1',
  )
  const requestId = await query(
    "select id from mas.entities where resource='quote_requests';",
  )
  const writes = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      query(
        `select public.mas_command('quote_requests','note','${requestId}',1,'{"body":"Concurrent note"}','${owner}','aal2');`,
      ),
    ),
  )
  assert.equal(writes.filter((row) => row.status === 'fulfilled').length, 1)
  assert.equal(
    writes.filter(
      (row) =>
        row.status === 'rejected' &&
        row.reason.message.includes('MAS_CONFLICT'),
    ).length,
    1,
  )
  const limits = await Promise.all(
    Array.from({ length: 20 }, () =>
      query(`select public.mas_rate_limit(repeat('b',64),5,60);`).then(
        JSON.parse,
      ),
    ),
  )
  assert.equal(limits.filter((row) => row.allowed).length, 5)
  await query(
    "insert into mas.jobs(kind,payload) values ('delete_media','{}'),('delete_media','{}');",
  )
  const claims = await Promise.all(
    Array.from({ length: 5 }, () =>
      query('select public.mas_claim_jobs(1);').then(JSON.parse),
    ),
  )
  const jobs = claims.flat()
  assert.equal(jobs.length, 2)
  assert.equal(new Set(jobs.map((row) => row.id)).size, 2)
})
