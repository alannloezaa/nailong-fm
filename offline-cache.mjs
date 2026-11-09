export const appBase=new URL('./',import.meta.url).href;
export const cachePrefix=base=>`nailong-fm:${base}:`;
export const offlineCacheName=(base=appBase)=>cachePrefix(base)+'offline:v1';
export const audioURL=(config,base=appBase)=>{if(!config?.audio)return null;const url=new URL(config.audio,base);if(config.sha256)url.searchParams.set('nfm',config.sha256);return url.href;};
export const trackKey=(id,base=appBase)=>new URL(`__offline__/tracks/${encodeURIComponent(id)}`,base).href;
export function lyricsSignature(track,config){return JSON.stringify([track.id,config.sha256,config.duration,config.lyricsId,config.lyricsIdentity,config.lyricsTiming,config.lyricsSync,config.lyrics]);}
function lyricsKey(track,config){let hash=2166136261;for(const c of lyricsSignature(track,config))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;return new URL(`__offline__/lyrics/${encodeURIComponent(track.id)}?v=${hash.toString(16)}`,appBase).href;}
export async function savedLyrics(track,config){try{const cache=await caches.open(offlineCacheName()),response=await cache.match(lyricsKey(track,config));if(!response)return null;const envelope=await response.json();return envelope.signature===lyricsSignature(track,config)?envelope.result:null;}catch{return null;}}
export async function storeLyrics(track,config,result){if(!result||!['synced','plain','instrumental'].includes(result.kind))return;try{const cache=await caches.open(offlineCacheName());await cache.put(lyricsKey(track,config),Response.json({signature:lyricsSignature(track,config),result}));}catch{}}

// Safari requests byte ranges even when the complete song is already cached.
export function parseRange(header,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(header||'');if(!match||!size||(!match[1]&&!match[2]))return null;
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Number(match[2]):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start||(!match[1]&&Number(match[2])===0))return null;
 return {start,end:Math.min(end,size-1)};
}
export async function rangedResponse(response,header,head=false){
 const blob=await response.blob(),headers=new Headers(response.headers);headers.set('Accept-Ranges','bytes');
 if(!header){headers.set('Content-Length',String(blob.size));return new Response(head?null:blob,{status:200,headers});}
 const range=parseRange(header,blob.size);if(!range){headers.set('Content-Range',`bytes */${blob.size}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
 const {start,end}=range;headers.set('Content-Range',`bytes ${start}-${end}/${blob.size}`);headers.set('Content-Length',String(end-start+1));return new Response(head?null:blob.slice(start,end+1),{status:206,headers});
}
