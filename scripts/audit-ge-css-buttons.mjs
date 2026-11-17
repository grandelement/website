import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read=file=>readFileSync(file,'utf8');
const pages=['index.html','backroom/index.html','radio/index.html'];
const reports=[];
for(const file of pages){
 const src=read(file);
 const styles=[...src.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)];
 const styleContents=styles.map(m=>m[1]);
 const important=styleContents.reduce((n,x)=>n+(x.match(/!important/gi)||[]).length,0);
 const linked=[...src.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)]
   .map(m=>(m[0].match(/\bhref=["']([^"']+)["']/i)||[])[1])
   .filter(Boolean).filter(url=>!/^https?:|^\/\//i.test(url));
 const missing=linked.filter(url=>{
   const clean=url.split(/[?#]/)[0].replace(/^\.\//,'');
   return !existsSync(path.join(path.dirname(file),clean));
 });
 // Inline HTML ID uniqueness, without mistaking JavaScript template strings for
 // actual mounted elements. Runtime-created controls are audited by browser QA.
 const markup=src.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
                 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
 const ids=[...markup.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]);
 const idCount=new Map();ids.forEach(id=>idCount.set(id,(idCount.get(id)||0)+1));
 const duplicateIds=[...idCount.entries()].filter(([,n])=>n>1).map(([id,count])=>({id,count})).slice(0,40);
 const css=styleContents.join('\n');
 const navSelectorMatches=(css.match(/#backroomMain\s+\.backroomTabs\s*\{/g)||[]).length;
 const report={file,styleBlocks:styles.length,importantDeclarations:important,
   linkedStylesheets:linked.length,missingStylesheets:missing,duplicateStaticIds:duplicateIds,
   backroomNavDefinitionCount:navSelectorMatches};
 reports.push(report);
}
const back=read('backroom/index.html'),publisher=read('backroom/publisher-worker.js');
const save=read('backroom/save-center.js'),css=read('backroom/save-center.css');
const critical={
 navButton:back.includes('id="brTopSave"'),
 navigationHandler:save.includes("button.addEventListener('click',selectedSave)"),
 scopedGithubPublisher:publisher.includes("'/manage/public-settings'")&&
  publisher.includes('GE_PUBLIC_SAVE_PATHS'),
 publicGitHubReadback:back.includes("api('/manage/public-settings'")&&
  back.includes('GitHub commit'),
 radioRouting:save.includes("trigger('brRouteSave'"),
 accessVault:save.includes("trigger(existing?'brAccessSave':'brAccessIssue'"),
 fanVault:save.includes("current==='fans'"),
 merchRoute:publisher.includes("'/manage/merchandise'"),
 originalBlitz:back.includes("geDJApi('/control/playlists'"),
 cssFileLoaded:back.includes('save-center.css'),
 jsFileLoaded:back.includes('save-center.js'),
 newStyleScoped:css.includes('#backroomMain #backroomTabs > #brTopSave') && css.includes('grid-template-columns:repeat(4,minmax(0,1fr))')
};
const result={reports,critical};
console.log('GE SITE CSS / BUTTON AUDIT',JSON.stringify(result,null,2));
for(const [key,pass]of Object.entries(critical))assert.equal(pass,true,'Critical routing contract missing: '+key);
for(const report of reports){
 assert.equal(report.missingStylesheets.length,0,'Missing CSS assets on '+report.file);
}
console.log('PASS: all new central SAVE source and destination connections exist and linked CSS assets resolve. Legacy repeated selectors are reported, not automatically deleted.');
