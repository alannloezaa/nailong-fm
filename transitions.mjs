import {prefersNativePlayback} from './mixer.mjs?v=20261116-3';

export function transitionProfile(device=globalThis.navigator){
 return prefersNativePlayback(device)?'native':'desktop';
}

// Old downloads remain playable even when the optional effect has not been saved.
// A personal upload always wins and never inherits an effect from another file.
export async function transitionSource(config,{profile='native',enabled=true,localAudio=null,online=true,readSaved=async()=>null}={}){
 if(localAudio)return {config,blob:localAudio,effect:false};
 if(profile==='native'&&enabled&&config.fade?.audio){
  const blob=await readSaved(config.fade);
  if(blob||online)return {config:config.fade,blob,effect:true};
 }
 return {config,blob:await readSaved(config),effect:false};
}
