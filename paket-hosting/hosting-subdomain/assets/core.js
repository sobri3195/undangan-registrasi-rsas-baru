export const BASE = 'https://undanganregistrasirsas.puskesau.com';
export const HEADERS = ['event','code','name','company','position','category','token'];
const id = /^[A-Za-z0-9_-]{1,64}$/;
const validId = value => typeof value === 'string' && id.test(value);
const token = /^[a-f0-9]{32,64}$/;
const fail = message => { throw new Error(message); };
export const key = x => `${x.event}:${x.code}`;
export function text(value, max=200) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) fail('Teks tidak valid / terlalu panjang.');
  return value;
}
export function validateSlot(x) {
  if (!x || !validId(x.event) || !validId(x.code) || !token.test(x.token)) fail('Event, kode, atau token tidak valid.');
  const out = Object.fromEntries(HEADERS.map(h=>[h,text(x[h])]));
  if (!out.name.trim() || !['VIP','reguler','mitra PT'].includes(out.category)) fail('Nama wajib diisi; kategori: VIP, reguler, mitra PT.');
  return out;
}
export function randomToken() { return [...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export function parseCSV(source) {
  if (typeof source !== 'string' || source.length > 5*1024*1024) fail('CSV terlalu besar.');
  source=source.replace(/^\uFEFF/,'');
  const rows=[]; let row=[], cell='', quoted=false, closed=false;
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(quoted) { if(c==='"') { if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;} }else cell+=c; }
    else if(c==='"') { if(cell || closed) fail('Kutip CSV tidak valid.'); quoted=true; }
    else if(c===',' || c==='\n' || c==='\r') {
      row.push(cell);cell='';closed=false;
      if(c!==','){if(c==='\r'&&source[i+1]==='\n')i++; if(row.some(Boolean))rows.push(row);row=[];}
    }else {if(closed)fail('Karakter setelah kutip CSV.');cell+=c;}
  }
  if(quoted)fail('Kutip CSV belum ditutup.');
  row.push(cell);if(row.some(Boolean))rows.push(row);
  if(!rows.length || rows[0].join(',')!==HEADERS.join(','))fail('Header CSV harus: '+HEADERS.join(','));
  if(rows.length>10001)fail('Maksimum 10.000 slot per berkas.');
  const seen=new Set();
  return rows.slice(1).map(r=>{
    if(r.length!==HEADERS.length)fail('Jumlah kolom CSV tidak cocok.');
    const x=Object.fromEntries(HEADERS.map((h,i)=>[h,r[i].trim()]));
    x.token ||= randomToken();const s=validateSlot(x);
    if(seen.has(key(s)))fail('Kode slot duplikat dalam CSV.');seen.add(key(s));return s;
  });
}
export function invitationURL(slot,phone='') {
  validateSlot(slot);
  const hash=new URLSearchParams({v:'1',event:slot.event,code:slot.code,token:slot.token});
  if(phone){if(!/^\d{8,15}$/.test(phone))fail('Nomor WhatsApp tidak valid.');hash.set('phone',phone);}
  return `${BASE}/index.php?page=tamu#${hash}`;
}
export function parseQR(raw) {
  if(typeof raw!=='string'||raw.length>1024)fail('QR terlalu panjang.');
  const u=new URL(raw);
  if(u.origin!==BASE || u.pathname!=='/index.php' || u.search!=='?page=tamu')fail('QR bukan undangan aplikasi ini.');
  const p=new URLSearchParams(u.hash.slice(1));
  if([...p.keys()].some(k=>!['v','event','code','token','phone'].includes(k)) || [...p.keys()].some(k=>p.getAll(k).length!==1))fail('Parameter QR tidak valid.');
  const x={event:p.get('event'),code:p.get('code'),token:p.get('token'),phone:p.get('phone')||''};
  if(p.get('v')!=='1'||!validId(x.event)||!validId(x.code)||!token.test(x.token)||(x.phone&&!/^\d{8,15}$/.test(x.phone)))fail('Isi QR tidak valid.');return x;
}
function date(value) { if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value)))fail('Waktu catatan tidak valid.');return value; }
export function empty() { return {version:1,slots:[],logs:[],rsvps:[]}; }
export function validateBackup(b) {
  if(!b||b.version!==1||!Array.isArray(b.slots)||!Array.isArray(b.logs)||!Array.isArray(b.rsvps)||b.slots.length>10000||b.logs.length>100000||b.rsvps.length>10000)fail('Format / ukuran backup tidak valid.');
  const slots=b.slots.map(validateSlot), lookup=new Map();
  for(const s of slots){if(lookup.has(key(s)))fail('Slot duplikat pada backup.');lookup.set(key(s),s);}
  const logs=b.logs.map(l=>{
    if(!l||!validId(l.id)||!/^T0[1-6]$/.test(l.tablet))fail('Log tidak valid.');
    const s=lookup.get(key(l));if(!s||s.token!==l.token)fail('Log tidak cocok dengan daftar undangan.');
    return {id:l.id,event:s.event,code:s.code,token:s.token,tablet:l.tablet,at:date(l.at)};
  });
  const rsvps=b.rsvps.map(r=>{
    if(!r||!lookup.has(key(r))||!['hadir','tidak','belum'].includes(r.answer))fail('RSVP tidak valid.');
    return {event:r.event,code:r.code,answer:r.answer,at:date(r.at)};
  });
  if(new Set(logs.map(l=>l.id)).size!==logs.length||new Set(rsvps.map(key)).size!==rsvps.length)fail('Catatan duplikat pada backup.');
  return {version:1,slots,logs,rsvps};
}
export function merge(a,b) {
  a=validateBackup(a);b=validateBackup(b);
  const slots=new Map(a.slots.map(s=>[key(s),s])),logs=new Map(a.logs.map(l=>[l.id,l])),rsvps=new Map(a.rsvps.map(r=>[key(r),r]));
  for(const s of b.slots){const old=slots.get(key(s));if(old&&JSON.stringify(old)!==JSON.stringify(s))fail('Daftar undangan bertentangan: '+key(s));slots.set(key(s),s);}
  for(const l of b.logs){const old=logs.get(l.id);if(old&&JSON.stringify(old)!==JSON.stringify(l))fail('ID log bertentangan.');logs.set(l.id,l);}
  for(const r of b.rsvps){const old=rsvps.get(key(r));if(!old||r.at>old.at||(r.at===old.at&&r.answer>old.answer))rsvps.set(key(r),r);}
  return validateBackup({version:1,slots:[...slots.values()],logs:[...logs.values()],rsvps:[...rsvps.values()]});
}
export function uniqueAttendance(b,event) { return new Set(b.logs.filter(l=>!event||l.event===event).map(key)).size; }
export function csvCell(s) { s=String(s);if(/^[\s\uFEFF]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'; }
export function reportCSV(b,event) {
  const rows=[['event','code','nama','perusahaan','jabatan','kategori','rsvp','hadir','waktu_pertama_UTC','tablet','jumlah_catatan']];
  for(const s of b.slots.filter(s=>s.event===event)) {
    const logs=b.logs.filter(l=>key(l)===key(s)).sort((a,b)=>a.at.localeCompare(b.at));
    rows.push([s.event,s.code,s.name,s.company,s.position,s.category,b.rsvps.find(r=>key(r)===key(s))?.answer||'belum',logs.length?'ya':'tidak',logs[0]?.at||'',[...new Set(logs.map(l=>l.tablet))].join(' / '),logs.length]);
  }
  return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
