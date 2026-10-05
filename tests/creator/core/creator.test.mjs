import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const base=process.env.CREATOR_CORE_DIR?pathToFileURL(resolve(process.env.CREATOR_CORE_DIR)+'/'):new URL('../',import.meta.url);
const {COLLECTIONS,createWorkspace,applyCommand,readiness,selectWorkspace,latestMetrics,metricDelta,resolveSchedule,canonical}=await import(new URL('core.mjs',base));
const {createMemoryStore,createIndexedDBStore,storagePolicy}=await import(new URL('store.mjs',base));
const {exportPackage,previewImport,prepareImport,validatePackage,sha256,relationsFor}=await import(new URL('exchange.mjs',base));
const {previewMetricsCsv,exportMetricsCsv}=await import(new URL('csv.mjs',base));
const {seedDemo}=await import(new URL('fixtures.mjs',base));
import {createTestIndexedDB} from './test-idb-driver.mjs';

const NOW='2026-10-05T01:00:00Z';
const makeId=()=>{let n=0;return prefix=>`${prefix}_${++n}`;};
function makeState(){let state=createWorkspace({id:'workspace-test',now:NOW});const idFactory=makeId();let n=0;return {get state(){return state;},set state(s){state=s;},run(type,payload={},options={}){const out=applyCommand(state,{type,payload,operationId:options.operationId||`op-${++n}`,expectedRevision:options.expectedRevision??state.revision},{now:options.now||NOW,idFactory});state=out.state;return out.result;}};}
function chain(){
  const h=makeState();const accountId=h.run('createAccount',{displayName:'虚构甲',platform:'演示甲'}).accountId;
  const workId=h.run('captureIdea',{title:'虚构作品',angle:'独立切入点',references:[{url:'https://example.com/ref',analysis:'只存拆解'}]}).workId;
  const taskIds=h.run('startProduction',{workId}).taskIds;
  const draftId=h.run('saveDraft',{workId,body:'合成稿件版本一'}).draftId;
  for(const taskId of taskIds)h.run('setTaskState',{workId,taskId,status:'done'});
  h.run('setReady',{workId});
  const publicationId=h.run('recordPublication',{workId,accountId,actualPublishedAt:'2026-09-30T23:30:00Z',publicUrl:'https://example.com/published'}).publicationId;
  return {h,accountId,workId,taskIds,draftId,publicationId};
}
const expectCode=code=>error=>error?.code===code;
async function rehash(pkg){for(const r of pkg.records)r.hash=await sha256(canonical(r.entity));pkg.relations=pkg.records.flatMap(r=>relationsFor(r.collection,r.id,r.entity));delete pkg.packageHash;pkg.packageHash=await sha256(canonical(pkg));return pkg;}

