export const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseLrc(text){
 const offset=Number(String(text).match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000,lines=[];
 for(const raw of String(text).split(/\r?\n/)){const matches=[...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];if(!matches.length)continue;const words=raw.replace(/\[[^\]]*\]/g,'').trim();for(const match of matches){const seconds=Number(match[2]);if(seconds>=60)continue;const fraction=Number(`0.${match[3]||'0'}`);lines.push({time:Math.max(0,Math.round((Number(match[1])*60+seconds+fraction+offset)*1000)/1000),text:words});}}
 lines.sort((a,b)=>a.time-b.time);const merged=[];for(const line of lines){const previous=merged.at(-1);if(previous&&Math.abs(previous.time-line.time)<0.001){if(line.text&&!previous.text.includes(line.text))previous.text=[previous.text,line.text].filter(Boolean).join('\n');}else merged.push(line);}return merged;
}
export function cueAt(lines,time){let low=0,high=lines.length-1,result=-1;while(low<=high){const mid=(low+high)>>1;if(lines[mid].time<=time){result=mid;low=mid+1;}else high=mid-1;}return result;}
export function advanceHybrid({cursor,cue,tap=false,now=0,lastTap=-Infinity,total,manualHold=3000,mode='mixed'}){
 if(!total)return -1;
 const clamp=value=>Math.min(total-1,Math.max(-1,value));
 if(mode==='manual')return clamp(tap?cursor+1:cursor);
 if(mode==='auto')return clamp(cue);
 if(tap)return clamp(Math.max(cursor,cue)+1);
 return clamp(now-lastTap>=manualHold?cue:Math.max(cursor,cue));
}
const memory=new Map();
async function getJson(url,signal){const response=await fetch(url,{signal});if(!response.ok){const error=new Error(`lyrics-${response.status}`);error.status=response.status;throw error;}return response.json();}
function resultOf(record,approximate=false){const lines=parseLrc(record.syncedLyrics||'');if(lines.length)return {kind:'synced',lines,recordId:record.id,approximate};const plain=String(record.plainLyrics||'').split(/\r?\n/).map(text=>text.trim()).filter(text=>text&&!/^\[.*\]$/.test(text)).map(text=>({time:0,text}));if(record.instrumental)return {kind:'instrumental',lines:[],recordId:record.id};return {kind:plain.length?'plain':'none',lines:plain,recordId:record.id};}
export async function loadLyrics(track,{local={},configured={},signal}={}){
 if(local.lrc){const lines=parseLrc(local.lrc);return {kind:lines.length?'synced':'none',lines,local:true};}
 if(configured.lyrics){const response=await fetch(configured.lyrics,{signal});if(response.ok){const lines=parseLrc(await response.text());if(lines.length)return {kind:'synced',lines,local:true};}}
 const cacheKey=`${track.id}:${Math.round(track.duration||0)}`;if(memory.has(cacheKey))return memory.get(cacheKey);
 let result;
 if(configured.lyricsId){try{const record=await getJson(`https://lrclib.net/api/get/${configured.lyricsId}`,signal);if(normalize(record.artistName).includes(normalize(track.artist))&&Math.abs(Number(record.duration)-track.duration)<=3){result=resultOf(record,Math.abs(Number(record.duration)-track.duration)>2);}}catch(error){if(error.name==='AbortError')throw error;}}
 if(!result){const query=new URLSearchParams({track_name:track.title,artist_name:track.artist,duration:String(Math.max(1,Math.round(track.duration||1)))});if(track.album)query.set('album_name',track.album);try{result=resultOf(await getJson(`https://lrclib.net/api/get?${query}`,signal));}catch(error){if(error.name==='AbortError')throw error;if(error.status!==404&&error.status!==400)throw error;}}
 if(!result||result.kind==='none'){try{const query=new URLSearchParams({track_name:track.title,artist_name:track.artist});const records=await getJson(`https://lrclib.net/api/search?${query}`,signal);const candidates=records.filter(record=>normalize(record.trackName)===normalize(track.title)&&normalize(record.artistName).includes(normalize(track.artist)));const exact=candidates.find(record=>record.syncedLyrics&&Math.abs(record.duration-track.duration)<=2);const plain=candidates.find(record=>record.plainLyrics);if(exact)result=resultOf(exact);else if(plain)result=resultOf({...plain,syncedLyrics:null});}catch(error){if(error.name==='AbortError')throw error;}}
 result||={kind:'none',lines:[]};memory.set(cacheKey,result);return result;
}
