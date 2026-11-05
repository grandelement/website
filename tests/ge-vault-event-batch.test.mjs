import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../vault-worker/src/index.js';

globalThis.crypto ||= webcrypto;
const rows=[];
const db={
 prepare(sql){
  return {bind(...params){
   return {
    async first(){return {n:rows.length}},
    async run(){rows.push({sql,params});return {success:true}}
   };
  }};
 }
};
const env={VAULT_DB:db,ALLOWED_ORIGINS:'https://grandelement.com'};
const url='https://vault.grandelement.com/v1/public/events';
const user='GE-anonymous-test-1234567890';
const session='GE-session-1234567890';
const event=(label,i)=>({
 anon_id:user,session_id:session,surface:'radio',event_type:label,
 page_path:'/radio/',client_event_id:'ev-00000000-0000-4000-9000-'+String(i).padStart(12,'0'),
 metadata:{test:true}
});
const post=events=>worker.fetch(new Request(url,{method:'POST',headers:{
 'content-type':'application/json','origin':'https://grandelement.com'
},body:JSON.stringify({events})}),env);
let r=await post([event('page_view',1),event('track_start',2)]);
let body=await r.json();
assert.equal(r.status,201);
assert.equal(body.accepted,2);
assert.equal(rows.length,2,'Both analytics events must be persisted');
assert.ok(rows.every(x=>x.sql.includes('ON CONFLICT(id) DO NOTHING')),
 'Batch inserts must be idempotent for safe retry');
assert.ok(rows.every(x=>String(x.params[0]).startsWith('event-ev-')),
 'Event IDs must be stable across repeated delivery');
assert.equal(r.headers.get('access-control-allow-origin'),'https://grandelement.com');

r=await post([]);
assert.equal(r.status,400,'Empty batch must fail');
r=await post(Array.from({length:26},(_,i)=>event('page_view',i+3)));
assert.equal(r.status,400,'Oversized batch must fail');
r=await post([event('page_view',3),{...event('track_start',4),client_event_id:event('page_view',3).client_event_id}]);
assert.equal(r.status,400,'Duplicate client event IDs must fail');
r=await post([event('page_view',5),{...event('track_start',6),event_type:'gate_unlock_me'}]);
assert.equal(r.status,400,'Unknown event types must fail');
r=await post([event('page_view',7),{...event('track_start',8),anon_id:'Other_anonymous_1234567890'}]);
assert.equal(r.status,400,'Mixed fan identities must fail');
assert.equal(rows.length,2,'Invalid requests must never create partial events');

// The original individual event endpoint remains operational.
r=await worker.fetch(new Request('https://vault.grandelement.com/v1/public/event',{
 method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({...event('radio_open',9),client_event_id:undefined})
}),env);
assert.equal(r.status,201);
assert.equal(rows.length,3);

console.log('PASS: batch analytics stores intact events, validates 1-25, stable IDs, protected from mixed IDs and invalid types; old event endpoint unchanged.');
