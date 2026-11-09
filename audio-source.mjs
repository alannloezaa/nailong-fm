import {audioURL} from './offline-cache.mjs';

// Keep the native cached Blob and the range-enabled URL available to both decks.
// Safari's media/Web Audio path can expose incomplete metadata for Blob URLs.
export function createAudioLease({track,local={},configured={},blob=null,urlAPI=URL}={}){
 const objectURL=blob?urlAPI.createObjectURL(blob):null,hostedURL=audioURL(configured),nativeURL=objectURL||hostedURL;
 const mixingURL=blob&&!local.audio&&hostedURL?hostedURL:nativeURL;
 const expectedDuration=!local.audio||local.audio.size===configured.bytes?Number(configured.duration||track.duration)||0:0;
 let references=0,disposed=false;
 function lease(url=nativeURL){
  if(disposed)throw new Error('Audio source already released');references++;let released=false;
  const retain=nextURL=>{if(released)throw new Error('Audio lease already released');return lease(nextURL);};
  return {track,local,url,expectedDuration,mixing:local.audio?{}:configured.mixing||{},retain:()=>retain(url),forNative:()=>retain(nativeURL),forMixing:()=>retain(mixingURL),release(){if(released)return;released=true;if(--references===0){disposed=true;if(objectURL)urlAPI.revokeObjectURL(objectURL);}}};
 }
 return lease();
}
