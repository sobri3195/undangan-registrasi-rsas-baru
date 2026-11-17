// Isolated database with SQL 07; synthetic identities and disposable session files only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {openPage} from './access-helper.mjs';
const {chromium,request}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8130',container=process.env.PHP_CONTAINER||'rsas-p1-mysql';
const adminPin=process.env.TEST_ADMIN_PIN,staffPin=process.env.TEST_STAFF_PIN;
assert.ok(adminPin&&staffPin,'Test server PIN environment required');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const contexts=[];
const php=code=>execFileSync('docker',['exec',container,'php','-r',"require '/app/public/lib/bootstrap.php';"+code],{encoding:'utf8'});
const event='DEMO-RSAS-2026';
try{
 const page=await browser.newPage();let response=await page.goto(origin+'/index.php?page=admin');assert.equal(response.status(),200);assert.match(response.headers()['permissions-policy'],/camera=\(\)/);assert.equal(await page.locator('#access-form').count(),1);assert.equal(await page.locator('#arrivals').count(),0);assert.doesNotMatch(await page.content(),/Dian Sintetis|VIP001/);
 const anonymousCsrf=await page.locator('meta[name=csrf]').getAttribute('content');
 const write=['preview_import','import','checkin','create_event','update_guest','set_event_status'];
 const read=['events','event_state','status','search','lookup','invitation','export'];
 for(const action of [...read,...write]){
  const url=origin+'/api.php?'+new URLSearchParams({action,event,code:'PT001',q:'Dian'});
  const r=write.includes(action)?await page.request.post(url,{headers:{'X-CSRF-Token':anonymousCsrf},data:{code:'VIP002',tablet:'T06',status:'selesai',previous:'dibuka'}}):await page.request.get(url);
  assert.equal(r.status(),401,action);assert.doesNotMatch(await r.text(),/Dian Sintetis|43ad6cbd/);
 }
 response=await page.request.get(origin+'/index.php?page=admin&print=qr&event='+event);assert.equal(response.status(),401);assert.doesNotMatch(await response.text(),/data-qr=|Dian Sintetis/);
 assert.equal((await page.request.get(origin+'/access.php')).status(),405);
 assert.equal((await page.request.post(origin+'/access.php',{data:{action:'login',role:'admin',pin:adminPin}})).status(),422);
 const oldCookie=(await page.context().cookies()).find(x=>x.name==='PHPSESSID').value;
 await openPage(page,origin+'/index.php?page=admin');const newCookie=(await page.context().cookies()).find(x=>x.name==='PHPSESSID').value;assert.notEqual(newCookie,oldCookie);
 const adminCsrf=await page.locator('meta[name=csrf]').getAttribute('content');assert.notEqual(adminCsrf,anonymousCsrf);
 const status=async()=>(await (await page.request.get(origin+'/api.php?action=status&event='+event)).json());assert.equal((await status()).present,5);
 const tables=[];
 for(let i=1;i<=6;i++){
  const tablet=await browser.newPage({viewport:{width:1024,height:768}});tables.push(tablet);await openPage(tablet,origin+'/','staff');await tablet.waitForFunction(()=>!document.getElementById('event-select').disabled);await tablet.selectOption('#event-select',event);
  const csrf=await tablet.locator('meta[name=csrf]').getAttribute('content');const call=async(action,body)=>tablet.request.post(origin+'/api.php?'+new URLSearchParams({action,event}),{headers:{'X-CSRF-Token':csrf},data:body});
  if(i===1){
   for(const action of ['status','invitation','export'])assert.equal((await tablet.request.get(origin+'/api.php?'+new URLSearchParams({action,event,code:'PT001'}))).status(),403);
   for(const action of ['create_event','update_guest','set_event_status','preview_import','import'])assert.equal((await call(action,{})).status(),403);
   const html=await tablet.request.get(origin+'/index.php?page=admin&print=qr&event='+event);assert.equal(html.status(),403);assert.doesNotMatch(await html.text(),/data-qr=/);
   assert.equal((await tablet.request.post(origin+'/api.php?action=checkin&event='+event,{headers:{'X-CSRF-Token':anonymousCsrf},data:{code:'UM003',tablet:'T01'}})).status(),422);
  }
  await tablet.selectOption('#tablet','T0'+i);await tablet.locator('details summary').click();await tablet.locator('#search').fill('UM003');await tablet.locator('#results button').click();await tablet.waitForFunction(()=>!document.getElementById('identity').hidden);assert.match(await tablet.locator('#guest-name').innerText(),/Reno/);await tablet.locator('#confirm').click();await tablet.waitForFunction(()=>document.getElementById('saved').textContent.includes('berhasil dicatat'));
 }
 let data=await status();assert.equal(data.present,6);assert.equal(data.arrivals.find(x=>x.kode==='UM003').jumlah_tablet,6);
 const tablet=tables[0],csrf=await tablet.locator('meta[name=csrf]').getAttribute('content');assert.equal((await tablet.request.post(origin+'/access.php',{data:{action:'logout'}})).status(),422);assert.equal((await tablet.request.get(origin+'/api.php?action=event_state&event='+event)).status(),200);
 await tablet.locator('#logout').click();await tablet.locator('#access-form').waitFor();assert.equal((await tablet.request.get(origin+'/api.php?action=search&event='+event+'&q=Reno')).status(),401);
 // Expiry and credential fingerprint revocation are enforced server-side.
 const expiry=await browser.newPage();await openPage(expiry,origin+'/index.php?page=admin');let sid=(await expiry.context().cookies()).find(x=>x.name==='PHPSESSID').value;
 execFileSync('docker',['exec',container,'php','-r',"session_id($argv[1]);require '/app/public/lib/bootstrap.php';$_SESSION['access']['expires']=time()-1;",sid]);assert.equal((await expiry.request.get(origin+'/api.php?action=events')).status(),401);
 await openPage(expiry,origin+'/index.php?page=admin');sid=(await expiry.context().cookies()).find(x=>x.name==='PHPSESSID').value;
 execFileSync('docker',['exec',container,'php','-r',"session_id($argv[1]);require '/app/public/lib/bootstrap.php';$_SESSION['access']['fingerprint']=str_repeat('0',64);",sid]);assert.equal((await expiry.request.get(origin+'/api.php?action=events')).status(),401);
 // The API sees cookie/session resets and spoofed forwarded addresses as the same source.
 php("database()->exec('DELETE FROM scan_access_limits');");
 const clients=[];for(let i=0;i<8;i++){
  const c=await request.newContext();clients.push(c);contexts.push(c);const r=await c.get(origin+'/');const html=await r.text();const csrf=html.match(/name="csrf" content="([a-f0-9]+)"/)[1];c.csrf=csrf;
 }
 const attempts=await Promise.all(clients.map((c,i)=>c.post(origin+'/access.php',{headers:{'X-CSRF-Token':c.csrf,'X-Forwarded-For':'198.51.100.'+i},data:{action:'login',role:'admin',pin:'00000000'}})));
 assert.equal(attempts.filter(x=>x.status()===401).length,5);assert.equal(attempts.filter(x=>x.status()===429).length,3);
 const blocked=await clients[0].post(origin+'/access.php',{headers:{'X-CSRF-Token':clients[0].csrf},data:{action:'login',role:'admin',pin:adminPin}});assert.equal(blocked.status(),429);assert.ok(Number(blocked.headers()['retry-after'])>0);
 // A shared global role quota also applies when the per-IP bucket is absent.
 const bucket='https://undanganregistrasirsas.puskesau.com|admin|global';
 php("$d=database();$d->exec('DELETE FROM scan_access_limits');$q=$d->prepare('INSERT INTO scan_access_limits VALUES (?,50,?)');$q->execute([hash('sha256',"+JSON.stringify(bucket)+"),time()+60]);");
 const global=await clients[1].post(origin+'/access.php',{headers:{'X-CSRF-Token':clients[1].csrf},data:{action:'login',role:'admin',pin:adminPin}});assert.equal(global.status(),429);
 php("database()->exec('DELETE FROM scan_access_limits');");
 const unblocked=await clients[1].post(origin+'/access.php',{headers:{'X-CSRF-Token':clients[1].csrf},data:{action:'login',role:'admin',pin:adminPin}});assert.equal(unblocked.status(),200);
 const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(origin+'/');await nojs.locator('#access-pin').fill(staffPin);const posted=nojs.waitForRequest(r=>r.url()===origin+'/access.php');await nojs.locator('#access-submit').click();const native=await posted;assert.equal(native.method(),'POST');assert.ok(!native.url().includes(staffPin));assert.doesNotMatch(await nojs.content(),new RegExp(staffPin));await nojs.close();
 for(const width of [320,390,768,1024]){const p=await browser.newPage({viewport:{width,height:844}});await p.goto(origin+'/');assert.equal(await p.evaluate(()=>document.body.scrollWidth<=innerWidth),true);assert.equal(await p.locator('#access-pin').getAttribute('type'),'password');await p.screenshot({path:'/tmp/rsas-p1-access-'+width+'.png',fullPage:true});await p.close();}
 assert.equal((await status()).present,6);console.log('PASS P1: anonymous API/QR/PII denied; role guards, CSRF, session rotation/expiry/revocation/logout; six staff tablets and live admin; durable concurrent throttling across cookies/forwarded headers; global limit; responsive PIN page.');
}finally{await Promise.all(contexts.map(c=>c.dispose()));await browser.close();}
