/* GE Studios · Music checkout rehearsal v1.
 * Intentionally isolated from Radio audio, Vault credentials, real payments,
 * real purchase entitlements, server email and protected downloads.
 * Activated by a valid all-music session (e.g. LOVE), or owner-only Sun Lab.
 */
(()=>{
 'use strict';
 const CHECKED='GE_MUSIC_V3_SELECTION_20261024';
 const DEMO_KEY='GE_MUSIC_TEST_PURCHASES_V1';
 const MUSIC_SESSION='GE_MUSIC_CODE_SESSION_V1';
 const STORAGE_OWNER='GE_PLAYER_OWNER_DEMO_V1';
 const app=document.createElement('div');
 app.id='geMusicDemoCheckout';
 app.style.cssText='display:none;position:fixed;inset:0;z-index:60150;background:rgba(0,5,15,.94);color:#f1faff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch';
 const style=document.createElement('style');
 style.textContent=[
 '#geMusicDemoCheckout *{box-sizing:border-box}',
 '#geMusicDemoCheckout button,#geMusicDemoCheckout select,#geMusicDemoCheckout input{font:inherit}',
 '#geMusicDemoCheckout button{border:1px solid #77caff;border-radius:9px;background:#145685;color:#fff;min-height:41px;padding:8px 12px;font-weight:750;cursor:pointer}',
 '#geMusicDemoCheckout button:disabled{opacity:.45}',
 '#geMusicDemoCheckout .box{width:min(650px,calc(100vw - 12px));margin:max(8px,env(safe-area-inset-top)) auto max(12px,env(safe-area-inset-bottom));border:2px solid #5ccaff;border-radius:12px;background:#061b2c;box-shadow:0 8px 35px #000}',
 '#geMusicDemoCheckout .head{display:flex;justify-content:space-between;gap:8px;align-items:center;background:#095da3;padding:12px;border-radius:10px 10px 0 0}',
 '#geMusicDemoCheckout .head strong{font-size:18px;letter-spacing:.04em}',
 '#geMusicDemoCheckout .body{padding:12px 14px 24px}',
 '#geMusicDemoCheckout .flag{font-weight:850;color:#ffe6a5;border:1px solid #b78b41;background:#37250d;border-radius:7px;padding:10px;margin:0 0 12px;font-size:13px}',
 '#geMusicDemoCheckout .stepTitle{font-size:19px;font-weight:900;margin:6px 0 12px}',
 '#geMusicDemoCheckout .lines{border:1px solid #43789d;border-radius:9px;max-height:36vh;overflow-y:auto;padding:8px 10px;background:#102d41}',
 '#geMusicDemoCheckout .line{display:flex;justify-content:space-between;gap:7px;padding:5px 0;border-bottom:1px solid #28465a;font-size:13px}',
 '#geMusicDemoCheckout .line:last-child{border:0}',
 '#geMusicDemoCheckout .total{display:flex;justify-content:space-between;font-weight:900;font-size:19px;padding:10px 0}',
 '#geMusicDemoCheckout .controls{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}',
 '#geMusicDemoCheckout .controls button{flex:1 1 150px}',
 '#geMusicDemoCheckout button.primary{background:#88621d;border-color:#f2d48b}',
 '#geMusicDemoCheckout label{display:block;font-weight:750;font-size:13px;margin:10px 0 6px}',
 '#geMusicDemoCheckout select,#geMusicDemoCheckout input{display:block;width:100%;background:#031422;border:1px solid #72b7e0;border-radius:8px;color:#fff;padding:9px;font-size:16px;min-height:43px}',
 '#geMusicDemoCheckout .note{font-size:12px;line-height:1.5;color:#bedbea;margin:10px 0}',
 '#geMusicDemoCheckout .status{font-size:13px;line-height:1.45;color:#ffe7ad;white-space:pre-line;margin:12px 0}',
 '#geMusicDemoCheckout .downloadList{display:grid;gap:8px;padding:7px 0}',
 '#geMusicDemoCheckout .downloadList a{display:block;color:#b4ecff;border:1px solid #4d90ac;padding:8px;border-radius:7px;text-decoration:none;overflow-wrap:anywhere}',
 '#geMusicDemoCheckout .emailPreview{white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow-y:auto;border:1px solid #497996;border-radius:8px;padding:9px;font-size:12px;background:#071522}',
 '#geMusicDemoCheckout [hidden]{display:none!important}'
 ].join('\n');
 const heading=document.createElement('div');
 heading.className='box';
 heading.innerHTML='<div class="head"><strong>GE MUSIC · TEST CHECKOUT</strong><button type="button" id="geDemoClose">CLOSE</button></div><div class="body"><p class="flag">DEMO ONLY · NO MONEY CHARGED · NO REAL PURCHASE RIGHTS</p><div id="geDemoContent"></div></div>';
 app.append(style,heading);document.body.append(app);
 const $=id=>heading.querySelector('#'+id);
 const body=$('geDemoContent');
 let snapshot=null,paidRecord=null;
 const money=n=>'$'+Number(n||0).toFixed(2);
 const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 function authorizedDemo(){
   try{
     const a=JSON.parse(sessionStorage.getItem(MUSIC_SESSION)||'null');
     return !!(a&&typeof a.token==='string'&&a.token.length>8&&a.restricted===false&&Number(a.until)>Date.now());
   }catch(_){return false}
 }
 function ownerDemo(){try{return localStorage.getItem(STORAGE_OWNER)==='yes'}catch(_){return false}}
 function testEligible(){return authorizedDemo()||ownerDemo()}
 function canonical(path){
   const p=String(path||'').replace(/^\/+/,'');
   return /^ge-music\/music\/[^/]+\/.+\.(mp3|m4a|wav|ogg)$/i.test(p)&&!p.includes('..')?p:'';
 }
 function checkedPaths(){
  try{const a=JSON.parse(localStorage.getItem(CHECKED)||'[]');return Array.isArray(a)?a.map(canonical).filter(Boolean):[]}catch(_){return []}
 }
 function stored(){
  try{const a=JSON.parse(localStorage.getItem(DEMO_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.testOnly===true&&Array.isArray(x.paths)):[]}catch(_){return []}
 }
 const E=(tag,cls,content)=>{
   const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;
 };
 function addButton(where,title,fn,primary=false){
   const button=E('button',primary?'primary':'',title);button.type='button';button.addEventListener('click',fn);where.append(button);return button;
 }
 function block(title){body.replaceChildren();body.append(E('h2','stepTitle',title))}
 function controls(){const d=E('div','controls');body.append(d);return d}
 function close(){app.style.display='none';body.replaceChildren();snapshot=null;paidRecord=null}
 $('geDemoClose').addEventListener('click',close);
 function catalogPathToUrl(path){
   return new URL('../'+path.split('/').map(encodeURIComponent).join('/'),location.href).href;
 }
 function groupSelection(catalog,raw){
   const all=catalog.music||[],selected=[],missing=[],seen=new Set();
   for(const path of raw){
     if(seen.has(path))continue;seen.add(path);
     const bits=path.split('/'),folder=(bits[2]||'').replace(/^Grand Element - \d{4} - /,'').trim(),file=bits.slice(3).join('/');
     const album=all.find(a=>norm(a.title)===norm(folder));
     const track=album?.tracks?.find(t=>norm(t.file)===norm(file));
     if(!album||!track){missing.push(path);continue}
     selected.push({path,title:track.title,album:album.title,albumId:album.id,number:track.number});
   }
   if(missing.length)throw Error(missing.length+' selected recording(s) were not found in the Support catalog. Check the music catalog before checkout.');
   if(!selected.length)throw Error('Choose at least one song in MUSIC first.');
   const counts=new Map();
   for(const t of selected)counts.set(t.albumId,(counts.get(t.albumId)||0)+1);
   const totals=new Map(all.map(a=>[a.id,(a.tracks||[]).length]));
   let subtotal=0;const priced=selected.map(t=>{
    const full=counts.get(t.albumId)===totals.get(t.albumId);
    const price=full?1:1.5;subtotal+=price;return {...t,price,full};
   });
   return {tracks:priced,paths:priced.map(t=>t.path),subtotal};
 }
 async function open(options){
   if(!testEligible())return false;
   app.style.display='block';block('LOADING TEST ORDER…');
   body.append(E('p','note','Checking selected recordings against the current Support catalog.'));
   const paths=Array.isArray(options?.paths)?options.paths.map(canonical).filter(Boolean):checkedPaths();
   try{
     const resp=await fetch('../support/catalog.json',{cache:'no-store'});
     if(!resp.ok)throw Error('Support catalog could not be loaded.');
     const catalog=await resp.json();
     let requested=paths;
     if(options?.mode==='album'&&typeof options.album==='string'){
       const album=(catalog.music||[]).find(a=>norm(a.title)===norm(options.album));
       if(!album)throw Error('This album is not in the Support catalog.');
       requested=checkedPaths().filter(path=>path.split('/')[2]?.toLowerCase().includes(norm(album.title)));
       if(requested.length!==album.tracks.length){
         const candidates=await fetch('./manifest.json',{cache:'no-store'}).then(r=>r.ok?r.json():{});
         const files=Array.isArray(candidates.files)?candidates.files:[];
         requested=files.map(canonical).filter(path=>{
           const bits=path.split('/');
           return norm((bits[2]||'').replace(/^Grand Element - \d{4} - /,''))===norm(album.title);
         });
       }
     }
     snapshot=groupSelection(catalog,requested);
     showReview();
   }catch(error){block('TEST CHECKOUT UNAVAILABLE');body.append(E('p','status',String(error.message||error)));const c=controls();addButton(c,'CLOSE',close)}
   return true;
 }
 function showReview(){
  block('1 · REVIEW SELECTED MUSIC');
  const rows=E('div','lines');
  snapshot.tracks.forEach(t=>{
   const row=E('div','line');row.append(E('span','',t.title+' — '+t.album),E('strong','',money(t.price)));rows.append(row);
  });body.append(rows);
  const total=E('div','total');total.append(E('span','','SUBTOTAL'),E('strong','',money(snapshot.subtotal)));body.append(total);
  body.append(E('p','note','Full available albums use the store\'s $1-per-track preview pricing; individual songs are $1.50. No charge, tax, or actual checkout occurs here.'));
  const c=controls();addButton(c,'NEXT · PAYMENT',showPayment,true);addButton(c,'CANCEL',close);
 }
 function showPayment(){
  block('2 · SIMULATED PAYMENT');
  body.append(E('p','note',snapshot.tracks.length+' songs · '+money(snapshot.subtotal)+' subtotal. This payment screen is for testing only.'));
  const label=E('label','','PAYMENT METHOD (DEMO)');label.setAttribute('for','geDemoMethod');body.append(label);
  const select=E('select');select.id='geDemoMethod';
  for(const x of ['Bitcoin','Lightning','Credit/Debit Card','PayPal'])select.add(new Option(x+' · TEST',x));
  body.append(select);
  body.append(E('p','status','No payment processor, wallet, or bank is connected to this demo. No financial information is requested.'));
  const c=controls();addButton(c,'MAKE TEST PAYMENT',()=>{
    if(!testEligible()){block('TEST SESSION EXPIRED');body.append(E('p','status','Enter an authorized code and restart the test.'));return}
    paidRecord={
      version:1,testOnly:true,status:'SIMULATED_NOT_PAID',
      orderId:'GE-TEST-'+Date.now().toString(36).toUpperCase(),
      at:Date.now(),method:select.value,paths:snapshot.paths,
      subtotal:snapshot.subtotal,deliveryFormat:'',deliveryOption:''
    };
    try{localStorage.setItem(DEMO_KEY,JSON.stringify([...stored(),paidRecord].slice(-100)))}
    catch(_){body.append(E('p','status','Test order could not be saved on this device.'));return}
    window.dispatchEvent(new Event('ge-music-demo-purchase-updated'));
    showSuccess();
  },true);
  addButton(c,'BACK',showReview);
 }
 function showSuccess(){
  block('PAYMENT MADE · SIMULATION');
  body.append(E('p','status','TEST PAYMENT SUCCESSFUL\n'+paidRecord.orderId+'\nNO MONEY CHARGED · NO REAL ACCESS GRANTED'));
  body.append(E('p','note',authorizedDemo()?'Your current music access already permits playback; this test does not change it.':'This device has a simulated music library for testing, not a purchased entitlement.'));
  const c=controls();addButton(c,'CONTINUE · FILE DELIVERY',showDelivery,true);addButton(c,'CLOSE',close);
 }
 function persistDelivery(format,mode,email){
  try{
   const orders=stored(),last=orders.find(x=>x.orderId===paidRecord.orderId);
   if(last){last.deliveryFormat=format;last.deliveryOption=mode;last.deliveryEmail=email||'';localStorage.setItem(DEMO_KEY,JSON.stringify(orders))}
  }catch(_){}
 }
 function manifestDownload(format){
  const manifest={
    label:'GE STUDIOS · SIMULATED DELIVERY MANIFEST · NOT A PAID PURCHASE',
    order:paidRecord.orderId,requested_format:format,
    converted:false,emailed:false,private_download_links_generated:false,
    tracks:snapshot.tracks.map(t=>({title:t.title,album:t.album,source:t.path}))
  };
  const blob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=E('a','','DOWNLOAD DEMO ORDER MANIFEST');a.href=url;a.download=paidRecord.orderId+'.json';
  a.style.cssText='display:block;padding:10px;color:#b7edff;text-decoration:underline';
  a.addEventListener('click',()=>setTimeout(()=>URL.revokeObjectURL(url),2000),{once:true});
  return a;
 }
 function showDelivery(){
  block('3 · CHOOSE MUSIC FILE DELIVERY');
  body.append(E('p','note','Choose a delivery format for your order. This demo records your preferences. Actual transcoding, private download links and automatic emails are not connected.'));
  const lab=E('label','','MUSIC FILE FORMAT');lab.setAttribute('for','geDemoFormat');body.append(lab);
  const format=E('select');format.id='geDemoFormat';
  for(const [value,title] of [
    ['MP3','MP3 · standard listening'],['AIFF','AIFF / AIF · uncompressed studio'],['WAV','WAV · uncompressed'],
    ['FLAC','FLAC · lossless'],['ALAC','ALAC / M4A · Apple lossless'],['AAC','AAC / M4A'],['OGG','OGG Vorbis']
  ])format.add(new Option(title,value));
  body.append(format);
  const deliveryLabel=E('label','','DELIVERY OPTION');body.append(deliveryLabel);
  const mode=E('select');for(const x of [['download','DOWNLOAD LINK'],['email','EMAIL ME THE LINK'],['both','DOWNLOAD + EMAIL LINK']])mode.add(new Option(x[1],x[0]));
  body.append(mode);
  const email=E('input');email.type='email';email.autocomplete='email';email.placeholder='Email address for link preview';email.setAttribute('aria-label','Email for demo delivery');email.hidden=true;body.append(email);
  const output=E('div','status');body.append(output);
  const links=E('div','downloadList');body.append(links);
  mode.addEventListener('change',()=>{email.hidden=mode.value==='download'});
  const c=controls();
  addButton(c,'PREVIEW MY DELIVERY',()=>{
    const fmt=format.value,method=mode.value,address=email.value.trim();
    if(method!=='download'&&!/^\S+@\S+\.\S+$/.test(address)){output.textContent='Enter a valid email address for the email preview.';return}
    persistDelivery(fmt,method,address);
    links.replaceChildren();
    links.append(manifestDownload(fmt));
    if(fmt==='MP3'&&(method==='download'||method==='both')){
      for(const t of snapshot.tracks){
        const a=E('a','',t.title+' — '+t.album+' · SOURCE MP3');
        a.href=catalogPathToUrl(t.path);a.target='_blank';a.rel='noopener noreferrer';
        a.title='Public demo source file, not a protected purchased download';
        links.append(a);
      }
    }
    output.textContent='DELIVERY PREVIEW SAVED · '+fmt+'\n'+
      (method==='download'?'Download link preview selected.':'TEST EMAIL PREVIEW for '+address+' · nothing was emailed.')+
      '\n'+(fmt==='MP3'?'Existing public MP3 source links appear below. This is NOT secure paid delivery.':
       'Conversion to '+fmt+' has NOT run. The manifest records the format to generate when the backend is connected.');
    if(method!=='download'){
      const sample=E('div','emailPreview','TO: '+address+'\nSUBJECT: Your Grand Element Music — TEST ORDER '+paidRecord.orderId+
      '\n\nThank you for supporting Grand Element.\nYour '+snapshot.tracks.length+' tracks have been requested in '+fmt+
      '.\n\nTEST ONLY: No email was sent and no private download URL has been issued.');
      links.append(sample);
    }
  },true);
  addButton(c,'BACK',showSuccess);
  addButton(c,'CLOSE',close);
 }
 window.GEDemoCheckout={open,eligible:testEligible,authorizedMusic:authorizedDemo,showSelected:()=>open({paths:checkedPaths()}),close};
 // For local owner testing without all-music access, expose a Sun Lab shortcut.
 function addSunLabShortcut(){
   const pane=document.querySelector('#sunLabPanel .sunlab-actions');
   if(!pane||document.getElementById('geSunLabPurchaseDemo'))return;
   const b=E('button','','PURCHASE FLOW · TEST');b.id='geSunLabPurchaseDemo';
   b.type='button';b.className='sunlab-mini';
   b.title='Simulate the selected-song payment and delivery steps, without charging money';
   b.addEventListener('click',()=>{
     if(!testEligible())return;
     const sun=document.getElementById('sunLabPanel');
     if(sun){sun.hidden=true;sun.classList.remove('show')}
     void open({paths:checkedPaths()});
   });
   pane.append(b);
   const refresh=()=>{b.hidden=authorizedDemo()||!ownerDemo()};
   refresh();
   window.addEventListener('ge-vault-music-access-updated',refresh);
   window.addEventListener('pageshow',refresh);
 }
 addSunLabShortcut();
})();
