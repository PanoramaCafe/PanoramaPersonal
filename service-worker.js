const CACHE_NAME='panorama-personal-offline-v4';
const APP_SHELL=['./','./index.html','./manifest.json','./supabase-config.js','./panorama-auth.js','./panorama-core-integration.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);for(const url of APP_SHELL){try{await cache.add(url)}catch(error){console.warn('Offline shell',url,error)}}await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith((async()=>{const cached=await caches.match(event.request);try{const network=await fetch(event.request);if(new URL(event.request.url).origin===self.location.origin&&network.ok){const cache=await caches.open(CACHE_NAME);cache.put(event.request,network.clone()).catch(()=>{})}return network}catch{return cached||new Response('',{status:503})}})())});
