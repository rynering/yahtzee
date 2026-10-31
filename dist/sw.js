const CACHE='lucky-roll-v19';
const ASSETS=['./','./index.html','./style.css?v=19','./app.mjs?v=19','./engine.mjs','./celebration.mjs?v=9','./manifest.webmanifest','./icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lucky-roll-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('./index.html',copy)));}return response;}).catch(()=>caches.match('./index.html')));return;}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});

