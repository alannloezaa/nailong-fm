import {cachePrefix,offlineCacheName,rangedResponse} from './offline-cache.mjs';
const PREFIX=cachePrefix(self.registration.scope),SHELL_CACHE=PREFIX+'shell:v21',MEDIA_CACHE=offlineCacheName(self.registration.scope);
const SHELL=['./','./index.html','./base.css','./site.css?v=20261109-4','./app.mjs?v=20261109-4','./mixer.mjs?v=20261109-4','./mobile-mixer.mjs?v=20261109-4','./audio-source.mjs','./install.mjs','./media-session.mjs?v=20261108-2','./playlist.mjs?v=20261107-5','./lyrics.mjs?v=20261109-2','./offline-cache.mjs','./offline.mjs','./analytics.mjs','./analytics-config.json','./storage.mjs','./theme.mjs','./catalog.json','./media.json','./favicon-nailong.png','./icon-nailong-192.png','./icon-nailong-512.png','./apple-touch-icon-nailong.png','./manifest.webmanifest?v=nailong-yellow-1','./artwork-monet-hd.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==SHELL_CACHE&&key!==MEDIA_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(!['GET','HEAD'].includes(request.method)||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 const isAudio=/\.(?:mp3|m4a|mp4)$/i.test(url.pathname);
 event.respondWith((async()=>{
  const media=await caches.open(MEDIA_CACHE),saved=await media.match(request.url);
  if(isAudio){if(saved)return rangedResponse(saved,request.headers.get('Range'),request.method==='HEAD');return fetch(request);}
  if(request.method==='HEAD')return fetch(request);
  const shell=await caches.open(SHELL_CACHE);
  try{const response=await fetch(request);if(response.ok){const copy=response.clone();event.waitUntil(shell.put(request,copy));return response;}const fallback=saved||await shell.match(request);return fallback||response;}
  catch{return saved||await shell.match(request)||(request.mode==='navigate'?await shell.match(new URL('./index.html',self.registration.scope)):Response.error());}
 })());
});
