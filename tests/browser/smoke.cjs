const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const base=process.env.BASE_URL || 'http://localhost:3000'
;(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 const results=[]
 try {
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
  const page=await browser.newPage({viewport});let errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  for(const path of ['/ar','/en','/ar/products','/en/products','/ar/categories','/ar/brands','/ar/sectors','/ar/about','/ar/contact','/ar/request-quote','/ar/privacy','/ar/terms','/ar/compare','/admin/login','/admin']) {
   const response=await page.goto(base+path,{waitUntil:'networkidle'})
   const heading=await page.locator('h1,h2').first().innerText()
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)
   assert.equal(response.status(),200,path)
   assert.equal(overflow,false,`${path}: horizontal overflow at ${viewport.width}`)
   assert.deepEqual(errors,[],`${path}: uncaught browser error`)
   results.push({viewport:viewport.width,path,status:response.status(),heading,overflow,errors})
   errors=[]
  }
  await page.close()
 }
 fs.mkdirSync('work/test-results',{recursive:true})
 fs.writeFileSync('work/test-results/browser-smoke.json',JSON.stringify(results,null,2))
 console.log(`PASS: ${results.length} page/viewport render checks (live API; does not assert seeded business flows).`)
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)})
