const OPT='nailong-fm:metrics-enabled',QUEUE='nailong-fm:metrics-queue';
export class ListeningStats{
 constructor(send){this.send=send;this.reset(null);}
 reset(track){this.track=track;this.seconds=0;this.last=null;this.played=false;this.milestones=new Set();}
 play(){if(!this.track)return;if(!this.played){this.played=true;this.send('song_play',this.info());}else this.send('song_resume',this.info());this.last=null;}
 pause(){if(this.played)this.send('song_pause',this.info());this.last=null;}
 info(){return this.track?{song:this.track.title,artist:this.track.artist,track_id:this.track.id}:{};}
 sample(time,wall,playing){
  if(!playing){this.last=null;return;}if(this.last){const dt=time-this.last.time,dw=(wall-this.last.wall)/1000;if(dt>0&&dw>0&&dt<=6&&Math.abs(dt-dw)<1.5)this.seconds+=Math.min(dt,dw);}
  this.last={time,wall};for(const threshold of [30,60,120])if(this.seconds>=threshold&&!this.milestones.has(threshold)){this.milestones.add(threshold);this.send('song_listen', {...this.info(),seconds:threshold});}
 }
}
export class Metrics{
 constructor({storage=globalThis.localStorage,device=globalThis.navigator,host=globalThis.location?.hostname,clock=()=>Date.now()}={}){
  this.storage=storage;this.device=device;this.host=host;this.clock=clock;this.ready=false;this.flushing=false;this.queue=[];this.enabled=this.read(OPT)!=='false'&&device?.doNotTrack!=='1'&&device?.globalPrivacyControl!==true;
  try{this.queue=JSON.parse(this.read(QUEUE)||'[]').filter(e=>e.at>clock()-86400000).slice(-100);}catch{}
  this.listening=new ListeningStats((name,data)=>this.event(name,data));
 }
 read(key){try{return this.storage?.getItem(key);}catch{return null;}}
 write(key,value){try{this.storage?.setItem(key,value);}catch{}}
 allowed(){return this.enabled&&this.host==='alannloezaa.github.io';}
 setEnabled(enabled){this.enabled=!!enabled&&this.device?.doNotTrack!=='1'&&this.device?.globalPrivacyControl!==true;this.write(OPT,String(this.enabled));if(!this.enabled){this.queue=[];this.write(QUEUE,'[]');}else void this.start();return this.enabled;}
 event(name,data={}){if(!this.allowed()||!this.config?.websiteId)return;const safe=Object.fromEntries(Object.entries(data).filter(([key])=>['song','artist','track_id','seconds','mode','count','result','action'].includes(key)));this.queue.push({name,data:safe,at:this.clock()});this.queue=this.queue.filter(e=>e.at>this.clock()-86400000).slice(-100);this.write(QUEUE,JSON.stringify(this.queue));void this.flush();}
 async start(){
  if(!this.allowed())return;
  if(!this.config){try{const response=await fetch('./analytics-config.json');this.config=await response.json();}catch{return;}}
  if(!/^[a-f0-9-]{36}$/.test(this.config.websiteId||''))return;
  if(this.ready){void this.flush();return;}
  if(this.starting)return this.starting;
  this.starting=new Promise(resolve=>{const script=document.createElement('script');script.defer=true;script.src=this.config.script;script.dataset.websiteId=this.config.websiteId;script.dataset.autoTrack='false';script.dataset.doNotTrack='true';script.onload=()=>{this.ready=true;this.starting=null;if(this.allowed()){this.event('site_open');void this.flush();}resolve();};script.onerror=()=>{this.starting=null;script.remove();resolve();};document.head.append(script);});return this.starting;
 }
 async flush(){
  if(!this.ready||!this.allowed()||this.device?.onLine===false||this.flushing||!globalThis.umami?.track)return;this.flushing=true;
  try{while(this.queue.length&&this.allowed()){const event=this.queue[0];await globalThis.umami.track(props=>({...props,url:'/nailong-fm/',title:'Nailong FM',referrer:'',name:event.name==='site_open'?undefined:event.name,data:event.data,timestamp:Math.floor(event.at/1000)}));if(this.queue[0]===event)this.queue.shift();this.write(QUEUE,JSON.stringify(this.queue));}}
  catch{}finally{this.flushing=false;}
 }
}
