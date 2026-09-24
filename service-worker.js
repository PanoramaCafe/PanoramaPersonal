const CACHE_NAME='panorama-personal-offline-v13';
const APP_SHELL=['./','./index.html','./manifest.json','./supabase-config.js','./panorama-session.js','./panorama-auth.js','./panorama-core-integration.js','./rescate.html','./icons/icon-192.svg','./icons/icon-512.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);for(const url of APP_SHELL){try{await cache.add(url)}catch(error){console.warn('Offline shell',url,error)}}await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
/* Solo interceptamos archivos propios (Supabase pasa directo). Red primero con límite de 4 s; si falla, caché. */
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  if(new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const network=await Promise.race([fetch(req),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),4000))]);
      if(network.ok)cache.put(req,network.clone()).catch(()=>{});
      return network;
    }catch{
      return (await cache.match(req))||(req.mode==='navigate'?await cache.match('./index.html'):null)||new Response('',{status:503});
    }
  })());
});
