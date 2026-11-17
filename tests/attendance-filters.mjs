// Disposable DB seeded with sql/07_shared_hosting_dummy.sql; this test records one demo check-in.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8098 node tests/attendance-filters.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8098';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/index.php?page=admin');await page.waitForFunction(()=>!document.getElementById('event-select').disabled);await page.selectOption('#event-select','DEMO-RSAS-2026');
 const request=page.request,A='DEMO-RSAS-2026',B='DEMO-MITRA-2027';
 async function status(filter,q='',event=A){const r=await request.get(origin+'/api.php?'+new URLSearchParams({action:'status',event,filter,q}));assert.equal(r.status(),200);return r.json();}
 async function csv(filter,q='',event=A){const r=await request.get(origin+'/api.php?'+new URLSearchParams({action:'export',event,filter,q}));assert.equal(r.status(),200);return r.text();}
 for(const [filter,count] of [['all',8],['present',5],['absent',3]]){
  const data=await status(filter);assert.equal(data.guests.length,count);assert.equal(new Set(data.guests.map(g=>g.kode)).size,count);assert.equal(data.total,8);assert.equal(data.present,5);
  const text=await csv(filter);assert.equal(text.trim().split(/\r?\n/).length,count+1);assert.match(text,/status/);
 }
 const repeated=(await status('present')).guests.find(g=>g.kode==='PT001');assert.equal(repeated.tablet,'T02, T03');assert.equal(Number(repeated.jumlah_tablet),2);
 for(const q of ['Dr. Naya','Instansi Demo','Dokter','VIP002'])assert.equal((await status('absent',q)).guests.length,1);
 assert.equal((await status('all','PT Mitra Sintetis')).guests.length,2);assert.equal((await status('present','T02')).guests.length,1);
 for(const q of ['%',"' OR 1=1 --",'not found'])assert.equal((await status('all',q)).guests.length,0);
 assert.equal((await status('present','VIP002')).guests.length,0);
 for(const g of (await status('absent')).guests){assert.equal(g.status,'Belum Datang');assert.equal(g.pertama_utc,null);assert.equal(g.tablet,'');}
 for(const action of ['status','export'])for(const suffix of ['filter=bad','filter[]=all','filter=all&q[]=x'])assert.equal((await request.get(`${origin}/api.php?action=${action}&event=${A}&${suffix}`)).status(),422);
 await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('5 undangan'));
 assert.equal(await page.locator('[data-filter=present]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-filter=all]').click();await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('8 undangan'));
 await page.locator('[data-filter=absent]').click();await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('3 undangan'));
 assert.doesNotMatch(await page.locator('#arrivals').innerText(),/Invalid Date|Dian Sintetis/);assert.equal(await page.locator('#present').innerText(),'5');
 await page.locator('#arrival-search').fill('Mira');await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('1 undangan'));
 assert.match(await page.locator('#arrivals').innerText(),/Mira Contoh/);const link=new URL(await page.locator('#export').getAttribute('href'));assert.equal(link.searchParams.get('q'),'Mira');assert.equal(link.searchParams.get('filter'),'absent');assert.equal(link.searchParams.get('event'),A);
 const filteredCSV=await csv('absent','Mira');assert.match(filteredCSV,/Mira Contoh/);assert.doesNotMatch(filteredCSV,/Dian Sintetis|Reno Contoh/);
 await page.selectOption('#event-select',B);await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('2 undangan'));assert.equal(await page.locator('#arrival-search').inputValue(),'');assert.equal(await page.locator('[data-filter=absent]').getAttribute('aria-pressed'),'true');
 const absentB=await status('absent','',B),target=absentB.guests[0];const csrf=await page.locator('meta[name=csrf]').getAttribute('content');
 assert.equal((await request.post(`${origin}/api.php?action=checkin&event=${B}`,{headers:{'X-CSRF-Token':csrf},data:{code:target.kode,tablet:'T06'}})).status(),200);
 await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('1 undangan')&&document.getElementById('present').textContent==='2');assert.doesNotMatch(await page.locator('#arrivals').innerText(),new RegExp(target.kode));assert.equal((await status('all')).guests.length,8);
 // A delayed response for another filter must not overwrite the latest selection.
 let entered,release,done;const hit=new Promise(r=>entered=r),gate=new Promise(r=>release=r),finished=new Promise(r=>done=r);let once=true;
 await page.route('**/api.php?**',async route=>{const u=new URL(route.request().url());if(once&&u.searchParams.get('action')==='status'&&u.searchParams.get('filter')==='present'){once=false;const response=await route.fetch();entered();await gate;await route.fulfill({response});done();}else await route.continue();});
 await page.locator('[data-filter=present]').click();await hit;await page.locator('[data-filter=absent]').click();await page.waitForFunction(()=>document.getElementById('list-summary').textContent.startsWith('1 undangan'));release();await finished;await page.waitForTimeout(200);assert.equal(await page.locator('[data-filter=absent]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('#list-summary').innerText(),/^1 undangan/);await page.unroute('**/api.php?**');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/rsas-attendance-filters.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: all/present/absent, shared CSV/search query, duplicates, missing arrival time, isolated events, live check-in update, invalid parameters, stale filter responses, mobile layout.');
}finally{await browser.close();}
