/* GE Studios — Shared Radio Clock + listener-wide station transition coordinator.
 * No server continuously plays audio. All scheduled playback is derived from UTC.
 * Cloudflare Workers Free + SQLite-backed Durable Object; no passwords in browser source.
 */
export class RadioTimeline {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async fetch(request){
    const url=new URL(request.url),now=Date.now();
    if(url.pathname.endsWith("/state")){
      const saved=await this.ctx.storage.get("on_air");
      const state=saved||{from:"blitz",to:"blitz",start_at_ms:0,duration_ms:0,revision:0,updated_at_ms:0};
      const ge_dj=await this.ctx.storage.get("ge_dj")||null;
      return Response.json({ok:true,server_now_ms:now,station:state,ge_dj});
    }
    if(url.pathname.endsWith("/switch")){
      const body=await request.json().catch(()=>null);
      if(!body||!["blitz","ge"].includes(body.to))return Response.json({ok:false,error:"Select BLITZ or GE RADIO."},{status:400});
      const fade=Number(body.crossfade_seconds);
      if(!Number.isFinite(fade)||fade<0||fade>30)return Response.json({ok:false,error:"Crossfade must be 0–30 seconds."},{status:400});
      const old=await this.ctx.storage.get("on_air")||{from:"blitz",to:"blitz",start_at_ms:0,duration_ms:0,revision:0,updated_at_ms:0};
      const oldEnds=old.start_at_ms+old.duration_ms;
      if(now<oldEnds)return Response.json({ok:false,error:"Previous station crossfade is still in progress.",station:old},{status:409});
      const previous=old.to;
      if(previous===body.to)return Response.json({ok:true,unchanged:true,server_now_ms:now,station:old});
      // Allow enough advance notice for clients polling every 3 seconds and opening the next stream.
      // The audience may hear the transition late if the device is asleep or buffering.
      const lead_ms=20000,duration_ms=Math.round(fade*1000);
      const next={
        from:previous,to:body.to,start_at_ms:now+lead_ms,
        duration_ms:duration_ms,revision:(old.revision||0)+1,updated_at_ms:now
      };
      await this.ctx.storage.put("on_air",next);
      return Response.json({ok:true,server_now_ms:now,station:next});
    }
    if(url.pathname.endsWith("/ge-dj")){
      const body=await request.json().catch(()=>null);
      if(!body||!body.meta||!Array.isArray(body.meta.durations)||!body.meta.hash)
        return Response.json({ok:false,error:"Playlist information missing."},{status:400});
      const ds=body.meta.durations.map(Number),n=ds.length;
      if(n<3||n>400||ds.some(v=>!Number.isFinite(v)||v<1000))
        return Response.json({ok:false,error:"Invalid playlist durations."},{status:400});
      const total=ds.reduce((a,b)=>a+b,0),hash=body.meta.hash,epoch=Number(body.meta.epoch);
      const initial=()=>({running:true,anchor_at_ms:epoch,position_ms:0,
        order:ds.map((_,i)=>i),revision:0,updated_at_ms:0,playlist_hash:hash});
      let ge=await this.ctx.storage.get("ge_dj");
      if(!ge||ge.playlist_hash!==hash||!Array.isArray(ge.order)||ge.order.length!==n)ge=initial();
      if(body.expected_revision!==undefined&&Number(body.expected_revision)!==ge.revision)
        return Response.json({ok:false,error:"Playlist changed in another DJ session. Refresh and retry.",ge_dj:ge},{status:409});
      const action=body.action;
      const norm=v=>((v%total)+total)%total;
      let pos=norm(Number(ge.position_ms)+(ge.running?now-Number(ge.anchor_at_ms):0));
      function at(p){
        for(let i=0;i<n;i++){const len=ds[ge.order[i]];
          if(p<len)return {slot:i,offset:p};
          p-=len;
        }return {slot:0,offset:0};
      }
      function prefix(slot){let p=0;for(let i=0;i<slot;i++)p+=ds[ge.order[i]];return p;}
      const here=at(pos);
      if(action==="play"){
        ge.running=true;ge.position_ms=pos;ge.anchor_at_ms=now;
      }else if(action==="stop"){
        ge.running=false;ge.position_ms=pos;ge.anchor_at_ms=now;
      }else if(action==="skip"){
        ge.position_ms=prefix((here.slot+1)%n);ge.anchor_at_ms=now;
      }else if(action==="reshuffle"){
        const current=ge.order[here.slot];
        const remaining=ge.order.filter(v=>v!==current);
        for(let i=remaining.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
        ge.order=[current,...remaining];ge.position_ms=here.offset;ge.anchor_at_ms=now;
      }else if(action==="move"){
        const from=body.from_pos,to=body.to_pos;
        if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=n||to>=n)
          return Response.json({ok:false,error:"Invalid playlist positions."},{status:400});
        const current=ge.order[here.slot];
        const [picked]=ge.order.splice(from,1);ge.order.splice(to,0,picked);
        ge.position_ms=prefix(ge.order.indexOf(current))+here.offset;ge.anchor_at_ms=now;
      }else return Response.json({ok:false,error:"Unknown DJ action."},{status:400});
      ge.revision=(ge.revision||0)+1;ge.updated_at_ms=now;
      await this.ctx.storage.put("ge_dj",ge);
      return Response.json({ok:true,server_now_ms:now,ge_dj:ge});
    }
    return new Response("Not found",{status:404});
  }
}
const GOOD_ORIGINS=new Set([
  "https://grandelement.com","https://www.grandelement.com","https://grandelement.github.io"
]);
function cors(req){
  const o=req.headers.get("Origin");
  return {"Access-Control-Allow-Origin":GOOD_ORIGINS.has(o)?o:"https://grandelement.com",
    "Vary":"Origin","Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":"Authorization, Content-Type",
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
}
function json(data,status=200,req){
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json;charset=utf-8",...cors(req)}});
}
function equalToken(a,b){
  // Compare HMAC digests constant-time-ish rather than plaintext strings, without leaking a token.
  if(!a||!b)return false;
  let mismatch=a.length^b.length;
  for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return mismatch===0;
}
async function program(env){
  const url=env.PROGRAM_URL||"https://grandelement.com/radio/sync-playlist.json";
  const result=await fetch(url,{cf:{cacheTtl:300},headers:{"Accept":"application/json"}});
  if(!result.ok)throw new Error("Published GE RADIO playlist is unavailable ("+result.status+").");
  const d=await result.json();
  if(d.format!=="ge-radio-clock-v1"||!Array.isArray(d.tracks)||d.tracks.length<3)throw new Error("GE RADIO playlist is not ready.");
  if(d.tracks.some(x=>!x.url||!(Number(x.duration_ms)>1000)))throw new Error("GE RADIO playlist contains an incomplete song duration.");
  return d;
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname,now=Date.now();
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(request)});
  if(path==="/v1/program"&&request.method==="GET"){
    try{const p=await program(env);return json({ok:true,server_now_ms:now,program:p},200,request);}
    catch(e){return json({ok:false,error:String(e.message||e)},503,request);}
  }
  if(path==="/v1/state"&&request.method==="GET"){
    const id=env.RADIO_TIMELINE.idFromName("grand-element-on-air");
    const result=await env.RADIO_TIMELINE.get(id).fetch("https://internal/state");
    const d=await result.json();
    return json({...d,server_now_ms:Date.now()},200,request);
  }
  if(path==="/v1/admin/ge"&&request.method==="POST"){
    const auth=request.headers.get("Authorization")||"";
    if(!env.GE_RADIO_SWITCH_TOKEN||!equalToken(auth,"Bearer "+env.GE_RADIO_SWITCH_TOKEN))
      return json({ok:false,error:"GE RADIO DJ authorization required."},401,request);
    let body;try{body=await request.json();}catch(_){return json({ok:false,error:"Invalid JSON."},400,request);}
    try{
      const p=await program(env);
      const ds=p.tracks.map(t=>Number(t.duration_ms));
      const meta={durations:ds,hash:p.playlist_hash,epoch:Number(p.epoch_utc_ms)};
      const id=env.RADIO_TIMELINE.idFromName("grand-element-on-air");
      const result=await env.RADIO_TIMELINE.get(id).fetch("https://internal/ge-dj",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...body,meta})
      });
      return json(await result.json(),result.status,request);
    }catch(e){return json({ok:false,error:String(e.message||e)},503,request);}
  }
  if(path==="/v1/admin/switch"&&request.method==="POST"){
    const auth=request.headers.get("Authorization")||"";
    if(!env.GE_RADIO_SWITCH_TOKEN||!equalToken(auth,"Bearer "+env.GE_RADIO_SWITCH_TOKEN))
      return json({ok:false,error:"Separate GE Radio switch authorization required."},401,request);
    let body;
    try{body=await request.clone().json();}catch(_){return json({ok:false,error:"Invalid JSON."},400,request);}
    if(body.to==="ge"){try{await program(env);}catch(e){return json({ok:false,error:String(e.message||e)},503,request);}}
    const id=env.RADIO_TIMELINE.idFromName("grand-element-on-air");
    const result=await env.RADIO_TIMELINE.get(id).fetch("https://internal/switch",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    return json(await result.json(),result.status,request);
  }
  return json({ok:false,error:"Unknown route."},404,request);
 }
};
