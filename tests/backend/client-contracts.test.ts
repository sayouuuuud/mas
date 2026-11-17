import test from 'node:test'
import assert from 'node:assert/strict'
import { saveResource, saveQuotation, BackendError, api } from '../../lib/api-client'
import { quotationInput } from '../../lib/server/contracts'
import { adminJobsController, runJobs } from '../../lib/server/jobs'
import { NextRequest } from 'next/server'
import type { RequestScope } from '../../lib/server/auth'

test('resource updates send the expected version envelope and return the saved record', async () => {
 const original = globalThis.fetch
 const calls: Array<{ url: string; options: RequestInit }> = []
 globalThis.fetch = async (url, options) => {
  calls.push({url: String(url),options: options!})
  return Response.json({data:{id:'saved',version:3}})
 }
 try {
  assert.deepEqual(await saveResource('/admin/units',{code:'piece'},'saved',2),{id:'saved',version:3})
  assert.deepEqual(JSON.parse(String(calls[0].options.body)),{version:2,data:{code:'piece'}})
  assert.equal(calls[0].options.method,'PATCH')
  await assert.rejects(()=>saveResource('/admin/units',{},'saved'), (e:unknown)=>e instanceof BackendError && e.status===409)
  assert.equal(calls.length,1)
 } finally {globalThis.fetch=original}
})

test('an existing quotation without a version cannot fall back to creating another draft', async () => {
 const original=globalThis.fetch
 let calls=0
 globalThis.fetch=async()=>{calls++;return Response.json({data:{}})}
 try {
  await assert.rejects(()=>saveQuotation('request',{} as any,'quotation'),(e:unknown)=>e instanceof BackendError && e.status===409)
  assert.equal(calls,0)
 }finally{globalThis.fetch=original}
})

test('quotation client preserves strict line inputs and server-computed totals', async () => {
 const original=globalThis.fetch
 globalThis.fetch=async (_url,opts)=>{
  const input=quotationInput.parse(JSON.parse(String(opts?.body)))
  assert.equal(input.lines[0].price,'10.005')
  assert.equal(input.lines[0].discount,'0.01')
  assert.equal('totals' in input,false)
  return Response.json({data:{id:'quote',version:1,totals:{total:2280}}})
 }
 try {
  const result=await saveQuotation('request',{locale:'ar',currency:'EGP',validUntil:'2099-01-01',leadTime:'أسبوع',terms:'شروط معتمدة',lines:[{description:'زيت صناعي',sku:'SKU',unit:'piece',quantity:2,price:'10.005',discount:'0.01',tax:'14'}]})
  assert.equal(result.data.id,'quote')
  assert.equal(result.data.totals?.total,2280)
 } finally {globalThis.fetch=original}
})

test('API reports conflict and upstream failure instead of a successful save', async () => {
 const original=globalThis.fetch
 try {
  for(const status of [409,503]) {
   globalThis.fetch=async()=>Response.json({error:{code:'FAILED',message:'Failed'}},{status})
   await assert.rejects(()=>api('/admin/units',{method:'POST',body:{}}),(e:unknown)=>e instanceof BackendError && e.status===status)
  }
 }finally{globalThis.fetch=original}
})

test('jobs parse a streamed JSON body without Content-Length',async()=>{
 let resource=''
 const scope={service:{},config:{rateLimitSecret:'x'.repeat(32)},repository:{rateLimit:async()=>({allowed:true}),rpc:async(name:string,args:Record<string,unknown>)=>{if(name==='mas_retry_job') resource=String(args.p_resource);return []},get:async()=>({id:'00000000-0000-4000-8000-000000000001',pdfStatus:'processing'})}} as unknown as RequestScope
 const result=await adminJobsController(new NextRequest('https://app.test/api/v1/admin/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quotationId:'00000000-0000-4000-8000-000000000001'})}),scope,{id:'00000000-0000-4000-8000-000000000002',roles:['Admin'],active:true,aal:'aal2'})
 assert.equal(result.status,200)
 assert.equal(resource,'quotations')
 const invalid=new NextRequest('https://app.test/api/v1/admin/jobs',{method:'POST',headers:{'content-type':'application/json'},body:'{"unexpected":true}'})
 await assert.rejects(()=>adminJobsController(invalid,scope,{id:'00000000-0000-4000-8000-000000000002',roles:['Admin'],active:true,aal:'aal2'}))
})

test('worker rejects non-ASCII credentials with equal character length safely',async()=>{
 const scope={config:{jobSecret:'x'.repeat(32)}} as RequestScope
 await assert.rejects(()=>runJobs(new NextRequest('https://app.test/api/v1/internal/jobs',{headers:{authorization:'Bearer '+ 'é'.repeat(32)}}),scope,['jobs']),(e:unknown)=>(e as {status:number}).status===401)
})
