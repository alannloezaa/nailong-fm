export class SongList {
 constructor(ids=[]){this.ids=Array.isArray(ids)?[...new Set(ids.filter(id=>typeof id==='string'&&id.length))]:[];this.anchor=0;}
 retain(valid){this.ids=this.ids.filter(id=>valid.has(id));this.anchor=Math.min(this.anchor,this.ids.length);}
 add(id){if(this.ids.includes(id))return false;this.ids.push(id);return true;}
 remove(id,currentId){const index=this.ids.indexOf(id);if(index<0)return false;const current=this.ids.indexOf(currentId);if(id===currentId)this.anchor=index;else if(current<0&&index<this.anchor)this.anchor--;this.ids.splice(index,1);return true;}
 move(id,delta,currentId){const index=this.ids.indexOf(id),target=index+Math.sign(delta);if(index<0||target<0||target>=this.ids.length)return false;const next=this.ids[this.anchor],missing=!this.ids.includes(currentId);[this.ids[index],this.ids[target]]=[this.ids[target],this.ids[index]];if(missing)this.anchor=next?this.ids.indexOf(next):this.ids.length;return true;}
 place(id,beforeId,currentId){if(!this.ids.includes(id)||id===beforeId)return false;const next=this.ids[this.anchor],missing=!this.ids.includes(currentId),previous=this.ids.join('\0'),items=this.ids.filter(value=>value!==id),target=beforeId==null?items.length:items.indexOf(beforeId);if(target<0)return false;items.splice(target,0,id);this.ids=items;if(missing)this.anchor=next?this.ids.indexOf(next):this.ids.length;return previous!==this.ids.join('\0');}
 neighbor(currentId,delta,playable=new Set(this.ids)){const ids=this.ids.filter(id=>playable.has(id)),index=ids.indexOf(currentId),boundary=this.ids.slice(0,this.anchor).filter(id=>playable.has(id)).length;return ids[index>=0?index+Math.sign(delta):boundary+(delta>0?0:-1)]??null;}
}
