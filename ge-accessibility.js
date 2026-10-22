/* GRAND ELEMENT · shared access layer.
   One language preference for website + Radio; only country code is read from
   an optional same-origin edge hint (no raw IP, GPS, or tracking stored).
   Essential player controls retain native button behavior and screen-reader names. */
(function(){
'use strict';
const A=document;
const radio=!!A.getElementById('musicGroup');
const localeKey='GE_LANGUAGE_V1';
const declinedKey='GE_LANGUAGE_ENGLISH_CHOICE_V1';
const zoomKey='GE_ACCESS_ZOOM_V1';
const names={en:'English',es:'Español',fr:'Français',de:'Deutsch',nl:'Nederlands',pt:'Português'};
const strings={
en:{previous:'PREV',play:'PLAY',pause:'PAUSE',next:'NEXT',shuffle:'SHUFFLE',radio:'RADIO',songs:'SONGS',music:'MUSIC',love:'LOVE',bgPrev:'PREV',bgOff:'OFF',bgNext:'NEXT',perSong:'PER SONG',bgShuffle:'SHUFFLE',contact:'CONTACT',support:'SUPPORT',share:'SHARE',code:'CODE',about:'ABOUT',openRadio:'RADIO',playAlbum:'PLAY ALBUM',stop:'STOP',language:'Language',choose:'Choose your language',intro:'English is the default. You can change your language at any time.',recommend:'Your browser or country may prefer another language. Would you like to use it?',save:'USE LANGUAGE',keep:'KEEP ENGLISH',close:'CLOSE',game:'GAME',albumInfo:'album. Open album information',backgrounds:'Backgrounds',selected:'Language saved',option:'LANGUAGE',musicOptions:'MUSIC OPTIONS',zoom:'Allow pinch-to-zoom outside games'},
es:{previous:'ANTERIOR',play:'REPRODUCIR',pause:'PAUSA',next:'SIGUIENTE',shuffle:'ALEATORIO',radio:'RADIO',songs:'CANCIONES',music:'MÚSICA',love:'ME GUSTA',bgPrev:'ANT.',bgOff:'APAGAR',bgNext:'SIG.',perSong:'POR CANCIÓN',bgShuffle:'ALEATORIO',contact:'CONTACTO',support:'APOYAR',share:'COMPARTIR',code:'CÓDIGO',about:'ACERCA DE',openRadio:'RADIO',playAlbum:'ESCUCHAR ÁLBUM',stop:'PARAR',language:'Idioma',choose:'Elige tu idioma',intro:'El inglés es el idioma predeterminado. Puedes cambiarlo cuando quieras.',recommend:'Tu navegador o país sugiere otro idioma. ¿Quieres usarlo?',save:'USAR IDIOMA',keep:'SEGUIR EN INGLÉS',close:'CERRAR',game:'JUEGO',albumInfo:'álbum. Abrir información',backgrounds:'Fondos',selected:'Idioma guardado',option:'IDIOMA',musicOptions:'OPCIONES DE MÚSICA',zoom:'Permitir zoom con dos dedos fuera de los juegos'},
fr:{previous:'PRÉC.',play:'LECTURE',pause:'PAUSE',next:'SUIV.',shuffle:'ALÉATOIRE',radio:'RADIO',songs:'TITRES',music:'MUSIQUE',love:'J’AIME',bgPrev:'PRÉC.',bgOff:'ARRÊT',bgNext:'SUIV.',perSong:'PAR TITRE',bgShuffle:'ALÉATOIRE',contact:'CONTACT',support:'SOUTENIR',share:'PARTAGER',code:'CODE',about:'À PROPOS',openRadio:'RADIO',playAlbum:'ÉCOUTER L’ALBUM',stop:'ARRÊT',language:'Langue',choose:'Choisissez votre langue',intro:'L’anglais est la langue par défaut. Vous pouvez changer de langue à tout moment.',recommend:'Votre navigateur ou pays suggère une autre langue. Voulez-vous l’utiliser ?',save:'UTILISER',keep:'GARDER L’ANGLAIS',close:'FERMER',game:'JEU',albumInfo:'album. Ouvrir les détails',backgrounds:'Arrière-plans',selected:'Langue enregistrée',option:'LANGUE',musicOptions:'OPTIONS MUSIQUE',zoom:'Autoriser le zoom hors des jeux'},
de:{previous:'ZURÜCK',play:'SPIELEN',pause:'PAUSE',next:'WEITER',shuffle:'ZUFALL',radio:'RADIO',songs:'SONGS',music:'MUSIK',love:'LIEBEN',bgPrev:'ZURÜCK',bgOff:'AUS',bgNext:'WEITER',perSong:'PRO SONG',bgShuffle:'ZUFALL',contact:'KONTAKT',support:'UNTERSTÜTZEN',share:'TEILEN',code:'CODE',about:'ÜBER UNS',openRadio:'RADIO',playAlbum:'ALBUM SPIELEN',stop:'STOPP',language:'Sprache',choose:'Sprache auswählen',intro:'Englisch ist voreingestellt. Du kannst die Sprache jederzeit ändern.',recommend:'Dein Browser oder Land schlägt eine andere Sprache vor. Möchtest du sie nutzen?',save:'SPRACHE NUTZEN',keep:'ENGLISCH BEHALTEN',close:'SCHLIESSEN',game:'SPIEL',albumInfo:'Album. Albuminformationen öffnen',backgrounds:'Hintergründe',selected:'Sprache gespeichert',option:'SPRACHE',musicOptions:'MUSIKOPTIONEN',zoom:'Vergrößern mit zwei Fingern außerhalb der Spiele'},
nl:{previous:'VORIGE',play:'AFSPELEN',pause:'PAUZE',next:'VOLGENDE',shuffle:'WILLEKEURIG',radio:'RADIO',songs:'NUMMERS',music:'MUZIEK',love:'LEUK',bgPrev:'VORIGE',bgOff:'UIT',bgNext:'VOLGENDE',perSong:'PER NUMMER',bgShuffle:'WILLEKEURIG',contact:'CONTACT',support:'STEUN',share:'DELEN',code:'CODE',about:'OVER',openRadio:'RADIO',playAlbum:'ALBUM AFSPELEN',stop:'STOP',language:'Taal',choose:'Kies je taal',intro:'Engels is standaard. Je kunt je taal altijd wijzigen.',recommend:'Je browser of land suggereert een andere taal. Wil je die gebruiken?',save:'TAAL GEBRUIKEN',keep:'ENGELS HOUDEN',close:'SLUITEN',game:'SPEL',albumInfo:'album. Albuminformatie openen',backgrounds:'Achtergronden',selected:'Taal opgeslagen',option:'TAAL',musicOptions:'MUZIEKOPTIES',zoom:'Zoomen met twee vingers buiten spellen toestaan'},
pt:{previous:'ANTERIOR',play:'TOCAR',pause:'PAUSA',next:'PRÓXIMA',shuffle:'ALEATÓRIO',radio:'RÁDIO',songs:'FAIXAS',music:'MÚSICA',love:'CURTIR',bgPrev:'ANT.',bgOff:'DESLIGAR',bgNext:'PRÓX.',perSong:'POR FAIXA',bgShuffle:'ALEATÓRIO',contact:'CONTATO',support:'APOIAR',share:'COMPARTILHAR',code:'CÓDIGO',about:'SOBRE',openRadio:'RÁDIO',playAlbum:'TOCAR ÁLBUM',stop:'PARAR',language:'Idioma',choose:'Escolha seu idioma',intro:'O inglês é o idioma padrão. Você pode mudar quando quiser.',recommend:'Seu navegador ou país sugere outro idioma. Deseja usá-lo?',save:'USAR IDIOMA',keep:'MANTER INGLÊS',close:'FECHAR',game:'JOGO',albumInfo:'álbum. Abrir informações',backgrounds:'Fundos',selected:'Idioma salvo',option:'IDIOMA',musicOptions:'OPÇÕES DE MÚSICA',zoom:'Permitir ampliar com dois dedos fora dos jogos'}
};
let lang='en', lastFocus=null, dialog=null, combo=null, globe=null, live=null, dialogText=null;
let zoomEnabled=false;
function code(input){const val=String(input||'').toLowerCase().split(/[-_]/)[0];return strings[val]?val:'';}
function text(key){return (strings[lang]&&strings[lang][key])||strings.en[key]||key;}
function find(selector){return A.querySelector(selector);}
const controls=[
['#prevBtn','previous','⏮'],['#playBtn','play','▶'],['#nextBtn','next','⏭'],
['#shuffleBtn','shuffle','🔀'],['#liveBtn','radio','📻'],['#chooseSongsBtn','songs','♫'],
['#musicMenuBtn','music','🎵'],['#loveBtn','love','♥'],
['#bgPrev','bgPrev','◀'],['#bgOff','bgOff','⊘'],['#bgNext','bgNext','▶'],
['#bgPer','perSong','↻'],['#bgShuf','bgShuffle','🔀'],
['#contactLaunchBtn','contact','✉'],['#shareBtn','share','↗'],
['#accessLaunchBtn','code','⌘'],['#bottomActions .bc-btn','support','♥'],
['#shipBottomActions [data-proxy="contactLaunchBtn"]','contact','✉'],
['#shipBottomActions [data-proxy="shareBtn"]','share','↗'],
['#shipBottomActions [data-proxy="accessLaunchBtn"]','code','⌘'],
['#shipBottomActions > a','support','♥'],
['#shipRightControls [data-proxy="nextBtn"]','next','⏭'],
['#shipRightControls [data-proxy="prevBtn"]','previous','⏮'],
['#shipRightControls [data-proxy="shuffleBtn"]','shuffle','🔀'],
['#shipRightControls [data-proxy="liveBtn"]','radio','📻'],
['#shipLeftControls [data-proxy="bgOff"]','bgOff','⊘'],
['#shipLeftControls [data-proxy="bgNext"]','bgNext','▶'],
['#shipLeftControls [data-proxy="bgPrev"]','bgPrev','◀']
];
const homeButtons=[
['#play','play','▶'],['#geHomeStop','stop','■'],['#albumScanListen','playAlbum'],
['#aboutBtn','about'],['#btnMusic','music'],['#musicOptionsBtn','musicOptions']
];
function setLabel(el,key,symbol){
 if(!el)return;
 const word=text(key);
 el.dataset.geCaption=word;
 if(symbol){el.dataset.geSymbol=symbol;el.dataset.geA11yIcon='1';}
 // Explicit spoken name remains independent from decorative icon glyphs.
 el.setAttribute('aria-label',word);
 el.setAttribute('title',word);
 el.setAttribute('lang',lang);
}
function currentPlayState(){
 const audio=find('#player');
 return audio&&(!audio.paused||!!audio.currentSrc&&!audio.ended&&!audio.paused);
}
function renderRadioControls(){
 for(const [selector,key,symbol] of controls){
   const el=find(selector);if(el)setLabel(el,key,symbol);
 }
 const play=find('#playBtn');
 if(play)setLabel(play,currentPlayState()?'pause':'play',currentPlayState()?'⏸':'▶');
 const header=find('#bgGroup .section-label');if(header){header.textContent=text('backgrounds');header.setAttribute('lang',lang);}
 // Avoid hiding the announcement channel: it is read by VoiceOver / TalkBack.
 const now=find('#titleBtn');if(now)now.setAttribute('aria-live','polite');
}
function renderHomeControls(){
 for(const [selector,key,symbol] of homeButtons){
  const el=find(selector);
  if(!el)continue;
  setLabel(el,key,symbol);
  if(selector==='#aboutBtn'||selector==='#btnMusic')el.textContent=text(key);
  if(el.tagName==='DIV'){el.setAttribute('tabindex','0');el.setAttribute('role','button');}
  // Only static headings/buttons are translated. Dynamic RADIO status remains untouched.
  if(selector==='#albumScanListen')el.textContent=text('playAlbum');
 }
 const moon=find('#moon');
 if(moon){moon.setAttribute('tabindex','0');moon.setAttribute('role','link');moon.setAttribute('aria-label',text('openRadio'));}
 const opt=find('#geLanguagePreference');
 if(opt){opt.value=lang;}
 const optLabel=find('#geLanguageOptionLabel');
 if(optLabel){optLabel.textContent=text('option');optLabel.setAttribute('lang',lang);}
 labelPlanets();
}
function labelPlanets(){
 const all=A.querySelectorAll('#planets .planet');
 for(const el of all){
   const album=String(el.dataset.album||el.title||'Grand Element');
   const game=A.body.classList.contains('game-mode-active');
   if(game){el.removeAttribute('href');el.setAttribute('role','img');el.removeAttribute('tabindex');el.setAttribute('aria-label',album);}
   else{
     el.setAttribute('role','button');el.setAttribute('tabindex','0');
     el.setAttribute('aria-label',album+' '+text('albumInfo'));
   }
 }
}
function redraw(){
 if(radio)renderRadioControls();else renderHomeControls();
 if(globe)globe.setAttribute('aria-label',text('language'));
 if(dialog){
  find('#geLangTitle').textContent=text('choose');
  find('#geLangIntro').textContent=text('intro');
  find('#geLangRecommendation').textContent=text('recommend');
  find('#geLangLabel').textContent=text('language');
  find('#geLangSave').textContent=text('save');
  find('#geLangKeep').textContent=text('keep');
  find('#geLangClose').setAttribute('aria-label',text('close'));
  const zoomText=find('#geLangZoomLabel');if(zoomText)zoomText.textContent=text('zoom');
 }
}
function applyZoom(on,persist){
 zoomEnabled=!!on;
 window.GE_A11Y_ZOOM=zoomEnabled;
 A.documentElement.classList.toggle('ge-access-zoom',zoomEnabled);
 const setting=find('#geLangZoomCheck');if(setting)setting.checked=zoomEnabled;
 if(persist)try{localStorage.setItem(zoomKey,zoomEnabled?'1':'0')}catch(_e){}
}
function applyLanguage(value,persist){
 const next=code(value)||'en';
 lang=next;
 if(persist){
  try{localStorage.setItem(localeKey,next);localStorage.setItem(declinedKey,'1');}catch(_e){}
 }
 // Most authored content (album biographies, policies and games) remains English.
 // Mark localized controls individually so screen readers pronounce them correctly.
 redraw();
 if(live&&persist)live.textContent=text('selected')+': '+names[lang];
}
function keyboardActivation(el){
 if(!el)return;
 el.addEventListener('keydown',function(e){
   if(e.key!=='Enter'&&e.key!==' ')return;
   e.preventDefault();
   el.click();
 });
}
function setupRadioKeyboard(){
 const picker=find('#trackList');
 if(!picker)return;
 let returnTo=null;
 new MutationObserver(()=>{
  const isOpen=picker.classList.contains('open');
  if(isOpen){
   if(!returnTo)returnTo=A.activeElement;
   // A native button is easier for VoiceOver than the title alone.
   requestAnimationFrame(()=>picker.querySelector('button')?.focus({preventScroll:true}));
  }else if(returnTo){
   if(returnTo.isConnected)returnTo.focus({preventScroll:true});
   returnTo=null;
  }
 }).observe(picker,{attributes:true,attributeFilter:['class']});
 picker.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||!picker.classList.contains('open'))return;
  const options=[...picker.querySelectorAll('button:not([disabled]),input:not([disabled])')]
   .filter(x=>x.getClientRects().length);
  if(!options.length)return;
  const first=options[0],last=options[options.length-1];
  if(e.shiftKey&&A.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&A.activeElement===last){e.preventDefault();first.focus();}
 });
}
function setupKeyboard(){
 if(radio){setupRadioKeyboard();return;}
 for(const selector of ['#aboutBtn','#btnMusic','#moon'])keyboardActivation(find(selector));
 const planets=find('#planets');
 if(planets){
  labelPlanets();
  planets.addEventListener('keydown',function(e){
   const planet=e.target.closest('.planet');
   if(!planet||A.body.classList.contains('game-mode-active'))return;
   if(e.key==='Enter'||e.key===' '){e.preventDefault();planet.click();}
  });
  new MutationObserver(labelPlanets).observe(planets,{childList:true});
  new MutationObserver(labelPlanets).observe(A.body,{attributes:true,attributeFilter:['class']});
 }
 const scan=find('#albumScan');
 if(scan){
  new MutationObserver(function(){
   if(scan.classList.contains('show')){
    const anchor=A.activeElement;
    if(anchor?.classList?.contains('planet'))lastFocus=anchor;
    requestAnimationFrame(()=>find('#albumScanListen')?.focus({preventScroll:true}));
   }else if(lastFocus&&lastFocus.isConnected){
    lastFocus.focus({preventScroll:true});lastFocus=null;
   }
  }).observe(scan,{attributes:true,attributeFilter:['class']});
  scan.addEventListener('keydown',function(e){
   if(e.key!=='Tab'||!scan.classList.contains('show'))return;
   const controls=[...scan.querySelectorAll('button,a[href]')].filter(el=>el.getClientRects().length);
   if(!controls.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&A.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&A.activeElement===last){e.preventDefault();first.focus();}
  });
 }
}
function createUI(){
 const skip=A.createElement('a');
 skip.href=radio?'#musicGroup':'./radio/';
 skip.className='ge-a11y-skip';
 skip.textContent=radio?'Skip to music controls':'Listen to Grand Element Radio';
 A.body.prepend(skip);
 const target=find(radio?'#musicGroup':'#sunWrap');if(target)target.setAttribute('tabindex','-1');
 globe=A.createElement('button');
 globe.type='button';globe.className='ge-language-trigger';
 globe.textContent='🌐';globe.setAttribute('aria-haspopup','dialog');
 globe.setAttribute('aria-expanded','false');
 globe.setAttribute('aria-label','Language');
 A.body.append(globe);
 live=A.createElement('div');live.className='ge-a11y-live';
 live.setAttribute('role','status');live.setAttribute('aria-live','polite');
 A.body.append(live);
 dialog=A.createElement('div');
 dialog.className='ge-language-dialog';dialog.hidden=true;
 dialog.innerHTML='<div class="ge-language-panel" role="dialog" aria-modal="true" aria-labelledby="geLangTitle" aria-describedby="geLangIntro">'+
 '<h2 id="geLangTitle">Choose your language</h2>'+
 '<p id="geLangIntro">English is the default.</p>'+
 '<p id="geLangRecommendation" hidden></p>'+
 '<label for="geLangSelect" id="geLangLabel">Language</label>'+
 '<select id="geLangSelect"></select>'+
 '<div class="ge-language-actions"><button type="button" id="geLangKeep">KEEP ENGLISH</button>'+
 '<button type="button" class="ge-language-save" id="geLangSave">USE LANGUAGE</button>'+
 '<button type="button" id="geLangClose" aria-label="Close">×</button></div></div>';
 A.body.append(dialog);
 // Browser zoom is opt-in on the physics-based universe; Radio permits
 // standard browser zoom regardless of this setting.
 const panel=dialog.querySelector('.ge-language-panel');
 const zoomRow=A.createElement('label');
 zoomRow.className='ge-language-zoom';
 zoomRow.innerHTML='<input id="geLangZoomCheck" type="checkbox"><span id="geLangZoomLabel"></span>';
 zoomRow.hidden=radio;
 panel.insertBefore(zoomRow,panel.querySelector('.ge-language-actions'));
 find('#geLangZoomCheck').addEventListener('change',e=>applyZoom(e.target.checked,true));
 combo=find('#geLangSelect');
 for(const [id,name] of Object.entries(names)){
  const opt=A.createElement('option');opt.value=id;opt.textContent=name;opt.lang=id;combo.append(opt);
 }
 const close=()=>{
  dialog.hidden=true;globe.setAttribute('aria-expanded','false');A.body.classList.remove('ge-language-open');
  try{localStorage.setItem(declinedKey,'1')}catch(_e){}
  (lastFocus||globe).focus({preventScroll:true});lastFocus=null;
 };
 const open=(recommendation)=>{
  lastFocus=A.activeElement;
  combo.value=code(recommendation)||lang;
  const note=find('#geLangRecommendation');
  note.hidden=!recommendation;
  dialog.hidden=false;A.body.classList.add('ge-language-open');
  globe.setAttribute('aria-expanded','true');
  redraw();
  combo.focus();
 };
 globe.addEventListener('click',()=>dialog.hidden?open():close());
 find('#geLangClose').addEventListener('click',close);
 find('#geLangSave').addEventListener('click',()=>{applyLanguage(combo.value,true);close()});
 find('#geLangKeep').addEventListener('click',()=>{applyLanguage('en',true);close()});
 dialog.addEventListener('mousedown',e=>{if(e.target===dialog)close()});
 dialog.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const focusable=[combo,...(radio?[]:[find('#geLangZoomCheck')]),find('#geLangKeep'),find('#geLangSave'),find('#geLangClose')];
  const idx=focusable.indexOf(A.activeElement);
  if(e.shiftKey&&idx<=0){e.preventDefault();focusable[focusable.length-1].focus();}
  else if(!e.shiftKey&&idx===focusable.length-1){e.preventDefault();focusable[0].focus();}
 });
 const settingsSelect=find('#geLanguagePreference');
 if(settingsSelect){
  for(const [id,name] of Object.entries(names)){
   const option=A.createElement('option');option.value=id;option.textContent=name;option.lang=id;settingsSelect.append(option);
  }
  settingsSelect.addEventListener('change',()=>applyLanguage(settingsSelect.value,true));
 }
 window.GE_LANGUAGE={get:()=>lang,set:value=>applyLanguage(value,true),open:()=>open()};
 return open;
}
async function suggestedLanguage(){
 const browser=Array.isArray(navigator.languages)&&navigator.languages.length?navigator.languages:[navigator.language];
 const preferred=code(browser[0]);
 // Optional same-origin Cloudflare hint. A 404 or other host simply uses the
 // browser preferences. Never retain or print the IP value returned by trace.
 let country='';
 try{
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),1400);
  try{
   const r=await fetch(new URL('/cdn-cgi/trace',location.origin).href,{cache:'no-store',signal:ctrl.signal});
   if(r.ok && /text\/plain/i.test(r.headers.get('content-type')||'')){
    const value=(await r.text()).match(/^loc=([A-Z]{2})$/m);
    if(value)country=value[1];
   }
  }finally{clearTimeout(timeout);}
 }catch(_e){}
 const countries={NL:'nl',DE:'de',AT:'de',FR:'fr',ES:'es',MX:'es',AR:'es',CO:'es',CL:'es',PE:'es',BR:'pt',PT:'pt'};
 // Browser setting takes precedence over region; a country alone does not
 // imply the visitor's language, so always ask before switching.
 const regional=countries[country]||'';
 return (preferred&&preferred!=='en'?preferred:regional)||'';
}
function fitViewport(){
 if(!radio)return;
 const root=A.documentElement,body=A.body,wrap=find('main.wrap');
 const shouldFit=body.classList.contains('view-player')&&!body.classList.contains('iam-studio-open');
 if(!shouldFit||!wrap){
  root.classList.remove('ge-access-overflow');
  root.style.removeProperty('--ge-fit-sun');root.style.removeProperty('--ge-fit-iam');return;
 }
 const h=Math.round(window.visualViewport?.height||innerHeight);
 const w=Math.round(window.visualViewport?.width||innerWidth);
 const portrait=window.matchMedia('(orientation: portrait)').matches;
 const sunBase=Math.min(portrait?178:182,Math.max(100,Math.round(h*(portrait?.19:.20))));
 let sun=sunBase,iam=Math.min(100,Math.max(54,Math.round(h*.105)));
 root.classList.remove('ge-access-overflow');
 for(let attempt=0;attempt<9;attempt++){
   root.style.setProperty('--ge-fit-sun',sun+'px');
   root.style.setProperty('--ge-fit-iam',iam+'px');
   const overflow=wrap.scrollHeight-wrap.clientHeight;
   if(overflow<4)break;
   if(iam>52)iam=Math.max(52,iam-Math.min(15,overflow));
   else if(sun>96)sun=Math.max(96,sun-Math.min(15,overflow));
   else break;
 }
 root.style.setProperty('--ge-fit-sun',sun+'px');
 root.style.setProperty('--ge-fit-iam',iam+'px');
 const zoomed=window.visualViewport?.scale>1.15;
 const tooSmall=h<545||w<310;
 // If content still exceeds the screen, scrolling is safer than a clipped
 // CODE button or invisible focus target, especially with accessibility zoom.
 root.classList.toggle('ge-access-overflow',!!(zoomed||tooSmall||wrap.scrollHeight>wrap.clientHeight+5));
}
function start(){
 A.documentElement.classList.add(radio?'ge-radio-ui':'ge-site-ui');
 try{zoomEnabled=localStorage.getItem(zoomKey)==='1'}catch(_e){}
 const open=createUI();
 applyZoom(zoomEnabled,false);
 try{const saved=code(localStorage.getItem(localeKey));if(saved)lang=saved;}catch(_e){}
 applyLanguage(lang,false);
 setupKeyboard();
 if(radio){
  const player=find('#player');
  if(player)for(const type of ['play','playing','pause','ended','emptied'])player.addEventListener(type,()=>requestAnimationFrame(renderRadioControls));
  let pending=0;
  const fit=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(fitViewport)};
  for(const e of ['resize','orientationchange','pageshow'])addEventListener(e,fit,{passive:true});
  window.visualViewport?.addEventListener('resize',fit,{passive:true});
  if(window.ResizeObserver){
    const target=find('#musicGroup');
    if(target)new ResizeObserver(fit).observe(target);
  }
  fit();setTimeout(fit,300);setTimeout(fit,1600);
 }
 let prior=false;try{prior=!!localStorage.getItem(localeKey)||!!localStorage.getItem(declinedKey);}catch(_e){}
 if(!prior)void suggestedLanguage().then(preferred=>{
  // Don't interrupt the visitor's interaction or a currently open dialog.
  if(preferred && preferred!=='en' && dialog?.hidden && !A.hidden){
   try{if(localStorage.getItem(localeKey)||localStorage.getItem(declinedKey))return;}catch(_e){}
   open(preferred);
  }
 });
}
if(A.readyState==='loading')A.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
