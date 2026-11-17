// Retire cached offline pages from the earlier local-only application.
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('rsas-'))await caches.delete(key);await self.clients.claim();})()));
