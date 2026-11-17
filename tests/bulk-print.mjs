import {openPage} from './access-helper.mjs';
// Disposable database with schema 05 + 06 + 08. Creates only synthetic PRINT-* events.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8110';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openPage(page,origin+'/index.php?page=admin');await page.waitForFunction(()=>!document.getElementById('event-select').disabled);const req=page.request,csrf=await page.locator('meta[name=csrf]').getAttribute('content');
 async function post(action,data,event='PRINT-A'){const r=await req.post(origin+'/api.php?'+new URLSearchParams({action,event}),{headers:{'X-CSRF-Token':csrf},data});assert.ok(r.ok(),await r.text());return r.json();}
 for(const [kode,nama] of [['PRINT-A','Acara Cetak "<uji>"'],['PRINT-B','Acara Lain'],['PRINT-EMPTY','Tanpa Undangan']])await post('create_event',{kode,nama,tanggal:'2027-01-10',lokasi:'Aula Sintetis'});
 const csv='kode,nama,perusahaan,jabatan\n'+Array.from({length:41},(_,i)=>{const n=String(i+1).padStart(3,'0');return `G${n},Tamu Cetak ${n},PT Mitra Sintetis,Perwakilan ${n}`;}).join('\n');
 async function upload(source,event){const r=await req.post(origin+'/api.php?'+new URLSearchParams({action:'import',event}),{headers:{'X-CSRF-Token':csrf},multipart:{csv:{name:'print.csv',mimeType:'text/csv',buffer:Buffer.from(source)}}});assert.equal(r.status(),200);}
 await upload(csv,'PRINT-A');await upload('kode,nama,perusahaan,jabatan\nG001,Tamu Acara Lain,PT Lain,Staf\n','PRINT-B');
 const invitation=async code=>(await (await req.get(origin+'/api.php?'+new URLSearchParams({action:'invitation',event:'PRINT-A',code}))).json());const before=[];for(let i=1;i<=41;i++)before.push(await invitation('G'+String(i).padStart(3,'0')));
 await page.reload();await page.waitForFunction(()=>document.getElementById('event-select').options.length>=4);await page.selectOption('#event-select','PRINT-A');await page.waitForFunction(()=>document.getElementById('total').textContent==='41');
 await page.locator('[data-filter=absent]').click();await page.locator('#arrival-search').fill('G041');const href=await page.locator('#bulk-print').getAttribute('href');assert.match(href,/event=PRINT-A/);assert.doesNotMatch(href,/filter=|q=/);
 const printPage=await browser.newPage();printPage.on('pageerror',e=>errors.push(e.message));const collected=[];
 for(let batch=1;batch<=3;batch++){
  const response=await openPage(printPage,origin+'/index.php?'+new URLSearchParams({page:'admin',print:'qr',event:'PRINT-A',batch:String(batch)}));assert.equal(response.status(),200);assert.match(response.headers()['permissions-policy'],/camera=\(\)/);assert.ok(response.headers()['content-security-policy']);
  await printPage.waitForFunction(()=>document.body.dataset.printReady==='true');assert.equal(await printPage.locator('[data-qr]').count(),batch<3?20:1);assert.equal(await printPage.locator('#print-qr').isDisabled(),false);
  await printPage.addScriptTag({url:origin+'/assets/vendor/jsQR.js'});
  const decoded=await printPage.locator('[data-qr]').evaluateAll(boxes=>boxes.map(box=>{const c=box.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height);return {url:window.jsQR(d.data,d.width,d.height)?.data,expected:box.dataset.qr};}));
  for(const qr of decoded){assert.equal(qr.url,qr.expected);const p=new URLSearchParams(new URL(qr.url).hash.slice(1));assert.equal(p.get('event'),'PRINT-A');const original=before[Number(p.get('code').slice(1))-1];assert.equal(qr.url,original.url);collected.push(p.get('code'));}
  if(batch<3){const next=await printPage.locator('#next-batch').getAttribute('href');assert.ok(next.startsWith('https://undanganregistrasirsas.puskesau.com/'));assert.match(next,new RegExp('batch='+(batch+1)));}else assert.equal(await printPage.locator('#next-batch').count(),0);
  assert.equal(await printPage.locator('#previous-batch').count(),batch===1?0:1);
  assert.equal(await printPage.locator('h2.card-event').first().innerText(),'Acara Cetak "<uji>"');assert.doesNotMatch(await printPage.locator('main').innerText(),/Tamu Acara Lain/);
  if(batch===1){
   // Save as PDF uses browser printing, without a server-side PDF package.
   await printPage.pdf({path:'/tmp/rsas-qr-batch-1.pdf',format:'A4',preferCSSPageSize:true});
   const text=execFileSync('pdftotext',['/tmp/rsas-qr-batch-1.pdf','-'],{encoding:'utf8'});for(let i=1;i<=20;i++)assert.match(text,new RegExp('Tamu Cetak '+String(i).padStart(3,'0')));assert.doesNotMatch(text,/Batch berikutnya|Save as PDF|Cetak \/ Simpan/);
   await printPage.evaluate(()=>{window.print=()=>{window.printCalls=(window.printCalls||0)+1;};});await printPage.locator('#print-qr').click();assert.equal(await printPage.evaluate(()=>window.printCalls),1);
   await printPage.setViewportSize({width:390,height:844});assert.equal(await printPage.evaluate(()=>document.body.scrollWidth<=innerWidth),true);await printPage.screenshot({path:'/tmp/rsas-bulk-print-mobile.png',fullPage:true});await printPage.setViewportSize({width:1280,height:900});
  }
 }
 assert.equal(new Set(collected).size,41);assert.deepEqual(collected,Array.from({length:41},(_,i)=>'G'+String(i+1).padStart(3,'0')));
 for(let i=1;i<=41;i++)assert.deepEqual(await invitation('G'+String(i).padStart(3,'0')),before[i-1]);
 for(const query of ['event=UNKNOWN','event=PRINT-A&batch=4'])assert.equal((await req.get(origin+'/index.php?page=admin&print=qr&'+query)).status(),404);
 for(const query of ['event[]=PRINT-A','event=PRINT-A&batch=0','event=PRINT-A&batch=01','event=PRINT-A&batch[]=1','event=PRINT-A&batch=-1','event=PRINT-A&batch=1000000'])assert.equal((await req.get(origin+'/index.php?page=admin&print=qr&'+query)).status(),422);
 await openPage(printPage,origin+'/index.php?page=admin&print=qr&event=PRINT-EMPTY');assert.equal(await printPage.locator('[data-qr]').count(),0);assert.equal(await printPage.locator('#print-qr').isDisabled(),true);
 await post('set_event_status',{status:'selesai',previous:'persiapan'});await openPage(printPage,origin+'/index.php?page=admin&print=qr&event=PRINT-A');await printPage.waitForFunction(()=>document.body.dataset.printReady==='true');assert.equal(await printPage.locator('[data-qr]').count(),20);
 // Maximum identity lengths remain readable rather than clipped on fixed-height cards.
 await post('create_event',{kode:'PRINT-LONG',nama:'E'.repeat(200),tanggal:'',lokasi:''});
 await upload('kode,nama,perusahaan,jabatan\n'+'L'.repeat(64)+','+'N'.repeat(200)+','+'C'.repeat(200)+','+'J'.repeat(200)+'\n','PRINT-LONG');
 await openPage(printPage,origin+'/index.php?page=admin&print=qr&event=PRINT-LONG');await printPage.waitForFunction(()=>document.body.dataset.printReady==='true');
 assert.equal(await printPage.locator('.card-name').innerText(),'N'.repeat(200));await printPage.pdf({path:'/tmp/rsas-qr-long.pdf',format:'A4',preferCSSPageSize:true});
 const longText=execFileSync('pdftotext',['/tmp/rsas-qr-long.pdf','-'],{encoding:'utf8'}).replace(/\s/g,'');for(const letter of ['E','N','C','J'])assert.ok(longText.includes(letter.repeat(200)));
 // Generation failure must keep printing disabled and show a warning in print media.
 await printPage.route('**/assets/print-qr.js',async route=>{const response=await route.fetch();const body=await response.text();await route.fulfill({response,body:'window.qrcode=()=>{throw Error("simulated QR failure")};\n'+body});});
 await openPage(printPage,origin+'/index.php?page=admin&print=qr&event=PRINT-A');assert.equal(await printPage.locator('#print-qr').isDisabled(),true);await printPage.emulateMedia({media:'print'});assert.equal(await printPage.locator('#print-warning').isVisible(),true);assert.equal(await printPage.locator('#print-cards').isHidden(),true);
 assert.deepEqual(errors,[]);console.log('PASS: Admin print link, 20/20/1 batches, 41 distinct original QR codes, event isolation, unchanged tokens/logs, PDF names/hidden controls, mobile, validation, empty/closed events.');
}finally{await browser.close();}
