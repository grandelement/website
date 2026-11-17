/* Shared GE music destination resolver. No playlist copies or secondary store. */
(function(global){
 'use strict';
 const AUDIO=/^ge-music\/music\/.+\.(?:mp3|m4a|wav|ogg|flac)$/i;
 const TARGETS=['front','store','player','radio'];
 function albumOf(path){
  return (String(path).split('/')[2]||'').replace(/^Grand Element - (?:\d{4} - )?/,'').trim()||'Other';
 }
 function entries(registry){
  return Array.isArray(registry)?registry:Array.isArray(registry?.playlists)?registry.playlists:[];
 }
 function selection(id,registry,allPaths){
  if(!id)return null; // CUSTOM keeps existing manual settings.
  if(id==='@all'){
   if(!Array.isArray(allPaths))return null; // Use the verified published snapshot.
   return [...new Set(allPaths.filter(path=>typeof path==='string'&&AUDIO.test(path)&&!path.includes('..')))];
  }
  const playlist=entries(registry).find(p=>p.id===id);
  if(!playlist||!Array.isArray(playlist.songs))return null; // Never silently fall back to all.
  return [...new Set(playlist.songs.filter(path=>typeof path==='string'&&AUDIO.test(path)&&!path.includes('..')))];
 }
 function resolve(record,registry,allPaths){
  const routing={...(record||{})};
  const assignments=routing.assignments||{};
  const missing=[];
  for(const destination of TARGETS){
   const id=String(assignments[destination]||'');
   if(!id)continue;
   const paths=selection(id,registry,allPaths);
   if(paths===null){missing.push(destination);continue}
   // Preserve the existing public choice: Singles is hidden from playlist-driven
   // cover stacks unless the owner expressly chooses ALL or enables it in CUSTOM.
   if(destination==='front')routing.frontAlbums=[...new Set(paths.map(albumOf))]
    .filter(name=>name!=='Singles');
   if(destination==='store'){
    routing.storeAlbums=[...new Set(paths.map(albumOf))];
    routing.storeSongPaths=paths;
   }
   if(destination==='player')routing.playerSongPaths=paths;
   if(destination==='radio')routing.radioSongPaths=paths;
  }
  return {routing,missing};
 }
 global.GEMusicRouting=Object.freeze({albumOf,selection,resolve,entries});
})(window);
