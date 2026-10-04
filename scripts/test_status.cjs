const assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../src/status.js'),A=require('../src/archive.js');
const data=JSON.parse(fs.readFileSync('dist/dashboard/catalog.json','utf8'));
const items=data.statusSnapshot.items;
assert.equal(items.length,8);assert.equal(S.filter(items).length,8);
const fixture=['running','running','waiting','blocked','round_complete'].map((state,i)=>({id:String(i),state}));
assert.deepEqual(S.counts(fixture),{running:2,waiting:1,blocked:1,round_complete:1});
assert.deepEqual(S.filter(fixture,'waiting').map(x=>x.id),['2']);
assert.equal(Object.values(S.counts(items)).reduce((a,b)=>a+b,0),items.length,'Every current task appears in exactly one status count');
for(const item of items){assert(Object.hasOwn(S.labels,item.state));assert(item.contextMessageIds.length);assert(item.verification.summary);assert(!Object.hasOwn(item,'evidenceMessageIds'));}
const at='2026-10-03T16:00:00Z',stamp=Date.parse(at);
assert.equal(S.freshness(at,stamp+29*60000).kind,'fresh');assert.equal(S.freshness(at,stamp+30*60000).kind,'stale');
assert.equal(S.freshness(at,stamp-3*60000).kind,'clock_error');assert.equal(S.freshness('invalid',stamp).kind,'unknown');
const kept=JSON.stringify(items);S.freshness(items[0].verifiedAt,stamp+86400000);assert.equal(JSON.stringify(items),kept,'Age display must never advance task evidence');
const base={id:'test',role:'user',time:'2026-10-03T09:00:00Z',text:'Paper 论文；FarmSystemDesign 海南地图'};
assert(A.matches(base,{q:'paper 论文',role:'user',from:'2026-10-03',to:'2026-10-03',project:'paper'}));
for(const s of [{q:'paper missing'},{role:'assistant'},{from:'2026-10-04'},{to:'2026-10-02'},{project:'income'}])assert(!A.matches(base,s));
assert(A.matches(base,{project:'farm'}));
assert(A.matches({...base,time:'2026-10-02T23:30:00-05:00'},{from:'2026-10-03',to:'2026-10-03'}),'Date filters normalize offsets to UTC');
assert(!A.matches({...base,time:'unknown'},{from:'2026-10-03'}),'Unknown dates do not pass a date range');
assert(A.matches({...base,text:''},{}),'Empty visible messages remain available');
assert(!A.matches({...base,text:''},{project:'paper'}));
const chat=JSON.parse(fs.readFileSync('data/dot-chat.json','utf8'));
const integrity=JSON.parse(fs.readFileSync('data/chat-integrity.json','utf8'));assert.equal(chat.messages.length,integrity.approvedMessageCount);assert.equal(data.statusSnapshot.coverage.nonemptyCount,chat.messages.filter(x=>x.text).length);
const dayMessages=chat.messages.filter(m=>new Date(m.time).toISOString().slice(0,10)==='2026-10-03');assert.deepEqual(chat.messages.filter(m=>A.matches(m,{from:'2026-10-03',to:'2026-10-03'})).map(m=>m.id),dayMessages.map(m=>m.id),'UTC filter must return the exact source messages');
assert.equal(chat.coverage.readApiHistoryExhausted,false);
console.log('PASS: snapshot states, publication/completion separation, empty status, date/project/role/AND searches and preserved empty messages');

assert.equal(A.messageId('#Sentinel_abc123'),'Sentinel_abc123');assert.equal(A.messageId('#%53entinel_abc123'),'Sentinel_abc123');for(const value of ['#%E0%A4%A','#<img>','#Sentinel_bad/path','#query',''])assert.equal(A.messageId(value),null);