test('complete chain has one stable work, immutable drafts and two publication snapshots',()=>{
  const {h,workId,accountId,draftId,publicationId}=chain();
  const account2=h.run('createAccount',{displayName:'虚构乙',platform:'演示乙'}).accountId;
  h.run('recordPublication',{workId,accountId:account2,actualPublishedAt:'2026-10-01T12:00:00Z',publicUrl:'https://example.com/second'});
  assert.equal(Object.keys(h.state.works).length,1);assert.equal(Object.keys(h.state.publications).length,2);
  h.run('saveDraft',{workId,body:'合成稿件版本二'});assert.equal(h.state.drafts[draftId].body,'合成稿件版本一');assert.equal(h.state.publications[publicationId].finalSnapshot.body,'合成稿件版本一');
  assert.equal(h.state.works[workId].phase,'producing');assert.equal(readiness(h.state,workId).ready,false);
  const metrics=h.run('appendMetrics',{snapshots:[{publicationId,metricKey:'views',value:100,observedAt:'2026-10-02T00:00:00Z'},{publicationId,metricKey:'views',value:160,observedAt:'2026-10-03T00:00:00Z'},{accountId,metricKey:'followers',value:200,observedAt:'2026-10-03T00:00:00Z'}]}).metricIds;
  const reviewId=h.run('saveReview',{workId,observation:'100 到160',nextExperiment:'改变开头',evidenceMetricIds:metrics.slice(0,2)}).reviewId;
  const followup=h.run('deriveFollowupIdea',{reviewId,title:'后续选题'}).workId;
  assert.notEqual(workId,followup);assert.equal(h.state.works[followup].parentWorkId,workId);assert.equal(h.run('deriveFollowupIdea',{reviewId,title:'重复点击'}).workId,followup);
  assert.equal(metricDelta(h.state,{publicationId,metricKey:'views'}).value,60);
});
test('idempotency, stale revisions, same-title identities and template readiness',()=>{
  const h=makeState();assert.throws(()=>h.run('captureIdea',{title:''}),expectCode('VALIDATION'));
  const first=h.run('captureIdea',{title:'同名',angle:'角度'},{operationId:'capture-repeat'}).workId;
  const revision=h.state.revision;assert.equal(h.run('captureIdea',{title:'同名',angle:'角度'},{operationId:'capture-repeat',expectedRevision:0}).workId,first);assert.equal(h.state.revision,revision);
  assert.throws(()=>h.run('captureIdea',{title:'不同'},{operationId:'capture-repeat'}),expectCode('OPERATION_ID_REUSED'));
  assert.throws(()=>h.run('captureIdea',{title:'同名'},{expectedRevision:0}),expectCode('STALE_REVISION'));
  assert.notEqual(h.run('captureIdea',{title:'同名'}).workId,first);
  const start=h.run('startProduction',{workId:first,contentType:'text'});assert.equal(start.taskIds.length,4);assert.deepEqual(h.run('startProduction',{workId:first}).taskIds,start.taskIds);
  assert.throws(()=>h.run('setTaskState',{workId:first,taskId:start.taskIds[0],status:'blocked'}),expectCode('VALIDATION'));
  h.run('setTaskState',{workId:first,taskId:start.taskIds[0],status:'na',reason:'本例不需要提纲'});
  assert.equal(readiness(h.state,first).completed,1);assert.throws(()=>h.run('setReady',{workId:first}),expectCode('NOT_READY'));
});
test('timed/all-day schedule cancellation, undo, stale undo, DST and no inferred publication',()=>{
  const {h,workId,accountId}=chain();
  const plan=h.run('setSchedule',{workId,accountId,schedule:{date:'2026-10-06',allDay:true,timeZone:'Asia/Shanghai'}});
  assert.equal(h.state.publications[plan.publicationId].schedule.plannedAt,null);
  const count=Object.values(h.state.publications).filter(p=>p.status==='published').length;
  const cancel=h.run('cancelSchedule',{publicationId:plan.publicationId});assert.ok(selectWorkspace(h.state).unscheduled.some(w=>w.id===workId));
  h.run('undo',{targetOperationId:cancel.undoOperationId});assert.equal(h.state.publications[plan.publicationId].status,'planned');
  assert.equal(Object.values(h.state.publications).filter(p=>p.status==='published').length,count);
  assert.throws(()=>h.run('undo',{targetOperationId:plan.undoOperationId}),expectCode('UNDO_CONFLICT'));
  assert.throws(()=>resolveSchedule({date:'2026-03-08',time:'02:30',allDay:false,timeZone:'America/New_York'}),expectCode('NONEXISTENT_LOCAL_TIME'));
  assert.throws(()=>resolveSchedule({date:'2026-11-01',time:'01:30',allDay:false,timeZone:'America/New_York'}),expectCode('AMBIGUOUS_LOCAL_TIME'));
  assert.equal(resolveSchedule({date:'2026-11-01',time:'01:30',allDay:false,timeZone:'America/New_York',offsetMinutes:-300}).plannedAt,'2026-11-01T06:30:00.000Z');
});
test('metrics preserve unknown/zero, latest cumulative and timezone-equivalent identity',()=>{
  const {h,publicationId}=chain();
  const row={publicationId,metricKey:'views',value:100,observedAt:'2026-10-02T00:00:00Z'};
  h.run('appendMetrics',{snapshots:[row]});assert.equal(h.run('appendMetrics',{snapshots:[{...row,observedAt:'2026-10-02T08:00:00+08:00'}]}).skipped.length,1);
  assert.throws(()=>h.run('appendMetrics',{snapshots:[{...row,value:200,observedAt:'2026-10-02T08:00:00+08:00'}]}),expectCode('METRIC_CONFLICT'));
  h.run('appendMetrics',{snapshots:[{...row,value:160,observedAt:'2026-10-03T00:00:00Z'},{...row,metricKey:'likes',value:0},{...row,metricKey:'comments',value:null}]});
  const latest=latestMetrics(h.state,{publicationId});assert.equal(latest.find(m=>m.metricKey==='views').value,160);assert.equal(latest.find(m=>m.metricKey==='likes').value,0);assert.equal(latest.find(m=>m.metricKey==='comments').value,null);
  h.run('appendMetrics',{snapshots:[{...row,value:null,observedAt:'2026-10-04T00:00:00Z'}]});assert.equal(latestMetrics(h.state,{publicationId}).find(m=>m.metricKey==='views').value,null);assert.equal(metricDelta(h.state,{publicationId,metricKey:'views'}).value,null);
});
test('goals and dashboards respect month, timezone, account and platform without mixed rankings',()=>{
  const {h,workId,accountId}=chain();const b=h.run('createAccount',{displayName:'乙',platform:'演示乙'}).accountId;
  h.run('setGoal',{month:'2026-10',timeZone:'Asia/Shanghai',metric:'publications',target:2,accountId});
  h.run('setGoal',{month:'2026-10',timeZone:'UTC',metric:'publications',target:5,accountId:b});
  assert.equal(selectWorkspace(h.state,{month:'2026-10',timeZone:'UTC'}).totals.publications,0);
  const query=selectWorkspace(h.state,{month:'2026-10',timeZone:'Asia/Shanghai',accountId});assert.equal(query.totals.publications,1);assert.equal(query.goals[0].actual,1);
  assert.equal(selectWorkspace(h.state,{platform:'演示甲'}).goals.length,1);
  const bpub=h.run('recordPublication',{workId,accountId:b,actualPublishedAt:'2026-10-01T12:00:00Z',publicUrl:'https://example.com/b'}).publicationId;
  const apub=Object.values(h.state.publications).find(p=>p.accountId===accountId).id;
  h.run('appendMetrics',{snapshots:[{publicationId:apub,metricKey:'views',value:160,observedAt:NOW},{publicationId:bpub,metricKey:'views',value:50,observedAt:NOW}]});
  const groups=selectWorkspace(h.state,{asOf:NOW}).metricGroups;assert.equal(groups.length,2);assert.deepEqual(groups.map(g=>g.value).sort((a,b)=>a-b),[50,160]);
});
test('archive and trash are recoverable and do not delete facts',()=>{
  const {h,workId,publicationId}=chain();const before=canonical(h.state.publications[publicationId]);
  h.run('archiveWork',{workId});assert.equal(selectWorkspace(h.state).production.length,0);h.run('restoreWork',{workId});assert.equal(h.state.works[workId].phase,'ready');
  h.run('trashWork',{workId});assert.ok(h.state.works[workId].trashedAt);h.run('restoreWork',{workId});assert.equal(h.state.works[workId].trashedAt,null);assert.equal(canonical(h.state.publications[publicationId]),before);
});
test('empty independent backup restore retains complete entities and honestly absent media',async()=>{
  const store=createMemoryStore({initialState:createWorkspace({id:'source'}),idFactory:makeId(),now:NOW});await seedDemo(store);
  const state=await store.read(),pkg=await exportPackage(state,{packageId:'package-test',generatedAt:NOW});
  const fresh=createMemoryStore({initialState:createWorkspace({id:'target'}),idFactory:makeId()});
  const preview=await fresh.previewImport(pkg);assert.equal(preview.missingAssets.length,1);assert.equal(preview.conflicts.length,0);
  const result=await fresh.importPackage(pkg,{expectedRevision:0,operationId:'import-one'});assert.ok(result.result.restorePointId);
  const restored=await fresh.read();for(const col of COLLECTIONS)assert.deepEqual(restored[col],state[col]);assert.equal(restored.sourceWorkspaces[0].id,state.id);
  const repeat=await fresh.importPackage(pkg,{expectedRevision:restored.revision,operationId:'import-two'});assert.equal(repeat.result.imported,0);
  await fresh.restore({restorePointId:result.result.restorePointId,expectedRevision:restored.revision,operationId:'restore-one'});assert.equal(Object.keys((await fresh.read()).works).length,0);
  assert.equal((await fresh.listRestorePoints()).length,2);const after=await fresh.read();await fresh.importPackage(pkg,{expectedRevision:after.revision,operationId:'reimport-after-restore'});assert.equal(Object.keys((await fresh.read()).works).length,2);
});
test('exchange conflicts show common base and require choices, no-common-base is explicit',async()=>{
  const {h,workId}=chain(),base=h.state;
  const forkA=makeState(),forkB=makeState();forkA.state=structuredClone(base);forkB.state=structuredClone(base);
  forkA.run('updateIdea',{workId,title:'分支甲'},{operationId:'branch-a'});forkB.run('updateIdea',{workId,title:'分支乙'},{operationId:'branch-b'});
  const pkg=await exportPackage(forkB.state,{packageId:'fork-package'}),preview=await previewImport(forkA.state,pkg),conflict=preview.conflicts.find(c=>c.id===workId);
  assert.equal(conflict.commonBase.title,'虚构作品');assert.equal(conflict.noCommonBase,false);
  await assert.rejects(()=>prepareImport(forkA.state,pkg,{expectedRevision:forkA.state.revision,operationId:'conflict'}),expectCode('IMPORT_CONFLICT'));
  const prepared=await prepareImport(forkA.state,pkg,{expectedRevision:forkA.state.revision,operationId:'accept-incoming',choices:{[`works:${workId}`]:'incoming'}});assert.equal(prepared.state.works[workId].title,'分支乙');
  const noHistory=structuredClone(forkA.state);noHistory.history={};const pkg2=structuredClone(pkg);for(const r of pkg2.records)r.ancestors=[];await rehash(pkg2);assert.equal((await previewImport(noHistory,pkg2)).conflicts.find(c=>c.id===workId).noCommonBase,true);
});
test('package rejects corrupt/duplicate/unknown/unsafe/prototype/dangling/semantically forged content',async()=>{
  const {h,publicationId}=chain(),pkg=await exportPackage(h.state);
  const bad=structuredClone(pkg);bad.records[0].entity.title='corrupt';await assert.rejects(()=>validatePackage(bad),expectCode('BAD_HASH'));
  const duplicate=structuredClone(pkg);duplicate.records.push(duplicate.records[0]);await rehash(duplicate);await assert.rejects(()=>validatePackage(duplicate),expectCode('DUPLICATE_ID'));
  const unknown=structuredClone(pkg);unknown.schemaVersion=2;await assert.rejects(()=>validatePackage(unknown),expectCode('UNSUPPORTED_SCHEMA'));
  const unsafe=structuredClone(pkg);unsafe.records.find(r=>r.id===publicationId).entity.publicUrl='javascript:alert(1)';await rehash(unsafe);await assert.rejects(()=>validatePackage(unsafe),expectCode('UNSAFE_URL'));
  await assert.rejects(()=>validatePackage('{"__proto__":{"polluted":true}}'),expectCode('UNSAFE_KEY'));
  const orphan=structuredClone(pkg);delete orphan.records.find(r=>r.id===publicationId).entity.workId;await rehash(orphan);await assert.rejects(()=>validatePackage(orphan),expectCode('MISSING_FIELD'));
  const wrong=structuredClone(pkg);wrong.records.find(r=>r.id===publicationId).entity.accountId='missing-account';await rehash(wrong);await assert.rejects(()=>validatePackage(wrong),expectCode('DANGLING_REFERENCE'));
});
test('CSV requires review, rejects formulas/status columns and only produces metric commands',()=>{
  const {h,publicationId}=chain();
  const good=`publicationId,metricKey,value,observedAt,sourceRef\n${publicationId},views,0,2026-10-05T00:00:00Z,"line one\nline two"\n${publicationId},comments,,2026-10-05T00:00:00Z,manual`;
  const preview=previewMetricsCsv(h.state,good);assert.equal(preview.valid,true);assert.equal(preview.snapshots[0].value,0);assert.equal(preview.snapshots[1].value,null);
  const before=canonical(h.state.publications);h.run('appendMetrics',{snapshots:preview.snapshots});assert.equal(canonical(h.state.publications),before);
  assert.equal(previewMetricsCsv(h.state,good).duplicates.length,2);
  assert.equal(previewMetricsCsv(h.state,good.replace(',0,',',=1+1,')).valid,false);
  assert.equal(previewMetricsCsv(h.state,'publicationId,status\nx,published').valid,false);
  h.run('appendMetrics',{snapshots:[{publicationId,metricKey:'likes',value:0,observedAt:NOW,sourceRef:'=HYPERLINK("bad")'}]});assert.match(exportMetricsCsv(h.state),/"'=HYPERLINK/);
});
test('memory contract: no notification or partial data before commit; quota preserves editor retry envelope',async()=>{
  let release;let fail=true;const wait=new Promise(resolve=>release=resolve);const store=createMemoryStore({initialState:createWorkspace({id:'memory-test'}),idFactory:makeId(),now:NOW,failWrite:async()=>{await wait;if(fail)throw new DOMException('full','QuotaExceededError');}});
  let notifications=0;store.subscribe(()=>notifications++);
  const command={type:'captureIdea',operationId:'retry-one',expectedRevision:0,payload:{title:'编辑缓冲中的稿件'}};
  const saving=store.dispatch(command);await Promise.resolve();assert.equal((await store.read()).revision,0);assert.equal(notifications,0);release();await assert.rejects(()=>saving,expectCode('STORAGE_QUOTA'));
  assert.equal((await store.read()).revision,0);fail=false;await store.dispatch(command);assert.equal(notifications,1);
});
test('IndexedDB adapter contract double: reopen, two-connection CAS, quota atomicity and no early saved event',async()=>{
  const indexedDB=createTestIndexedDB(),options={indexedDB,name:'idb-test',origin:'https://1337816143.github.io',broadcastChannelFactory:()=>({postMessage(){},close(){}}),initialState:createWorkspace({id:'idb-workspace'}),idFactory:makeId(),now:NOW};
  const a=await createIndexedDBStore(options),b=await createIndexedDBStore(options);let seen=0;a.subscribe(()=>seen++);
  const one={type:'captureIdea',operationId:'first',expectedRevision:0,payload:{title:'虚构甲'}};
  const pending=a.dispatch(one);assert.equal(seen,0);await pending;assert.equal(seen,1);assert.equal((await b.read()).revision,1);
  await assert.rejects(()=>b.dispatch({...one,operationId:'stale'}),expectCode('STALE_REVISION'));
  indexedDB.failNextCommit(new DOMException('full','QuotaExceededError'));
  await assert.rejects(()=>a.dispatch({...one,operationId:'quota',expectedRevision:1,payload:{title:'虚构乙'}}),expectCode('STORAGE_QUOTA'));assert.equal((await b.read()).revision,1);assert.equal(seen,1);
  a.close();b.close();const reopened=await createIndexedDBStore(options);assert.equal(Object.values((await reopened.read()).works)[0].title,'虚构甲');
  indexedDB.mutate('idb-test','workspace',s=>({...s,dataClass:'private'}));await assert.rejects(()=>reopened.read(),expectCode('PRIVATE_DATA_BLOCKED'));await assert.rejects(()=>reopened.dispatch({...one,operationId:'private-block',expectedRevision:1}),expectCode('PRIVATE_DATA_BLOCKED'));reopened.close();
});
test('IndexedDB adapter contract double: import and restore point commit or abort together',async()=>{
  const indexedDB=createTestIndexedDB(),source=chain().h.state,pkg=await exportPackage(source);
  const store=await createIndexedDBStore({indexedDB,name:'private-contract-only',origin:'https://isolated.example.test',approvedPrivateOrigin:true,broadcastChannelFactory:()=>({postMessage(){},close(){}}),initialState:createWorkspace({id:'isolated-target'})});
  indexedDB.failNextCommit(new DOMException('full','QuotaExceededError'));
  await assert.rejects(()=>store.importPackage(pkg,{expectedRevision:0,operationId:'failed-import'}),expectCode('STORAGE_QUOTA'));assert.equal((await store.read()).revision,0);assert.equal((await store.listRestorePoints()).length,0);
  const result=await store.importPackage(pkg,{expectedRevision:0,operationId:'success-import'});assert.equal((await store.listRestorePoints()).length,1);
  await store.restore({expectedRevision:1,operationId:'restore',restorePointId:result.result.restorePointId});assert.equal(Object.keys((await store.read()).works).length,0);assert.equal((await store.listRestorePoints()).length,2);store.close();
});
test('all default origins and shared GitHub origin remain demo; no private import bypass',async()=>{
  for(const origin of ['', 'https://1337816143.github.io/MyDotWork','https://isolated.example.test','http://localhost:8000'])assert.equal(storagePolicy({origin}).allowBackupImport,false);
  assert.equal(storagePolicy({origin:'https://1337816143.github.io',approvedPrivateOrigin:true}).mode,'demo');
  const store=createMemoryStore({policy:storagePolicy({origin:'https://1337816143.github.io'})});await assert.rejects(()=>store.previewImport({}),expectCode('DEMO_IMPORT_DISABLED'));
});
test('inherited object keys never resolve as account or operation identities',()=>{
  const h=makeState();for(const accountId of ['toString','valueOf','hasOwnProperty'])assert.throws(()=>h.run('appendMetrics',{snapshots:[{accountId,metricKey:'followers',value:2,observedAt:NOW}]}),expectCode('NOT_FOUND'));
  assert.throws(()=>h.run('captureIdea',{title:'x'},{operationId:'toString'}),expectCode('INVALID_ID'));
});
test('queued commands snapshot their input and never retain mutable UI array references',async()=>{
  const store=createMemoryStore({initialState:createWorkspace({id:'input-snapshot'}),idFactory:makeId(),now:NOW});
  const command={type:'captureIdea',operationId:'input-snapshot-op',expectedRevision:0,payload:{title:'Before click',tags:['before']}};
  const pending=store.dispatch(command);command.payload.title='After click';command.payload.tags[0]='after';
  const result=await pending;assert.equal(result.state.works[result.result.workId].title,'Before click');assert.deepEqual(result.state.works[result.result.workId].tags,['before']);
});
test('archive metadata cannot bypass the ready or producing import gates',async()=>{
  const h=makeState();const workId=h.run('captureIdea',{title:'No production yet'}).workId;
  for(const previousPhase of ['ready','producing']){
    const pkg=await exportPackage(h.state);const entity=pkg.records.find(r=>r.id===workId).entity;entity.phase='archived';entity.previousPhase=previousPhase;await rehash(pkg);
    await assert.rejects(()=>validatePackage(pkg),error=>['INVALID_READY_STATE','INVALID_TASK_TEMPLATE'].includes(error.code));
  }
});
test('selected-work backup does not include unrelated account data or global goals',async()=>{
  const {h,workId,accountId}=chain();const other=h.run('createAccount',{displayName:'Unrelated account',platform:'Other platform'}).accountId;
  h.run('appendMetrics',{snapshots:[{accountId:other,metricKey:'followers',value:123,observedAt:NOW}]});
  h.run('setGoal',{month:'2026-10',timeZone:'UTC',metric:'publications',target:5,accountId:null});
  const pkg=await exportPackage(h.state,{workIds:[workId]});await validatePackage(pkg);
  assert.deepEqual(pkg.records.filter(r=>r.collection==='accounts').map(r=>r.id),[accountId]);assert.equal(pkg.records.filter(r=>r.collection==='metrics').length,0);assert.equal(pkg.records.filter(r=>r.collection==='goals').length,0);
});
