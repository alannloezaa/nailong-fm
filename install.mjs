export function installationHelp(navigator={}){
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(ios)return {platform:'ios',steps:['Abre Nailong FM en Safari.','Toca Compartir. Si no lo ves, abre el menú de la página y elige Compartir.','Elige «Añadir a pantalla de inicio»; puede estar en «Más». Activa «Abrir como app web» si aparece y toca Añadir.']};
 if(/Android/i.test(navigator.userAgent||''))return {platform:'android',steps:['Abre Nailong FM en Chrome.','Abre el menú de los tres puntos.','Elige «Añadir a pantalla de inicio» o «Instalar aplicación» y confirma.']};
 return {platform:'desktop',steps:['Abre el menú del navegador.','En Chrome o Edge, busca «Instalar Nailong FM» o «Crear acceso directo».','Confirma para abrir Nailong FM desde su propio icono.']};
}

export class InstallShortcut{
 constructor({window=globalThis.window,navigator=globalThis.navigator,onChange=()=>{}}={}){
  this.window=window;this.navigator=navigator;this.onChange=onChange;this.prompt=null;this.pending=false;this.help=false;this.accepted=false;
  this.display=window.matchMedia?.('(display-mode: standalone)');this.installed=!!navigator.standalone||!!this.display?.matches;
  this.before=event=>{event.preventDefault();this.prompt=event;this.accepted=false;this.render();};
  this.complete=()=>{this.installed=true;this.prompt=null;this.help=false;this.render();};
  this.changed=event=>{this.installed=event.matches||!!this.navigator.standalone;this.render();};
  window.addEventListener('beforeinstallprompt',this.before);window.addEventListener('appinstalled',this.complete);this.display?.addEventListener?.('change',this.changed);this.render();
 }
 get state(){return {...installationHelp(this.navigator),installed:this.installed,pending:this.pending,help:this.help&&!this.installed,label:this.installed?'Ya estás usando la app':this.pending?'Abriendo instalación…':this.prompt?'Instalar Nailong FM':'Agregar a pantalla de inicio',message:this.installed?'Abre Nailong FM cuando quieras desde este icono.':this.accepted?'Confirma la instalación en el navegador y después abre el nuevo icono.':'Un icono para entrar directo a tu música, sin buscar el enlace.'};}
 render(){this.onChange(this.state);}
 async request(){
  if(this.installed||this.pending)return;
  const prompt=this.prompt;if(!prompt){this.help=!this.help;this.render();return;}
  this.pending=true;this.render();
  try{await prompt.prompt();const choice=await prompt.userChoice;this.accepted=choice.outcome==='accepted';this.help=!this.accepted;}
  catch{this.help=true;}
  finally{if(this.prompt===prompt)this.prompt=null;this.pending=false;this.render();}
 }
 dispose(){this.window.removeEventListener('beforeinstallprompt',this.before);this.window.removeEventListener('appinstalled',this.complete);this.display?.removeEventListener?.('change',this.changed);}
}
