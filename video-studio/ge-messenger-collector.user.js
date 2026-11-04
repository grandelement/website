// ==UserScript==
// @name         GE Studios | Messenger Video Collector
// @namespace    https://grandelement.com/video-studio
// @version      0.1.0
// @description  Collect visible Messenger video links, metadata and preview thumbnails. Export catalog and download directly accessible media with private metadata sidecars.
// @match        https://business.facebook.com/*
// @match        https://www.facebook.com/messages/*
// @match        https://www.facebook.com/latest/*
// @match        https://www.messenger.com/*
// @match        https://messenger.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_download
// @grant        GM_addStyle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // No automated logins, private APIs, hidden network calls, CAPTCHA bypass or third-party uploads.
  // Scans only rendered/open Messenger page content. Other chat threads need opening or a Meta export.
  if (!/business\.facebook\.com|\/messages\/|messenger\.com/.test(location.host + location.pathname)) return;

  const STORE = 'ge_studios_video_collector_v1';
  let clips = readStore();
  let loading = false;
  let statusEl, countEl, resultsEl, searchEl, maxEl;
  let search = '';
  const VIDEO_EXT = /\.(mp4|mov|m4v|webm|gif|m3u8)(?:[?#]|$)/i;

  function clean(s, max=1400) {
    return String(s || '').replace(/\s+/g,' ').trim().slice(0, max);
  }
  function norm(raw) {
    try {
      const u = new URL(raw, location.href);
      if (!/^https?:$/.test(u.protocol)) return '';
      u.hash = '';
      ['fbclid','igshid','gclid','si','utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k => u.searchParams.delete(k));
      return u.toString();
    } catch { return ''; }
  }
  function platform(u) {
    try { return new URL(u).hostname.replace(/^www\./,'').toLowerCase(); } catch { return ''; }
  }
  function isVideo(u) {
    const h = platform(u), path = (()=>{try{return new URL(u).pathname.toLowerCase()}catch{return ''}})();
    if (VIDEO_EXT.test(u)) return true;
    if (h === 'youtu.be') return true;
    if (h.endsWith('youtube.com')) return /\/(watch|shorts|live|embed)\b/.test(path);
    if (h.endsWith('instagram.com')) return /\/(reel|reels|p|tv)\//.test(path);
    if (h.endsWith('tiktok.com')) return /\/video\/|\/t\//.test(path);
    if (h.endsWith('facebook.com') || h === 'fb.watch') return h === 'fb.watch' || /\/(videos|reel|watch)\b|video\.php/.test(path);
    if (h.endsWith('vimeo.com') || h.endsWith('streamable.com') || h.endsWith('dailymotion.com')) return path.length > 2;
    if (h === 'x.com' || h === 'twitter.com') return /\/status\//.test(path);
    if (h.endsWith('rumble.com')) return /^\/v/.test(path);
    if (h.includes('fbcdn.net')) return /video|\.mp4|\.m4v/.test(u);
    return false;
  }
  function idFor(u) {
    let h = 2166136261;
    for (let i=0;i<u.length;i++) { h ^= u.charCodeAt(i); h = Math.imul(h,16777619); }
    return 'GEV-' + (h>>>0).toString(16).padStart(8,'0');
  }
  function readStore() {
    try { const a = JSON.parse(GM_getValue(STORE, '[]')); return Array.isArray(a) ? a : []; } catch { return []; }
  }
  function persist() {
    try { GM_setValue(STORE, JSON.stringify(clips)); }
    catch (e) { setStatus('Storage full: export your catalog now. ' + String(e).slice(0,70)); }
  }
  function setStatus(text) { if (statusEl) statusEl.textContent = text; }
  function timestamp(el) {
    if (!el) return null;
    const t = el.querySelector('time[datetime], abbr[data-utime], [data-utime]');
    if (t) {
      const v = t.getAttribute('datetime') || t.getAttribute('data-utime');
      const d = /^\d+$/.test(v || '') ? new Date(Number(v)*1000) : new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
    }
    return null; // Never use today's date as an invented post/publication date.
  }
  function findMessage(el) {
    let cur = el;
    for (let i=0;cur && i<7;i++,cur=cur.parentElement) {
      if (cur.matches && cur.matches('[role="row"], [role="listitem"], li, [data-testid*="message"], [data-scope*="message"]')) return cur;
      if ((cur.innerText || '').length > 65 && (cur.innerText || '').length < 900) return cur;
    }
    return el.parentElement || el;
  }
  function getMeta(el) {
    const box = findMessage(el), text = clean(box?.innerText || '', 2200);
    const img = box?.querySelector('img[src]');
    const v = box?.querySelector('video');
    const poster = v?.getAttribute('poster') || img?.currentSrc || img?.src || null;
    const heading = box?.querySelector('h1,h2,h3,h4,strong,[role="heading"]');
    const title = clean(el.getAttribute?.('title') || el.getAttribute?.('aria-label') ||
      heading?.innerText || el.innerText || '', 180);
    const duration = v && Number.isFinite(v.duration) ? Math.round(v.duration*100)/100 : null;
    return {title:title || null, source_text:text || null, thumbnail:poster,
      shared_at:timestamp(box), duration_seconds:duration, message_href:location.href};
  }
  function creatorFromLink(u) {
    try {
      const p = new URL(u), m = p.pathname.match(/\/(@[A-Za-z0-9._-]+)\/video\/|\/([A-Za-z0-9_]+)\/status\//);
      return m?.[1] || (m?.[2] ? '@'+m[2] : null);
    } catch { return null; }
  }
  function add(url, meta={}, origin='rendered_message') {
    const u = norm(url);
    if (!u || !isVideo(u)) return false;
    let x = clips.find(c => c.source_url === u);
    if (!x) {
      const creator = creatorFromLink(u);
      x = {
        id:idFor(u), source_url:u, platform:platform(u),
        original_title:meta.title || null, creator_handle:creator,
        creator_display_name:null, creator_profile:null, copyright_owner:null,
        post_date:null, messenger_shared_at:meta.shared_at || null,
        added_at:new Date().toISOString(), description:meta.source_text || '',
        comments_visible:null, creator_credit:creator || null, duration_seconds:meta.duration_seconds ?? null,
        thumbnail_url:meta.thumbnail || null, direct_media_url:null, local_media_filename:null,
        right_to_use:{status:'confirmed_by_GE_Studios_via_Messenger',
          scope:'attribution-required; verify any other agreed limitations', proof_private_ref:null},
        shared_from_page:meta.message_href || location.href, origins:[origin],
        selected:false, notes:''
      };
      clips.push(x);
      return true;
    }
    x.origins ||= [];
    if (!x.origins.includes(origin)) x.origins.push(origin);
    if (!x.original_title && meta.title) x.original_title=meta.title;
    if (!x.thumbnail_url && meta.thumbnail) x.thumbnail_url=meta.thumbnail;
    if (!x.description && meta.source_text) x.description=meta.source_text;
    if (!x.messenger_shared_at && meta.shared_at) x.messenger_shared_at=meta.shared_at;
    if (x.duration_seconds == null && meta.duration_seconds != null) x.duration_seconds=meta.duration_seconds;
    return false;
  }
  function scanOpen() {
    let added=0;
    // We deliberately avoid invisible scripts, API payloads, authentication tokens and unrelated account data.
    const scopes = [...document.querySelectorAll('main,[role="main"]')];
    const root = scopes.sort((a,b)=>(b.querySelectorAll('a[href]').length)-(a.querySelectorAll('a[href]').length))[0] || document.body;
    const anchors = [...root.querySelectorAll('a[href]')];
    for (const a of anchors) {
      if (a.closest('#ge-video-panel')) continue;
      const u = norm(a.href);
      if (!isVideo(u)) continue;
      if (add(u,getMeta(a))) added++;
      const vid=findMessage(a).querySelector('video');
      const src = vid?.currentSrc || vid?.src;
      if (src && /^https?:/.test(src) && isVideo(src)) {
        const rec=clips.find(c=>c.source_url===u);
        if (rec && !rec.direct_media_url) rec.direct_media_url=src;
      }
    }
    // Direct video files visible in the open conversation are also candidates.
    for (const v of root.querySelectorAll('video')) {
      const u=v.currentSrc || v.getAttribute('src') || v.querySelector('source[src]')?.src;
      if (u && /^https?:/.test(u) && isVideo(u)) {
        if (add(u,getMeta(v),'visible_video_player')) added++;
        const rec=clips.find(c=>c.source_url===norm(u));
        if (rec) rec.direct_media_url=u;
      }
    }
    persist();render();
    setStatus('Found ' + added + ' new links. Catalog total: ' + clips.length + '. Current rendered conversation only.');
  }
  async function loadOlder() {
    if (loading) { loading=false; setStatus('Stopping after current scroll.'); return; }
    loading=true;
    const max = Math.min(100,Math.max(1,Number(maxEl.value)||20));
    const roots=[...document.querySelectorAll('main,[role="main"],[role="log"],[role="feed"],[role="grid"]')];
    const candidates=[];
    for (const root of [...roots,document.body]) {
      const elems=[root,...root.querySelectorAll('*')];
      for (const el of elems) {
        if (!el || el.closest?.('#ge-video-panel')) continue;
        if (el.scrollHeight > el.clientHeight+200 && el.clientHeight>140 && el.clientHeight < innerHeight*1.6) {
          const st=getComputedStyle(el), scrollable=/(auto|scroll)/.test(st.overflowY);
          if (scrollable) candidates.push(el);
        }
      }
      if (candidates.length) break;
    }
    candidates.sort((a,b)=>(b.clientHeight*b.clientWidth)-(a.clientHeight*a.clientWidth));
    const area=candidates[0];
    if (!area) { setStatus('No scrollable conversation detected. Open a thread and use Scan.');loading=false;return; }
    let stagnant=0, seen=clips.length;
    for (let i=0;i<max && loading;i++) {
      area.scrollTop=0;
      area.dispatchEvent(new Event('scroll',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,1100));
      scanOpen();
      if (clips.length===seen) stagnant++; else {stagnant=0;seen=clips.length;}
      setStatus('Loading older messages: '+(i+1)+'/'+max+' | links '+clips.length);
      if(stagnant>=6) break;
    }
    loading=false;
    setStatus('Scroll scan complete. '+clips.length+' unique links saved. Other conversations must be opened separately.');
  }
  function slug(s) {
    return clean(s,140).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').replace(/^\.+|\.+$/g,'').slice(0,85) || 'Untitled';
  }
  function basename(c) {
    const date=c.post_date || c.messenger_shared_at || 'undated';
    return slug(date + ' ' + (c.original_title || 'Untitled video') + ' ' +
                (c.creator_handle || c.creator_display_name || 'creator unknown')) + ' ['+c.id+']';
  }
  function saveJson(name,obj) {
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
    const a=document.createElement('a'); const u=URL.createObjectURL(blob);
    a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),60000);
  }
  function saveCsv() {
    const fields=['id','source_url','original_title','creator_handle','creator_display_name',
      'creator_profile','post_date','messenger_shared_at','duration_seconds','description',
      'comments_visible','creator_credit','right_to_use','direct_media_url','local_media_filename'];
    const q=v=>'"'+String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replace(/"/g,'""')+'"';
    const data=[fields.map(q).join(','),...clips.map(c=>fields.map(k=>q(c[k])).join(','))].join('\r\n');
    const u=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=u;a.download='GE-Video-Catalog.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
  }
  function exportJson() {
    saveJson('GE-Video-Catalog.json',{
      schema_version:1,source:'GE Studios Messenger collector',
      export_time:new Date().toISOString(),
      warning:'Private Messenger metadata. Do not commit to public GitHub. Captured fields may be partial. Confirm actual rights and attribution before publication.',
      clips
    });
  }
  function createProject() {
    const chosen=clips.filter(c=>c.selected);
    saveJson('GE-Video-Project.json',{
      schema_version:1,project_name:'Grand Element Music Video',song_file:'CHOOSE_SONG',
      logo_file:'CHOOSE_ACTUAL_GE_SHIP_PNG',output:'GE-Music-Video.mp4',
      style:{motion:'smooth_slow_motion',interpolation:'optical_flow_review_required',
        transitions:['fade','dissolve','smoothleft','smoothright','circleopen','slideleft','wipeup','zoomin','radial'],
        mix:'varied',song_synced:true,logo_intro:true,logo_outro:true,
        central_ship_aura:'audio_reactive_requested'},
      clips:chosen.map(c=>({id:c.id,source_url:c.source_url,local_file:c.local_media_filename||null,
        creator_credit:c.creator_credit,notes:c.notes,transition:null}))
    });
    setStatus('Project manifest exported with '+chosen.length+' selected clips. Video renderer runs separately.');
  }
  function downloadSelected() {
    const chosen=clips.filter(c=>c.selected);
    if (!chosen.length) {setStatus('Select at least one clip.');return;}
    let downloadable=0;
    for (const c of chosen) {
      // Every clip gets a full metadata sidecar; no information has to be forced into a filename.
      saveJson(basename(c)+'.metadata.json',c);
      const link=c.direct_media_url || (VIDEO_EXT.test(c.source_url)?c.source_url:null);
      if (!link || !/^https?:/.test(link)) continue; // blob: and protected page shares cannot be downloaded here.
      const ext=(link.match(/\.(mp4|mov|m4v|webm|gif)(?:[?#]|$)/i)||[])[1]||'mp4';
      const filename=basename(c)+'.'+ext.toLowerCase();
      c.local_media_filename=filename;
      downloadable++;
      try {
        GM_download({url:link,name:filename,saveAs:false,
          onerror:e=>setStatus('Some downloads failed. Direct media links may expire: '+(e?.error||'unknown'))});
      } catch(e) {setStatus('Download refused: '+String(e).slice(0,100));}
    }
    persist();
    setStatus('Metadata saved for '+chosen.length+' clips; started '+downloadable+
      ' directly accessible file downloads. Social share pages need separate lawful file retrieval.');
  }
  function textInput(value, onChange, placeholder='') {
    const i=document.createElement('input');i.value=value||'';i.placeholder=placeholder;
    i.addEventListener('change',()=>{onChange(i.value);persist();renderCount();});
    return i;
  }
  function createButton(text, click) {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',click);return b;
  }
  function renderCount() {
    if(countEl) countEl.textContent=clips.length+' saved | '+clips.filter(x=>x.selected).length+' selected';
  }
  function render() {
    renderCount();
    resultsEl.replaceChildren();
    const filtered=clips.filter(c=>!search || [c.original_title,c.creator_handle,c.description,c.source_url].join(' ').toLowerCase().includes(search));
    for (const c of filtered.slice(0,200)) {
      const row=document.createElement('div'); row.className='ge-clip';
      const box=document.createElement('input');box.type='checkbox';box.checked=!!c.selected;
      box.addEventListener('change',()=>{c.selected=box.checked;persist();renderCount()});
      const info=document.createElement('div');info.className='ge-info';
      const head=document.createElement('div');head.className='ge-head';
      const open=document.createElement('a');open.href=c.source_url;open.target='_blank';open.rel='noopener noreferrer';
      open.textContent=c.original_title||'Untitled video / review original';
      head.append(open);
      const sub=document.createElement('div');sub.className='ge-small';
      sub.textContent=[c.post_date||c.messenger_shared_at||'undated',c.creator_handle||'creator unknown',
        c.duration_seconds!=null?c.duration_seconds+'s':'length unknown'].join(' · ');
      const meta=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Edit title, creator, date, description and credit';
      const fields=[
        ['Creator title','original_title'],['Creator @tag','creator_handle'],
        ['Creator name','creator_display_name'],['Creator profile URL','creator_profile'],
        ['Original post date YYYY-MM-DD','post_date'],['Credit text','creator_credit'],
        ['Duration (seconds)','duration_seconds'],['Comments/description','description'],
        ['Notes','notes'],['Direct video URL (optional)','direct_media_url']
      ];
      meta.appendChild(summary);
      for (const [label,key] of fields) {
        const wrap=document.createElement('label');wrap.textContent=label;
        let el;
        if (key==='description'||key==='notes') {
          el=document.createElement('textarea');el.rows=2;el.value=c[key]||'';
          el.addEventListener('change',()=>{c[key]=el.value;persist();});
        } else {
          el=textInput(c[key],val=>{c[key]=key==='duration_seconds'?(val?Number(val):null):val;},label);
        }
        wrap.appendChild(el);meta.appendChild(wrap);
      }
      info.append(head,sub,meta);
      const thumbnail=document.createElement('div');thumbnail.className='ge-thumb';
      if (c.thumbnail_url && /^https?:/.test(c.thumbnail_url)) {
        const im=document.createElement('img');im.src=c.thumbnail_url;im.loading='lazy';im.referrerPolicy='no-referrer';im.alt='Source preview';thumbnail.appendChild(im);
      } else thumbnail.textContent='NO PREVIEW';
      row.append(box,thumbnail,info);resultsEl.appendChild(row);
    }
    if(filtered.length>200) {
      const more=document.createElement('p');more.textContent='Showing first 200 matches. Filter to see additional clips; the full catalog is retained.';resultsEl.appendChild(more);
    }
  }
  function initUI() {
    GM_addStyle([
      '#ge-video-panel{position:fixed;right:12px;bottom:12px;z-index:2147483646;width:420px;max-width:94vw;max-height:80vh;background:#0d1824;color:#eaf7ff;border:1px solid #56b9ed;border-radius:12px;font:12px Arial,sans-serif;box-shadow:0 8px 30px #000b;display:flex;flex-direction:column;overflow:hidden}',
      '#ge-video-panel *{box-sizing:border-box}#ge-video-panel .ge-top{background:#12273a;padding:10px;display:flex;align-items:center;gap:8px}#ge-video-panel .ge-top strong{font-size:14px;flex:1}',
      '#ge-video-panel button{background:#15577c;color:white;border:1px solid #46b9ed;padding:6px;border-radius:5px;cursor:pointer;font:inherit}',
      '#ge-video-panel button:hover{background:#27769d}#ge-video-panel input:not([type=checkbox]),#ge-video-panel textarea{background:#0e2637;border:1px solid #456777;border-radius:4px;color:white;padding:5px;width:100%;font:inherit}',
      '#ge-video-panel .ge-controls{padding:9px;display:grid;gap:6px}#ge-video-panel .ge-buttons{display:flex;flex-wrap:wrap;gap:5px}',
      '#ge-video-panel .ge-results{overflow-y:auto;padding:7px;min-height:60px;max-height:45vh}#ge-video-panel .ge-clip{display:grid;grid-template-columns:20px 74px 1fr;gap:6px;border-bottom:1px solid #33516a;padding:7px 1px}',
      '#ge-video-panel .ge-clip a{color:#8bdfff;text-decoration:underline}#ge-video-panel .ge-thumb{height:58px;background:#1c3446;color:#7994a3;display:grid;place-items:center;font-size:9px;text-align:center}',
      '#ge-video-panel .ge-thumb img{width:100%;height:100%;object-fit:cover}#ge-video-panel .ge-head{font-weight:bold}#ge-video-panel .ge-small{font-size:10px;color:#aac9d5;margin:4px 0}',
      '#ge-video-panel label{display:block;color:#c6dfe8;margin-top:5px}#ge-video-panel label input,#ge-video-panel label textarea{display:block;margin-top:2px}',
      '#ge-video-panel .ge-status{padding:8px;color:#a7c9da;background:#0b2434;font-size:11px}#ge-video-panel summary{cursor:pointer;color:#87d1fa}',
      '#ge-video-panel.ge-collapsed .ge-controls,#ge-video-panel.ge-collapsed .ge-results,#ge-video-panel.ge-collapsed .ge-status{display:none}'
    ].join('\n'));
    const panel=document.createElement('section');panel.id='ge-video-panel';
    const top=document.createElement('div');top.className='ge-top';
    const label=document.createElement('strong');label.textContent='GE VIDEO COLLECTOR';
    countEl=document.createElement('span');
    const toggle=createButton('−',()=>{panel.classList.toggle('ge-collapsed');toggle.textContent=panel.classList.contains('ge-collapsed')?'+':'−';});
    top.append(label,countEl,toggle);
    const controls=document.createElement('div');controls.className='ge-controls';
    const buttons=document.createElement('div');buttons.className='ge-buttons';
    buttons.append(createButton('SCAN OPEN CHAT',scanOpen),createButton('LOAD OLDER + SCAN',loadOlder));
    maxEl=document.createElement('input');maxEl.type='number';maxEl.min='1';maxEl.max='100';maxEl.value='20';maxEl.style.maxWidth='56px';maxEl.title='Maximum older-message scroll attempts';
    buttons.append(maxEl);
    const manual=document.createElement('div');manual.style.display='flex';manual.style.gap='5px';
    const linkInput=document.createElement('input');linkInput.placeholder='Paste direct video/share URL…';
    manual.append(linkInput,createButton('ADD',()=>{
      if (!isVideo(norm(linkInput.value))) {setStatus('Not a recognized video share link.');return;}
      add(linkInput.value,{title:null,source_text:'',message_href:'Manually supplied'},'manual_link');
      linkInput.value='';persist();render();setStatus('Link added.');
    }));
    const actions=document.createElement('div');actions.className='ge-buttons';
    actions.append(createButton('SELECT ALL SHOWN',()=>{
      const matching=clips.filter(c=>!search || [c.original_title,c.creator_handle,c.description,c.source_url].join(' ').toLowerCase().includes(search));
      matching.forEach(c=>c.selected=true);persist();render();
    }),createButton('CLEAR SELECTION',()=>{clips.forEach(c=>c.selected=false);persist();render()}));
    const exports=document.createElement('div');exports.className='ge-buttons';
    exports.append(createButton('EXPORT JSON',exportJson),createButton('CSV',saveCsv),
      createButton('DOWNLOAD SELECTED',downloadSelected),createButton('VIDEO PROJECT',createProject));
    searchEl=document.createElement('input');searchEl.placeholder='Search title / creator / description…';
    searchEl.addEventListener('input',()=>{search=searchEl.value.toLowerCase();render();});
    controls.append(buttons,manual,actions,exports,searchEl);
    resultsEl=document.createElement('div');resultsEl.className='ge-results';
    statusEl=document.createElement('div');statusEl.className='ge-status';
    statusEl.textContent='Open a Grand Element Messenger conversation, then scan the visible links. Nothing is uploaded.';
    panel.append(top,controls,resultsEl,statusEl);document.body.appendChild(panel);
    render();
  }
  if (document.body) initUI();
  else document.addEventListener('DOMContentLoaded',initUI,{once:true});
})();
