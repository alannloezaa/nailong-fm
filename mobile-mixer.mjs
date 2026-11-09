import {PlaybackMixer,prefersNativePlayback,completeMetadata} from './mixer.mjs?v=20261109-4';

function waitForMetadata(deck,record,{signal,timeout=8000,complete=false}={}){
 const ready=()=>complete?completeMetadata(deck,record):deck.readyState>=1;
 if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
 if(ready())return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const events=['loadedmetadata','durationchange','loadeddata','canplay','progress'],timer=setTimeout(()=>finish(new Error('audio-metadata-timeout')),timeout);
  function finish(error){clearTimeout(timer);for(const name of events)deck.removeEventListener(name,check);deck.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted);error?reject(error):resolve();}
  const check=()=>{if(ready())finish();},failed=()=>finish(new Error('audio-load')),aborted=()=>finish(new DOMException('Aborted','AbortError'));
  for(const name of events)deck.addEventListener(name,check);deck.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',aborted,{once:true});check();
 });
}

// Separate native decks are never attached to AudioContext. They remain available
// when iOS/Android suspends Web Audio after the screen is locked.
export class MobilePlaybackMixer{
 constructor({decks,createDeck=()=>document.createElement('audio'),onAdopt=()=>{},onError=()=>{},onSupport=()=>{},handoffTimeout=8000,...config}){
  this.mobile=true;this.nativeOnly=false;this.hidden=false;this.revision=0;this.transfer=null;this.moveController=null;this.moveTarget=null;this.handoffTimeout=handoffTimeout;this.handoffSeeks=new WeakSet();this.onAdopt=onAdopt;this.onError=onError;this.onSupport=onSupport;
  const graphDecks=[createDeck(),createDeck()];for(const deck of graphDecks){deck.preload='none';deck.setAttribute?.('playsinline','');if(globalThis.document)document.getElementById('el-flow')?.append(deck);}
  const callback=engine=>(record,state)=>{if(engine()!==this.engine)return;this._ids();this.onAdopt(record,state);if(this.engine===this.graph)this._backup();};
  this.native=new PlaybackMixer({...config,decks,nativeOnly:true,onAdopt:callback(()=>this.native),onError,onSupport:()=>{}});
  const prepareMixing=async id=>{const original=await config.prepare(id);if(!original?.forMixing)return original;try{return original.forMixing();}finally{original.release();}};
  this.graph=new PlaybackMixer({...config,prepare:prepareMixing,decks:graphDecks,nativeOnly:false,onAdopt:callback(()=>this.graph),onError,onSupport});
  this.engine=this.native;this.decks=[...decks,...graphDecks];this.options={...this.native.options};
  for(const deck of this.decks)deck.addEventListener('pause',()=>{if(deck===this.active&&deck.paused&&!deck.ended&&!this.switching&&!this.pausing)this.pause();});
 }
 get active(){return this.engine.active;}get record(){return this.engine.record;}get paused(){return this.engine.paused;}get fade(){return this.engine.fade;}get context(){return this.graph.context;}get handoff(){return this.transfer||this.engine.handoff;}
 _ids(){this.decks.forEach((deck,index)=>deck.id=deck===this.active?'audio':`audio-buffer-${index}`);}
 _wantsMix(){return this.options.continuous&&this.options.mode!=='off';}
 _settings(){this.native.configure({...this.options,mode:'off',muted:this.moveTarget===this.native&&this.engine!==this.native?true:this.options.muted,continuous:this.engine===this.native&&this.options.continuous});this.graph.configure({...this.options,muted:this.moveTarget===this.graph&&this.engine!==this.graph?true:this.options.muted,continuous:this.engine===this.graph&&this.options.continuous});}
 _invalidate(){this.revision++;this.moveController?.abort();}
 _backup(){
  if(!this.graph.record?.url)return;this.native.configure({...this.options,mode:'off',continuous:false});const backup=this.graph.record.forNative?.()||this.graph.record.retain();
  if(this.native.record?.track.id===backup.track.id&&this.native.record.url===backup.url){backup.release();return;}this.native.setTrack(backup);this._ids();
 }
 configure(changes={}){
  const old=this.options;this.options={...old,...changes};if(old.mode!==this.options.mode||old.continuous!==this.options.continuous)this._invalidate();this._settings();
  if(!this._wantsMix()&&this.engine===this.graph)void this._requestMove(this.native);
 }
 setTrack(record){this._invalidate();this.pausing=true;this.graph.pause();this.native.pause();this.pausing=false;this.engine=this.native;this.graph.configure({continuous:false});this.graph.setTrack(nullRecord());this._settings();this.native.setTrack(record);this._ids();}
 async unlock(){if(!this.hidden&&this._wantsMix()){this._settings();await this.graph.unlock();}}
 async play(){
  const revision=this.revision,unlock=this.unlock().catch(()=>{});
  // Start the original native element in the same gesture before any hand-off.
  await this.engine.play();await unlock;if(revision!==this.revision||this.hidden||!this._wantsMix()||this.paused)return;
  await this._requestMove(this.graph);
 }
 pause(){this._invalidate();this.pausing=true;this.native.pause();this.graph.pause();this.pausing=false;}
 finishMix(){this.engine.finishMix();}cancelForSeek(){this._invalidate();this.engine.cancelForSeek();}
 consumeHandoffSeek(deck){if(!this.handoffSeeks.has(deck))return false;this.handoffSeeks.delete(deck);return true;}
 refreshQueue(){this.engine.refreshQueue();}
 ensurePrepared(){return this.engine.ensurePrepared();}tick(){this.engine.tick();}
 setVisibility(hidden){this.hidden=hidden;this._invalidate();if(hidden)void this._requestMove(this.native);else this.activate();}
 activate(){if(!this.hidden&&!this.paused&&this._wantsMix())void this.unlock().then(()=>this._requestMove(this.graph)).catch(()=>{});}
 async _requestMove(target){if(this.transfer)await this.transfer.catch(()=>{});if(target===this.graph&&(this.hidden||this.paused||!this._wantsMix()))return;return this._move(target);}
 async _move(target){
  if(target===this.engine||this.transfer||!this.record?.url)return;
  const source=this.engine,record=source.record,revision=++this.revision,playing=!source.paused,controller=new AbortController();this.moveController=controller;this.moveTarget=target;
  let staged;
  const valid=()=>revision===this.revision&&record===source.record&&this.engine===source&&target.record===staged&&!controller.signal.aborted&&!(target===this.graph&&(this.hidden||!this._wantsMix()));
  const stopTarget=()=>{if(target!==this.engine&&target.record===staged)target.pause();};
  const task=(async()=>{
   try{
    target.configure({...this.options,mode:target===this.native?'off':this.options.mode,continuous:false,muted:true});
    const candidate=target===this.graph?(record.forMixing?.()||record.retain()):(record.forNative?.()||record.retain());
    if(target.record?.track.id===candidate.track.id&&target.record.url===candidate.url)candidate.release();else target.setTrack(candidate);staged=target.record;
    if(target===this.graph)target.active.preload='auto';
    if(target===this.graph){let timer;try{await Promise.race([target.unlock(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('audio-context-timeout')),2000);})]);}finally{clearTimeout(timer);}if(!target.gains)throw new Error('audio-context-unavailable');}
    await waitForMetadata(target.active,staged,{signal:controller.signal,timeout:this.handoffTimeout,complete:target===this.graph});
    if(!valid()){stopTarget();return;}
    this.handoffSeeks.add(target.active);target.active.currentTime=source.active.currentTime;
    if(playing){target.paused=false;await target.active.play();}
    if(!valid()){stopTarget();return;}
    this.switching=true;source.pause();source.finishMix();this.engine=target;this._settings();this._ids();this.switching=false;
    this.onAdopt(target.record,{playing,automatic:false,handoff:true});if(target===this.graph){this.onSupport(true);this._backup();}
   }catch(error){stopTarget();if(error.name!=='AbortError'&&valid()&&target===this.graph){this.onSupport(false);this.onError(new Error('mix-unavailable'));}}
   finally{if(this.moveController===controller){this.moveController=null;this.moveTarget=null;}if(target!==this.engine)target.configure({muted:this.options.muted,continuous:false});}
  })();
  this.transfer=task;try{await task;}finally{if(this.transfer===task)this.transfer=null;}
 }
}
function nullRecord(){return {track:{id:'__empty__'},url:null,local:{},release(){}};}
export function createPlaybackMixer(config){return prefersNativePlayback()?new MobilePlaybackMixer(config):new PlaybackMixer({...config,nativeOnly:false});}
