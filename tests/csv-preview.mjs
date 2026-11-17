import {openPage} from './access-helper.mjs';
// Disposable database seeded with sql/07_shared_hosting_dummy.sql; mutates only synthetic data.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8104';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const A='DEMO-RSAS-2026',B='DEMO-MITRA-2027',header='kode,nama,perusahaan,jabatan\n';
 await openPage(page,origin+'/index.php?page=admin');await page.waitForFunction(()=>!document.getElementById('event-select').disabled);await page.selectOption('#event-select',A);await page.waitForFunction(()=>document.getElementById('total').textContent==='8');
 const csrf=await page.locator('meta[name=csrf]').getAttribute('content'),request=page.request;
 async function upload(action,source,event=A){return request.post(origin+'/api.php?'+new URLSearchParams({action,event}),{headers:{'X-CSRF-Token':csrf},multipart:{csv:{name:'list.csv',mimeType:'text/csv',buffer:Buffer.from(source)}}});}
 async function total(event=A){return (await (await request.get(origin+'/api.php?'+new URLSearchParams({action:'status',event}))).json()).total;}
 async function previewUI(source){await page.locator('#csv').setInputFiles({name:'list.csv',mimeType:'text/csv',buffer:Buffer.from(source)});await page.locator('#import').click();await page.waitForFunction(()=>!document.getElementById('csv-preview').hidden);}
 const valid=header+'PT001,Dian Sintetis,PT Mitra Sintetis,Direktur\nNEW001,Nama Baru,PT Baru,Staf\n';
 const response=await upload('preview_import',valid);assert.equal(response.status(),200);const result=await response.json();assert.deepEqual(result.summary,{total:2,new:1,existing:1,invalid:0});assert.equal(result.can_import,true);assert.equal(result.rows,undefined);assert.ok(result.sample.every(r=>!('token'in r)));assert.equal(await total(),8);
 const bad=header+'OK001,Nama Valid,PT,Staf\nBAD001,,PT,Staf\nOK001,Duplikat,PT,Staf\nPT001,Nama Konflik,PT,Staf\nSHORT,Nama\n';
 const badResult=await (await upload('preview_import',bad)).json();assert.deepEqual(badResult.summary,{total:5,new:1,existing:0,invalid:4});assert.deepEqual(badResult.errors.map(e=>e.line),[3,4,5,6]);assert.equal(badResult.can_import,false);
 assert.equal((await upload('import',bad)).status(),422);assert.equal(await total(),8);
 await previewUI(bad);assert.equal(await page.locator('#confirm-import').isDisabled(),true);assert.match(await page.locator('#preview-errors').innerText(),/Baris 3.*Nama wajib/);await page.locator('#cancel-import').click();assert.equal(await total(),8);assert.equal(await page.locator('#csv-preview').isHidden(),true);
 await previewUI(valid);assert.equal(await total(),8);assert.equal(await page.locator('#confirm-import').isDisabled(),false);await page.locator('#confirm-import').click();await page.waitForFunction(()=>document.getElementById('total').textContent==='9');
 const replay=await upload('import',valid);assert.equal(replay.status(),200);assert.equal((await replay.json()).added,0);assert.equal(await total(),9);
 // Changed file invalidates preview, including when the new file itself would be valid.
 await previewUI(header+'NEW002,Nama Kedua,PT,Staf\n');await page.locator('#csv').setInputFiles({name:'replacement.csv',mimeType:'text/csv',buffer:Buffer.from(header+'NEW003,Pengganti,PT,Staf\n')});assert.equal(await page.locator('#csv-preview').isHidden(),true);assert.equal(await page.locator('#confirm-import').isDisabled(),true);
 // The database changes after preview: server must recheck and reject the whole new batch.
 const initial=await (await request.get(`${origin}/api.php?action=lookup&event=${A}&code=PT001`)).json();
 const stale=header+'NEW004,Baru Empat,PT,Staf\nPT001,Dian Sintetis,PT Mitra Sintetis,Direktur\n';await previewUI(stale);
 const edit=await request.post(`${origin}/api.php?action=update_guest&event=${A}`,{headers:{'X-CSRF-Token':csrf},data:{kode:'PT001',nama:'Dian Diubah',perusahaan:initial.guest.perusahaan,jabatan:initial.guest.jabatan,original:{nama:initial.guest.nama,perusahaan:initial.guest.perusahaan,jabatan:initial.guest.jabatan}}});assert.equal(edit.status(),200);
 await page.locator('#confirm-import').click();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Impor dibatalkan'));assert.equal(await total(),9);assert.equal(await page.locator('#confirm-import').isDisabled(),true);
 // Event switch also invalidates approval and clears the selected file.
 await previewUI(header+'NEW005,Baru Lima,PT,Staf\n');await page.selectOption('#event-select',B);assert.equal(await page.locator('#csv-preview').isHidden(),true);assert.equal(await page.locator('#csv').inputValue(),'');assert.equal(await total(B),3);await page.selectOption('#event-select',A);
 // RFC-style quoting, Unicode BOM, physical line numbers and bounded responses.
 const quoted='\uFEFF'+header.replace('\n','\r\n')+'Q001,"Nama, Éka","PT ""Contoh""","Baris satu\r\nbaris dua"\r\nQ002,,PT,Staf\r\n';
 const q=await (await upload('preview_import',quoted)).json();assert.equal(q.sample[0].name,'Nama, Éka');assert.equal(q.sample[0].company,'PT "Contoh"');assert.equal(q.errors[0].line,4);
 for(const malformed of [header+'"unterminated',header+'A,"name"junk,PT,Staf','wrong,header\na,b',header])assert.equal((await upload('preview_import',malformed)).status(),422);
 const many=header+Array.from({length:70},(_,i)=>`ERR${i},,PT,Staf`).join('\n');const m=await (await upload('preview_import',many)).json();assert.equal(m.summary.invalid,70);assert.equal(m.errors.length,50);assert.equal(m.sample.length,20);assert.equal(m.errors_truncated,true);
 const tooMany=header+Array.from({length:10001},(_,i)=>`BIG${i},Nama,PT,Staf`).join('\n');assert.equal((await upload('preview_import',tooMany)).status(),422);
 const legacy='event,code,name,company,position,category,token\n'+A+',LEG001,Tamu Lama,PT,Staf,reguler,'+'a'.repeat(48)+'\n';const l=await (await upload('preview_import',legacy)).json();assert.equal(l.summary.new,1);assert.equal((await upload('preview_import',legacy,B)).status(),200);assert.equal((await (await upload('preview_import',legacy,B)).json()).can_import,false);
 assert.equal((await request.get(`${origin}/api.php?action=preview_import&event=${A}`)).status(),405);assert.equal((await request.post(`${origin}/api.php?action=preview_import&event=${A}`,{multipart:{csv:{name:'x.csv',mimeType:'text/csv',buffer:Buffer.from(valid)}}})).status(),422);
 // Render untrusted strings as text; confirmation preview must not execute markup.
 await previewUI(header+'HTML001,<img src=x onerror=alert(1)>,PT,Staf\n');assert.equal(await page.locator('#csv-preview img').count(),0);await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),true);await page.waitForTimeout(300);await page.screenshot({path:'/tmp/rsas-csv-preview.png',fullPage:true});assert.equal(await total(),9);assert.deepEqual(errors,[]);
 console.log('PASS: read-only preview/counts/rows, confirmation/replay, no partial writes, changed DB/file/event, strict CSV/BOM/multiline/line numbers, bounded samples/errors, legacy event/token, CSRF and mobile/XSS.');
}finally{await browser.close();}
