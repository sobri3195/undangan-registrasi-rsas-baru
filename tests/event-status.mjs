import {openPage} from './access-helper.mjs';
// Disposable database seeded with 07_shared_hosting_dummy.sql. Uses Docker CLI for one lock race.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8107',container=process.env.PHP_CONTAINER||'rsas-status-mysql';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const admin=await browser.newPage(),tablet=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];admin.on('pageerror',e=>errors.push(e.message));tablet.on('pageerror',e=>errors.push(e.message));admin.on('dialog',d=>d.accept());
 const A='DEMO-RSAS-2026',B='DEMO-MITRA-2027';await openPage(admin,origin+'/index.php?page=admin');await admin.waitForFunction(()=>!document.getElementById('event-select').disabled);await admin.selectOption('#event-select',A);await admin.waitForFunction(()=>document.getElementById('present').textContent==='5');
 const csrf=await admin.locator('meta[name=csrf]').getAttribute('content'),req=admin.request;
 const post=(action,data,event=A)=>req.post(origin+'/api.php?'+new URLSearchParams({action,event}),{headers:{'X-CSRF-Token':csrf},data});
 const get=(action,event=A,params={})=>req.get(origin+'/api.php?'+new URLSearchParams({action,event,...params}));
 const state=async(event=A)=>(await (await get('event_state',event)).json()).event_info.status;
 const current=await (await get('invitation',A,{code:'PT001'})).json();
 async function uiStatus(status){await admin.selectOption('#status-select',status);await admin.locator('#apply-status').click();await admin.waitForFunction(s=>document.getElementById('event-state').dataset.state===s,status);}
 await openPage(tablet,origin+'/');await tablet.waitForFunction(()=>!document.getElementById('event-select').disabled);await tablet.selectOption('#event-select',A);await tablet.selectOption('#tablet','T03');await tablet.waitForFunction(()=>!document.getElementById('start').disabled);
 await uiStatus('persiapan');await tablet.waitForFunction(()=>document.getElementById('event-state').dataset.state==='persiapan'&&document.getElementById('start').disabled);
 assert.equal((await post('checkin',{code:'VIP002',tablet:'T06'})).status(),409);
 const csv='kode,nama,perusahaan,jabatan\nNEW001,Tamu Baru,PT,Staf\n';
 const upload=(action)=>req.post(`${origin}/api.php?action=${action}&event=${A}`,{headers:{'X-CSRF-Token':csrf},multipart:{csv:{name:'test.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}});
 assert.equal((await upload('preview_import')).status(),200);assert.equal((await upload('import')).status(),200);
 await uiStatus('dibuka');await tablet.waitForFunction(()=>!document.getElementById('start').disabled);
 // Keep a confirmation open while Admin closes reception.
 await tablet.locator('details summary').click();await tablet.locator('#search').fill('VIP002');await tablet.locator('#results button').click();assert.equal(await tablet.locator('#confirm').isDisabled(),false);
 await uiStatus('selesai');await tablet.waitForFunction(()=>document.getElementById('event-state').dataset.state==='selesai'&&document.getElementById('confirm').disabled&&document.getElementById('identity').hidden);
 assert.equal((await post('checkin',{code:'VIP002',tablet:'T06'})).status(),409);
 assert.equal((await upload('import')).status(),409);assert.equal((await upload('preview_import')).status(),409);
 const original={nama:current.guest.nama,perusahaan:current.guest.perusahaan,jabatan:current.guest.jabatan};assert.equal((await post('update_guest',{kode:'PT001',...original,nama:'Forbidden',original})).status(),409);
 assert.equal((await get('export')).status(),200);assert.equal((await get('search',A,{q:'PT001'})).status(),200);assert.deepEqual(await (await get('invitation',A,{code:'PT001'})).json(),current);
 let data=await (await get('status')).json();assert.equal(data.present,5);assert.equal(data.total,9);assert.equal(await state(B),'dibuka');assert.equal(await admin.locator('#import').isDisabled(),true);
 assert.equal((await post('set_event_status',{status:'bad',previous:'selesai'})).status(),422);assert.equal((await req.post(`${origin}/api.php?action=set_event_status&event=${A}`,{data:{status:'dibuka',previous:'selesai'}})).status(),422);
 assert.equal((await post('set_event_status',{status:'persiapan',previous:'dibuka'})).status(),409);assert.equal(await state(),'selesai');
 // Explicit reopen retains evidence and allows reception again.
 await uiStatus('dibuka');await tablet.waitForFunction(()=>!document.getElementById('start').disabled);assert.equal((await post('checkin',{code:'VIP002',tablet:'T06'})).status(),200);data=await (await get('status')).json();assert.equal(data.present,6);
 // Hold the event row in a closing transaction while the API's initial non-locking read sees open.
 const php=`require '/app/public/lib/bootstrap.php';$d=database();$d->beginTransaction();$d->exec("UPDATE scan_acara SET status='selesai' WHERE kode='${A}'");echo "LOCKED\\n";flush();usleep(1500000);$d->commit();`;
 const child=spawn('docker',['exec',container,'php','-r',php]);let output='';const ready=new Promise((resolve,reject)=>{child.stdout.on('data',d=>{output+=d;if(output.includes('LOCKED'))resolve();});child.on('error',reject);child.on('exit',c=>{if(!output.includes('LOCKED'))reject(Error('Lock helper exited '+c));});});const finished=new Promise((resolve,reject)=>child.on('exit',c=>c===0?resolve():reject(Error('Lock helper failed'))));await ready;
 assert.equal((await post('checkin',{code:'UM003',tablet:'T02'})).status(),409);await finished;assert.equal((await (await get('status')).json()).present,6);
 // New events default to preparation, independent from other event status.
 assert.equal((await post('create_event',{kode:'STATUS-NEW',nama:'Acara Baru',tanggal:'',lokasi:''})).status(),201);assert.equal(await state('STATUS-NEW'),'persiapan');
 await admin.setViewportSize({width:390,height:844});assert.equal(await admin.evaluate(()=>document.body.scrollWidth<=innerWidth),true);await admin.waitForTimeout(300);await admin.screenshot({path:'/tmp/rsas-event-status.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: preparation/open/closed, live tablet controls, PHP write guards, preserved evidence/QR/export, stale status conflict, reopen, locked closing race, new-event default and mobile UI.');
}finally{await browser.close();}
