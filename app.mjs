import {readTrack,saveTrack,localAudioIds} from './storage.mjs';
import {normalize,cueAt,advanceHybrid,loadLyrics} from './lyrics.mjs';
import {buildTheme,dominantHue,pastelHues,rgbHue,hslToRgb,cssRgb,rgbHex} from './theme.mjs';

const root=document.getElementById('el-flow'),q=selector=>document.querySelector(selector),audio=q('#audio');
const paths={play:'<path d="m9 5 12 7-12 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',previous:'<path d="M5 5v14m14-14L8 12l11 7z"/>',next:'<path d="M19 5v14M5 5l11 7L5 19z"/>',library:'<path d="M4 4v16M9 4v16M14 5v15m3-17 4 16"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',frame:'<rect x="3" y="5" width="18" height="14" rx="2"/>',hand:'<path d="M8 13V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 5-3 8-7 8-3 0-4-2-6-4l-3-4a2 2 0 0 1 3-2l1 1"/>',left:'<path d="m15 5-7 7 7 7"/>',right:'<path d="m9 5 7 7-7 7"/>','close-panel':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m8-14-4 5 4 5"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>'};
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.play}</svg>`;}
document.querySelectorAll('[data-icon]').forEach(element=>element.innerHTML=icon(element.dataset.icon));
let preferences={};try{preferences=JSON.parse(localStorage.getItem('entre-lineas-preferences')||'{}');}catch{}
let catalog={tracks:[],albums:[],artists:[]},media={tracks:{}},localIds=new Set(),current,local={},objectUrl,artUrl;
let libraryItems=[],browse=0,albumFilter='',visibleLimit=80,generation=0,lyricsRequest,closeTimer,toastTimer;
let lyrics={kind:'loading',lines:[]},cursor=-1,lastAuto=-Infinity,lastTap=-Infinity,started=false,seeking=false,renderedText='',lastStatus='';
let view=preferences.view||'available',artist=preferences.artist||'all',layout=preferences.layout||'stack',frame=preferences.frame!==false,search='',playingReady=false,lyricMode=['mixed','manual','auto'].includes(preferences.lyricMode)?preferences.lyricMode:'mixed';
let albumHue=35;
const artistPlatforms={
 Nsqk:{apple:'https://music.apple.com/mx/artist/nsqk/1480741185',spotify:'https://open.spotify.com/artist/1jtvmXiemNFkPO11NMdjfu'},
 Morat:{apple:'https://music.apple.com/mx/artist/morat/955657302',spotify:'https://open.spotify.com/artist/5C4PDR4LnhZTbVnKWXuDKD'},
 'Rels B':{apple:'https://music.apple.com/mx/artist/rels-b/1132604153',spotify:'https://open.spotify.com/artist/2IMZYfNi21MGqxopj9fWx8'}
};
const offsets=preferences.offsets||{},settings=q('#settings-dialog'),drawer=q('#ef-library'),toggle=q('.ef-library-toggle'),scrim=q('.ef-scrim'),card=q('.ef-lyric'),seek=q('.ef-seek');
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const fmt=value=>{const seconds=Number.isFinite(value)?Math.max(0,value):0;return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;};
const configured=()=>media.tracks[current?.id]||{};
const hasAudio=track=>!!media.tracks[track.id]?.audio||localIds.has(track.id);
const duration=()=>Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:(current?.duration||0);
function notify(message){clearTimeout(toastTimer);q('#toast').textContent=message;q('#toast').hidden=false;toastTimer=setTimeout(()=>q('#toast').hidden=true,5000);}
function remember(){try{localStorage.setItem('entre-lineas-preferences',JSON.stringify({view,artist,layout,frame,offsets,lyricMode,appearance:q('#theme-mode').value,palette:q('#palette-mode').value,customColor:q('#custom-color').value,textSize:q('#text-size').value,blur:q('#background-blur').value,fit:q('#background-fit').value}));}catch{}}
function setStatus(message){if(lastStatus===message)return;lastStatus=message;q('#status').textContent=message;}
function renderPlay(){q('.ef-play').innerHTML=icon(audio.paused?'play':'pause');q('.ef-play').setAttribute('aria-label',audio.paused?'Reproducir':'Pausar');}
function applyPreferences(){root.dataset.textSize=q('#text-size').value;root.classList.toggle('frame-off',!frame);q('.ef-frame').setAttribute('aria-pressed',String(frame));q('.ef-frame').setAttribute('aria-label',frame?'Ocultar recuadro':'Mostrar recuadro');root.style.setProperty('--bg-blur',`${Number(q('#background-blur').value)}px`);root.style.setProperty('--bg-fit',q('#background-fit').value);}
function updateTheme(){const appearance=q('#theme-mode').value,palette=q('#palette-mode').value,custom=q('#custom-color').value;const customRgb=[1,3,5].map(index=>parseInt(custom.slice(index,index+2),16));const hue=palette==='album'?albumHue:palette==='custom'?rgbHue(customRgb):(pastelHues[palette]??108),theme=buildTheme(appearance,hue),element=document.documentElement;for(const name of ['panel','raised','control','ink','muted','accent','onAccent','focus'])element.style.setProperty(`--ui-${name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())}`,cssRgb(theme[name]));element.style.setProperty('--ui-panel-rgb',theme.panel.join(','));element.style.setProperty('--ui-glass-alpha',String(theme.glassAlpha));element.dataset.appearance=theme.appearance;element.style.colorScheme=theme.appearance;q('#custom-color-label').hidden=palette!=='custom';}
function setArtwork(track,record){
 const token=generation,url=record.cover instanceof Blob?URL.createObjectURL(record.cover):track.artwork;
 if(artUrl){URL.revokeObjectURL(artUrl);artUrl=null;}if(record.cover instanceof Blob)artUrl=url;
 const first=q('#back-one'),second=q('#back-two');let target=Number(first.style.opacity||1)>.5?second:first,previous=target===first?second:first;
 const image=new Image();image.onload=()=>{if(token!==generation)return;target.src=url;target.onload=()=>{if(token!==generation)return;target.style.opacity='1';previous.style.opacity='0';};if(target.complete){target.style.opacity='1';previous.style.opacity='0';}};image.onerror=()=>{if(token!==generation)return;first.style.opacity='0';second.style.opacity='0';};image.src=url;
 albumHue=({Nsqk:96,Morat:35,'Rels B':207})[track.artist]||35;updateTheme();
 const sample=new Image();sample.crossOrigin='anonymous';sample.onload=()=>{if(token!==generation)return;try{const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(sample,0,0,24,24);albumHue=dominantHue(context.getImageData(0,0,24,24).data);updateTheme();}catch{}};sample.src=url;
}
function renderIdentity(){
 if(!current)return;
 q('.ef-title').textContent=current.title;q('.ef-artist').textContent=current.artist;
 q('.album-name').textContent=current.album===current.title?'':current.album;
 q('#settings-song').textContent=`${current.title} · ${current.artist}`;
 q('#apple-center').href=current.appleUrl;
 const links=artistPlatforms[current.artist];
 for(const platform of ['apple','spotify']){const link=q(`#${platform}-link`);link.hidden=!links;if(links){link.href=links[platform];link.textContent=`${current.artist} en ${platform==='apple'?'Apple Music':'Spotify'} ↗`;}}
}

