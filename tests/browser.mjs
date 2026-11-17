// Optional: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/browser.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8080';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  for(const route of ['/','/index.php?page=tamu','/index.php?page=petugas','/index.php?page=koordinator']) {
    const response=await page.goto(origin+route);assert.equal(response.status(),200);assert.ok(response.headers()['content-security-policy']);assert.equal(response.headers()['permissions-policy'].includes('camera=(self)'),route.endsWith('petugas'));
    assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
  }
  for(const query of ['unknown','%3Cscript%3E','x&page[]=tamu'])assert.equal((await page.request.get(origin+'/index.php?page='+query)).status(),404);
  await page.goto(origin+'/index.php?page=koordinator');
  await page.locator('#event').fill('RSAS-2026');await page.locator('#settings').click();
  await page.locator('#csv').setInputFiles({name:'demo.csv',mimeType:'text/csv',buffer:await readFile(new URL('../public/template.csv',import.meta.url))});
  await page.waitForFunction(()=>document.getElementById('summary').textContent.startsWith('3 slot'));
  await page.locator('#invites button').first().click();
  const url=await page.locator('#invitation a').getAttribute('href');assert.ok(url.startsWith('https://undanganregistrasirsas.puskesau.com/'));
  assert.equal(await page.locator('#invitation canvas').evaluate(c=>{const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height);return window.jsQR(d.data,d.width,d.height)?.data;}),url);
  const png=page.waitForEvent('download');await page.locator('#invitation button').first().click();assert.match((await png).suggestedFilename(),/\.png$/);
  await page.locator('#offline').click();await page.waitForFunction(()=>document.getElementById('offline-status').textContent.includes('Semua halaman'));
  await context.setOffline(true);
  await page.goto(origin+'/index.php?page=petugas');
  await page.locator('#search').fill('PT001');await page.locator('#results button').click();
  await page.locator('#attend').click();await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('1 hadir unik'));
  await page.reload();await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('1 hadir unik'));
  const backup=page.waitForEvent('download');await page.locator('#backup').click();const d=await backup;assert.match(d.suggestedFilename(),/T01/);const data=JSON.parse(await readFile(await d.path(),'utf8'));assert.equal(data.logs.length,1);
  // Feed a generated QR via a canvas stream: tests decoder and confirm-first flow, not physical hardware.
  await page.evaluate(async()=>{const b=await import('/assets/core.js');const db=await import('/assets/db.js');await db.openDB();const state=await db.read();const slot=state.slots.find(s=>s.code==='PT002');const q=window.qrcode(0,'M');q.addData(b.invitationURL(slot));q.make();const n=q.getModuleCount(),c=document.createElement('canvas');c.width=c.height=(n+8)*8;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(q.isDark(y,x))ctx.fillRect((x+4)*8,(y+4)*8,8,8);window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async options=>{window.cameraCalls++;if(options.audio!==false)throw Error('audio requested');const stream=c.captureStream(10);setInterval(()=>ctx.drawImage(c,0,0),100);return stream;};});
  assert.equal(await page.evaluate(()=>window.cameraCalls),0);await page.locator('#camera').click();await page.waitForFunction(()=>document.getElementById('identity').textContent.includes('PT002'));
  assert.equal(await page.evaluate(()=>window.cameraCalls),1);assert.match(await page.locator('#summary').innerText(),/1 hadir unik/);
  await page.locator('#attend').click();await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('2 hadir unik'));
  await page.goto(origin+'/index.php?page=koordinator');
  const tablet2={...data,logs:[{...data.logs[0],id:'second-tablet',tablet:'T02'}]};
  await page.locator('#merge').setInputFiles({name:'T02.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(tablet2))});
  await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('3 catatan'));
  assert.match(await page.locator('#summary').innerText(),/2 hadir unik/);
  const report=page.waitForEvent('download');await page.locator('#report').click();assert.match(await readFile(await (await report).path(),'utf8'),/"T01 \/ T02"/);
  await page.goto(origin+'/index.php?page=tamu'+new URL(url).hash);await page.locator('[data-rsvp="hadir"]').click();assert.match(await page.locator('#reply').inputValue(),/Akan Hadir/);
  const guestPNG=page.waitForEvent('download');await page.locator('#save-guest').click();assert.match((await guestPNG).suggestedFilename(),/check-in/);
  assert.deepEqual(errors,[]);console.log('PASS: routes, CSP, mobile layout, QR/PNG, IndexedDB, offline navigation/search/camera simulation/export, two-tablet merge, RSVP.');
 }catch(e){console.error(await page.evaluate(()=>({notice:document.getElementById('notice')?.textContent,status:document.getElementById('camera-status')?.textContent,ready:document.getElementById('video')?.readyState,width:document.getElementById('video')?.videoWidth})));throw e;}finally{await browser.close();}
