import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const home=readFileSync(new URL('../radio/ge-home-gate-stop.js',import.meta.url),'utf8');
const radio=readFileSync(new URL('../radio/index.html',import.meta.url),'utf8');
const website=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const albumPlayer=readFileSync(new URL('../radio/preview-lab.html',import.meta.url),'utf8');

assert.match(website,/id="geSiteAlbumPlayer"/,'Main universe contains an inline album player');
assert.match(website,/window\.GE_SITE_ALBUM_PLAYER\?\.open\?\.\(albumTitle\)/,
 'Album planets open the on-site preview rather than the standalone music page');
assert.match(website,/window\.GE_SITE_ALBUM_PLAYER\?\.preload\?\.\(alb\.musicTitle\|\|alb\.title\)/,
 'Album preloads at planet tap to preserve iOS Safari user activation');
assert.match(albumPlayer,/const AUDIO_LIMIT_SECONDS=2013;/,'On-site album preview retains the one 33:33 clock');
assert.match(albumPlayer,/const STORE_KEY='GE_PLAYER_LISTENING_V2_3333'/,
 'The on-site player shares the existing listening state, not a second free trial');
assert.match(albumPlayer,/GE_SITE_MUSIC_EMBED=GE_EMBED_MODE==='website'/,
 'Same embedded gate is available on homepage');
assert.match(albumPlayer,/window\.GEPlayWebsiteAlbum=function\(albumName\)/,
 'The album starts from the parent click without a second navigation');
assert.match(albumPlayer,/id="musicPrevious"/,'Album player has a previous track button');
assert.match(albumPlayer,/id="musicNext"/,'Album player has a next track button');
assert.match(albumPlayer,/GE_MUSIC_SESSION_ENDPOINT='https:\/\/vault\.grandelement\.com\/v1\/public\/access\/music-session'/,
 'Access codes continue through the original Vault endpoint');
assert.match(albumPlayer,/BUY ALBUM ON BANDCAMP/,'Only existing published album sale pages are used');
assert.match(website,/--ge-merch-factor:\.5/,'Shirt flyby remains half size');
assert.match(website,/--ge-merch-factor:\.75/,'Hat flyby remains 25% smaller');

assert.doesNotMatch(home,/GE_GATE_LOVE_V1/,'homepage never trusts the historic LOVE local flag');
assert.match(home,/GE_VAULT_SCOPED_ACCESS_V1/,'homepage reads the Vault-scoped receipt');
assert.match(radio,/fetch\('https:\/\/vault\.grandelement\.com\/v1\/public\/access\/redeem'/,
  'Radio must redeem every key against Vault D1');
assert.match(radio,/sessionStorage\.setItem\('GE_VAULT_SCOPED_ACCESS_V1'/,
  'Radio shares a scoped receipt, not the typed secret');

function simulate(scopes,expiresInMs=60000,legacyLove=false){
  const keys={
    GE_GATE_STATE_V5_3333:JSON.stringify({expired:true}),
    ...(legacyLove?{GE_GATE_LOVE_V1:'1'}:{})
  };
  const stored=new Map();
  if(scopes!==null)stored.set('GE_VAULT_SCOPED_ACCESS_V1',JSON.stringify({
    scopes,until:Date.now()+expiresInMs,verifiedFor:'radio'
  }));
  const handlers=new Map();
  const media={muted:false,defaultMuted:false,paused:false,pause(){this.paused=true;}};
  const localStorage={getItem:k=>keys[k]??null};
  const sessionStorage={getItem:k=>stored.get(k)??null};
  const document={
    hidden:false,
    addEventListener:(event,handler)=>handlers.set('document:'+event,handler),
    querySelectorAll:()=>[media]
  };
  const window={
    addEventListener:(event,handler)=>handlers.set('window:'+event,handler),
    GE_MUSIC_CONTROLLER:{stop(){}}
  };
  runInNewContext(home,{localStorage,sessionStorage,document,window,Date,JSON,Map,setInterval(){}});
  return {media,stored,handlers};
}

for(const scope of ['radio','games']){
  const {media}=simulate([scope]);
  assert.equal(media.muted,true,scope+' must never unlock website music');
}
for(const scope of ['website','music','albums']){
  const {media}=simulate([scope]);
  assert.equal(media.muted,false,scope+' may unlock the homepage Gate');
}
assert.equal(simulate(null,60000,true).media.muted,true,'legacy LOVE browser flag grants nothing');
assert.equal(simulate(['website'],-1000).media.muted,true,'expired scoped receipt grants nothing');
{
  const {media,stored,handlers}=simulate(['radio']);
  assert.equal(media.muted,true);
  stored.set('GE_VAULT_SCOPED_ACCESS_V1',JSON.stringify({
    scopes:['website'],until:Date.now()+60000,verifiedFor:'radio'
  }));
  handlers.get('window:pageshow')();
  assert.equal(media.muted,false,'successful scoped unlock restores the old mute state');
  assert.equal(media.paused,true,'unlock must never autoplay');
}
console.log('PASS: Vault scoped Radio Gate shares only authorized website/music/album grants; legacy LOVE flag ignored');
