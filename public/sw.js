'use strict';
const CACHE='rsas-v1';
const FILES=['/','/index.php?page=tamu','/index.php?page=petugas','/index.php?page=koordinator','/assets/style.css','/assets/app.js','/assets/core.js','/assets/db.js','/assets/vendor/qrcode.js','/assets/vendor/qrcode_UTF8.js','/assets/vendor/jsQR.js','/template.csv'];
async function prepare(){const cache=await caches.open(CACHE);await cache.addAll(FILES);}
self.addEventListener('install',e=>e.waitUntil(prepare().then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('rsas-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('message',e=>{if(e.data?.type==='PREPARE')e.waitUntil(prepare().then(()=>e.ports[0]?.postMessage({ok:true})).catch(()=>e.ports[0]?.postMessage({ok:false})));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!FILES.includes(u.pathname+u.search))return;e.respondWith((async()=>{try{return await fetch(e.request);}catch{const cached=await caches.match(u.pathname+u.search);return cached||Response.error();}})());});
