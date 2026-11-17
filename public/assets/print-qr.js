'use strict';
const printButton=document.getElementById('print-qr'),status=document.getElementById('print-status');
let ready=false;
try{
  const boxes=[...document.querySelectorAll('[data-qr]')];
  for(const box of boxes){
    const qr=window.qrcode(0,'M');qr.addData(box.dataset.qr,'Byte');qr.make();
    const n=qr.getModuleCount(),scale=6,pad=4,c=document.createElement('canvas');
    c.width=c.height=(n+pad*2)*scale;c.setAttribute('role','img');c.setAttribute('aria-label',box.getAttribute('aria-label'));
    const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#000';
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))ctx.fillRect((x+pad)*scale,(y+pad)*scale,scale,scale);
    box.replaceChildren(c);
  }
  ready=boxes.length>0;
  if(status)status.textContent=ready?`${boxes.length} QR siap dicetak. Kode undangan dan QR tetap sama.`:'Belum ada undangan pada acara ini.';
  document.body.dataset.printReady=String(ready);printButton.disabled=!ready;
}catch(e){if(status)status.textContent='QR gagal dibuat. Muat ulang halaman sebelum mencetak.';}
printButton.addEventListener('click',()=>{if(ready)window.print();});
