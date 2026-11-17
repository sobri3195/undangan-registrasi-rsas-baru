import {openPage} from './access-helper.mjs';
// Uses the isolated fixture prepared by tests/event-roster.py; no writes to this roster.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8112',event='RSAS-20261119';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await openPage(page,origin+'/index.php?page=admin');await page.waitForFunction(()=>document.getElementById('total').textContent==='80');assert.equal(await page.locator('#present').innerText(),'0');assert.equal(await page.locator('#event-state').innerText(),'Persiapan');assert.match(await page.locator('#event-detail').innerText(),/19 November 2026.*09.00 WIB/);
 const csrf=await page.locator('meta[name=csrf]').getAttribute('content');const preview=await page.request.post(`${origin}/api.php?action=preview_import&event=${event}`,{headers:{'X-CSRF-Token':csrf},multipart:{csv:{name:'list.csv',mimeType:'text/csv',buffer:await readFile(new URL('../data/undangan-rsas-20261119.csv',import.meta.url))}}});assert.equal(preview.status(),200);assert.deepEqual((await preview.json()).summary,{total:80,new:0,existing:80,invalid:0});
 const codes=[],qrPage=await browser.newPage();
 for(let batch=1;batch<=4;batch++){
  await openPage(qrPage,origin+`/index.php?page=admin&print=qr&event=${event}&batch=${batch}`);await qrPage.waitForFunction(()=>document.body.dataset.printReady==='true');assert.equal(await qrPage.locator('[data-qr]').count(),20);await qrPage.addScriptTag({url:origin+'/assets/vendor/jsQR.js'});
  const values=await qrPage.locator('[data-qr]').evaluateAll(boxes=>boxes.map(box=>{const c=box.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height);return {decoded:window.jsQR(d.data,d.width,d.height)?.data,expected:box.dataset.qr};}));
  for(const value of values){assert.equal(value.decoded,value.expected);const p=new URLSearchParams(new URL(value.decoded).hash.slice(1));assert.equal(p.get('event'),event);codes.push(p.get('code'));}
  assert.match(await qrPage.locator('.card-location').first().innerText(),/09.00 WIB/);
  if(batch===1){await qrPage.pdf({path:'/tmp/rsas-undangan-19-november-batch-1.pdf',format:'A4',preferCSSPageSize:true});const text=execFileSync('pdftotext',['/tmp/rsas-undangan-19-november-batch-1.pdf','-'],{encoding:'utf8'});assert.match(text,/Paban V\/Watpers Spersau/);assert.match(text,/09.00 WIB/);}
 }
 assert.deepEqual(codes,Array.from({length:80},(_,i)=>'RSAS'+String(i+1).padStart(3,'0')));
 const status=await (await page.request.get(`${origin}/api.php?action=status&event=${event}`)).json();assert.equal(status.total,80);assert.equal(status.present,0);assert.equal(status.event_info.status,'persiapan');assert.deepEqual(errors,[]);console.log('PASS: supplied roster 80 slots, 80 existing on CSV preview, 4x20 distinct decodable QR cards, correct time/location in PDF, no attendance writes');
}finally{await browser.close();}
