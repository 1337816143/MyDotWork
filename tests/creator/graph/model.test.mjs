import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from './frozen-reader.mjs';
import {createHash} from 'node:crypto';
import {projectWebState} from '../../../src/creator/graph/web.mjs';
import {selectNodes,paginate,relationsForNode,metricLabel,workIdFor,editorTarget,createGraphSession,PAGE_SIZE} from '../../../src/creator/graph/model.mjs';
import {routeHash,parseRoute,VIEWS} from '../../../src/creator/controller.mjs';
import {storagePolicy} from '../../../src/creator/core/store.mjs';
import {builder,ideas,rich} from './fixtures.mjs';

test('web rebinding is the only adapter source change; native contracts and pure modules byte-identical',async()=>{
  for(const file of ['project.mjs','snapshot.mjs'])assert.equal(await readFile(new URL(`../../../src/creator/graph/${file}`,import.meta.url),'utf8'),await readFile(new URL(`./frozen/frozen-adapters/${file}`,import.meta.url),'utf8'));
  const original=await readFile(new URL('./frozen/frozen-adapters/web.mjs',import.meta.url),'utf8');
  assert.equal(await readFile(new URL('../../../src/creator/graph/web.mjs',import.meta.url),'utf8'),original.replaceAll('../../workbench-780-xuan-integration-20261006/source/src/creator/core/','../core/'));
  for(const file of ['core.mjs','exchange.mjs','store.mjs','csv.mjs','fixtures.mjs'])assert.deepEqual(await readFile(new URL(`../../../src/creator/core/${file}`,import.meta.url)),await readFile(new URL(`./frozen/baseline-creator/core/${file}`,import.meta.url)));
});

test('rebound web adapter produces precisely the independent-reviewed projection',async()=>{
  const expected=JSON.parse(await readFile(new URL('./frozen/frozen-web-projection-hashes.json',import.meta.url),'utf8'));
  for(const [name,b]of [['empty',builder()],['31-works',ideas(31)],['rich',rich().b]])assert.equal(createHash('sha256').update(JSON.stringify(await projectWebState(b.state))).digest('hex'),expected[name]);
});

test('all 31 same-title works remain distinct, and every page can be reached without truncation',async()=>{
  const graph=await projectWebState(ideas().state),nodes=selectNodes(graph,{kind:'Work'}),seen=[];
  assert.equal(nodes.length,31);assert.equal(new Set(nodes.map(n=>n.id)).size,31);
  for(let page=0;page<3;page++)seen.push(...paginate(nodes,page).items.map(n=>n.id));
  assert.deepEqual(seen,nodes.map(n=>n.id));assert.equal(paginate(nodes,999).page,2);assert.equal(paginate(nodes,-1).page,0);assert.equal(paginate([],0).total,0);
});

test('full text is searched beyond page boundaries and retained in draft and each Publication',async()=>{
  const f=rich({count:31}),graph=await projectWebState(f.b.state),found=selectNodes(graph,{search:'末页全文尾标记'});
  assert.equal(found.filter(n=>n.kind==='Draft').length,1);assert.equal(found.filter(n=>n.kind==='Publication').length,2);
  assert.equal(found.find(n=>n.kind==='Draft').record.body,f.body);
  assert.ok(found.filter(n=>n.kind==='Publication').every(n=>n.record.finalSnapshot.body===f.body));
});

test('zero, unknown, two separate PublicationIDs, and account-global observations retain their own meanings',async()=>{
  const f=rich(),graph=await projectWebState(f.b.state),metrics=selectNodes(graph,{kind:'MetricObservation'});
  assert.equal(metricLabel(metrics.find(n=>n.source.entityId===f.metricIds[0])),'0');
  assert.equal(metricLabel(metrics.find(n=>n.source.entityId===f.metricIds[1])),'未知');
  assert.equal(new Set(selectNodes(graph,{kind:'Publication'}).map(n=>n.source.entityId)).size,2);
  const scoped=selectNodes(graph,{kind:'MetricObservation',workId:f.workId});assert.equal(scoped.length,15);assert.equal(scoped.some(n=>n.source.entityId===f.globalMetricId),false);
  assert.equal(workIdFor(graph,metrics.find(n=>n.source.entityId===f.globalMetricId)),null);
});

test('stable identities survive renaming and new entities; no synthetic method-note nodes',async()=>{
  const f=rich(),first=await projectWebState(f.b.state);f.b.run('updateIdea',{workId:f.workId,title:'改名'});f.b.run('captureIdea',{title:'新增虚构选题',angle:'测试'});
  const second=await projectWebState(f.b.state);assert.ok(first.nodes.every(n=>second.nodes.some(x=>x.id===n.id)));
  assert.equal(second.nodes.some(n=>/Method/.test(n.kind)),false);assert.equal(second.capabilities.methodNotes.supported,false);
});

