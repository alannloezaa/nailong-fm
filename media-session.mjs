export function mediaPosition(audio){
 const duration=Number(audio.duration),rate=Number(audio.playbackRate)||1;
 if(!Number.isFinite(duration)||duration<=0)return null;
 return {duration,playbackRate:rate>0?rate:1,position:Math.max(0,Math.min(duration,Number(audio.currentTime)||0))};
}

export function connectMediaSession({device=globalThis.navigator,readAudio,play,pause,next,previous,seek}){
 const session=device?.mediaSession;
 if(!session)return ()=>{};
 const jump=delta=>{const audio=readAudio(),position=mediaPosition(audio);if(position)seek(Math.max(0,Math.min(position.duration,position.position+delta)));};
 for(const [action,handler]of Object.entries({
  play,pause,stop:pause,nexttrack:next,previoustrack:previous,
  seekto:event=>{if(Number.isFinite(event.seekTime))seek(event.seekTime);},
  seekbackward:event=>jump(-(event.seekOffset||10)),seekforward:event=>jump(event.seekOffset||10)
 })){try{session.setActionHandler(action,handler);}catch{}}
 let last='';
 return (force=false)=>{
  const audio=readAudio(),position=mediaPosition(audio),state=!audio.getAttribute('src')?'none':audio.paused||audio.ended?'paused':'playing';
  const key=`${state}:${position?.duration}:${Math.floor(position?.position||0)}:${position?.playbackRate}`;
  if(!force&&key===last)return;last=key;
  try{session.playbackState=state;}catch{}
  try{if(session.setPositionState)session.setPositionState(position||{});}catch{}
 };
}
