'use strict';
const $=id=>document.getElementById(id),page=document.body.dataset.page;
let selected=null,stream=null,frame=null,starting=false,scanSession=0,arrivals=[],searchVersion=0,inviteVersion=0;
const notify=message=>{$('notice').textContent=message;};
const handle=fn=>async e=>{try{await fn(e);}catch(err){notify(err.message||'Operasi gagal.');}};
function on(id,event,fn){$(id)?.addEventListener(event,handle(fn));}
function element(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
async function api(action,params={},body){
  const u=new URL('/api.php',location.origin);u.search=new URLSearchParams({action,...params});
  const controller=new AbortController();
  const options={cache:'no-store',credentials:'same-origin',signal:controller.signal};
  if(body){options.method='POST';options.headers={'X-CSRF-Token':document.querySelector('meta[name=csrf]').content};if(body instanceof FormData)options.body=body;else{options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}}
  let response;
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{response=await fetch(u,options);}catch{throw Error('Koneksi terputus. Kehadiran belum terkonfirmasi. Periksa internet dan coba lagi.');}finally{clearTimeout(timeout);}
  let result;try{result=await response.json();}catch{throw Error('Respons server tidak valid. Periksa pengaturan PHP/database.');}
  if(!response.ok)throw Error(result.error||'Permintaan gagal.');return result;
}
function tablet(){const value=$('tablet').value;if(!/^T0[1-6]$/.test(value))throw Error('Pilih tablet T01–T06 terlebih dahulu.');return value;}
function stopCamera(){scanSession++;if(frame)cancelAnimationFrame(frame);frame=null;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if($('video')){$('video').srcObject=null;$('video').hidden=true;$('stop').hidden=true;$('start').disabled=false;}}
function reset(){selected=null;$('identity').hidden=true;$('empty').hidden=false;}
function time(value){return new Date(value.replace(' ','T')+'Z').toLocaleString('id-ID',{dateStyle:'short',timeStyle:'medium'});}
async function lookup(params){
  const version=++searchVersion;const result=await api('lookup',params);
  if(version!==searchVersion)return;
  stopCamera();selected=result.guest;$('guest-name').textContent=selected.nama;$('guest-detail').textContent=[selected.perusahaan,selected.jabatan].filter(Boolean).join(' · ');$('guest-code').textContent='Kode '+selected.kode;
  $('previous').textContent=result.records.length?'Sudah tercatat melalui '+result.records.map(r=>r.tablet).join(', ')+'. Konfirmasi dari tablet lain tetap dihitung satu tamu.':'Belum tercatat hadir.';
  $('identity').hidden=false;$('empty').hidden=true;$('saved').textContent='';notify('');$('confirmation').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function parseQR(raw){
  if(/^[A-Za-z0-9_-]{1,64}$/.test(raw))return {code:raw};
  if(raw.length>1024)throw Error('QR tidak valid.');
  const url=new URL(raw);
  if(url.origin!==document.body.dataset.base || url.pathname!=='/index.php' || !['?page=scan','?page=tamu'].includes(url.search))throw Error('QR bukan undangan RSAS.');
  const p=new URLSearchParams(url.hash.slice(1));
  if([...p.keys()].some(k=>!['v','event','code','token','phone'].includes(k)||p.getAll(k).length!==1)||p.get('v')!=='1'||!/^[-\w]{1,64}$/.test(p.get('code')||'')||!/^[-\w]{1,64}$/.test(p.get('event')||'')||!(/^[a-f0-9]{32,64}$/).test(p.get('token')||''))throw Error('Isi QR tidak valid.');
  return {code:p.get('code'),event:p.get('event'),token:p.get('token')};
}
async function startCamera(){
  tablet();if(starting||stream)return;
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
  }catch(err){stopCamera();throw Error(`Kamera gagal (${err.name||'error'}). Periksa izin kamera atau gunakan pencarian manual.`);}finally{starting=false;if(!stream)$('start').disabled=false;}
}
async function search(id,target,invites=false){
  const version=invites?++inviteVersion:++searchVersion,q=$(id).value.trim();$(target).replaceChildren();if(q.length<2)return;
  const data=await api('search',{q});if(version!==(invites?inviteVersion:searchVersion))return;
  for(const guest of data.guests){const b=element('button',`${guest.nama} · ${guest.perusahaan} · ${guest.kode}`,'secondary');b.addEventListener('click',handle(()=>invites?showQR(guest.kode):lookup({code:guest.kode})));const row=element('div',undefined,'slot');row.append(b);$(target).append(row);}
  if(!data.guests.length)$(target).append(element('p','Tidak ada hasil.'));
}
async function showQR(code){
  const result=await api('invitation',{code}),box=$('invitation');box.replaceChildren(element('h3',result.guest.nama));
  const qr=window.qrcode(0,'M');qr.addData(result.url);qr.make();const n=qr.getModuleCount(),c=element('canvas',undefined,'qr');c.width=c.height=(n+8)*6;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+4)*6,(y+4)*6,6,6);
  const a=element('a',result.url);a.href=result.url;const save=element('button','Simpan QR PNG');save.addEventListener('click',()=>{const d=element('a');d.href=c.toDataURL('image/png');d.download=`undangan-${code}.png`;d.click();});box.append(c,save,a);
}
function renderArrivals(){
  const query=$('arrival-search').value.trim().toLocaleLowerCase('id'),rows=arrivals.filter(x=>[x.nama,x.perusahaan,x.jabatan,x.kode,x.tablet].some(s=>s.toLocaleLowerCase('id').includes(query)));const fragment=document.createDocumentFragment();
  for(const guest of rows){const tr=element('tr');for(const value of [guest.nama,[guest.perusahaan,guest.jabatan].filter(Boolean).join(' / '),guest.kode,guest.tablet,time(guest.pertama_utc)])tr.append(element('td',value));fragment.append(tr);}
  if(!rows.length){const tr=element('tr'),td=element('td','Belum ada tamu yang cocok / datang.');td.colSpan=5;tr.append(td);fragment.append(tr);}$('arrivals').replaceChildren(fragment);
}
let refreshing=false;
async function refresh(){if(refreshing)return;refreshing=true;try{
  const data=await api('status');$('connection').textContent='Terhubung ke server';
  if(page==='admin'){$('total').textContent=data.total;$('present').textContent=data.present;$('remaining').textContent=data.total-data.present;$('tablet-counts').replaceChildren();for(let i=1;i<=6;i++){const id='T0'+i,div=element('div',id);div.append(element('strong',data.tablets[id]||0));$('tablet-counts').append(div);}arrivals=data.arrivals;renderArrivals();$('updated').textContent=`Terakhir diperbarui ${new Date().toLocaleTimeString('id-ID')} · otomatis setiap 3 detik`;}
  else $('tablet-status').textContent=`${data.total} undangan tersedia dari Admin. Acara ${data.event}.`;
}catch(err){$('connection').textContent='Server belum terhubung';if(page==='admin')$('updated').textContent='Data belum diperbarui. '+err.message;else notify(err.message);}finally{refreshing=false;}}
on('tablet','change',()=>{stopCamera();searchVersion++;reset();localStorage.setItem('rsas-tablet',$('tablet').value);});
on('start','click',startCamera);on('stop','click',()=>{stopCamera();$('camera-status').textContent='Kamera dihentikan.';});
on('cancel','click',()=>{searchVersion++;reset();});on('search','input',()=>search('search','results'));
on('confirm','click',async e=>{if(!selected)return;const guest=selected,station=tablet();e.target.disabled=true;try{const result=await api('checkin',{}, {code:guest.kode,tablet:station});$('saved').textContent=`${guest.nama} · ${station}. ${result.message}`;notify('');reset();await refresh();}finally{e.target.disabled=false;}});
on('arrival-search','input',renderArrivals);on('refresh','click',refresh);on('invite-search','input',()=>search('invite-search','invite-results',true));
on('import','click',async e=>{const file=$('csv').files[0];if(!file||file.size>5*1024*1024)throw Error('Pilih CSV maksimal 5 MB.');e.target.disabled=true;try{const form=new FormData();form.append('csv',file);const result=await api('import',{},form);notify(result.message);$('csv').value='';await refresh();}finally{e.target.disabled=false;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else refresh();});window.addEventListener('pagehide',stopCamera);
// Retire the previous offline-only shell; shared attendance requires a server connection.
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(async regs=>{for(const reg of regs)if(reg.scope===location.origin+'/')await reg.unregister();}).catch(()=>{});
if('caches' in window)caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rsas-')).map(k=>caches.delete(k)))).catch(()=>{});
if(page==='scan'){try{const saved=localStorage.getItem('rsas-tablet');if(/^T0[1-6]$/.test(saved))$('tablet').value=saved;}catch{}if(location.hash)handle(async()=>{tablet();await lookup(parseQR(document.body.dataset.base+'/index.php?page=scan'+location.hash));})() ;}
if(page==='scan'||page==='admin'){refresh();if(page==='admin')setInterval(()=>{if(!document.hidden)refresh();},3000);}
