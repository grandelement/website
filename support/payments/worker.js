/**
 * Grand Element self-hosted BTCPay checkout API.
 * REQUIRED: D1, secret-bound BTCPAY_API_KEY / BTCPAY_WEBHOOK_SECRET, verified BTCPAY_URL / BTCPAY_STORE_ID.
 * No custodial funds, seed phrases, xpub, personal identity, or wallet private keys belong in code.
 * Deployment is fail-closed. This file does NOT enable commerce without operator configuration.
 */
const SKUS={"album-fire":{"kind":"album","name":"Fire · Complete Album","priceCents":1100,"albumId":"album-fire"},"album-fire-track-1":{"kind":"track","name":"Fire — Alignment","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_01_Alignment.mp3"},"album-fire-track-2":{"kind":"track","name":"Fire — The Fire","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_02_The Fire.mp3"},"album-fire-track-3":{"kind":"track","name":"Fire — Remember","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_03_Remember.mp3"},"album-fire-track-4":{"kind":"track","name":"Fire — Spark","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_04_Spark.mp3"},"album-fire-track-5":{"kind":"track","name":"Fire — Arrival","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_05_Arrival.mp3"},"album-fire-track-6":{"kind":"track","name":"Fire — Smoke","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_06_Smoke.mp3"},"album-fire-track-7":{"kind":"track","name":"Fire — Wildfire","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_07_Wildfire.mp3"},"album-fire-track-8":{"kind":"track","name":"Fire — Transformation","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_08_Transformation.mp3"},"album-fire-track-9":{"kind":"track","name":"Fire — Grounding","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_09_Grounding.mp3"},"album-fire-track-10":{"kind":"track","name":"Fire — Releasure","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_10_Releasure.mp3"},"album-fire-track-11":{"kind":"track","name":"Fire — The Source","priceCents":150,"albumId":"album-fire","sourceFile":"Fire_11_The Source.mp3"},"album-spirit":{"kind":"album","name":"Spirit · Complete Album","priceCents":400,"albumId":"album-spirit"},"album-spirit-track-1":{"kind":"track","name":"Spirit — Magic","priceCents":150,"albumId":"album-spirit","sourceFile":"Spirit_01_Magic.mp3"},"album-spirit-track-2":{"kind":"track","name":"Spirit — Awakenings","priceCents":150,"albumId":"album-spirit","sourceFile":"Spirit_02_Awakenings.mp3"},"album-spirit-track-3":{"kind":"track","name":"Spirit — Illuminate","priceCents":150,"albumId":"album-spirit","sourceFile":"Spirit_03_Illuminate.mp3"},"album-spirit-track-5":{"kind":"track","name":"Spirit — Ying Yang Universe","priceCents":150,"albumId":"album-spirit","sourceFile":"Spirit_05_Ying Yang Universe.mp3"},"album-soul":{"kind":"album","name":"Soul · Complete Album","priceCents":1000,"albumId":"album-soul"},"album-soul-track-1":{"kind":"track","name":"Soul — Sunbeam","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_01_Sunbeam.mp3"},"album-soul-track-2":{"kind":"track","name":"Soul — Halo","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_02_Halo.mp3"},"album-soul-track-3":{"kind":"track","name":"Soul — Lovelorn","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_03_Lovelorn.mp3"},"album-soul-track-4":{"kind":"track","name":"Soul — Intuition","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_04_Intuition.mp3"},"album-soul-track-5":{"kind":"track","name":"Soul — Family Tree","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_05_Family Tree.mp3"},"album-soul-track-6":{"kind":"track","name":"Soul — Flame of Creation","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_06_Flame of Creation.mp3"},"album-soul-track-7":{"kind":"track","name":"Soul — Dogs Day","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_07_Dogs Day.mp3"},"album-soul-track-8":{"kind":"track","name":"Soul — Emerald Green","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_08_Emerald Green.mp3"},"album-soul-track-9":{"kind":"track","name":"Soul — Moon Horizon","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_09_Moon Horizon.mp3"},"album-soul-track-10":{"kind":"track","name":"Soul — Be Here Now","priceCents":150,"albumId":"album-soul","sourceFile":"Soul_10_Be Here Now.mp3"},"album-love":{"kind":"album","name":"Love · Complete Album","priceCents":700,"albumId":"album-love"},"album-love-track-1":{"kind":"track","name":"Love — I=Energy","priceCents":150,"albumId":"album-love","sourceFile":"Love_01_I=Energy.mp3"},"album-love-track-2":{"kind":"track","name":"Love — Be Yourself","priceCents":150,"albumId":"album-love","sourceFile":"Love_02_Be Yourself.mp3"},"album-love-track-3":{"kind":"track","name":"Love — The Delivery","priceCents":150,"albumId":"album-love","sourceFile":"Love_03_The Delivery.mp3"},"album-love-track-5":{"kind":"track","name":"Love — Free","priceCents":150,"albumId":"album-love","sourceFile":"Love_05_Free.mp3"},"album-love-track-6":{"kind":"track","name":"Love — Be Free","priceCents":150,"albumId":"album-love","sourceFile":"Love_06_Be Free.mp3"},"album-love-track-7":{"kind":"track","name":"Love — Entrance","priceCents":150,"albumId":"album-love","sourceFile":"Love_07_Entrance.mp3"},"album-love-track-8":{"kind":"track","name":"Love — RevelAtions","priceCents":150,"albumId":"album-love","sourceFile":"Love_08_RevelAtions.mp3"},"album-intergy":{"kind":"album","name":"Intergy · Complete Album","priceCents":1000,"albumId":"album-intergy"},"album-intergy-track-2":{"kind":"track","name":"Intergy — Intergy","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_02_Intergy.mp3"},"album-intergy-track-3":{"kind":"track","name":"Intergy — Amuse","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_03_Amuse.mp3"},"album-intergy-track-4":{"kind":"track","name":"Intergy — Heartful","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_04_Heartful.mp3"},"album-intergy-track-5":{"kind":"track","name":"Intergy — Teleportation","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_05_Teleportation.mp3"},"album-intergy-track-6":{"kind":"track","name":"Intergy — You Cant Change Me","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_06_You Cant Change Me.mp3"},"album-intergy-track-7":{"kind":"track","name":"Intergy — Selfishteem","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_07_Selfishteem.mp3"},"album-intergy-track-8":{"kind":"track","name":"Intergy — Rebirth","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_08_Rebirth.mp3"},"album-intergy-track-9":{"kind":"track","name":"Intergy — Creature","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_09_Creature.mp3"},"album-intergy-track-10":{"kind":"track","name":"Intergy — Prelude","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_10_Prelude.mp3"},"album-intergy-track-11":{"kind":"track","name":"Intergy — Music Box","priceCents":150,"albumId":"album-intergy","sourceFile":"Intergy_11_Music Box.mp3"},"album-sessions-ii":{"kind":"album","name":"Sessions II · Complete Album","priceCents":600,"albumId":"album-sessions-ii"},"album-sessions-ii-track-1":{"kind":"track","name":"Sessions II — Freedom","priceCents":150,"albumId":"album-sessions-ii","sourceFile":"Sessions II_01_Freedom.mp3"},"album-sessions-ii-track-3":{"kind":"track","name":"Sessions II — Silver Dollar","priceCents":150,"albumId":"album-sessions-ii","sourceFile":"Sessions II_03_Silver Dollar.mp3"},"album-sessions-ii-track-4":{"kind":"track","name":"Sessions II — Be Yourself","priceCents":150,"albumId":"album-sessions-ii","sourceFile":"Sessions II_04_Be Yourself (III).mp3"},"album-sessions-ii-track-5":{"kind":"track","name":"Sessions II — Soul Being","priceCents":150,"albumId":"album-sessions-ii","sourceFile":"Sessions II_05_Soul Being.mp3"},"album-sessions-ii-track-6":{"kind":"track","name":"Sessions II — Awake","priceCents":150,"albumId":"album-sessions-ii","sourceFile":"Sessions II_06_Awake.mp3"},"album-sessions-ii-track-7":{"kind":"track","name":"Sessions II — You Cant Change Me","priceCents":150,"albumId":"album-sessions-ii","sourceFile":"Sessions II_07_You Cant Change Me (II).mp3"},"album-sessions-i":{"kind":"album","name":"Sessions I · Complete Album","priceCents":800,"albumId":"album-sessions-i"},"album-sessions-i-track-1":{"kind":"track","name":"Sessions I — I=Energy","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_01_I=Energy (I).mp3"},"album-sessions-i-track-2":{"kind":"track","name":"Sessions I — Autonomy","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_02_Autonomy.mp3"},"album-sessions-i-track-3":{"kind":"track","name":"Sessions I — Redline","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_03_Redline.mp3"},"album-sessions-i-track-4":{"kind":"track","name":"Sessions I — Transport","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_04_Transport (III).mp3"},"album-sessions-i-track-5":{"kind":"track","name":"Sessions I — SunDay","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_05_SunDay.mp3"},"album-sessions-i-track-6":{"kind":"track","name":"Sessions I — Soul","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_06_Soul.mp3"},"album-sessions-i-track-7":{"kind":"track","name":"Sessions I — Grace","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_07_Grace.mp3"},"album-sessions-i-track-8":{"kind":"track","name":"Sessions I — Resurection","priceCents":150,"albumId":"album-sessions-i","sourceFile":"Sessions I_08_Resurection.mp3"},"album-live":{"kind":"album","name":"Live! · Complete Album","priceCents":900,"albumId":"album-live"},"album-live-track-2":{"kind":"track","name":"Live! — Intro - Prelude","priceCents":150,"albumId":"album-live","sourceFile":"Live_02_Intro - Prelude.mp3"},"album-live-track-4":{"kind":"track","name":"Live! — The Last Song","priceCents":150,"albumId":"album-live","sourceFile":"Live_04_The Last Song.mp3"},"album-live-track-6":{"kind":"track","name":"Live! — The Movement","priceCents":150,"albumId":"album-live","sourceFile":"Live_06_The Movement.mp3"},"album-live-track-8":{"kind":"track","name":"Live! — Autonomy","priceCents":150,"albumId":"album-live","sourceFile":"Live_08_Autonomy.mp3"},"album-live-track-9":{"kind":"track","name":"Live! — Be Yourself","priceCents":150,"albumId":"album-live","sourceFile":"Live_09_Be Yourself.mp3"},"album-live-track-10":{"kind":"track","name":"Live! — Running Man","priceCents":150,"albumId":"album-live","sourceFile":"Live_10_Running Man.mp3"},"album-live-track-11":{"kind":"track","name":"Live! — Automagic","priceCents":150,"albumId":"album-live","sourceFile":"Live_11_Automagic.mp3"},"album-live-track-12":{"kind":"track","name":"Live! — Darkroom","priceCents":150,"albumId":"album-live","sourceFile":"Live_12_Darkroom.mp3"},"album-live-track-13":{"kind":"track","name":"Live! — You Cant Change Me","priceCents":150,"albumId":"album-live","sourceFile":"Live_13_You Cant Change Me.mp3"},"album-trio":{"kind":"album","name":"Trio · Complete Album","priceCents":500,"albumId":"album-trio"},"album-trio-track-2":{"kind":"track","name":"Trio — Prelude","priceCents":150,"albumId":"album-trio","sourceFile":"Trio_02_Prelude (II).wav"},"album-trio-track-7":{"kind":"track","name":"Trio — CrystalBall","priceCents":150,"albumId":"album-trio","sourceFile":"Trio_07_CrystalBall(II).mp3"},"album-trio-track-8":{"kind":"track","name":"Trio — Running Man","priceCents":150,"albumId":"album-trio","sourceFile":"Trio_08_Running Man (II).mp3"},"album-trio-track-9":{"kind":"track","name":"Trio — Automagic","priceCents":150,"albumId":"album-trio","sourceFile":"Trio_09_Automagic(II).mp3"},"album-trio-track-18":{"kind":"track","name":"Trio — Teleportation","priceCents":150,"albumId":"album-trio","sourceFile":"Trio_18_Teleportation.mp3"},"album-singles":{"kind":"album","name":"Singles · Complete Album","priceCents":500,"albumId":"album-singles"},"album-singles-track-1":{"kind":"track","name":"Singles — The Journey","priceCents":150,"albumId":"album-singles","sourceFile":"Singles_01_The Journey.mp3"},"album-singles-track-2":{"kind":"track","name":"Singles — Crystal Ball","priceCents":150,"albumId":"album-singles","sourceFile":"Singles_Crystal Ball.mp3"},"album-singles-track-3":{"kind":"track","name":"Singles — I=Energy","priceCents":150,"albumId":"album-singles","sourceFile":"Singles_I=Energy.mp3"},"album-singles-track-4":{"kind":"track","name":"Singles — Meaning of Love","priceCents":150,"albumId":"album-singles","sourceFile":"Singles_Meaning of Love.mp3"},"album-singles-track-5":{"kind":"track","name":"Singles — Twisted (4hero Cover)","priceCents":150,"albumId":"album-singles","sourceFile":"Singles_Twisted (4hero Cover).mp3"},"tee-white":{"kind":"merch","name":"White GE T-Shirt","priceCents":3300},"tee-black":{"kind":"merch","name":"Black GE T-Shirt","priceCents":3300},"hat-blue":{"kind":"merch","name":"Blue GE Trucker Hat","priceCents":3300},"hat-black":{"kind":"merch","name":"Black GE Trucker Hat","priceCents":3300},"radio-forever":{"kind":"radio","name":"GE Radio · One-Time Access","priceCents":600}};
const CATALOG_VERSION=2;
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const ALLOWED_ORIGINS=new Set(["https://grandelement.com","https://www.grandelement.com"]);
function cors(origin) {return ALLOWED_ORIGINS.has(origin)?{"access-control-allow-origin":origin,"vary":"Origin","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type","access-control-max-age":"600"}:{"vary":"Origin"}}
function reply(data,status=200,origin=""){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(origin)}})}
function requestAllowed(req){const o=req.headers.get("Origin");return o&&ALLOWED_ORIGINS.has(o)}
function enabled(env){return env.PAYMENTS_ENABLED==="true"&&env.DELIVERY_AUDITED==="true"&&!!(env.DB&&env.BTCPAY_URL&&env.BTCPAY_STORE_ID&&env.BTCPAY_API_KEY&&env.BTCPAY_WEBHOOK_SECRET)}
function paidMethods(){return ["Bitcoin (on-chain)","Lightning (via the configured BTCPay store)"]}
function sanitizeItems(items,env){
 if(!Array.isArray(items)||!items.length||items.length>30)throw new Error("Choose between 1 and 30 products.");
 const used=new Set(),found=[],albums=new Set(),tracks=new Set();let totalCents=0;
 for(const x of items){
  if(!x||typeof x.id!=="string"||typeof x.qty!=="number"||!Number.isInteger(x.qty)||x.qty<1||x.qty>9||used.has(x.id+"|"+(x.fit||"")+"|"+(x.size||"")))throw new Error("Invalid item or quantity.");
  const p=SKUS[x.id];if(!p)throw new Error("Unknown or unavailable item.");
  const fit=typeof x.fit==="string"?x.fit:"",size=typeof x.size==="string"?x.size:"";
  if(fit.length>48||size.length>8)throw new Error("Invalid size/fit.");
  if(p.kind==="merch"){
   if(env.MERCH_CHECKOUT_READY!=="true")throw new Error("Merchandise payments are not yet enabled: shipping, tax and supplier fulfillment must be configured.");
   if(!["tee-white","tee-black","hat-blue","hat-black"].includes(x.id))throw new Error("Product not available.");
   if(x.id.startsWith("tee-")&&(!["XS","S","M","L","XL","2XL","3XL"].includes(size)||!["Unisex / Men's","Women's"].includes(fit)))throw new Error("Select a valid T-shirt fit and size.");
   if(x.id.startsWith("hat-")&&fit!=="Adjustable · One Size")throw new Error("Select a valid hat size.");
  } else {
   if(fit||size)throw new Error("Unexpected options on music or radio.");
   if(x.qty!==1)throw new Error("Music and radio purchases may appear only once per order.");
   if(p.kind==="radio"&&env.RADIO_ACCESS_READY!=="true")throw new Error("Radio activation is not yet connected.");
   if(["album","track"].includes(p.kind)&&env.DIGITAL_DELIVERY_READY!=="true")throw new Error("Paid music delivery is not yet connected.");
   if(x.id==="album-singles-track-5"&&env.COVER_LICENSE_VERIFIED!=="true")throw new Error("This recording requires rights review before sale.");
  }
  if(p.kind==="album")albums.add(p.albumId);if(p.kind==="track")tracks.add(p.albumId);
  used.add(x.id+"|"+fit+"|"+size);
  const cents=p.priceCents*x.qty;totalCents+=cents;
  found.push({id:x.id,name:p.name,qty:x.qty,fit,size,unitCents:p.priceCents,totalCents:cents});
 }
 if([...albums].some(x=>tracks.has(x)))throw new Error("Do not buy the same album and tracks from it in one order.");
 if(totalCents<100||totalCents>250000)throw new Error("Order amount out of range.");
 return {items:found,totalCents};
}
function secureToken(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
async function digest(s){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")}
function checkInvoiceUrl(str,env){const actual=new URL(str),expected=new URL(env.BTCPAY_URL);if(expected.protocol!=="https:"||actual.protocol!=="https:"||actual.origin!==expected.origin||!actual.pathname.startsWith("/i/"))throw new Error("Unexpected payment URL from payment provider");return actual.href}
async function createOrder(req,env,origin){
 if(!enabled(env))return reply({error:"Payments are not active. Complete BTCPay, wallet and delivery setup before accepting orders."},503,origin);
 const len=Number(req.headers.get("content-length")||0);if(len>12000)return reply({error:"Order too large"},413,origin);
 let input;try{input=await req.json()}catch{return reply({error:"Invalid JSON"},400,origin)}
 let items,totalCents;try{({items,totalCents}=sanitizeItems(input.items,env))}catch(e){return reply({error:e.message},400,origin)}
 const email=typeof input.email==="string"?input.email.trim():"";
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return reply({error:"A valid receipt email is required."},400,origin);
 if(items.some(x=>SKUS[x.id].kind==="merch"))return reply({error:"Merchandise checkout must calculate address-based shipping and taxes before it can accept payment."},503,origin);
 const id=crypto.randomUUID(),token=secureToken(),tokenHash=await digest(token),now=new Date().toISOString(),money=(totalCents/100).toFixed(2);
 await env.DB.prepare("INSERT INTO orders (id,created_at,updated_at,status,currency,total_cents,email,items_json,access_hash) VALUES (?,?,?,'initializing','USD',?,?,?,?)").bind(id,now,now,totalCents,email,JSON.stringify(items),tokenHash).run();
 try{
  const target=new URL(env.BTCPAY_URL);if(target.protocol!=="https:")throw new Error("BTCPay URL must use HTTPS");
  const api=new URL("/api/v1/stores/"+encodeURIComponent(env.BTCPAY_STORE_ID)+"/invoices",target);
  const response=await fetch(api.toString(),{method:"POST",headers:{"Authorization":"token "+env.BTCPAY_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({amount:money,currency:"USD",metadata:{orderId:id,buyerEmail:email}}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("BTCPay API returned "+response.status);
  const invoice=await response.json();
  if(!invoice.id||!invoice.checkoutLink)throw new Error("Missing provider invoice fields");
  const checkoutUrl=checkInvoiceUrl(invoice.checkoutLink,env);
  await env.DB.prepare("UPDATE orders SET status='awaiting_payment',invoice_id=?,checkout_url=?,updated_at=? WHERE id=?").bind(String(invoice.id),checkoutUrl,new Date().toISOString(),id).run();
  return reply({orderId:id,accessToken:token,checkoutUrl,paymentMethods:paidMethods(),totalCents},201,origin);
 }catch(e){
  await env.DB.prepare("UPDATE orders SET status='setup_error',updated_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
  return reply({error:"Unable to start the payment invoice. No charge has been made."},502,origin);
 }
}
function signatureEqual(a,b){if(a.length!==b.length)return false;let bad=0;for(let i=0;i<a.length;i++)bad|=a.charCodeAt(i)^b.charCodeAt(i);return bad===0}
async function verifyWebhook(raw,sig,secret){
 if(!/^sha256=[a-f0-9]{64}$/.test(sig||""))return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=await crypto.subtle.sign("HMAC",key,raw);const hex=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
 return signatureEqual(sig,"sha256="+hex);
}
async function fetchProviderInvoice(id,env){
 const url=new URL("/api/v1/stores/"+encodeURIComponent(env.BTCPAY_STORE_ID)+"/invoices/"+encodeURIComponent(id),env.BTCPAY_URL);
 const r=await fetch(url.toString(),{headers:{"Authorization":"token "+env.BTCPAY_API_KEY},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error("Provider invoice lookup failed");return r.json();
}
async function webhook(req,env){
 if(!env.DB||!env.BTCPAY_WEBHOOK_SECRET||!env.BTCPAY_STORE_ID||!env.BTCPAY_URL||!env.BTCPAY_API_KEY)return reply({error:"Unconfigured"},503);
 if(Number(req.headers.get("content-length")||0)>20000)return reply({error:"Too large"},413);
 const bytes=await req.arrayBuffer();
 if(bytes.byteLength>20000)return reply({error:"Too large"},413);
 if(!await verifyWebhook(bytes,req.headers.get("BTCPay-Sig"),env.BTCPAY_WEBHOOK_SECRET))return reply({error:"Invalid webhook signature"},401);
 let event;try{event=JSON.parse(new TextDecoder().decode(bytes))}catch{return reply({error:"Malformed payload"},400)}
 if(!event.invoiceId||event.storeId!==env.BTCPAY_STORE_ID)return reply({error:"Invalid invoice/store"},400);
 const row=await env.DB.prepare("SELECT id,status,total_cents FROM orders WHERE invoice_id=?").bind(String(event.invoiceId)).first();
 if(!row)return reply({error:"Unknown invoice"},404);
 const invoice=await fetchProviderInvoice(String(event.invoiceId),env);
 if(String(invoice.id)!==String(event.invoiceId)||String(invoice.storeId)!==String(env.BTCPAY_STORE_ID))return reply({error:"Invoice mismatch"},409);
 if(Number(Math.round(Number(invoice.amount)*100))!==row.total_cents||invoice.currency!=="USD")return reply({error:"Invoice amount mismatch"},409);
 const current=String(invoice.status);
 const status=current==="Settled"?"paid_unfulfilled":current==="Expired"?"expired":current==="Invalid"?"invalid":current==="Processing"?"processing":"awaiting_payment";
 // Never regress a confirmed order or treat merely broadcast/processing funds as delivered.
 if(row.status==="paid_unfulfilled"||row.status==="fulfilled")return reply({ok:true});
 await env.DB.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").bind(status,new Date().toISOString(),row.id).run();
 // Fulfillment is deliberately NOT performed here: wire an audited idempotent worker first.
 return reply({ok:true});
}
async function orderStatus(req,env,origin,url){
 if(!env.DB)return reply({error:"Not configured"},503,origin);
 const id=url.searchParams.get("id"),token=req.headers.get("x-order-token")||url.searchParams.get("token");
 if(!id||!token||!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f]{64}$/i.test(token))return reply({error:"Missing order access"},401,origin);
 const row=await env.DB.prepare("SELECT id,status,total_cents,access_hash FROM orders WHERE id=?").bind(id).first();
 if(!row||!signatureEqual(row.access_hash,await digest(token)))return reply({error:"Order not found"},404,origin);
 return reply({orderId:row.id,status:row.status,totalCents:row.total_cents},200,origin);
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get("Origin")||"";
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(url.pathname==="/health"&&request.method==="GET")return reply({service:"GE Studios BTCPay Checkout",ready:enabled(env),catalogVersion:CATALOG_VERSION,paymentMethods:enabled(env)?paidMethods():[]},200,origin);
 if(url.pathname==="/webhooks/btcpay"&&request.method==="POST")return webhook(request,env);
 if(!requestAllowed(request))return reply({error:"Origin not allowed"},403,origin);
 if(url.pathname==="/checkout"&&request.method==="POST")return createOrder(request,env,origin);
 if(url.pathname==="/order"&&request.method==="GET")return orderStatus(request,env,origin,url);
 return reply({error:"Not found"},404,origin);
}};
