// mini_player.js — minimal player wired to the Sun’s mini UI
(function(){
  const box=document.getElementById('miniPlayer'); if(!box){ GE_ENV.mark('mini_player.js','no UI'); return; }
  const btnPrev=box.querySelector('#prev'), btnPlay=box.querySelector('#play'), btnNext=box.querySelector('#next');
  const title=box.querySelector('#title'), seek=box.querySelector('#seek'), vol=box.querySelector('#vol'), audio=box.querySelector('#audio');

  // Fallback single track (replace with your GitHub radio URLs if you want)
  const FALLBACK='https://cdn.pixabay.com/download/audio/2022/03/15/audio_2b7f5cd9d0.mp3?filename=calm-music-110624.mp3';
  const playlist=[{album:'Trio',track:'01',url:FALLBACK}]; let i=0; title.textContent=`${playlist[0].album} · ${playlist[0].track}`;

  btnPlay.onclick=()=>{ if(!audio.src) audio.src=playlist[i].url; if(audio.paused){ audio.play().catch(()=>{}); btnPlay.textContent='⏸'; } else { audio.pause(); btnPlay.textContent='▶'; } };
  btnNext.onclick=()=>{ i=(i+1)%playlist.length; audio.src=playlist[i].url; title.textContent=`${playlist[i].album} · ${playlist[i].track}`; audio.play().catch(()=>{}); btnPlay.textContent='⏸'; };
  btnPrev.onclick=()=>{ i=(i-1+playlist.length)%playlist.length; audio.src=playlist[i].url; title.textContent=`${playlist[i].album} · ${playlist[i].track}`; audio.play().catch(()=>{}); btnPlay.textContent='⏸'; };
  audio.addEventListener('timeupdate',()=>{ if(isFinite(audio.duration)) seek.value=(audio.currentTime/audio.duration*100)|0; });
  seek.oninput=()=>{ if(isFinite(audio.duration)) audio.currentTime = (seek.value/100)*audio.duration; };
  vol.oninput=()=> audio.volume=+vol.value;

  GE_ENV.mark('mini_player.js','player ready');
})();
