import {PlaybackMixer,prefersNativePlayback} from './mixer.mjs?v=20261109-1';

// Separate native decks are never attached to AudioContext. They remain available
// when iOS/Android suspends Web Audio after the screen is locked.
export class MobilePlaybackMixer{
 constructor({decks,createDeck=()=>document.createElement('audio'),onAdopt=()=>{},onError=()=>{},onSupport=()=>{},...config}){
  this.mobile=true;this.nativeOnly=false;this.hidden=false;this.revision=0;this.transfer=null;this.handoffSeeks=new WeakSet();this.onAdopt=onAdopt;this.onError=onError;
  const graphDecks=[createDeck(),createDeck()];for(const deck of graphDecks){deck.preload='none';deck.setAttribute?.('playsinline','');if(globalThis.document)document.getElementById('el-flow')?.append(deck);}
  const callback=engine=>(record,state)=>{if(engine()!==this.engine)return;this._ids();this.onAdopt(record,state);if(this.engine===this.graph)this._backup();};
  this.native=new PlaybackMixer({...config,decks,nativeOnly:true,onAdopt:callback(()=>this.native),onError,onSupport:()=>{}});
  this.graph=new PlaybackMixer({...config,decks:graphDecks,nativeOnly:false,onAdopt:callback(()=>this.graph),onError,onSupport});
  this.engine=this.native;this.decks=[...decks,...graphDecks];this.options={...this.native.options};
  for(const deck of this.decks)deck.addEventListener('pause',()=>{if(deck===this.active&&deck.paused&&!deck.ended&&!this.switching&&!this.pausing)this.pause();});
 }
 get active(){return this.engine.active;}get record(){return this.engine.record;}get paused(){return this.engine.paused;}get fade(){return this.engine.fade;}get context(){return this.graph.context;}get handoff(){return this.transfer||this.engine.handoff;}
 _ids(){this.decks.forEach((deck,index)=>deck.id=deck===this.active?'audio':`audio-buffer-${index}`);}
 _settings(){this.native.configure({...this.options,mode:'off',continuous:this.engine===this.native&&this.options.continuous});this.graph.configure({...this.options,continuous:this.engine===this.graph&&this.options.continuous});}
 _backup(){if(!this.graph.record||this.native.record===this.graph.record)return;this.native.configure({...this.options,mode:'off',continuous:false});if(this.native.record?.track.id!==this.graph.record.track.id){this.native.setTrack(this.graph.record.retain());this._ids();}}
 configure(changes={}){
  if(changes.mode==='off'&&this.engine===this.native&&this.transfer)this.revision++;
  this.options={...this.options,...changes};this._settings();
  if(this.options.mode==='off'&&this.engine===this.graph)void this._move(this.native);
 }
 setTrack(record){this.revision++;this.transfer=null;this.graph.pause();this.native.pause();this.engine=this.native;this.graph.configure({continuous:false});this.graph.setTrack(nullRecord());this._settings();this.native.setTrack(record);this._ids();}
 async unlock(){if(!this.hidden&&this.options.mode!=='off'){this.graph.configure({...this.options,continuous:this.engine===this.graph&&this.options.continuous});await this.graph.unlock();}}
 async play(){
  const revision=this.revision,unlock=this.unlock();
  // Start the original native element in the same gesture before any hand-off.
  await this.engine.play();await unlock;if(revision!==this.revision||this.hidden||this.options.mode==='off'||this.paused)return;
  await this._move(this.graph);
 }
 pause(){this.revision++;this.transfer=null;this.pausing=true;this.native.pause();this.graph.pause();this.pausing=false;}
 finishMix(){this.engine.finishMix();}cancelForSeek(){this.revision++;this.transfer=null;this.engine.cancelForSeek();}
 consumeHandoffSeek(deck){if(!this.handoffSeeks.has(deck))return false;this.handoffSeeks.delete(deck);return true;}
 refreshQueue(){this.revision++;this.transfer=null;this.engine.refreshQueue();}
 ensurePrepared(){return this.engine.ensurePrepared();}tick(){this.engine.tick();}
 setVisibility(hidden){this.hidden=hidden;if(hidden&&this.engine===this.native)this.revision++;if(hidden&&this.engine===this.graph)void this._move(this.native);}
 activate(){if(!this.hidden&&!this.paused&&this.options.mode!=='off'){void this.unlock().then(()=>this._move(this.graph)).catch(()=>{});}}
 async _move(target){
  if(target===this.engine||this.transfer||!this.record?.url)return;
  const source=this.engine,record=source.record,revision=++this.revision,playing=!source.paused;
  const task=(async()=>{
   target.configure({...this.options,mode:target===this.native?'off':this.options.mode,continuous:false,muted:true});
   if(target.record?.track.id!==record.track.id)target.setTrack(record.retain());
   try{
    if(target===this.graph){let timer;try{await Promise.race([target.unlock(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('audio-context-timeout')),2000);})]);}finally{clearTimeout(timer);}if(!target.gains)throw new Error('audio-context-unavailable');}
    if(target.active.readyState<1)await new Promise((resolve,reject)=>{const deck=target.active,timer=setTimeout(()=>done(new Error('audio-load-timeout')),2500),done=error=>{clearTimeout(timer);deck.removeEventListener('loadedmetadata',ready);deck.removeEventListener('error',failed);error?reject(error):resolve();},ready=()=>done(),failed=()=>done(new Error('audio-load'));deck.addEventListener('loadedmetadata',ready,{once:true});deck.addEventListener('error',failed,{once:true});});
    if(revision!==this.revision||record!==source.record||(target===this.graph&&this.hidden))return;
    this.handoffSeeks.add(target.active);target.active.currentTime=source.active.currentTime;
    if(playing){target.paused=false;await target.active.play();}
    if(revision!==this.revision||record!==source.record){target.pause();return;}
    this.switching=true;source.pause();source.finishMix();this.engine=target;this._settings();this._ids();this.switching=false;
    this.onAdopt(target.record,{playing,automatic:false,handoff:true});if(target===this.graph)this._backup();
   }catch{target.pause();if(target===this.graph)this.onError(new Error('mix-unavailable'));}
   finally{if(target!==this.engine)target.configure({muted:this.options.muted,continuous:false});}
  })();
  this.transfer=task;try{await task;}finally{if(this.transfer===task)this.transfer=null;}
 }
}
function nullRecord(){return {track:{id:'__empty__'},url:null,local:{},release(){}};}
export function createPlaybackMixer(config){return prefersNativePlayback()?new MobilePlaybackMixer(config):new PlaybackMixer({...config,nativeOnly:false});}
