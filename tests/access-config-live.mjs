// Run only against the disposable config-file fixture under /tmp/rsas-p1/.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {openPage} from './access-helper.mjs';
const path=await realpath(process.env.TEST_CONFIG_PATH||'/missing-test-config');assert.ok(path.startsWith('/tmp/rsas-p1/'),'Requires isolated test config');
const original=await readFile(path,'utf8'),adminPin=process.env.TEST_ADMIN_PIN,staffPin=process.env.TEST_STAFF_PIN,origin=process.env.TEST_ORIGIN;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const admin=await browser.newPage(),staff=await browser.newPage();await openPage(admin,origin+'/index.php?page=admin');await openPage(staff,origin+'/','staff');
 const events=page=>page.request.get(origin+'/api.php?action=events');assert.equal((await events(admin)).status(),200);assert.equal((await events(staff)).status(),200);
 const rotated=original.replace("'ADMIN_PIN'=>'"+adminPin+"'","'ADMIN_PIN'=>'81269437'");assert.notEqual(rotated,original);await writeFile(path,rotated);
 assert.equal((await events(admin)).status(),401);assert.equal((await events(staff)).status(),200);
 await admin.goto(origin+'/index.php?page=admin');const csrf=await admin.locator('meta[name=csrf]').getAttribute('content');
 const old=await admin.request.post(origin+'/access.php',{headers:{'X-CSRF-Token':csrf},data:{action:'login',role:'admin',pin:adminPin}});assert.equal(old.status(),401);
 process.env.TEST_ADMIN_PIN='81269437';await openPage(admin,origin+'/index.php?page=admin');assert.equal((await events(admin)).status(),200);
 for(const bad of [rotated.replace("'STAFF_PIN'=>'"+staffPin+"'","'STAFF_PIN'=>''"),rotated.replace("'STAFF_PIN'=>'"+staffPin+"'","'STAFF_PIN'=>'81269437'")]){
  await writeFile(path,bad);assert.equal((await events(admin)).status(),401);assert.equal((await events(staff)).status(),401);
  await admin.goto(origin+'/index.php?page=admin');assert.equal(await admin.locator('#access-form').count(),0);assert.match(await admin.locator('.access-warning').innerText(),/belum diatur/);
  const token=await admin.locator('meta[name=csrf]').getAttribute('content');const r=await admin.request.post(origin+'/access.php',{headers:{'X-CSRF-Token':token},data:{action:'login',role:'admin',pin:'81269437'}});assert.equal(r.status(),503);
  const html=await admin.content();assert.ok(!html.includes(adminPin)&&!html.includes(staffPin)&&!html.includes('81269437'));
 }
 console.log('PASS: actual config-file PIN rotation revokes old role sessions, preserves other role, rejects old PIN; blank/same PIN configuration fails closed without leaking PIN values.');
}finally{process.env.TEST_ADMIN_PIN=adminPin;await writeFile(path,original);await browser.close();}
