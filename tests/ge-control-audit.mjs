import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const base=process.env.GE_SITE_URL||'https://grandelement.com';
const routes=['/','/radio/','/radio/preview-lab.html'];
const viewports=[{name:'desktop',width:1365,height:900},{name:'mobile',width:390,height:844}];
const report={generated:new Date().toISOString(),base,inventory:[],errors:[],warnings:[],links:[]};
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const checkedLinks=new Set();
for(const viewport of viewports){
 const page=await browser.newPage();await page.setViewport(viewport);
 page.on('pageerror',e=>report.errors.push({viewport:viewport.name,error:e.message}));
 for(const route of routes){
  const url=new URL(route,base).href;
  try{
   const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   if(!res||res.status()>=400){report.errors.push({url,status:res?.status()??'no response'});continue;}
   await new Promise(r=>setTimeout(r,1500));
   const snapshot=await page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    const controls=[...document.querySelectorAll('button,[role="button"],input,select,textarea,a[href]')];
    return {overflow:document.documentElement.scrollWidth>innerWidth+12,controls:controls.map((el,i)=>({
     key:el.id||el.getAttribute('name')||el.getAttribute('aria-label')||el.textContent?.trim().slice(0,60)||el.tagName.toLowerCase()+'-'+i,
     tag:el.tagName.toLowerCase(),label:el.getAttribute('aria-label')||el.innerText?.trim().slice(0,90)||el.getAttribute('title')||'',
     href:el.href||null,visible:visible(el),disabled:!!el.disabled,
     inlineHandler:!!el.getAttribute('onclick'),type:el.type||null
    }))};
   });
   if(snapshot.overflow)report.warnings.push({url,viewport:viewport.name,issue:'horizontal overflow'});
   for(const c of snapshot.controls){
    report.inventory.push({route,viewport:viewport.name,...c});
    if(c.visible&&!c.label&&c.tag==='button')report.warnings.push({url,viewport:viewport.name,control:c.key,issue:'visible unlabeled button'});
    if(c.href&&new URL(c.href).origin===new URL(base).origin&&/^https?:/.test(c.href))checkedLinks.add(c.href);
   }
  }catch(e){report.errors.push({url,viewport:viewport.name,error:e.message});}
 }
 await page.close();
}
for(const url of checkedLinks){
 try{const res=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(12000)});report.links.push({url,status:res.status});if(res.status>=400)report.errors.push({url,issue:'dead internal link',status:res.status});}
 catch(e){report.warnings.push({url,issue:'link verification inconclusive',error:e.message});}
}
await browser.close();
fs.mkdirSync('ge-audit',{recursive:true});
fs.writeFileSync('ge-audit/control-inventory.json',JSON.stringify(report,null,2));
const rows=['# GE Control Audit',`Generated: ${report.generated}`,`Pages: ${routes.join(', ')}`,`Controls inventoried across viewports: ${report.inventory.length}`,`Internal links checked: ${report.links.length}`,`Errors: ${report.errors.length}; warnings: ${report.warnings.length}`,'','## Failures',...report.errors.map(x=>'- '+JSON.stringify(x)),'','## Warnings',...report.warnings.map(x=>'- '+JSON.stringify(x)),'','## Control inventory','| Page | Device | Control | Type | Visible | Disabled |','|---|---|---|---|---|---|',...report.inventory.map(x=>`| ${x.route} | ${x.viewport} | ${String(x.key).replaceAll('|','/')} | ${x.tag} | ${x.visible} | ${x.disabled} |`)];
fs.writeFileSync('ge-audit/control-audit.md',rows.join('\n'));
console.log(JSON.stringify({controls:report.inventory.length,links:report.links.length,errors:report.errors.length,warnings:report.warnings.length}));
if(report.errors.length)process.exitCode=1;
