// Run PHP + MySQL with sql/05_scan_sederhana.sql on a disposable empty database first.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs TEST_ORIGIN=http://127.0.0.1:8091 node tests/browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8091';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const contexts=[],errors=[];
try {
 const adminContext=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(adminContext);
 const admin=await adminContext.newPage();admin.on('pageerror',e=>errors.push(e.message));
 const res=await admin.goto(origin+'/index.php?page=admin');assert.equal(res.status(),200);assert.ok(res.headers()['content-security-policy']);assert.match(res.headers()['permissions-policy'],/camera=\(\)/);
 await admin.waitForFunction(()=>document.getElementById('total').textContent==='0');
 assert.equal((await admin.request.get(origin+'/index.php?page[]=admin')).status(),404);
 assert.equal((await admin.request.get(origin+'/api.php?action=checkin')).status(),405);
 assert.equal((await admin.request.post(origin+'/api.php?action=checkin',{data:{code:'PT001',tablet:'T01'}})).status(),422);
 await admin.locator('#csv').setInputFiles({name:'list.csv',mimeType:'text/csv',buffer:await readFile(new URL('../public/template.csv',import.meta.url))});
 await admin.locator('#import').click();await admin.waitForFunction(()=>document.getElementById('total').textContent==='4');
 const csrf=await admin.locator('meta[name=csrf]').getAttribute('content');
 const before=(await (await admin.request.get(origin+'/api.php?action=status')).json()).total;
 const invalid=await admin.request.post(origin+'/api.php?action=import',{headers:{'X-CSRF-Token':csrf},multipart:{csv:{name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('kode,nama,perusahaan,jabatan\nPT001,Conflict,PT,Job\nNEW001,New,PT,Job\n')}}});assert.equal(invalid.status(),422);
 assert.equal((await (await admin.request.get(origin+'/api.php?action=status')).json()).total,before);
 const tablets=[];
 for(let i=1;i<=6;i++) {
  const context=await browser.newContext({viewport:{width:1024,height:768}});contexts.push(context);
  const page=await context.newPage();tablets.push(page);page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(origin+'/');assert.match(response.headers()['permissions-policy'],/camera=\(self\)/);
  await page.selectOption('#tablet','T0'+i);
  await page.evaluate(()=>{
   const q=window.qrcode(0,'M');q.addData('PT001');q.make();const n=q.getModuleCount(),c=document.createElement('canvas');c.width=c.height=(n+8)*10;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))ctx.fillRect((x+4)*10,(y+4)*10,10,10);
   window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async options=>{window.cameraCalls++;if(options.audio!==false||options.video.facingMode.ideal!=='environment')throw Error('Wrong camera settings');const s=c.captureStream(10);setInterval(()=>ctx.drawImage(c,0,0),100);return s;};
  });
  assert.equal(await page.evaluate(()=>window.cameraCalls),0);await page.locator('#start').click();await page.waitForFunction(()=>document.getElementById('guest-name').textContent==='Dian Contoh');
  if(i===1)assert.equal((await (await admin.request.get(origin+'/api.php?action=status')).json()).present,0);
  await page.locator('#confirm').click();await page.waitForFunction(()=>document.getElementById('saved').textContent.includes('Dian Contoh'));
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
 }
 await admin.waitForFunction(()=>document.getElementById('present').textContent==='1');
 await admin.waitForFunction(()=>document.getElementById('arrivals').textContent.includes('T06'));
 assert.equal(await admin.locator('#arrivals tr').count(),1);
 let data=await (await admin.request.get(origin+'/api.php?action=status')).json();for(let i=1;i<=6;i++)assert.equal(data.tablets['T0'+i],1);
 // Second PT slot, manual search, offline write failure, retry, same-tablet idempotency.
 const page=tablets[2];await page.locator('details summary').click();await page.locator('#search').fill('PT002');await page.locator('#results button').click();await page.waitForFunction(()=>document.getElementById('guest-name').textContent==='Sari Contoh');
 await contexts[3].setOffline(true);await page.locator('#confirm').click();await page.waitForFunction(()=>!document.getElementById('confirm').disabled);
 assert.equal((await (await admin.request.get(origin+'/api.php?action=status')).json()).present,1);
 await contexts[3].setOffline(false);await page.locator('#confirm').click();await page.waitForFunction(()=>document.getElementById('saved').textContent.includes('Sari Contoh'));
 await admin.waitForFunction(()=>document.getElementById('present').textContent==='2');
 const tabletCsrf=await page.locator('meta[name=csrf]').getAttribute('content');const duplicate=await page.request.post(origin+'/api.php?action=checkin',{headers:{'X-CSRF-Token':tabletCsrf},data:{code:'PT002',tablet:'T03'}});assert.equal((await duplicate.json()).duplicate,true);
 assert.equal((await (await admin.request.get(origin+'/api.php?action=status')).json()).present,2);
 const csv=await admin.request.get(origin+'/api.php?action=export');assert.match(await csv.text(),/T01, T02, T03, T04, T05, T06/);assert.match(await csv.text(),/Sari Contoh/);
 // Canonical invitation URL QR and token mismatch protection.
 const invitation=await (await admin.request.get(origin+'/api.php?action=invitation&code=VIP001')).json();assert.ok(invitation.url.startsWith('https://undanganregistrasirsas.puskesau.com/index.php?page=scan#'));
 assert.equal((await admin.request.get(origin+'/api.php?action=lookup&event=RSAS-2026&code=VIP001&token=bad')).status(),422);
 assert.equal((await admin.request.get(origin+'/api.php?action=search&q=%25%27%20OR%201%3D1')).status(),200);
 await admin.screenshot({path:'/tmp/rsas-admin-simple.png',fullPage:true});await page.screenshot({path:'/tmp/rsas-tablet-simple.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: six independent tablets scan/confirm, names shown, admin auto-update, duplicate across six counted once, two PT slots, CSV import/rollback/export, CSRF/routes/QR, offline failure/retry.');
} finally {await browser.close();}