function showText(text){if(renderedText===text)return;renderedText=text;const element=q('.ef-current-line');element.textContent=text;element.classList.remove('ef-line-enter');requestAnimationFrame(()=>element.classList.add('ef-line-enter'));}
function tick(){
 if(!current)return;const time=audio.currentTime||0,max=duration(),now=performance.now(),offset=Number(offsets[current.id]||0);
 if(playingReady&&started&&lyrics.kind==='synced'&&!seeking){const cue=cueAt(lyrics.lines,time+offset);const next=advanceHybrid({cursor,cue,now,lastTap,total:lyrics.lines.length,mode:lyricMode});if(next!==cursor){if(next>cursor)lastAuto=now;cursor=next;}}
 if(!playingReady){showText('Agrega tu audio para escucharla aquí.');setStatus('La carátula y los datos ya están listos.');}
 else if(!started){showText('Toca para escuchar.');setStatus('Lista para reproducir.');}
 else if(lyrics.kind==='loading'){showText('Buscando la letra…');setStatus(audio.paused?'En pausa.':'La canción continúa mientras llega la letra.');}
 else if(lyrics.kind==='error'){showText('No se pudo cargar la letra.');setStatus('La música sigue disponible. Puedes agregar una letra en ajustes.');}
 else if(lyrics.kind==='none'){showText('Letra no disponible para esta versión.');setStatus(audio.paused?'En pausa.':'Puedes agregar una letra sincronizada en ajustes.');}
 else if(lyrics.kind==='instrumental'){showText('♪');setStatus(audio.paused?'En pausa.':'Instrumental');}
 else {const line=lyrics.lines[cursor];showText(line?.text||'♪');setStatus(audio.paused?'En pausa.':lyrics.kind==='plain'?'Letra sin tiempos · toca para pasar.':now-lastTap<2200?'A tu ritmo · puedes soltar cuando quieras.':'Siguiendo la canción · toca cuando quieras.');}
 q('.ef-interaction-hint').textContent=!playingReady?'Agrega el archivo desde ajustes.':!started?'Toca para comenzar.':lyrics.kind==='plain'||lyricMode==='manual'?'Tú pasas cada frase.':lyrics.kind==='synced'?(lyricMode==='auto'?'Sigue la canción.':'Vuelve solo tras 3 s sin tocar.'):'La música sigue su curso.';
 card.setAttribute('aria-label',!playingReady?'Agregar audio a esta canción':!started?'Reproducir canción':lyricMode==='auto'&&lyrics.kind==='synced'?'Letra en modo automático':'Mostrar siguiente frase');
 if(audio.ended&&playingReady)setStatus('Terminó la canción. Puedes volver a escucharla.');else if(playingReady&&!audio.paused&&audio.readyState<3)setStatus('Cargando audio…');
 if(!seeking){seek.max=String(max||1);seek.value=String(time);seek.style.setProperty('--ef-progress',`${max?Math.min(100,time/max*100):0}%`);}q('.ef-elapsed').textContent=fmt(time);q('.ef-duration').textContent=fmt(max);
}
function updateQueueButtons(){const queue=catalog.tracks.filter(hasAudio);q('.ef-back').disabled=queue.length<2;q('.ef-forward').disabled=queue.length<2;q('.ef-play').disabled=!playingReady;seek.disabled=!playingReady;}
async function play(){if(!playingReady){openSettings();return;}if(audio.ended){audio.currentTime=0;cursor=-1;}try{await audio.play();started=true;renderPlay();tick();}catch(error){if(error.name==='NotAllowedError')notify('Pulsa reproducir para comenzar.');else if(error.name!=='AbortError')notify('No se pudo reproducir este archivo. Prueba un MP3 o M4A sin protección.');}}
async function refreshLyrics(token=generation){
 lyricsRequest?.abort();lyricsRequest=new AbortController();lyrics={kind:'loading',lines:[]};cursor=-1;tick();
 try{const found=await loadLyrics({...current,duration:duration()},{local,configured:configured(),signal:lyricsRequest.signal});if(token!==generation)return;lyrics=found;cursor=found.kind==='synced'?cueAt(found.lines,(audio.currentTime||0)+Number(offsets[current.id]||0)):-1;tick();}
 catch(error){if(error.name==='AbortError'||token!==generation)return;lyrics={kind:'error',lines:[]};tick();}
}

