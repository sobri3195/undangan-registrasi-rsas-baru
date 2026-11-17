import {openPage} from './access-helper.mjs';
// Run PHP + MySQL with sql/05_scan_sederhana.sql + sql/06_multi_acara.sql on a disposable empty database first.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8091 node tests/browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8091';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const contexts=[],errors=[];
try {
 const adminContext=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(adminContext);
 const admin=await adminContext.newPage();admin.on('dialog',dialog=>dialog.accept());admin.on('pageerror',e=>errors.push(e.message));
 const res=await openPage(admin,origin+'/index.php?page=admin');assert.equal(res.status(),200);assert.ok(res.headers()['content-security-policy']);assert.match(res.headers()['permissions-policy'],/camera=\(\)/);
 await admin.waitForFunction(()=>document.getElementById('total').textContent==='0');await admin.selectOption('#status-select','dibuka');await admin.locator('#apply-status').click();await admin.waitForFunction(()=>document.getElementById('event-state').dataset.state==='dibuka');
 assert.equal((await admin.request.get(origin+'/index.php?page[]=admin')).status(),404);
 assert.equal((await admin.request.get(origin+'/api.php?event=RSAS-2026&action=checkin')).status(),405);
 assert.equal((await admin.request.post(origin+'/api.php?event=RSAS-2026&action=checkin',{data:{code:'PT001',tablet:'T01'}})).status(),422);
 await admin.locator('#csv').setInputFiles({name:'list.csv',mimeType:'text/csv',buffer:await readFile(new URL('../public/template.csv',import.meta.url))});
 await admin.locator('#import').click();await admin.locator('#confirm-import').waitFor({state:'visible'});await admin.locator('#confirm-import').click();await admin.waitForFunction(()=>document.getElementById('total').textContent==='4');
 const csrf=await admin.locator('meta[name=csrf]').getAttribute('content');
 const before=(await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=status')).json()).total;
 const invalid=await admin.request.post(origin+'/api.php?event=RSAS-2026&action=import',{headers:{'X-CSRF-Token':csrf},multipart:{csv:{name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('kode,nama,perusahaan,jabatan\nPT001,Conflict,PT,Job\nNEW001,New,PT,Job\n')}}});assert.equal(invalid.status(),422);
 assert.equal((await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=status')).json()).total,before);
 const tablets=[];
 for(let i=1;i<=6;i++) {
  const context=await browser.newContext({viewport:{width:1024,height:768}});contexts.push(context);
  const page=await context.newPage();tablets.push(page);page.on('pageerror',e=>errors.push(e.message));
  const response=await openPage(page,origin+'/','staff');assert.match(response.headers()['permissions-policy'],/camera=\(self\)/);
  await page.selectOption('#tablet','T0'+i);
  await page.evaluate(()=>{
   const q=window.qrcode(0,'M');q.addData('PT001');q.make();const n=q.getModuleCount(),c=document.createElement('canvas');c.width=c.height=(n+8)*10;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))ctx.fillRect((x+4)*10,(y+4)*10,10,10);
   window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async options=>{window.cameraCalls++;if(options.audio!==false||options.video.facingMode.ideal!=='environment')throw Error('Wrong camera settings');const s=c.captureStream(10);setInterval(()=>ctx.drawImage(c,0,0),100);return s;};
  });
  assert.equal(await page.evaluate(()=>window.cameraCalls),0);await page.locator('#start').click();await page.waitForFunction(()=>document.getElementById('guest-name').textContent==='Dian Contoh');
  if(i===1)assert.equal((await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=status')).json()).present,0);
  await page.locator('#confirm').click();await page.waitForFunction(()=>document.getElementById('saved').textContent.includes('Dian Contoh'));
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
 }
 await admin.waitForFunction(()=>document.getElementById('present').textContent==='1');
 await admin.waitForFunction(()=>document.getElementById('arrivals').textContent.includes('T06'));
 assert.equal(await admin.locator('#arrivals tr').count(),1);
 let data=await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=status')).json();for(let i=1;i<=6;i++)assert.equal(data.tablets['T0'+i],1);
 // Second PT slot, manual search, offline write failure, retry, same-tablet idempotency.
 const page=tablets[2];await page.locator('details summary').click();await page.locator('#search').fill('PT002');await page.locator('#results button').click();await page.waitForFunction(()=>document.getElementById('guest-name').textContent==='Sari Contoh');
 await contexts[3].setOffline(true);await page.locator('#confirm').click();await page.waitForFunction(()=>!document.getElementById('confirm').disabled);
 assert.equal((await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=status')).json()).present,1);
 await contexts[3].setOffline(false);await page.locator('#confirm').click();await page.waitForFunction(()=>document.getElementById('saved').textContent.includes('Sari Contoh'));
 await admin.waitForFunction(()=>document.getElementById('present').textContent==='2');
 const tabletCsrf=await page.locator('meta[name=csrf]').getAttribute('content');const duplicate=await page.request.post(origin+'/api.php?event=RSAS-2026&action=checkin',{headers:{'X-CSRF-Token':tabletCsrf},data:{code:'PT002',tablet:'T03'}});assert.equal((await duplicate.json()).duplicate,true);
 assert.equal((await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=status')).json()).present,2);
 const csv=await admin.request.get(origin+'/api.php?event=RSAS-2026&action=export');assert.match(await csv.text(),/T01, T02, T03, T04, T05, T06/);assert.match(await csv.text(),/Sari Contoh/);
 // Canonical invitation URL QR and token mismatch protection.
 const invitation=await (await admin.request.get(origin+'/api.php?event=RSAS-2026&action=invitation&code=VIP001')).json();assert.ok(invitation.url.startsWith('https://undanganregistrasirsas.puskesau.com/index.php?page=scan#'));
 assert.equal((await admin.request.get(origin+'/api.php?event=RSAS-2026&action=lookup&qr_event=RSAS-2026&code=VIP001&token=bad')).status(),422);
 assert.equal((await admin.request.get(origin+'/api.php?event=RSAS-2026&action=search&q=%25%27%20OR%201%3D1')).status(),200);
 // Create another event through the UI and use the same slot code for another person.
 await admin.locator('#new-event').click();await admin.locator('#event-name').fill('Temu Mitra RSAU 2027');await admin.locator('#event-code').fill('MITRA-2027');await admin.locator('#event-date').fill('2027-02-20');await admin.locator('#event-location').fill('Aula RSAU');await admin.locator('#save-event').click();
 await admin.waitForFunction(()=>document.getElementById('event-select').value==='MITRA-2027'&&document.getElementById('total').textContent==='0');
 assert.equal(await tablets[0].locator('#event-select').inputValue(),'RSAS-2026');
 await admin.locator('#csv').setInputFiles({name:'event-b.csv',mimeType:'text/csv',buffer:Buffer.from('kode,nama,perusahaan,jabatan\nPT001,Tamu Acara Kedua,PT Kedua,Direktur\n')});await admin.locator('#import').click();await admin.locator('#confirm-import').waitFor({state:'visible'});await admin.locator('#confirm-import').click();await admin.waitForFunction(()=>document.getElementById('total').textContent==='1');await admin.selectOption('#status-select','dibuka');await admin.locator('#apply-status').click();await admin.waitForFunction(()=>document.getElementById('event-state').dataset.state==='dibuka');
 await tablets[0].reload();await tablets[0].waitForFunction(()=>document.getElementById('event-select').options.length===2);await tablets[0].selectOption('#event-select','MITRA-2027');
 assert.equal(await tablets[0].locator('#identity').isHidden(),true);
 await tablets[0].locator('details summary').click();await tablets[0].locator('#search').fill('PT001');await tablets[0].locator('#results button').click();await tablets[0].waitForFunction(()=>document.getElementById('guest-name').textContent==='Tamu Acara Kedua');await tablets[0].locator('#confirm').click();
 await admin.waitForFunction(()=>document.getElementById('present').textContent==='1'&&document.getElementById('arrivals').textContent.includes('Tamu Acara Kedua'));
 assert.doesNotMatch(await admin.locator('#arrivals').innerText(),/Dian Contoh|Sari Contoh/);
 const aPT=await (await admin.request.get(origin+'/api.php?action=invitation&event=RSAS-2026&code=PT001')).json();const aHash=new URLSearchParams(new URL(aPT.url).hash.slice(1));
 assert.equal((await admin.request.get(origin+'/api.php?'+new URLSearchParams({action:'lookup',event:'MITRA-2027',code:'PT001',qr_event:'RSAS-2026',token:aHash.get('token')}))).status(),422);
 assert.equal((await (await admin.request.get(origin+'/api.php?action=status&event=RSAS-2026')).json()).present,2);
 const exportHref=await admin.locator('#export').getAttribute('href');assert.match(exportHref,/event=MITRA-2027/);
 const bCSV=await admin.request.get(origin+'/api.php?action=export&event=MITRA-2027');assert.match(await bCSV.text(),/Tamu Acara Kedua/);assert.doesNotMatch(await bCSV.text(),/Dian Contoh/);
 const duplicateEvent=await admin.request.post(origin+'/api.php?action=create_event',{headers:{'X-CSRF-Token':csrf},data:{kode:'MITRA-2027',nama:'Overwrite',tanggal:'',lokasi:''}});assert.equal(duplicateEvent.status(),422);
 const badDate=await admin.request.post(origin+'/api.php?action=create_event',{headers:{'X-CSRF-Token':csrf},data:{kode:'INVALID',nama:'Bad date',tanggal:'2027-02-31',lokasi:''}});assert.equal(badDate.status(),422);
 assert.equal((await admin.request.get(origin+'/api.php?action=status&event=UNKNOWN')).status(),422);
 await admin.selectOption('#event-select','RSAS-2026');await admin.waitForFunction(()=>document.getElementById('present').textContent==='2');
 await admin.reload();await admin.waitForFunction(()=>document.getElementById('event-select').value==='RSAS-2026'&&document.getElementById('present').textContent==='2');
 assert.equal(await admin.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);await admin.setViewportSize({width:390,height:844});assert.equal(await admin.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);await admin.waitForTimeout(550);await admin.screenshot({path:'/tmp/rsas-admin-mobile.png',fullPage:true});await admin.setViewportSize({width:1280,height:900});
 // Delay a status response from event B, switch to A, then let B finish.
 await admin.selectOption('#event-select','MITRA-2027');await admin.waitForFunction(()=>document.getElementById('present').textContent==='1');
 let started,release,finished;const hit=new Promise(r=>started=r),gate=new Promise(r=>release=r),done=new Promise(r=>finished=r);let once=true;
 await admin.route('**/api.php?**',async route=>{const u=new URL(route.request().url());if(once&&u.searchParams.get('action')==='status'&&u.searchParams.get('event')==='MITRA-2027'){once=false;const response=await route.fetch();started();await gate;await route.fulfill({response});finished();}else await route.continue();});
 await admin.locator('#refresh').click();await hit;await admin.selectOption('#event-select','RSAS-2026');await admin.waitForFunction(()=>document.getElementById('present').textContent==='2');release();await done;await admin.waitForTimeout(250);assert.equal(await admin.locator('#present').innerText(),'2');await admin.unroute('**/api.php?**');
 await admin.screenshot({path:'/tmp/rsas-admin-simple.png',fullPage:true});await page.screenshot({path:'/tmp/rsas-tablet-simple.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: event creation/selection/persistence, isolation of identical codes and CSV, QR-event mismatch, stale response guard, responsive UI, six independent tablets scan/confirm, names shown, admin auto-update, duplicate across six counted once, two PT slots, CSV import/rollback/export, CSRF/routes/QR, offline failure/retry.');
} finally {await browser.close();}
