export class ShuffleOrder{
 constructor(random=Math.random){this.random=random;this.order=[];this.scope='';this.playable=new Set();}
 _mixed(ids,artistOf,previous){
  const remaining=[...ids],result=[];let last=previous;
  while(remaining.length){let choices=remaining.filter(id=>artistOf(id)!==last);if(!choices.length)choices=remaining;const counts=new Map();for(const id of remaining)counts.set(artistOf(id),(counts.get(artistOf(id))||0)+1);const largest=Math.max(...choices.map(id=>counts.get(artistOf(id))));choices=choices.filter(id=>counts.get(artistOf(id))===largest);const id=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];result.push(id);remaining.splice(remaining.indexOf(id),1);last=artistOf(id);}
  return result;
 }
 sync(ids,currentId,{scope='catalog',artistOf=id=>id}={}){
  const unique=[...new Set(ids)];this.playable=new Set(unique);
  if(scope!==this.scope||!this.order.length){this.scope=scope;this.start(currentId,unique,artistOf);return;}
  // Keep a removed current track as an anchor until playback has left it.
  this.order=this.order.filter(id=>this.playable.has(id)||id===currentId);
  const added=unique.filter(id=>!this.order.includes(id));this.order.push(...this._mixed(added,artistOf,artistOf(this.order.at(-1))));
 }
 start(currentId,ids=[...this.playable],artistOf=id=>id){const unique=[...new Set(ids)];this.playable=new Set(unique);this.order=[...(unique.includes(currentId)?[currentId]:[]),...this._mixed(unique.filter(id=>id!==currentId),artistOf,artistOf(currentId))];}
 neighbor(currentId,delta,{loop=false}={}){
  const step=delta>0?1:-1,index=this.order.indexOf(currentId);if(index<0)return step>0?(this.order.find(id=>this.playable.has(id))??null):null;
  for(let offset=1;offset<=this.order.length;offset++){let next=index+offset*step;if(loop)next=(next%this.order.length+this.order.length)%this.order.length;else if(next<0||next>=this.order.length)return null;const id=this.order[next];if(id!==currentId&&this.playable.has(id))return id;}
  return null;
 }
}
