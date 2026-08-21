const CACHE_NAME='panorama-personal-offline-v3';
const APP_SHELL=[
  './',
  './index.html',
  './manifest.json',
  './supabase-config.js',
  './panorama-auth.js',
  './panorama-core-integration.js'
];

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  for(const url of APP_SHELL){
    try{await cache.add(url)}catch(error){console.warn('Offline shell: no se pudo cachear',url,error)}
  }
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  event.respondWith((async()=>{
    const url=new URL(request.url);
    const sameOrigin=url.origin===self.location.origin;

    // La navegación siempre puede arrancar desde el shell local.
    if(request.mode==='navigate'){
      const cached=await caches.match('./index.html');
      if(!navigator.onLine && cached) return cached;
      try{
        const network=await fetch(request);
        if(sameOrigin&&network.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put('./index.html',network.clone());
        }
        return network;
      }catch{
        return cached||new Response('<!doctype html><title>Panorama Personal</title><p>Panorama Personal está disponible sin conexión.</p>',{
          status:200,headers:{'Content-Type':'text/html; charset=utf-8'}
        });
      }
    }

    try{
      const network=await fetch(request);
      if(sameOrigin&&network.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(request,network.clone()).catch(()=>{});
      }
      return network;
    }catch{
      const cached=await caches.match(request);
      if(cached) return cached;
      return new Response('',{status:503});
    }
  })());
});
