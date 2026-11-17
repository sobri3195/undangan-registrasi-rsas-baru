import {openPage} from './access-helper.mjs';
// Disposable database seeded with sql/07_shared_hosting_dummy.sql; edits synthetic identities.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8101 node tests/edit-guest.mjs
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8101',A='DEMO-RSAS-2026',B='DEMO-MITRA-2027';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await openPage(page,origin+'/index.php?page=admin');await page.waitForFunction(()=>!document.getElementById('event-select').disabled);await page.selectOption('#event-select',A);await page.waitForFunction(()=>document.getElementById('present').textContent==='5');
 const request=page.request,csrf=await page.locator('meta[name=csrf]').getAttribute('content');
 const info=async(event,code)=>{const r=await request.get(origin+'/api.php?'+new URLSearchParams({action:'invitation',event,code}));assert.equal(r.status(),200);return r.json();};
 const initial=await info(A,'PT001'),other=await info(B,'PT001');
 const original=g=>({nama:g.nama,perusahaan:g.perusahaan,jabatan:g.jabatan});
 const update=data=>request.post(`${origin}/api.php?action=update_guest&event=${A}`,{headers:{'X-CSRF-Token':csrf},data});
 const editRow=async name=>{await page.locator('#arrivals tr').filter({hasText:name}).getByRole('button',{name:/Edit identitas/}).click();await page.locator('#guest-dialog').waitFor({state:'visible'});};
 await editRow('Dian Sintetis');assert.match(await page.locator('#edit-context').innerText(),/DEMO-RSAS-2026 \/ PT001/);assert.equal(await page.locator('#edit-name').inputValue(),'Dian Sintetis');
 await page.locator('#edit-name').fill('Dian Koreksi');await page.locator('#edit-company').fill('PT Koreksi');await page.locator('#edit-position').fill('Direktur Utama');await page.locator('#save-guest').click();await page.locator('#guest-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('arrivals').textContent.includes('Dian Koreksi'));
 let saved=await info(A,'PT001');assert.equal(saved.url,initial.url);assert.deepEqual(saved.records,initial.records);assert.equal(saved.guest.perusahaan,'PT Koreksi');assert.deepEqual((await info(B,'PT001')),other);
 const csv=await request.get(`${origin}/api.php?action=export&event=${A}&filter=present`);assert.match(await csv.text(),/Dian Koreksi/);assert.doesNotMatch(await csv.text(),/Dian Sintetis/);
 // The previously issued QR still identifies the corrected name in the scanner.
 const scanner=await browser.newPage();await openPage(scanner,origin+'/');await scanner.waitForFunction(()=>!document.getElementById('event-select').disabled);await scanner.selectOption('#event-select',A);await scanner.selectOption('#tablet','T01');await scanner.locator('details summary').click();await scanner.locator('#search').fill('PT001');await scanner.locator('#results button').click();await scanner.waitForFunction(()=>document.getElementById('guest-name').textContent==='Dian Koreksi');const h=new URLSearchParams(new URL(initial.url).hash.slice(1));const oldQR=await request.get(origin+'/api.php?'+new URLSearchParams({action:'lookup',event:A,qr_event:A,code:'PT001',token:h.get('token')}));assert.equal((await oldQR.json()).guest.nama,'Dian Koreksi');await scanner.close();
 const base={kode:'PT001',...original(saved.guest),original:original(saved.guest)};
 assert.equal((await request.get(`${origin}/api.php?action=update_guest&event=${A}`)).status(),405);
 assert.equal((await request.post(`${origin}/api.php?action=update_guest&event=${A}`,{data:base})).status(),422);
 for(const patch of [{nama:' '},{nama:'x'.repeat(201)},{perusahaan:['bad']},{kode:'UNKNOWN'},{token:'replacement'},{new_code:'CHANGED'}])assert.equal((await update({...base,...patch})).status(),422);
 assert.equal((await update(base)).status(),200); // No-op saves are valid.
 // An older open form cannot silently overwrite another operator's correction.
 await editRow('Dian Koreksi');assert.equal((await update({...base,nama:'Dian Perangkat Lain'})).status(),200);await page.locator('#edit-name').fill('Dian Formulir Lama');await page.locator('#save-guest').click();await page.waitForFunction(()=>document.getElementById('guest-error').textContent.includes('perangkat lain'));assert.equal((await info(A,'PT001')).guest.nama,'Dian Perangkat Lain');await page.locator('#close-guest').click();await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('arrivals').textContent.includes('Dian Perangkat Lain'));
 await editRow('Dian Perangkat Lain');await page.locator('#edit-name').fill('Dian Final');await context.setOffline(true);await page.locator('#save-guest').click();await page.waitForFunction(()=>!document.getElementById('save-guest').disabled&&document.getElementById('guest-error').textContent.includes('Koneksi'));assert.equal(await page.locator('#guest-dialog').isVisible(),true);await context.setOffline(false);await page.locator('#save-guest').click();await page.locator('#guest-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.getElementById('arrivals').textContent.includes('Dian Final'));saved=await info(A,'PT001');assert.equal(saved.url,initial.url);assert.deepEqual(saved.records,initial.records);
 // The invite-search editor also works for a guest who has not arrived.
 await page.locator('.qr-tools summary').click();await page.locator('#invite-search').fill('VIP002');await page.locator('#invite-results').getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#edit-name').fill('Naya Diperbaiki');await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/rsas-edit-tamu.png',fullPage:true});await page.locator('#save-guest').click();await page.locator('#guest-dialog').waitFor({state:'hidden'});assert.equal((await info(A,'VIP002')).records.length,0);
 const status=await (await request.get(`${origin}/api.php?action=status&event=${A}`)).json();assert.equal(status.present,5);assert.equal(status.total,8);assert.deepEqual((await info(B,'PT001')),other);
 // Pending lookup from the old event must not open an editor after switching events.
 await page.setViewportSize({width:1280,height:900});await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('arrivals').textContent.includes('Dian Final'));
 let release,started;const gate=new Promise(r=>release=r),hit=new Promise(r=>started=r);
 await page.route('**/api.php?**',async route=>{const u=new URL(route.request().url());if(u.searchParams.get('action')==='lookup'){const response=await route.fetch();started();await gate;await route.fulfill({response});}else await route.continue();});
 await page.locator('#arrivals tr').filter({hasText:'Dian Final'}).getByRole('button',{name:/Edit identitas/}).click();await hit;await page.selectOption('#event-select',B);release();await page.waitForTimeout(250);assert.equal(await page.locator('#guest-dialog').isVisible(),false);await page.unroute('**/api.php?**');assert.deepEqual(errors,[]);
 console.log('PASS: table/search edit, scanner/CSV corrected identity, unchanged QR/logs/counts, separate event slot, validation/CSRF, stale-edit conflict, offline retry and mobile dialog.');
}finally{await browser.close();}
