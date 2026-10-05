import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ui=process.env.CREATOR_UI_DIR||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const core=process.env.CREATOR_CORE_DIR||path.join(ui,'core');
const {createController,compactPayload,routeHash,parseRoute,calendarCells,parseNullableNumber,utcOffsetIso,matchWork,trendPoints,safeExternalUrl}=await import(pathToFileURL(path.join(ui,'controller.mjs')));
const {createMemoryStore}=await import(pathToFileURL(path.join(core,'store.mjs')));
const {createWorkspace,readiness,selectWorkspace,metricDelta}=await import(pathToFileURL(path.join(core,'core.mjs')));

test('routes retain safe opaque IDs and never contain title/body/account values',()=>{
  for(const id of ['work-uuid-123','work:abc','work.foo','a'.repeat(160)])assert.deepEqual(parseRoute(routeHash('production',id)),{view:'production',workId:id});
  assert.equal(routeHash('unknown','secret title/body'),'#view=desk');
  assert.deepEqual(parseRoute('#view=library&work=abc&title=private'),{view:'library',workId:'abc'});
  for(const reserved of ['__proto__','constructor','prototype','toString'])assert.equal(parseRoute(`#view=ideas&work=${reserved}`).workId,null);
});
test('safe URLs reject executable schemes and embedded credentials',()=>{
  assert.equal(safeExternalUrl('javascript:alert(1)'),null);assert.equal(safeExternalUrl('data:text/html,test'),null);assert.equal(safeExternalUrl('https://u:p@example.com'),null);
  assert.equal(safeExternalUrl('https://example.com/a'),'https://example.com/a');
});
test('unknown numeric inputs, explicit offsets and leap-month dates are preserved',()=>{
  assert.equal(parseNullableNumber(''),null);assert.equal(parseNullableNumber('0'),0);assert.equal(parseNullableNumber('160'),160);assert.throws(()=>parseNullableNumber('-1'));
  assert.equal(utcOffsetIso('2026-10-05T18:00','+08:00'),'2026-10-05T18:00:00+08:00');assert.throws(()=>utcOffsetIso('2026-10-05T18:00',''));
  assert.equal(calendarCells('2028-02').filter(Boolean).length,29);assert.equal(calendarCells('bad').length,0);
  assert.deepEqual(trendPoints([{value:0},{value:null},{value:160}]).map(p=>p===null?null:Math.round(p.y)),[104,null,18]);
});
test('strict core accepts UI optional fields only after recursive omission',async()=>{
  const c=createController(createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'})}));await c.init();
  const result=await c.action('captureIdea',{title:'虚构选题',angle:'自己的角度',references:[{title:undefined,url:'https://example.com/reference',analysis:''}]});
  assert.ok(result.result.workId);assert.deepEqual(compactPayload({a:undefined,b:null,c:[{x:undefined,y:0}]}),{b:null,c:[{y:0}]});c.close();
});
test('save waits for commit; duplicate submissions share one committed operation',async()=>{
  let release;const gate=new Promise(r=>release=r);let writes=0;
  const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'}),failWrite:async()=>{writes++;await gate}});
  const c=createController(store);await c.init();let notifications=0;c.subscribe(()=>notifications++);
  c.buffer('new',{title:''});c.edit('new','title','Buffered title');
  const a=c.execute('new','captureIdea',{title:'Buffered title'}),b=c.execute('new','captureIdea',{title:'Buffered title'});
  await new Promise(r=>setImmediate(r));assert.equal(c.state.revision,0);assert.equal(notifications,0);assert.equal(c.buffers.get('new').values.title,'Buffered title');
  release();await Promise.all([a,b]);assert.equal(writes,1);assert.equal(Object.keys(c.state.works).length,1);assert.equal(c.buffers.has('new'),false);c.close();
});
test('quota failure retains all editor text and exact retry envelope',async()=>{
  let fail=true;const attempted=[];const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'}),failWrite:()=>{if(fail){const e=new Error('quota');e.name='QuotaExceededError';throw e}}});
  const dispatch=store.dispatch;store.dispatch=c=>{attempted.push(structuredClone(c));return dispatch(c)};
  const c=createController(store);await c.init();c.buffer('idea',{title:'',angle:''});c.edit('idea','title','Long title');c.edit('idea','angle','No content loss');
  await assert.rejects(c.execute('idea','captureIdea',{title:'Long title',angle:'No content loss'}),{code:'STORAGE_QUOTA'});
  assert.equal(c.state.revision,0);assert.deepEqual(c.buffers.get('idea').values,{title:'Long title',angle:'No content loss'});
  fail=false;await c.execute('idea','captureIdea',{title:'Long title',angle:'No content loss'});assert.deepEqual(attempted[0],attempted[1]);c.close();
});
test('subscription updates never overwrite dirty draft, stale version requires explicit rebase',async()=>{
  const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'})}),c=createController(store);await c.init();
  const created=await c.action('captureIdea',{title:'One',angle:'Angle'}),id=created.result.workId;
  await c.action('startProduction',{workId:id});c.buffer('draft',{body:'old'});c.edit('draft','body','unsaved private test body');
  const before=c.buffers.get('draft').baseRevision;
  await store.dispatch({type:'saveDraft',payload:{workId:id,body:'Other tab body'},operationId:'external-op',expectedRevision:c.state.revision});
  c.buffer('draft',{body:'Other tab body'});assert.equal(c.buffers.get('draft').values.body,'unsaved private test body');assert.equal(c.buffers.get('draft').baseRevision,before);
  assert.throws(()=>c.rebase('draft',before),{code:'STALE_REVISION'});
  await assert.rejects(c.execute('draft','saveDraft',{workId:id,body:'unsaved private test body'}),{code:'STALE_REVISION'});
  assert.equal(Object.values(c.state.drafts).at(-1).body,'Other tab body');c.rebase('draft');await c.execute('draft','saveDraft',{workId:id,body:'unsaved private test body'});
  assert.equal(Object.values(c.state.drafts).length,2);c.close();
});
test('actual UI controller payloads complete six-module loop and preserve one work across accounts',async()=>{
  const c=createController(createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'})}));await c.init();const act=(type,payload)=>c.action(type,payload);
  const a=(await act('createAccount',{displayName:'Demo A',platform:'Demo Platform'})).result.accountId;
  const b=(await act('createAccount',{displayName:'Demo B',platform:'Demo Platform'})).result.accountId;
  await act('setGoal',{goalId:undefined,month:'2026-10',timeZone:'Asia/Shanghai',metric:'publications',target:2,accountId:null});
  const workId=(await act('captureIdea',{title:'Sample',angle:'Independent angle',references:[{url:undefined,title:'Offline source',analysis:'Notes'}]})).result.workId;
  await act('startProduction',{workId,contentType:'video'});await act('startProduction',{workId,contentType:'video'});
  await act('saveDraft',{workId,title:'Final title',body:'Draft body <script> remains text'});
  for(const task of Object.values(c.state.tasks))await act('setTaskState',{workId,taskId:task.id,status:'done',reason:''});
  await act('setReady',{workId});assert.equal(readiness(c.state,workId).ready,true);
  const schedule=(await act('setSchedule',{workId,accountId:a,publicationId:undefined,schedule:{date:'2026-10-06',time:'18:00',timeZone:'Asia/Shanghai',allDay:false,offsetMinutes:undefined}})).result.publicationId;
  await act('setSchedule',{workId,accountId:b,publicationId:undefined,schedule:{date:'2026-10-07',timeZone:'Asia/Shanghai',allDay:true}});
  await act('recordPublication',{workId,accountId:a,publicationId:schedule,actualPublishedAt:'2026-10-06T18:04:00+08:00',publicUrl:'https://example.com/demo/a',finalRevisionId:undefined});
  const pubB=Object.values(c.state.publications).find(p=>p.accountId===b);assert.equal(pubB.status,'planned');assert.equal(Object.keys(c.state.works).length,1);
  for(const [value,at]of [[100,'2026-10-07T18:00:00+08:00'],[160,'2026-10-08T18:00:00+08:00']])await act('appendMetrics',{snapshots:[{publicationId:schedule,metricKey:'views',value,definition:'platform cumulative views',observedAt:at,sourceRef:'Synthetic manual'}]});
  assert.equal(metricDelta(c.state,{publicationId:schedule,metricKey:'views',definition:'platform cumulative views'}).value,60);
  const reviewId=(await act('saveReview',{workId,observation:'100 to 160',hypothesis:'Unverified idea',nextExperiment:'Try another title',evidenceMetricIds:Object.keys(c.state.metrics)})).result.reviewId;
  const followup=(await act('deriveFollowupIdea',{reviewId,title:'Next sample'})).result.workId;assert.equal(c.state.works[followup].parentWorkId,workId);
  await act('addAsset',{workId,name:'demo.mp4',mimeType:undefined,size:undefined,url:undefined,sha256:undefined});
  assert.equal(matchWork(c.state.works[workId],c.state,'<script>'),true);
  const latest=selectWorkspace(c.state,{month:'2026-10',timeZone:'Asia/Shanghai',asOf:'2026-10-09T00:00:00+08:00'}).metricGroups.find(g=>g.metricKey==='views');assert.equal(latest.value,160);c.close();
});