async function selectTrack(id,{autoplay=false}={}){
 const track=catalog.tracks.find(item=>item.id===id);if(!track)return;const token=++generation;lyricsRequest?.abort();audio.pause();playingReady=false;started=false;cursor=-1;renderedText='';current=track;renderIdentity();
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}local={};
 try{local=await readTrack(id);}catch{}if(token!==generation)return;
 let url=configured().audio;if(local.audio instanceof Blob){objectUrl=URL.createObjectURL(local.audio);url=objectUrl;}
 setArtwork(track,local);q('#file-status').hidden=!local.audio;q('#file-status').textContent=local.audio?`Archivo local: ${local.fileName||'audio guardado'}`:'';
 audio.removeAttribute('src');if(url){audio.src=url;playingReady=true;}audio.load();q('#unavailable-actions').hidden=playingReady;updateQueueButtons();renderPlay();tick();
 if(playingReady){if(autoplay)void play();void refreshLyrics(token);}else{lyrics={kind:'none',lines:[]};}
 if(drawer.hidden===false)setOpen(false,card);if(libraryItems.length)renderLibrary();
 if('mediaSession'in navigator&&typeof MediaMetadata!=='undefined'){navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:track.album,artwork:[{src:new URL(track.artwork,location.href).href,sizes:'600x600',type:track.artwork.endsWith('.png')?'image/png':'image/jpeg'}]});}
}
function tap(){
 if(!playingReady){openSettings();return;}if(!started){void play();return;}const now=performance.now();tick();
 if(lyricMode==='auto'&&lyrics.kind==='synced')return;
 if(lyrics.lines.length){const cue=lyrics.kind==='synced'?cueAt(lyrics.lines,(audio.currentTime||0)+Number(offsets[current.id]||0)):-1;cursor=advanceHybrid({cursor,cue,tap:true,now,lastTap,total:lyrics.lines.length,mode:lyrics.kind==='plain'?'manual':lyricMode});}
 lastTap=now;root.classList.remove('ef-tapped');requestAnimationFrame(()=>root.classList.add('ef-tapped'));tick();
}
function nextTrack(delta){const queue=catalog.tracks.filter(hasAudio);if(!queue.length)return;const index=Math.max(0,queue.findIndex(track=>track.id===current?.id));void selectTrack(queue[(index+delta+queue.length)%queue.length].id,{autoplay:true});}
function rebuildLibrary(){
 const key=normalize(search),collection=view==='albums'?catalog.albums:catalog.tracks;
 libraryItems=collection.filter(item=>(artist==='all'||item.artist===artist)&&(!albumFilter||item.albumId===albumFilter)&&(view!=='available'||hasAudio(item))&&(!key||normalize(`${item.title} ${item.artist} ${item.album||''}`).includes(key)));
 if(view==='albums')libraryItems.sort((a,b)=>(b.releaseDate||'').localeCompare(a.releaseDate||''));
 else libraryItems.sort((a,b)=>Number(hasAudio(b))-Number(hasAudio(a))||a.title.localeCompare(b.title,'es'));
 browse=Math.max(0,libraryItems.findIndex(item=>item.id===current?.id));visibleLimit=80;renderLibrary();
}
function renderLibrary(){
 const sleeves=q('.ef-sleeves');sleeves.dataset.layout=layout;root.querySelectorAll('button[data-layout]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layout===layout)));
 q('#library-count').textContent=`${libraryItems.length} ${view==='albums'?(libraryItems.length===1?'lanzamiento':'álbumes y sencillos'):(libraryItems.length===1?'canción':'canciones')}`;q('#clear-album').hidden=!albumFilter;
 if(!libraryItems.length){sleeves.innerHTML='';q('.ef-preview-title').textContent='Sin resultados';q('.ef-preview-artist').textContent=view==='available'?'Agrega audio desde ajustes.':'Prueba otro artista o título.';q('.ef-song-names').innerHTML='<p class="empty-library">No hay canciones en esta selección.</p>';return;}
 browse=Math.min(Math.max(0,browse),libraryItems.length-1);const preview=libraryItems[browse],offsetsForCards=libraryItems.length===1?[0]:libraryItems.length===2?[1,0]:[-1,1,0];
 sleeves.innerHTML=offsetsForCards.map(offset=>{const item=libraryItems[(browse+offset+libraryItems.length)%libraryItems.length];return `<button type="button" class="ef-sleeve" data-pick="${esc(item.id)}" data-offset="${offset}" aria-label="Elegir ${esc(item.title)}, ${esc(item.artist)}"><img src="${esc(item.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`;}).join('');
 q('.ef-preview-title').textContent=preview.title;q('.ef-preview-artist').textContent=preview.artist;
 q('.ef-song-names').innerHTML=libraryItems.slice(0,visibleLimit).map(item=>`<button type="button" class="ef-name" data-pick="${esc(item.id)}" aria-current="${item.id===current?.id}">${esc(item.title)}</button>`).join('')+(libraryItems.length>visibleLimit?'<button type="button" class="ef-name" data-more="true">Mostrar más</button>':'');
}
function setOpen(open,focusTarget){clearTimeout(closeTimer);toggle.setAttribute('aria-expanded',String(open));if(open){rebuildLibrary();drawer.hidden=false;drawer.inert=false;drawer.classList.remove('is-closing');scrim.hidden=false;q('.ef-close').focus({preventScroll:true});}else{drawer.inert=true;scrim.hidden=true;drawer.classList.add('is-closing');closeTimer=setTimeout(()=>{drawer.hidden=true;drawer.classList.remove('is-closing');},280);(focusTarget||toggle).focus({preventScroll:true});}}
function openSettings(){renderIdentity();settings.showModal();}
toggle.addEventListener('click',()=>setOpen(true));q('.ef-close').addEventListener('click',()=>setOpen(false));scrim.addEventListener('click',()=>setOpen(false));
drawer.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.layout){layout=button.dataset.layout;renderLibrary();remember();}else if(button.dataset.more){visibleLimit+=80;renderLibrary();}else if(button.dataset.pick){if(view==='albums'){albumFilter=button.dataset.pick;view='songs';q('#catalog-view').value=view;search='';q('#catalog-search').value='';rebuildLibrary();}else void selectTrack(button.dataset.pick,{autoplay:true});}});
q('.ef-browse-back').addEventListener('click',()=>{if(libraryItems.length){browse=(browse-1+libraryItems.length)%libraryItems.length;renderLibrary();}});q('.ef-browse-next').addEventListener('click',()=>{if(libraryItems.length){browse=(browse+1)%libraryItems.length;renderLibrary();}});
q('#artist-filter').addEventListener('change',event=>{artist=event.target.value;albumFilter='';rebuildLibrary();remember();});q('#catalog-view').addEventListener('change',event=>{view=event.target.value;albumFilter='';rebuildLibrary();remember();});q('#catalog-search').addEventListener('input',event=>{search=event.target.value;rebuildLibrary();});q('#clear-album').addEventListener('click',()=>{albumFilter='';rebuildLibrary();});
card.addEventListener('click',tap);q('.ef-play').addEventListener('click',()=>audio.paused?void play():audio.pause());q('.ef-back').addEventListener('click',()=>nextTrack(-1));q('.ef-forward').addEventListener('click',()=>nextTrack(1));q('.ef-frame').addEventListener('click',()=>{frame=!frame;applyPreferences();remember();});
q('#lyric-mode').addEventListener('change',event=>{lyricMode=event.target.value;lastTap=-Infinity;if(lyricMode!=='manual'&&lyrics.kind==='synced')cursor=cueAt(lyrics.lines,(audio.currentTime||0)+Number(offsets[current?.id]||0));tick();remember();});
seek.addEventListener('input',()=>{if(!playingReady)return;seeking=true;audio.currentTime=Number(seek.value);cursor=lyrics.kind==='synced'?cueAt(lyrics.lines,audio.currentTime+Number(offsets[current.id]||0)):cursor;lastTap=-Infinity;tick();});seek.addEventListener('change',()=>{seeking=false;tick();});
audio.addEventListener('play',()=>{started=true;renderPlay();tick();});audio.addEventListener('pause',()=>{renderPlay();tick();});audio.addEventListener('ended',()=>{renderPlay();setStatus('Terminó la canción. Puedes volver a escucharla.');});audio.addEventListener('loadedmetadata',()=>{seek.max=String(duration());q('.ef-duration').textContent=fmt(duration());if(Math.abs(duration()-(current?.duration||duration()))>3)void refreshLyrics();tick();});audio.addEventListener('seeked',()=>{seeking=false;cursor=lyrics.kind==='synced'?cueAt(lyrics.lines,(audio.currentTime||0)+Number(offsets[current.id]||0)):cursor;lastTap=-Infinity;tick();});audio.addEventListener('error',()=>{if(playingReady)notify('No se pudo abrir el audio. Comprueba la conexión o vuelve a agregar el archivo.');});
q('#settings').addEventListener('click',openSettings);q('#attach-current').addEventListener('click',openSettings);q('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else notify('Puedes usar la pantalla del navegador en este dispositivo.');}catch{notify('La pantalla completa no está disponible en este navegador.');}});
q('#audio-file').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file||!current)return;if(file.size>100*1024*1024){notify('Usa un archivo menor de 100 MB para guardarlo en el navegador.');return;}const id=current.id;try{await saveTrack(id,{audio:file,fileName:file.name});localIds.add(id);q('#file-status').textContent='Archivo guardado en este dispositivo.';await selectTrack(id,{autoplay:false});rebuildLibrary();notify('Audio agregado. Pulsa reproducir para escucharlo.');}catch{notify('No se pudo guardar el archivo. Puede faltar espacio en este navegador.');}event.target.value='';});
q('#text-size').addEventListener('change',()=>{applyPreferences();remember();});
q('#background-blur').addEventListener('input',()=>{applyPreferences();remember();});q('#background-fit').addEventListener('change',()=>{applyPreferences();remember();});
q('#theme-mode').addEventListener('change',()=>{updateTheme();remember();});q('#palette-mode').addEventListener('change',()=>{updateTheme();remember();});q('#custom-color').addEventListener('change',event=>{const value=event.target.value,rgb=[1,3,5].map(index=>parseInt(value.slice(index,index+2),16));event.target.value=rgbHex(hslToRgb(rgbHue(rgb),.35,.80));updateTheme();remember();});
root.addEventListener('keydown',event=>{if(drawer.hidden)return;if(event.key==='Escape'){event.preventDefault();setOpen(false);}if(event.key==='Tab'){const controls=[...drawer.querySelectorAll('button,input,select')].filter(element=>!element.disabled&&!element.hidden);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
if('mediaSession'in navigator){for(const [action,handler]of Object.entries({play:()=>void play(),pause:()=>audio.pause(),seekto:event=>{if(Number.isFinite(event.seekTime))audio.currentTime=event.seekTime;}})){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}}
q('#artist-filter').value=artist;q('#catalog-view').value=view;q('#lyric-mode').value=lyricMode;q('#text-size').value=['small','medium','large'].includes(preferences.textSize)?preferences.textSize:'medium';q('#background-blur').value=String(preferences.blur??5);q('#background-fit').value=preferences.fit==='contain'?'contain':'cover';q('#theme-mode').value=preferences.appearance==='light'?'light':'dark';q('#palette-mode').value=['album','sage','sand','sky','lavender','rose','custom'].includes(preferences.palette)?preferences.palette:'album';q('#custom-color').value=/^#[0-9a-f]{6}$/i.test(preferences.customColor||'')?preferences.customColor:'#c6d7bf';applyPreferences();updateTheme();
try{const [catalogResponse,mediaResponse]=await Promise.all([fetch('./catalog.json',{cache:'no-store'}),fetch('./media.json',{cache:'no-store'})]);if(!catalogResponse.ok||!mediaResponse.ok)throw new Error('catalogue');[catalog,media]=await Promise.all([catalogResponse.json(),mediaResponse.json()]);try{localIds=new Set(await localAudioIds());}catch{}await selectTrack('monet');rebuildLibrary();}catch{showText('No se pudo cargar tu música.');setStatus('Revisa la conexión y vuelve a abrir la página.');notify('No pudimos cargar el catálogo.');}
setInterval(tick,150);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
