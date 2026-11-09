const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));

export function usesSystemVolume(device=globalThis.navigator){
 return /iPhone|iPad|iPod/i.test(device?.userAgent||'')||(device?.platform==='MacIntel'&&device?.maxTouchPoints>1);
}
export function prefersNativePlayback(device=globalThis.navigator){
 return usesSystemVolume(device)||/Android/i.test(device?.userAgent||'');
}

export function mixPlan({mode='off',seconds=5,duration=0,nextDuration=0,currentMix={},nextMix={}}={}){
 const end=mode==='auto'?Math.max(0,duration-clamp(duration-Number(currentMix.lastSound??duration)-.25,0,8)):duration;
 const incomingStart=mode==='auto'?clamp(Number(nextMix.firstSound||0)-.15,0,2):0;
 const fade=mode==='off'?0:Math.min(clamp(seconds,0,12),Math.max(0,end/4),Math.max(0,(nextDuration-incomingStart)/4));
 return {end,incomingStart,fade,trigger:Math.max(0,end-fade)};
}

export function fadeGains(progress){const p=clamp(progress,0,1);return {outgoing:Math.cos(p*Math.PI/2),incoming:Math.sin(p*Math.PI/2)};}

export class PlaybackMixer{
 constructor({decks,prepare,getNext,onAdopt=()=>{},onError=()=>{},onSupport=()=>{},onEnded=()=>{},contextFactory,nativeOnly=prefersNativePlayback()}={}){
  this.decks=decks;this.records=[null,null];this.index=0;this.prepare=prepare;this.getNext=getNext;
  this.onAdopt=onAdopt;this.onError=onError;this.onSupport=onSupport;
  this.nativeOnly=nativeOnly;
  this.contextFactory=contextFactory||(()=>{const Type=globalThis.AudioContext||globalThis.webkitAudioContext;return Type?new Type():null;});
  this.options={continuous:true,mode:'off',seconds:5,volume:1,muted:false};
  this.paused=true;this.context=null;this.gains=null;this.graphAttempted=false;this.fade=null;this.handoff=null;
  this.operation=0;this.prepareRevision=0;this.preparing=null;this.next=null;this.failedNext=null;this.primed=new Set();
  for(const deck of decks){
   deck.addEventListener('play',()=>{if(deck===this.active&&!deck.paused){this.paused=false;this.failedNext=null;void this.ensurePrepared();}});
   deck.addEventListener('pause',()=>{if(deck===this.active&&deck.paused&&!deck.ended&&!this.paused)this.pause();});
   deck.addEventListener('ended',()=>{if(deck!==this.active)return;onEnded(this.record);if(!this.paused&&this.options.continuous)void this.advance(false);else this.paused=true;});
   deck.addEventListener('timeupdate',()=>{if(deck===this.active)this.tick();});
  }
 }
 get active(){return this.decks[this.index];}
 get standby(){return this.decks[1-this.index];}
 get record(){return this.records[this.index];}
 _now(){return this.context?.currentTime??performance.now()/1000;}
 _gain(index,value){const param=this.gains?.[index]?.gain;if(param){param.cancelScheduledValues(0);param.setValueAtTime(value,this._now());}}
 _master(){for(const deck of this.decks){deck.muted=this.options.muted;if(!this.gains)deck.volume=this.options.volume;}if(this.master){this.master.gain.cancelScheduledValues(0);this.master.gain.setValueAtTime(this.options.muted?0:this.options.volume,this._now());}}
 _clear(index){const deck=this.decks[index];deck.pause();deck.removeAttribute('src');deck.load();this.records[index]?.release?.();this.records[index]=null;}
 _ids(){this.active.id='audio';this.standby.id='audio-next';}
 configure(changes={}){
  const old=this.options;
  this.options={...old,...changes,mode:['off','crossfade','auto'].includes(changes.mode??old.mode)?(changes.mode??old.mode):'off',seconds:clamp(changes.seconds??old.seconds,0,12),volume:clamp(changes.volume??old.volume,0,1)};
  if(old.mode!==this.options.mode||old.seconds!==this.options.seconds||old.continuous!==this.options.continuous)this.finishMix();
  this._master();
  if(!this.paused&&this.options.mode!=='off'&&!this.context)void this.unlock().catch(()=>{});
  if(!this.options.continuous){this.prepareRevision++;this.preparing=null;this.next=null;if(!this.fade)this._clear(1-this.index);}
  else if(!this.fade)void this.ensurePrepared();
 }
 async unlock(){
  // Media elements routed into Web Audio cannot be returned to native playback.
  // Keep the mobile element native for its entire lifetime, including background playback.
  if(this.nativeOnly){this.onSupport(false);return;}
  if(!this.graphAttempted&&this.options.mode!=='off'){
   this.graphAttempted=true;
   try{
    const context=this.contextFactory();
    if(context){
     this.context=context;this.master=context.createGain();
     this.gains=this.decks.map(deck=>{const source=context.createMediaElementSource(deck),gain=context.createGain();source.connect(gain);gain.connect(this.master);return gain;});
     const limiter=context.createDynamicsCompressor?.();
     if(limiter){limiter.threshold.value=-1;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.1;this.master.connect(limiter);limiter.connect(context.destination);}else this.master.connect(context.destination);
     this._gain(this.index,1);this._gain(1-this.index,0);this._master();this.onSupport(true);
    }else this.onSupport(false);
   }catch{this.onSupport(false);}
  }
  const resume=this.context&&['suspended','interrupted'].includes(this.context.state)?this.context.resume():Promise.resolve();
  if(this.gains&&!this.fade&&!this.primed.has(this.standby)){
   const deck=this.standby;this._gain(1-this.index,0);
   if(!deck.getAttribute('src')&&this.active.getAttribute('src')){deck.src=this.active.getAttribute('src');deck.load();}
   if(deck.getAttribute('src')){
    this.primed.add(deck);
    try{const src=deck.getAttribute('src');Promise.resolve(deck.play()).then(()=>{if(deck!==this.active&&!this.fade&&deck.getAttribute('src')===src)deck.pause();}).catch(()=>this.primed.delete(deck));}catch{this.primed.delete(deck);}
   }
  }
  await resume;
 }
 setTrack(record){
  this.operation++;this.prepareRevision++;this.paused=true;this.handoff=null;this.preparing=null;this.next=null;this.fade=null;this.failedNext=null;
  this._clear(0);this._clear(1);this.records[this.index]=record;
  if(record.url)this.active.src=record.url;this.active.preload='metadata';this.active.load();
  this._gain(this.index,1);this._gain(1-this.index,0);this._master();this._ids();
  this.onAdopt(record,{playing:false,automatic:false});if(this.options.continuous)void this.ensurePrepared();
 }
 async ensurePrepared(){
  if(!this.record||!this.options.continuous||this.fade)return null;
  const id=this.getNext(this.record.track.id);if(!id||id===this.record.track.id)return null;
  if(this.next?.track.id===id)return this.next;
  if(this.preparing?.id===id)return this.preparing.promise;
  const revision=++this.prepareRevision,currentId=this.record.track.id;
  this.next=null;this._clear(1-this.index);
  const promise=(async()=>{
   try{
    const record=await this.prepare(id);
    if(revision!==this.prepareRevision||this.record?.track.id!==currentId||this.fade||!this.options.continuous){record?.release?.();return null;}
    if(!record?.url){record?.release?.();return null;}
    this.records[1-this.index]=record;this.next=record;this.standby.src=record.url;this.standby.preload='auto';this.standby.load();this._gain(1-this.index,0);return record;
   }catch{return null;}finally{if(this.preparing?.revision===revision)this.preparing=null;}
  })();
  this.preparing={id,revision,promise};return promise;
 }
 refreshQueue(){this.operation++;this.prepareRevision++;this.preparing=null;this.next=null;this.failedNext=null;if(!this.fade){this._clear(1-this.index);if(this.options.continuous)void this.ensurePrepared();}}
 async play(){
  if(!this.record?.url)return;
  this.paused=false;this.failedNext=null;
  try{
   try{if(globalThis.navigator?.audioSession)globalThis.navigator.audioSession.type='playback';}catch{}
   await this.unlock();
   if(this.paused)return;
   if(this.active.ended)this.active.currentTime=0;
   const tasks=[this.active.play()];if(this.fade?.paused)tasks.push(this.decks[this.fade.from].play());await Promise.all(tasks);
   this.primed.add(this.active);
   if(this.fade?.paused){this.fade.paused=false;this._schedule(this.fade.elapsed);}
   void this.ensurePrepared();
  }catch(error){this.pause();throw error;}
 }
 pause(){
  this.paused=true;
  if(this.fade&&!this.fade.paused){const elapsed=this.fade.elapsed+this._now()-this.fade.started;this.fade.elapsed=Math.min(this.fade.duration,elapsed);this.fade.paused=true;const gain=fadeGains(this.fade.elapsed/this.fade.duration);this._gain(this.fade.from,gain.outgoing);this._gain(this.index,gain.incoming);}
  for(const deck of this.decks)deck.pause();
 }
 finishMix(){
  if(!this.fade)return;
  const from=this.fade.from;this.fade=null;this._gain(this.index,1);this._gain(from,0);this._clear(from);void this.ensurePrepared();
 }
 cancelForSeek(){this.operation++;this.handoff=null;this.finishMix();this.failedNext=null;}
 _plan(){return mixPlan({mode:this.gains?this.options.mode:'off',seconds:this.options.seconds,duration:Number.isFinite(this.active.duration)?this.active.duration:this.record?.track.duration||0,nextDuration:this.next?.track.duration||0,currentMix:this.record?.mixing,nextMix:this.next?.mixing});}
 _schedule(elapsed=0){
  if(!this.fade)return;const fade=this.fade,remaining=Math.max(.01,fade.duration-elapsed),count=128;
  for(const [index,kind]of [[fade.from,'outgoing'],[this.index,'incoming']]){
   const values=Float32Array.from({length:count},(_,i)=>fadeGains((elapsed+remaining*i/(count-1))/fade.duration)[kind]);
   this._gain(index,values[0]);this.gains[index].gain.setValueCurveAtTime(values,this._now(),remaining);
  }
  fade.started=this._now();fade.elapsed=elapsed;
 }
 tick(){
  if(this.fade){if(!this.fade.paused&&this.fade.elapsed+this._now()-this.fade.started>=this.fade.duration)this.finishMix();return;}
  if(this.paused||this.active.paused||!this.options.continuous||!this.gains||!this.next||this.handoff||this.failedNext===this.next.track.id||this.standby.readyState<3)return;
  const plan=this._plan();if(plan.fade>.1&&this.active.currentTime>=plan.trigger)void this.advance(true);
 }
 async advance(withFade=false){
  if(this.handoff||this.paused||!this.options.continuous)return;
  const operation=this.operation;
  const promise=(async()=>{
   // Use the prepared record synchronously at `ended`; background timers may be suspended.
   const record=this.next||await this.ensurePrepared();if(operation!==this.operation||this.paused||!this.options.continuous)return;
   if(!record){if(this.active.ended)this.paused=true;return;}
   if(!this.gains){
    // Reuse the element the user started. Starting a different element in the
    // background can require a new gesture on mobile browsers.
    const deck=this.active,old=this.record;
    this.records[1-this.index]=null;this.next=null;this._clear(1-this.index);
    this.records[this.index]=record;deck.src=record.url;deck.preload='auto';deck.load();
    old?.release?.();this._master();this.failedNext=null;
    this.onAdopt(record,{playing:true,automatic:true});
    try{await deck.play();if(operation===this.operation&&!this.paused)void this.ensurePrepared();}
    catch(error){if(operation===this.operation){this.pause();this.onAdopt(record,{playing:false,automatic:true});this.onError(error);}}
    return;
   }
   const from=this.index,to=1-from,outgoing=this.decks[from],incoming=this.decks[to],plan=this._plan();
   let duration=withFade&&this.gains?Math.min(plan.fade,Math.max(0,plan.end-outgoing.currentTime)):0;
   this._gain(to,duration>.1?0:1);try{incoming.currentTime=withFade?plan.incomingStart:0;}catch{}
   try{
    await incoming.play();
    if(operation!==this.operation||this.paused||!this.options.continuous){if(incoming!==this.active)incoming.pause();return;}
    duration=Math.min(duration,Math.max(0,plan.end-outgoing.currentTime));
    this.index=to;this.next=null;this.failedNext=null;this._ids();
    if(duration>.1){this.fade={from,duration,started:this._now(),elapsed:0,paused:false};this._schedule();}
    else{this._gain(to,1);this._clear(from);}
    this.onAdopt(record,{playing:true,automatic:true});if(!this.fade)void this.ensurePrepared();
   }catch(error){
    if(operation!==this.operation)return;this.failedNext=record.track.id;incoming.pause();
    if(outgoing.ended){this.index=to;this.next=null;this.paused=true;this._gain(to,1);this._clear(from);this._ids();this.onAdopt(record,{playing:false,automatic:true});}
    this.onError(error);
   }
  })();
  this.handoff=promise;try{await promise;}finally{if(this.handoff===promise)this.handoff=null;}
 }
}
