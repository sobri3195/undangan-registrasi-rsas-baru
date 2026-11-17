'use strict';
async function sendAccess(body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('/access.php',{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':document.querySelector('meta[name=csrf]').content},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Akses gagal.');return data;
  }finally{clearTimeout(timer);}
}
document.getElementById('access-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const button=document.getElementById('access-submit'),error=document.getElementById('access-error');button.disabled=true;error.textContent='';
  try{await sendAccess({action:'login',...Object.fromEntries(new FormData(e.target))});location.reload();}
  catch(err){error.textContent=err.name==='AbortError'?'Koneksi terputus. Periksa internet dan coba lagi.':err.message;document.getElementById('access-pin').value='';}
  finally{button.disabled=false;}
});
document.getElementById('logout')?.addEventListener('click',async e=>{
  e.target.disabled=true;
  try{await sendAccess({action:'logout'});location.reload();}
  catch{e.target.disabled=false;document.getElementById('notice').textContent='Belum berhasil keluar. Periksa koneksi dan coba lagi.';}
});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
