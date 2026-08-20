const CACHE_NAME="panorama-personal-v2-sync";
const APP_SHELL=["./","./index.html","./index-sync.html","./manifest.json","./panorama-sync.js"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(e.request.mode==='navigate'&&!u.pathname.endsWith('/index-sync.html')){e.respondWith(Response.redirect(new URL('./index-sync.html',self.registration.scope),302));return;}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request,{cache:u.pathname.endsWith('/index.html')?'no-store':'default'})));});