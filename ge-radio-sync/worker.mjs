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
      return Response.json({ok:true,server_now_ms:now,station:state});
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
