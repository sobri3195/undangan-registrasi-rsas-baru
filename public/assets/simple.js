'use strict';
const $=id=>document.getElementById(id),page=document.body.dataset.page;
let selected=null,stream=null,frame=null,starting=false,scanSession=0,arrivals=[],searchVersion=0,inviteVersion=0,activeEvent='',events=[],eventVersion=0;
let attendanceFilter='present',listingVersion=0,searchTimer,editingGuest=null,editVersion=0,importPreview=null,previewVersion=0,eventStatus='persiapan',statusEditorDirty=false,savingAttendance=false,importBusy=false;
const notify=message=>{$('notice').textContent=message;};
const handle=fn=>async e=>{try{await fn(e);}catch(err){notify(err.message||'Operasi gagal.');}};
function on(id,event,fn){$(id)?.addEventListener(event,handle(fn));}
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
async function api(action,params={},body){
  if(!['events','create_event'].includes(action)&&!activeEvent)throw Error('Pilih acara terlebih dahulu.');
  const u=new URL('/api.php',location.origin);u.search=new URLSearchParams({action,event:activeEvent,...params});
  const controller=new AbortController();
  const options={cache:'no-store',credentials:'same-origin',signal:controller.signal};
  if(body){options.method='POST';options.headers={'X-CSRF-Token':document.querySelector('meta[name=csrf]').content};if(body instanceof FormData)options.body=body;else{options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}}
  let response;
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{response=await fetch(u,options);}catch{throw Error('Koneksi terputus. Kehadiran belum terkonfirmasi. Periksa internet dan coba lagi.');}finally{clearTimeout(timeout);}
  let result;try{result=await response.json();}catch{throw Error('Respons server tidak valid. Periksa pengaturan PHP/database.');}
  if(!response.ok)throw Error(result.error||'Permintaan gagal.');return result;
}
function tablet(){if(!activeEvent)throw Error('Pilih acara terlebih dahulu.');const value=$('tablet').value;if(!/^T0[1-6]$/.test(value))throw Error('Pilih tablet T01–T06 terlebih dahulu.');return value;}
function stopCamera(){scanSession++;if(frame)cancelAnimationFrame(frame);frame=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if($('video')){$('video').srcObject=null;$('video').hidden=true;$('stop').hidden=true;$('start').disabled=eventStatus!=='dibuka';}}
function reset(){selected=null;$('identity').hidden=true;$('empty').hidden=false;}
function time(value){return new Date(value.replace(' ','T')+'Z').toLocaleString('id-ID',{dateStyle:'short',timeStyle:'medium'});}
async function lookup(params){
  const version=++searchVersion;const result=await api('lookup',params);
  if(version!==searchVersion)return;
  stopCamera();selected={...result.guest,event:activeEvent};$('guest-name').textContent=selected.nama;$('guest-detail').textContent=[selected.perusahaan,selected.jabatan].filter(Boolean).join(' · ');$('guest-code').textContent='Kode '+selected.kode;
  $('previous').textContent=result.records.length?'Sudah tercatat melalui '+result.records.map(r=>r.tablet).join(', ')+'. Konfirmasi dari tablet lain tetap dihitung satu tamu.':'Belum tercatat hadir.';
  $('confirm').disabled=eventStatus!=='dibuka'||savingAttendance;$('identity').hidden=false;$('empty').hidden=true;$('saved').textContent='';notify('');$('confirmation').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function parseQR(raw){
  if(/^[A-Za-z0-9_-]{1,64}$/.test(raw))return {code:raw};
  if(raw.length>1024)throw Error('QR tidak valid.');
  const url=new URL(raw);
  if(url.origin!==document.body.dataset.base || url.pathname!=='/index.php' || !['?page=scan','?page=tamu'].includes(url.search))throw Error('QR bukan undangan RSAS.');
  const p=new URLSearchParams(url.hash.slice(1));
  if([...p.keys()].some(k=>!['v','event','code','token','phone'].includes(k)||p.getAll(k).length!==1)||p.get('v')!=='1'||!/^[-\w]{1,64}$/.test(p.get('code')||'')||!/^[-\w]{1,64}$/.test(p.get('event')||'')||!(/^[a-f0-9]{32,64}$/).test(p.get('token')||''))throw Error('Isi QR tidak valid.');
  if(p.get('event')!==activeEvent)throw Error('QR milik acara lain. Pilih acara yang sesuai sebelum memindai.');
  return {code:p.get('code'),qr_event:p.get('event'),token:p.get('token')};
}
async function startCamera(){
  tablet();if(eventStatus!=='dibuka')throw Error('Penerimaan acara belum dibuka atau sudah selesai.');if(starting||stream)return;
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Kamera memerlukan HTTPS. Gunakan pencarian manual.');
  starting=true;const session=++scanSession;$('start').disabled=true;$('stop').hidden=false;reset();$('saved').textContent='';
  try{
    const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    if(session!==scanSession||document.hidden){media.getTracks().forEach(t=>t.stop());return;}
    stream=media;const video=$('video');video.srcObject=media;video.hidden=false;await video.play();
    $('camera-status').textContent='Arahkan kamera ke QR. Scan belum mencatat kehadiran.';
    const c=$('frame'),ctx=c.getContext('2d',{willReadFrequently:true});let last=0,checking=false;
    const tick=async now=>{
      if(!stream||session!==scanSession)return;
      if(!checking&&now-last>300&&video.readyState>=2&&video.videoWidth){
        last=now;c.width=Math.min(video.videoWidth,800);c.height=Math.round(video.videoHeight*c.width/video.videoWidth);ctx.drawImage(video,0,0,c.width,c.height);
        const pixels=ctx.getImageData(0,0,c.width,c.height),qr=window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
        if(qr){checking=true;try{await lookup(parseQR(qr.data));return;}catch(err){$('camera-status').textContent=err.message;}finally{checking=false;}}
      }
      if(stream&&session===scanSession)frame=requestAnimationFrame(tick);
    };frame=requestAnimationFrame(tick);
  }catch(err){stopCamera();throw Error(`Kamera gagal (${err.name||'error'}). Periksa izin kamera atau gunakan pencarian manual.`);}finally{starting=false;if(!stream)$('start').disabled=eventStatus!=='dibuka';}
}
async function search(id,target,invites=false){
  const version=invites?++inviteVersion:++searchVersion,q=$(id).value.trim();$(target).replaceChildren();if(q.length<2)return;
  const data=await api('search',{q});if(version!==(invites?inviteVersion:searchVersion))return;
  for(const guest of data.guests){const b=element('button',`${guest.nama} · ${guest.perusahaan} · ${guest.kode}`,'secondary');b.addEventListener('click',handle(()=>invites?showQR(guest.kode):lookup({code:guest.kode})));const row=element('div',undefined,'slot');row.append(b);if(invites){const edit=element('button','Edit','secondary');edit.disabled=eventStatus==='selesai';edit.addEventListener('click',handle(()=>openGuestEditor(guest.kode)));row.append(edit);}$(target).append(row);}
  if(!data.guests.length)$(target).append(element('p','Tidak ada hasil.'));
}
async function showQR(code){
  const version=eventVersion,result=await api('invitation',{code});if(version!==eventVersion)return;const box=$('invitation');box.replaceChildren(element('h3',result.guest.nama));
  const qr=window.qrcode(0,'M');qr.addData(result.url);qr.make();const n=qr.getModuleCount(),c=element('canvas',undefined,'qr');c.width=c.height=(n+8)*6;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+4)*6,(y+4)*6,6,6);
  const a=element('a',result.url);a.href=result.url;const save=element('button','Simpan QR PNG');save.addEventListener('click',()=>{const d=element('a');d.href=c.toDataURL('image/png');d.download=`undangan-${code}.png`;d.click();});box.append(c,save,a);
}
function renderArrivals(loading=false){
  const fragment=document.createDocumentFragment();
  for(const guest of arrivals){const tr=element('tr');for(const value of [guest.nama,[guest.perusahaan,guest.jabatan].filter(Boolean).join(' / '),guest.kode,guest.status,guest.tablet||'—',guest.pertama_utc?time(guest.pertama_utc):'—'])tr.append(element('td',value));const actions=element('td'),edit=element('button','Edit','secondary edit-guest');edit.disabled=eventStatus==='selesai';edit.setAttribute('aria-label','Edit identitas '+guest.nama);edit.addEventListener('click',handle(()=>openGuestEditor(guest.kode)));actions.append(edit);tr.append(actions);fragment.append(tr);}
  if(!arrivals.length){const tr=element('tr'),td=element('td',loading?'Memuat daftar…':'Tidak ada undangan yang cocok dengan filter dan pencarian.');td.colSpan=7;tr.append(td);fragment.append(tr);}$('arrivals').replaceChildren(fragment);
  const label={all:'Semua Undangan',present:'Sudah Datang',absent:'Belum Datang'}[attendanceFilter];
  $('list-summary').textContent=loading?'Memuat daftar…':`${arrivals.length} undangan ditampilkan · ${label}`;
}
function updateExport(){if(page==='admin')$('export').href=document.body.dataset.base+'/api.php?'+new URLSearchParams({action:'export',event:activeEvent,filter:attendanceFilter,q:$('arrival-search').value.trim()});}
function changeListing(){listingVersion++;arrivals=[];renderArrivals(true);updateExport();}
let refreshingEvent=null;
async function refresh(){if(!activeEvent||refreshingEvent===JSON.stringify([activeEvent,attendanceFilter,$('arrival-search')?.value.trim()||'',listingVersion]))return;const version=eventVersion,listVersion=listingVersion,event=JSON.stringify([activeEvent,attendanceFilter,$('arrival-search')?.value.trim()||'',listingVersion]);refreshingEvent=event;try{
  const data=await api(page==='admin'?'status':'event_state',page==='admin'?{filter:attendanceFilter,q:$('arrival-search').value.trim()}:{});if(version!==eventVersion||listVersion!==listingVersion)return;$('connection').textContent='Terhubung ke server';applyEventStatus(data.event_info);
  if(page==='admin'){$('total').textContent=data.total;$('present').textContent=data.present;$('remaining').textContent=data.total-data.present;const percent=data.total?Math.round(100*data.present/data.total):0;$('attendance-percent').textContent=percent+'%';$('attendance-progress').value=percent;$('attendance-progress').textContent=percent+'%';$('tablet-counts').replaceChildren();for(let i=1;i<=6;i++){const id='T0'+i,div=element('div',id);div.append(element('strong',data.tablets[id]||0));$('tablet-counts').append(div);}arrivals=data.guests;renderArrivals();$('updated').textContent=`Terakhir diperbarui ${new Date().toLocaleTimeString('id-ID')} · otomatis setiap 3 detik`;}
  else $('tablet-status').textContent=`${data.total} undangan tersedia dari Admin. Acara ${data.event}.`;
}catch(err){if(version!==eventVersion||listVersion!==listingVersion)return;$('connection').textContent='Server belum terhubung';if(page==='admin')$('list-summary').textContent='Daftar belum dapat diperbarui.';if(page==='admin')$('updated').textContent='Data belum diperbarui. '+err.message;else notify(err.message);}finally{if(refreshingEvent===event)refreshingEvent=null;}}
on('tablet','change',()=>{stopCamera();searchVersion++;reset();localStorage.setItem('rsas-tablet',$('tablet').value);});
on('start','click',startCamera);on('stop','click',()=>{stopCamera();$('camera-status').textContent='Kamera dihentikan.';});
on('cancel','click',()=>{searchVersion++;reset();});on('search','input',()=>search('search','results'));
on('confirm','click',async e=>{if(!selected||savingAttendance)return;if(eventStatus!=='dibuka')throw Error('Penerimaan acara tidak dibuka.');const guest=selected,station=tablet();if(guest.event!==activeEvent)throw Error('Acara berubah. Pindai ulang undangan.');savingAttendance=true;e.target.disabled=true;$('event-select').disabled=true;try{const result=await api('checkin',{}, {code:guest.kode,tablet:station});if(guest.event!==activeEvent)return;$('saved').textContent=`${guest.nama} · ${station}. ${result.message}`;notify('');reset();await refresh();}finally{savingAttendance=false;e.target.disabled=eventStatus!=='dibuka';$('event-select').disabled=false;}});
on('arrival-search','input',()=>{clearTimeout(searchTimer);changeListing();searchTimer=setTimeout(()=>refresh(),250);});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{clearTimeout(searchTimer);attendanceFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));changeListing();refresh();}));on('refresh','click',refresh);on('invite-search','input',()=>search('invite-search','invite-results',true));
function clearImportPreview(){previewVersion++;importPreview=null;if($('csv-preview')){$('csv-preview').hidden=true;$('confirm-import').disabled=true;$('preview-errors').replaceChildren();$('preview-rows').replaceChildren();}}
function renderImportPreview(result,file){
  const summary=result.summary;importPreview={file,event:activeEvent};
  $('preview-target').textContent=`Acara tujuan: ${result.event_name} (${result.event}) · ${file.name}`;
  $('preview-summary').textContent=`${summary.total} baris · ${summary.new} baru · ${summary.existing} sudah ada dan identik · ${summary.invalid} bermasalah`;
  $('preview-errors').replaceChildren();for(const error of result.errors)$('preview-errors').append(element('p',`Baris ${error.line}${error.code?' ('+error.code+')':''}: ${error.message}`));
  if(result.errors_truncated)$('preview-errors').append(element('p','Hanya 50 kesalahan pertama ditampilkan. Perbaiki CSV lalu periksa kembali.'));
  $('preview-rows').replaceChildren();for(const row of result.sample){const tr=element('tr');for(const value of [row.line,row.code,row.name,[row.company,row.position].filter(Boolean).join(' / '),{new:'Baru',existing:'Sudah ada',invalid:'Bermasalah'}[row.kind]])tr.append(element('td',String(value)));$('preview-rows').append(tr);}
  $('confirm-import').disabled=!result.can_import;$('csv-preview').hidden=false;
}
on('csv','change',()=>{clearImportPreview();});
on('cancel-import','click',()=>{clearImportPreview();$('csv').value='';notify('Pratinjau dibatalkan. Data tidak diimpor.');});
on('import','click',async e=>{
  const file=$('csv').files[0];clearImportPreview();if(!file||file.size>5*1024*1024)throw Error('Pilih CSV maksimal 5 MB.');
  if(eventStatus==='selesai')throw Error('Acara sudah selesai. Impor ditutup.');const version=eventVersion,preview=previewVersion;importBusy=true;e.target.disabled=true;$('event-select').disabled=true;
  try{const form=new FormData();form.append('csv',file);const result=await api('preview_import',{},form);if(version!==eventVersion||preview!==previewVersion)return;renderImportPreview(result,file);notify(result.can_import?'Pratinjau siap. Periksa acara dan data, lalu tekan Konfirmasi Impor.':'Ada baris bermasalah. Perbaiki CSV lalu jalankan pratinjau ulang.');}
  finally{importBusy=false;e.target.disabled=eventStatus==='selesai';$('event-select').disabled=false;}
});
on('confirm-import','click',async e=>{
  const context=importPreview;if(!context||context.event!==activeEvent||$('csv').files[0]!==context.file)throw Error('Berkas atau acara berubah. Jalankan pratinjau ulang.');
  const version=eventVersion;importBusy=true;e.target.disabled=true;$('event-select').disabled=true;$('csv').disabled=true;$('cancel-import').disabled=true;$('import').disabled=true;
  try{const form=new FormData();form.append('csv',context.file);const result=await api('import',{event:context.event},form);if(version!==eventVersion)return;clearImportPreview();$('csv').value='';listingVersion++;await refresh();notify(result.message);}
  catch(err){clearImportPreview();notify(err.message+' Jalankan pratinjau kembali sebelum mencoba impor.');}
  finally{importBusy=false;$('event-select').disabled=false;$('csv').disabled=false;$('cancel-import').disabled=false;$('import').disabled=eventStatus==='selesai'||importBusy;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else refresh();});window.addEventListener('pagehide',stopCamera);
// Retire the previous offline-only shell; shared attendance requires a server connection.
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(async regs=>{for(const reg of regs)if(reg.scope===location.origin+'/')await reg.unregister();}).catch(()=>{});
if('caches' in window)caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rsas-')).map(k=>caches.delete(k)))).catch(()=>{});
async function openGuestEditor(code){
  if(eventStatus==='selesai')throw Error('Acara selesai. Identitas hanya dapat dilihat.');
  if(eventStatus==='selesai')throw Error('Acara sudah selesai. Identitas tidak dapat diubah.');
  const version=++editVersion,event=activeEvent;
  const result=await api('lookup',{code});if(version!==editVersion||event!==activeEvent||eventStatus==='selesai')return;
  editingGuest={event,code,original:{nama:result.guest.nama,perusahaan:result.guest.perusahaan,jabatan:result.guest.jabatan}};
  $('edit-context').textContent=`${event} / ${code}`;
  $('edit-name').value=result.guest.nama;$('edit-company').value=result.guest.perusahaan;$('edit-position').value=result.guest.jabatan;
  $('guest-error').textContent='';$('guest-dialog').showModal();$('edit-name').focus();
}
on('close-guest','click',()=>$('guest-dialog').close());
$('guest-dialog')?.addEventListener('cancel',e=>{if($('save-guest').disabled)e.preventDefault();});
$('guest-dialog')?.addEventListener('close',()=>{editingGuest=null;editVersion++;});
on('guest-form','submit',async e=>{
  e.preventDefault();const context=editingGuest;if(!context||context.event!==activeEvent)throw Error('Acara berubah. Buka ulang Edit.');
  $('save-guest').disabled=true;$('close-guest').disabled=true;$('event-select').disabled=true;$('guest-error').textContent='';
  try{
    const data={...Object.fromEntries(new FormData(e.target)),kode:context.code,original:context.original};
    const result=await api('update_guest',{event:context.event},data);
    if(context.event!==activeEvent)return;
    $('guest-dialog').close();editVersion++;listingVersion++;inviteVersion++;
    // Clear QR captions/results so they do not show the identity from before this correction.
    $('invitation').replaceChildren();$('invite-results').replaceChildren();
    await refresh();if($('invite-search').value.trim().length>=2)await search('invite-search','invite-results',true);
    notify(result.message);
  }catch(err){$('guest-error').textContent=err.message;}
  finally{$('save-guest').disabled=false;$('close-guest').disabled=false;$('event-select').disabled=false;}
});
async function chooseEvent(){
  statusEditorDirty=false;
  if(page==='admin'){clearImportPreview();$('guest-dialog').close();editingGuest=null;editVersion++;}clearTimeout(searchTimer);activeEvent=$('event-select').value;eventVersion++;listingVersion++;searchVersion++;inviteVersion++;
  notify('');if(page==='scan'){stopCamera();reset();$('saved').textContent='';$('search').value='';$('results').replaceChildren();$('tablet-status').textContent='Memuat daftar acara…';}
  if(page==='admin'){arrivals=[];$('arrival-search').value='';renderArrivals(true);$('invite-search').value='';$('invite-results').replaceChildren();$('invitation').replaceChildren();$('csv').value='';for(const id of ['total','present','remaining'])$(id).textContent='—';$('tablet-counts').replaceChildren();$('updated').textContent='Memuat kehadiran acara…';$('attendance-progress').value=0;$('attendance-percent').textContent='—';updateExport();}
  const meta=events.find(e=>e.kode===activeEvent);applyEventStatus(meta);
  $('event-detail').textContent=meta?[meta.tanggal?new Date(meta.tanggal+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'Tanggal belum ditentukan',meta.lokasi,meta.kode].filter(Boolean).join(' · '):'Pilih acara.';
  try{localStorage.setItem('rsas-event',activeEvent);}catch{}
  await refresh();
}
async function loadEvents(preferred=''){
  const result=await api('events');events=result.events;let stored='';try{stored=localStorage.getItem('rsas-event')||'';}catch{}
  const wanted=preferred||activeEvent||stored;
  $('event-select').replaceChildren();for(const event of events){const option=element('option',event.nama);option.value=event.kode;$('event-select').append(option);}
  if(events.some(e=>e.kode===wanted))$('event-select').value=wanted;
  $('event-select').disabled=!events.length;
  if(events.length)await chooseEvent();else{activeEvent='';notify('Belum ada acara. Buat acara melalui Admin.');}
}
on('event-select','change',chooseEvent);
on('new-event','click',()=>{$('event-form').reset();$('event-error').textContent='';$('event-dialog').showModal();$('event-name').focus();});
on('close-event','click',()=>$('event-dialog').close());
on('event-form','submit',async e=>{e.preventDefault();$('save-event').disabled=true;$('event-error').textContent='';try{const data=Object.fromEntries(new FormData(e.target));const result=await api('create_event',{},data);await loadEvents(result.event);$('event-dialog').close();notify(result.message+' Impor daftar undangan untuk memulai.');}catch(err){$('event-error').textContent=err.message;}finally{$('save-event').disabled=false;}});
if(page==='scan'){try{const saved=localStorage.getItem('rsas-tablet');if(/^T0[1-6]$/.test(saved))$('tablet').value=saved;}catch{}}
if(page==='scan'||page==='admin')handle(async()=>{await loadEvents();if(page==='scan'&&location.hash){tablet();await lookup(parseQR(document.body.dataset.base+'/index.php?page=scan'+location.hash));}})();
if(page==='scan'||page==='admin')setInterval(()=>{if(!document.hidden)refresh();},3000);

function applyEventStatus(info){
  if(!info)return;const previous=eventStatus;eventStatus=info.status;
  const meta=events.find(e=>e.kode===activeEvent);if(meta)meta.status=eventStatus;
  const labels={persiapan:'Persiapan',dibuka:'Dibuka',selesai:'Selesai'};
  $('event-state').textContent=labels[eventStatus];$('event-state').dataset.state=eventStatus;
  $('event-status-note').textContent={persiapan:'Acara dalam persiapan. Daftar dan QR dapat disiapkan; check-in belum dibuka.',dibuka:'Penerimaan dibuka. Tablet T01–T06 dapat mencatat kehadiran.',selesai:'Acara selesai. Data tetap tersedia untuk dilihat dan diekspor.'}[eventStatus];
  if(page==='scan'){
    if(eventStatus!=='dibuka'){stopCamera();if(selected)reset();}
    $('start').disabled=eventStatus!=='dibuka'||starting||!!stream;$('confirm').disabled=eventStatus!=='dibuka'||savingAttendance;
  }else{
    if(!statusEditorDirty||previous!==eventStatus){$('status-select').value=eventStatus;statusEditorDirty=false;}
    $('import').disabled=eventStatus==='selesai'||importBusy;
    if(previous!==eventStatus&&eventStatus==='selesai'){clearImportPreview();editVersion++;$('guest-dialog').close();}
  }
}
on('status-select','change',()=>{statusEditorDirty=true;});
on('apply-status','click',async e=>{
  const next=$('status-select').value,previous=eventStatus,event=activeEvent;
  if(!event||next===previous)return;
  const names={persiapan:'Persiapan',dibuka:'Dibuka',selesai:'Selesai'};
  if(!window.confirm(`Ubah status acara menjadi ${names[next]}?${next==='selesai'?' Check-in, impor, dan edit identitas akan dihentikan.':''}`)){$('status-select').value=previous;statusEditorDirty=false;return;}
  e.target.disabled=true;$('status-select').disabled=true;$('event-select').disabled=true;
  try{const result=await api('set_event_status',{event},{status:next,previous});if(event!==activeEvent)return;statusEditorDirty=false;applyEventStatus({status:result.status});listingVersion++;await refresh();notify(result.message);}
  catch(err){notify(err.message);statusEditorDirty=false;await refresh();}
  finally{e.target.disabled=false;$('status-select').disabled=false;$('event-select').disabled=false;}
});
