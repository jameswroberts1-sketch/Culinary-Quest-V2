const VERSION = "quest-v1";
const ASSETS = ["/","/index.html","/public/manifest.webmanifest"];
self.addEventListener("install",e=>{ e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS))); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k))))); });
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
      const copy=res.clone(); caches.open(VERSION).then(c=>c.put(e.request,copy)); return res;
    })));
  }
});
