/* Album pages read the current public catalog. Playback and access rights remain with Radio. */
(()=>{'use strict';
const album=document.body.dataset.album;
const list=document.getElementById('albumTracks');
const status=document.getElementById('shareStatus');
const canonical=document.querySelector('link[rel="canonical"]')?.href||location.href;
const playPath=file=>'/radio/?album='+encodeURIComponent(album)+'&kind=album&song='+encodeURIComponent(file);
function title(path){
 const file=decodeURIComponent(String(path).split('/').pop()||'').replace(/\.[a-z0-9]+$/i,'');
 return file.replace(/^[^_]+_\d+(?:_|-)/,'').replace(/_/g,' ').trim()||'Music';
}
async function updateSongs(){
 const response=await fetch('/radio/manifest.json',{cache:'no-store'});
 if(!response.ok)throw Error('Catalog unavailable');
 const data=await response.json();
 if(!Array.isArray(data.files))throw Error('Invalid music catalog');
 const songs=data.files.filter(path=>{
  const folder=String(path).split('/')[2]||'';
  return folder.replace(/^Grand Element - \d{4} - /,'').toLowerCase()===album.toLowerCase();
 });
 if(!songs.length)throw Error('Album not in catalog');
 const fragment=document.createDocumentFragment();
 for(const path of songs){
  const li=document.createElement('li'),a=document.createElement('a');
  a.textContent=title(path);
  a.href=playPath(String(path).split('/').pop());
  li.appendChild(a);fragment.appendChild(li);
 }
 list.replaceChildren(fragment);
}
updateSongs().catch(()=>{}); // Existing static song links remain available offline.
document.getElementById('shareAlbum')?.addEventListener('click',async()=>{
 try{
  if(navigator.share){await navigator.share({title:'Grand Element — '+album,url:canonical});status.textContent='Album shared.';return}
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(canonical);status.textContent='Album link copied.';return}
  window.prompt('Copy album link:',canonical);
 }catch(error){if(error?.name!=='AbortError')window.prompt('Copy album link:',canonical)}
});
})();