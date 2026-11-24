/* Back Room Music section tabs and album shortcuts.
   One scroll area: catalog songs. Switching panels never resets checkboxes. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const host=$('brCatalogRouting'),tabs=$('brMusicSections');
 if(!host||!tabs)return;
 const modes=['songs','playlists'];
 const select=$('brRouteAlbum'),nav=$('brRouteAlbumTabs');
 function showSection(next){
  if(!modes.includes(next))return;
  for(const mode of modes){
   const panel=host.querySelector('[data-br-music-section-panel="'+mode+'"]');
   const btn=tabs.querySelector('[data-br-music-section="'+mode+'"]');
   if(panel)panel.hidden=mode!==next;
   if(btn){btn.setAttribute('aria-selected',String(mode===next));btn.tabIndex=mode===next?0:-1}
  }
 }
 tabs.querySelectorAll('[data-br-music-section]').forEach(btn=>{
  btn.addEventListener('click',()=>showSection(btn.dataset.brMusicSection));
  btn.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();
   const selected=modes.indexOf(btn.dataset.brMusicSection);
   const next=event.key==='Home'?0:event.key==='End'?modes.length-1:
    (selected+(event.key==='ArrowRight'?1:-1)+modes.length)%modes.length;
   showSection(modes[next]);
   tabs.querySelector('[data-br-music-section="'+modes[next]+'"]')?.focus();
  });
 });
 function updateAlbumPressed(){
  const chosen=select.value;
  nav.querySelectorAll('button[data-br-album]').forEach(btn=>
   btn.setAttribute('aria-pressed',String(btn.dataset.brAlbum===chosen)));
 }
 function populateAlbums(){
  const albums=[...select.options].map(o=>({name:o.textContent,value:o.value}));
  if(albums.length<2){nav.replaceChildren();return}
  nav.replaceChildren();
  for(const {name,value} of albums){
   const btn=document.createElement('button');
   btn.type='button';btn.dataset.brAlbum=value;
   btn.textContent=value||'ALL ALBUMS';
   btn.setAttribute('aria-label',value?'Show '+name+' album tracks':'Show all album tracks');
   btn.setAttribute('aria-pressed',String(select.value===value));
   btn.addEventListener('click',()=>{
    showSection('songs');
    select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
    updateAlbumPressed();
    const matrix=$('brRouteMatrix');
    if(matrix)matrix.scrollTop=0;
   });
   nav.append(btn);
  }
 }
 select.addEventListener('change',updateAlbumPressed);
 window.GE_BACKROOM_MUSIC_CATALOG_READY=populateAlbums;
 showSection('songs');
 if(select.options.length>1)populateAlbums();
})();
