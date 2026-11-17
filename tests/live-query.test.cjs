const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { createRequire } = require('node:module')
function fixture() {
 const source=fs.readFileSync('lib/live-query.ts','utf8')+'\nexport const testAccess={store,runFetch};'
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const localRequire=createRequire(require('node:path').resolve('lib/live-query.ts'))
 const context={exports:{},require:(name)=>name==='./api-client'?{BackendError:class extends Error{constructor(status){super('failed');this.status=status}}}:localRequire(name),Date,Map,Set,Error,Promise}
 vm.runInNewContext(code,context)
 return context.exports
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
test('late private failures cannot restore customer data after sign out',async()=>{
 const f=fixture(),d=deferred(),key='/admin/quote-requests'
 f.setLiveQueryData(key,{customer:'private'})
 const pending=f.testAccess.runFetch(key,()=>d.promise,true)
 f.clearPrivateLiveQueries();d.reject(new Error('network'))
 await assert.rejects(()=>pending)
 assert.equal(f.testAccess.store.has(key),false)
})
test('late private success cannot cross an authentication boundary',async()=>{
 const f=fixture(),d=deferred(),key='/admin/quote-requests'
 const pending=f.testAccess.runFetch(key,()=>d.promise)
 f.clearPrivateLiveQueries();d.resolve({customer:'private'});await pending
 assert.equal(f.testAccess.store.has(key),false)
})
test('an earlier refresh cannot overwrite newer data or its error state',async()=>{
 const f=fixture(),older=deferred(),newer=deferred(),key='/catalog/products'
 const first=f.testAccess.runFetch(key,()=>older.promise,true)
 const second=f.testAccess.runFetch(key,()=>newer.promise,true)
 newer.resolve({version:2});await second
 older.resolve({version:1});await first
 assert.equal(f.testAccess.store.get(key).data.version,2)
})
