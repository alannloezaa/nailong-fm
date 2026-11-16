import {appBase,offlineCacheName,audioURL,trackKey,savedLyrics} from './offline-cache.mjs';
import {loadLyrics} from './lyrics.mjs?v=20261116-3';

export async function verifyAudio(buffer,config){
 if(buffer.byteLength!==config.bytes)throw new Error('El archivo llegó incompleto. Vuelve a intentarlo.');
 const digest=await crypto.subtle.digest('SHA-256',buffer),sha=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(sha!==config.sha256)throw new Error('El audio no coincide con la versión del catálogo.');
}
export class OfflineLibrary{
 constructor({onChange=()=>{},onProgress=()=>{}}={}){this.tracks=[];this.media={};this.saved=new Map();this.onChange=onChange;this.onProgress=onProgress;this.busy=false;this.controller=null;}
 async configure(tracks,media,{retiredIds=[]}={}){this.tracks=tracks;this.media=media;try{await this.pruneRetired(retiredIds);}catch{}await this.refresh();}
 async pruneRetired(ids){
  if(!ids.length||!globalThis.caches)return;const retired=new Set(ids),keptArt=new Set(this.tracks.map(t=>new URL(t.artwork,appBase).href)),cache=await caches.open(offlineCacheName());
  for(const id of ids){const response=await cache.match(trackKey(id));if(!response)continue;try{const record=await response.json();if(record.url)await cache.delete(record.url);if(record.fadeURL)await cache.delete(record.fadeURL);if(record.artwork&&!keptArt.has(record.artwork))await cache.delete(record.artwork);}catch{}await cache.delete(trackKey(id));}
  for(const request of await cache.keys()){const path=new URL(request.url).pathname;if([...retired].some(id=>path.endsWith(`/audio/${id}.mp3`)||path.endsWith(`/audio-${id}.mp3`)||path.endsWith(`/audio-fade/${id}.m4a`)||path.endsWith(`/audio-fade-${id}.m4a`)||path.endsWith(`/__offline__/lyrics/${encodeURIComponent(id)}`)))await cache.delete(request);}
 }
 async refresh(){
  const found=new Map();try{const cache=await caches.open(offlineCacheName());for(const track of this.tracks){const config=this.media[track.id],response=await cache.match(trackKey(track.id));if(!response||!config)continue;const record=await response.json();if(record.sha===config.sha256&&await cache.match(audioURL(config)))found.set(track.id,record);}}catch{}
  this.saved=found;this.onChange();return found;
 }
 cancel(){this.controller?.abort();}
 async download(ids){
  if(this.busy)return;this.busy=true;this.controller=new AbortController();const signal=this.controller.signal;
  const jobs=[...new Set(ids)].map(id=>this.tracks.find(t=>t.id===id)).filter(t=>t&&this.media[t.id]?.audio),state={done:0,total:jobs.length,bytes:0,failed:[],partial:[],effectsMissing:[],cancelled:false};
  try{
   if(!globalThis.caches||!navigator.serviceWorker)throw new Error('Este navegador no permite guardar música sin conexión.');
   if(navigator.onLine===false)throw new Error('Conéctate a internet para guardar las canciones por primera vez.');
   let timer;try{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Vuelve a abrir la página para activar el modo sin conexión.')),10000);})]);}finally{clearTimeout(timer);}
   try{await navigator.storage?.persist?.();}catch{}
   const cache=await caches.open(offlineCacheName());
   for(const track of jobs){
    if(signal.aborted)break;const config=this.media[track.id],url=audioURL(config);this.onProgress({...state,title:track.title});
    try{
     if(!this.saved.has(track.id)){
      const response=await fetch(url,{signal,cache:'no-store'});if(!response.ok||response.status!==200)throw new Error('No se pudo descargar el audio completo.');
      const buffer=await response.arrayBuffer();await verifyAudio(buffer,config);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
      const headers=new Headers({'Content-Type':response.headers.get('Content-Type')||'audio/mpeg','Content-Length':String(buffer.byteLength),'Accept-Ranges':'bytes'});for(const name of ['ETag','Last-Modified'])if(response.headers.has(name))headers.set(name,response.headers.get(name));
      await cache.put(url,new Response(buffer,{headers}));
     }
     let fadeURL=null;
     if(config.fade?.audio){
      const target=audioURL(config.fade);
      try{
       if(!await cache.match(target)){
        const response=await fetch(target,{signal,cache:'no-store'});if(!response.ok||response.status!==200)throw new Error('Incomplete transition copy');
        const buffer=await response.arrayBuffer();await verifyAudio(buffer,config.fade);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
        await cache.put(target,new Response(buffer,{headers:{'Content-Type':'audio/mp4','Content-Length':String(buffer.byteLength),'Accept-Ranges':'bytes'}}));
       }
       fadeURL=target;
      }catch(error){if(error.name==='AbortError')throw error;state.effectsMissing.push(track.id);}
     }
     let art=false,lyrics=false;
     try{const artURL=new URL(track.artwork,appBase).href,response=await fetch(artURL,{signal});if(response.ok){await cache.put(artURL,response);art=true;}}catch(error){if(error.name==='AbortError')throw error;}
     try{const result=await loadLyrics({...track,duration:config.duration||track.duration},{configured:config,signal});lyrics=['synced','plain','instrumental'].includes(result.kind)&&!!await savedLyrics(track,config);}catch(error){if(error.name==='AbortError')throw error;}
     const record={id:track.id,sha:config.sha256,url,fadeURL,fadeSha:fadeURL?config.fade.sha256:null,artwork:new URL(track.artwork,appBase).href,art,lyrics,bytes:config.bytes+(fadeURL?config.fade.bytes:0),savedAt:Date.now()};
     const previous=this.saved.get(track.id);await cache.put(trackKey(track.id),Response.json(record));this.saved.set(track.id,record);if(previous?.fadeURL&&previous.fadeURL!==fadeURL)await cache.delete(previous.fadeURL);state.done++;state.bytes+=record.bytes;if(!art||!lyrics)state.partial.push(track.id);this.onChange();
    }catch(error){if(!this.saved.has(track.id)){await cache.delete(url);if(config.fade?.audio)await cache.delete(audioURL(config.fade));}if(error.name==='AbortError')break;if(error.name==='QuotaExceededError')throw new Error('El navegador se quedó sin espacio. Lo ya guardado se conserva.');state.failed.push({id:track.id,message:error.message});}
    this.onProgress({...state,title:track.title});
   }
   state.cancelled=signal.aborted;return state;
  }finally{this.busy=false;this.controller=null;await this.refresh();this.onProgress({...state,finished:true});}
 }
 async remove(ids){
  if(this.busy)return;const cache=await caches.open(offlineCacheName());
  for(const id of ids){const record=this.saved.get(id);if(!record)continue;await cache.delete(record.url);if(record.fadeURL)await cache.delete(record.fadeURL);const config=this.media[id];if(config?.fade?.audio)await cache.delete(audioURL(config.fade));await cache.delete(trackKey(id));this.saved.delete(id);if(![...this.saved.values()].some(other=>other.artwork===record.artwork))await cache.delete(record.artwork);for(const request of await cache.keys())if(new URL(request.url).pathname.endsWith(`/__offline__/lyrics/${encodeURIComponent(id)}`))await cache.delete(request);}
  this.onChange();
 }
}
