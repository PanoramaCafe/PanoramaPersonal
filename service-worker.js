const CACHE_NAME='panorama-personal-offline-v2';
const APP_SHELL=['./','./index.html','./manifest.json','./supabase-config.js','./panorama-auth.js','./panorama-core.js','./panorama-core-integration.js'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE_NAME)
    .then(cache=>cache.addAll(APP_SHELL))
    .then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  event.respondWith((async()=>{
    try{
      const network=await fetch(event.request);
      return network;
    }catch{
      const cache=await caches.open(CACHE_NAME);
      let cached=await cache.match(event.request);
      if(!cached && event.request.mode==='navigate'){
        cached=await cache.match('./index.html') || await cache.match(new URL('./index.html',self.registration.scope).href);
      }
      if(!cached){
        cached=await caches.match(event.request);
      }
      if(cached) return cached;
      return new Response('Sin conexión. Esta parte de Panorama Personal aún no está disponible sin internet.',{
        status:503,
        statusText:'Offline',
        headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});