test('every relation endpoint is reachable and paginated by its exact direction and identity',async()=>{
  const f=rich(),graph=await projectWebState(f.b.state),pub=graph.nodes.find(n=>n.source.entityId===f.publicationIds[0]);
  const {incoming,outgoing}=relationsForNode(graph,pub.id);assert.ok(incoming.length>6);
  const nodes=new Set(graph.nodes.map(n=>n.id));assert.ok(incoming.every(e=>e.to===pub.id&&nodes.has(e.from)));assert.ok(outgoing.every(e=>e.from===pub.id&&nodes.has(e.to)));
  const seen=[];for(let i=0;i<Math.ceil(incoming.length/6);i++)seen.push(...paginate(incoming,i,6).items);assert.deepEqual(seen,incoming);
});

test('editor destinations use WorkID and cannot use stale, missing or different-workspace graph identity',async()=>{
  const f=rich(),graph=await projectWebState(f.b.state),draft=graph.nodes.find(n=>n.source.entityId===f.draft1);
  assert.deepEqual(editorTarget(graph,draft,f.b.state),{workId:f.workId,view:'production'});
  const pub=graph.nodes.find(n=>n.source.entityId===f.publicationIds[0]);assert.equal(editorTarget(graph,pub,f.b.state).view,'library');
  const metric=graph.nodes.find(n=>n.source.entityId===f.metricIds[0]);assert.equal(editorTarget(graph,metric,f.b.state).view,'database');
  assert.equal(editorTarget(graph,draft,builder('different').state),null);
  f.b.run('updateIdea',{workId:f.workId,title:'更新后'});assert.equal(editorTarget(graph,draft,f.b.state),null);
});

test('session does no mutation; failure preserves previous view and retry recovers same input identity',async()=>{
  const f=rich(),before=JSON.stringify(f.b.state);let reject=false;
  const session=createGraphSession({project:async input=>{if(reject)throw Object.assign(new Error('synthetic failure'),{code:'TEST'});return projectWebState(input)}});
  await session.load(f.b.state);const previous=session.status.graph;reject=true;await session.load(f.b.state,{retry:true});
  assert.equal(session.status.graph,previous);assert.equal(session.status.error.code,'TEST');assert.equal(session.status.pending,false);
  reject=false;await session.load(f.b.state,{retry:true});assert.equal(session.status.error,null);assert.equal(JSON.stringify(f.b.state),before);
});

test('session latest-wins cancellation, rejected older request, duplicate load and close are safe',async()=>{
  const resolvers=[],session=createGraphSession({project:input=>new Promise((resolve,reject)=>resolvers.push({resolve,reject,input}))});
  const a=builder().state,b=ideas(1).state;
  const first=session.load(a);assert.equal(session.load(a),first);assert.equal(resolvers.length,1);
  const second=session.load(b);resolvers[1].resolve(await projectWebState(b));await second;const accepted=session.status.graph;
  resolvers[0].reject(new Error('late rejection'));await first;assert.equal(session.status.graph,accepted);assert.equal(session.status.error,null);
  const last=session.load(a);session.close();resolvers[2].resolve(await projectWebState(a));await last;assert.equal(session.status.graph,accepted);
});

test('strict failure is distinct from valid zero and synthetic privacy boundaries reject real state',async()=>{
  const session=createGraphSession();await session.load(builder().state);assert.equal(session.status.graph.counts.nodes,0);
  const current=session.status.graph;await session.load({...builder().state,dataClass:'private'});assert.ok(session.status.error);assert.equal(session.status.graph,current);
  const f=rich(),bad=structuredClone(f.b.state);bad.metrics.orphan={id:'orphan',value:0};await session.load(bad);assert.ok(session.status.error);assert.equal(session.status.graph,current);
});

test('six old routes remain exact; relation panel is database-only and cannot inject route content',()=>{
  assert.equal(VIEWS.length,6);
  for(const view of VIEWS){assert.deepEqual(parseRoute(routeHash(view,'work-id')),{view,workId:'work-id'});assert.equal(routeHash(view,'work-id','evil'),'#view='+view+'&work=work-id')}
  assert.deepEqual(parseRoute('#view=database&work=work-id&panel=relations'),{view:'database',workId:'work-id',panel:'relations'});
  assert.equal(routeHash('database','work-id','relations'),'#view=database&work=work-id&panel=relations');assert.deepEqual(parseRoute('#view=desk&panel=relations'),{view:'desk',workId:null});
  assert.equal(routeHash('database','<script>','relations'),'#view=database&panel=relations');
});

test('github.io and default-origin private draft and backup restrictions are unchanged',()=>{
  for(const origin of ['https://example.github.io','http://localhost:8000']){const policy=storagePolicy({origin,approvedPrivateOrigin:false});assert.equal(policy.mode,'demo');assert.equal(policy.allowBackupImport,false)}
});

test('literal raw-field search retains quotes, backslashes, source metadata and long text exactly',async()=>{
 const body='Long '+ 'x'.repeat(6001)+' quoted "literal" C:\\review\\file\r\nline two 🧪';
 const f=rich({body}),graph=await projectWebState(f.b.state);
 for(const search of ['quoted "literal"','C:\\review\\file','line two 🧪']){const nodes=selectNodes(graph,{search});assert.equal(nodes.filter(n=>n.kind==='Draft').length,1);assert.equal(nodes.filter(n=>n.kind==='Publication').length,2)}
 assert.equal(selectNodes(graph,{search:'web',kind:'Work'}).length,2);
});
