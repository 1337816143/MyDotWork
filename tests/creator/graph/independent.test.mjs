// Independent adversarial review. All valid states are made with native commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from './frozen-reader.mjs';
import {createWorkspace,applyCommand,COLLECTIONS} from '../../../src/creator/core/core.mjs';
import {createMemoryStore,storagePolicy} from '../../../src/creator/core/store.mjs';
import {projectWebState} from '../../../src/creator/graph/web.mjs';
import {createGraphSession,selectNodes,metricLabel,editorTarget,relationsForNode} from '../../../src/creator/graph/model.mjs';
import {createGraphView} from '../../../src/creator/graph/view.mjs';
import {parseRoute,routeHash,VIEWS} from '../../../src/creator/controller.mjs';
import {installDomFixture,fire,input,findButton} from '../../../tests/creator/ui/dom-fixture.mjs';
const NOW='2026-10-06T06:00:00.000Z';
function builder(id='independent:graph.review') {
 let state=createWorkspace({id,now:NOW,dataClass:'synthetic'}),op=0,n=0;
 return {get state(){return state},command(type,payload){const result=applyCommand(state,{type,payload,operationId:`review.op:${++op}`,expectedRevision:state.revision},{now:NOW,idFactory:p=>`${p}:review.${++n}`});state=result.state;return result.result}};
}
const TITLE='<img src=x onerror=alert(1)> 同名合成作品';
const BODY=('逐行完整正文🔬\n'.repeat(3200))+'尾部 quoted "literal" and C:\\review\\file\n<script>alert(1)</script>\r\n\u0000';
function scenario() {
 const b=builder();
 const accounts=[0,1].map(i=>b.command('createAccount',{displayName:`合成账户${i}`,platform:`synthetic${i}`}).accountId);
 const work=b.command('captureIdea',{title:TITLE,angle:'独立审查切入点',contentType:'text',references:[{title:'<svg onload=alert(1)>',url:'https://example.com/synthetic',excerpt:'literal \"quoted\" text',analysis:'合成参考'}]}).workId;
 const started=b.command('startProduction',{workId:work});
 const asset=b.command('addAsset',{workId:work,name:'synthetic.txt',size:0}).assetId;
 const oldDraft=b.command('saveDraft',{workId:work,title:'发布前标题',body:BODY}).draftId;
 for(const taskId of started.taskIds)b.command('setTaskState',{workId:work,taskId,status:'done'});
 b.command('setReady',{workId:work});
 const published=b.command('recordPublication',{workId:work,accountId:accounts[0],actualPublishedAt:NOW,publicUrl:'https://example.com/synthetic/p1'}).publicationId;
 const newDraft=b.command('saveDraft',{workId:work,title:'最新但尚未发布',body:'new current draft'}).draftId;
 const planned=b.command('setSchedule',{workId:work,accountId:accounts[1],schedule:{date:'2026-10-20',timeZone:'UTC',allDay:true}}).publicationId;
 const metricIds=b.command('appendMetrics',{snapshots:Array.from({length:15},(_,i)=>({publicationId:published,metricKey:'views',value:i===1?null:i,observedAt:new Date(Date.parse(NOW)+i*1000).toISOString(),sourceRef:`synthetic-${i}`}))}).metricIds;
 const accountMetric=b.command('appendMetrics',{snapshots:[{accountId:accounts[0],metricKey:'followers',value:0,observedAt:NOW}]}).metricIds[0];
 const review=b.command('saveReview',{workId:work,evidenceMetricIds:metricIds.slice(0,2),observation:'合成观察',nextExperiment:'合成后续'}).reviewId;
 const followup=b.command('deriveFollowupIdea',{reviewId:review,title:TITLE}).workId;
 const goal=b.command('setGoal',{accountId:accounts[1],month:'2026-10',timeZone:'UTC',metric:'publications',target:0}).goalId;
 return {b,work,accounts,asset,oldDraft,newDraft,published,planned,metricIds,accountMetric,review,followup,goal};
}
const {document,events}=installDomFixture();
const {mountCreator}=await import('../../../src/creator/app.mjs');
function fixture(options={}){const v=createGraphView(document,options);document.getElementById('app').replaceChildren(v.element);return v}
const node=(g,id)=>g.nodes.find(n=>n.source.entityId===id);
const list=v=>v.element.querySelector('[aria-label="记录列表"]').querySelectorAll('[data-node-id]');
const change=async(v,name,value)=>{const target=v.element.querySelector(`[name="${name}"]`);target.value=value;await fire(target,'change')};
const settle=async()=>{
 const deadline=Date.now()+5000;
 do{
  await new Promise(r=>setTimeout(r,5));
  const view=document.querySelector('[aria-label="只读关系浏览器"]');
  if(!view||view.getAttribute('aria-busy')!=='true')return;
 }while(Date.now()<deadline);
 throw new Error('Graph did not finish validation');
};

test('frozen pure code and native core are byte identical to read-only inputs',async()=>{
 for(const file of ['project.mjs','snapshot.mjs'])assert.deepEqual(await readFile(new URL(`../../../src/creator/graph/${file}`,import.meta.url)),await readFile(new URL(`./frozen/frozen-adapters/${file}`,import.meta.url)));
 for(const file of ['core.mjs','exchange.mjs','store.mjs','csv.mjs','fixtures.mjs'])assert.deepEqual(await readFile(new URL(`../../../src/creator/core/${file}`,import.meta.url)),await readFile(new URL(`./frozen/baseline-creator/core/${file}`,import.meta.url)));
 const frozen=await readFile(new URL('./frozen/frozen-adapters/web.mjs',import.meta.url),'utf8');
 assert.equal(await readFile(new URL('../../../src/creator/graph/web.mjs',import.meta.url),'utf8'),frozen.replaceAll('../../workbench-780-xuan-integration-20261006/source/src/creator/core/','../core/'));
});

test('independently expected record counts and exact semantic edges, including old published draft',async()=>{
 const f=scenario(),g=await projectWebState(f.b.state);
 assert.equal(g.nodes.length,COLLECTIONS.reduce((n,c)=>n+Object.keys(f.b.state[c]).length,0));
 const edge=(type,a,b)=>assert.ok(g.edges.some(e=>e.type===type&&e.from===node(g,a).id&&e.to===node(g,b).id),`${type}: ${a}->${b}`);
 edge('currentDraft',f.work,f.newDraft);edge('previousDraft',f.newDraft,f.oldDraft);
 edge('publishedDraft',f.published,f.oldDraft);edge('publicationAccount',f.published,f.accounts[0]);
 edge('publicationAsset',f.published,f.asset);edge('belongsToWork',f.published,f.work);
 edge('measuresPublication',f.metricIds[0],f.published);edge('measuresAccount',f.accountMetric,f.accounts[0]);
 edge('targetsAccount',f.goal,f.accounts[1]);edge('usesMetricEvidence',f.review,f.metricIds[1]);
 edge('derivedFromWork',f.followup,f.work);edge('derivedFromReview',f.followup,f.review);edge('producedFollowupWork',f.review,f.followup);
 assert.equal(node(g,f.published).record.finalSnapshot.body,BODY);assert.equal(node(g,f.published).label,'发布前标题');
 assert.equal(node(g,f.planned).record.finalSnapshot,null);assert.equal(g.edges.some(e=>e.from===node(g,f.planned).id&&e.type==='publishedDraft'),false);
 assert.equal(new Set(g.nodes.map(n=>n.id)).size,g.nodes.length);assert.equal(new Set(g.edges.map(e=>e.id)).size,g.edges.length);
});

test('graph IDs survive renaming, archive, trash, restore and distinguish workspaces with punctuation',async()=>{
 const f=scenario(),first=await projectWebState(f.b.state);
 f.b.command('updateIdea',{workId:f.work,title:'独立改名'});f.b.command('archiveWork',{workId:f.work});f.b.command('trashWork',{workId:f.work});f.b.command('restoreWork',{workId:f.work});
 const next=await projectWebState(f.b.state);assert.deepEqual(first.nodes.map(n=>n.id),next.nodes.map(n=>n.id));assert.deepEqual(first.edges.map(e=>e.id),next.edges.map(e=>e.id));
 const other=builder('independent.graph:review');other.command('captureIdea',{title:TITLE,angle:'other'});const second=await projectWebState(other.state);
 assert.ok(second.nodes.every(n=>!first.nodes.some(x=>x.id===n.id)));
});

test('unknown and observed zero stay distinct; account observations excluded from work scope',async()=>{
 const f=scenario(),g=await projectWebState(f.b.state);
 assert.equal(metricLabel(node(g,f.metricIds[0])),'0');assert.equal(metricLabel(node(g,f.metricIds[1])),'未知');assert.equal(node(g,f.metricIds[1]).record.value,null);
 const scoped=selectNodes(g,{workId:f.work,kind:'MetricObservation'});assert.equal(scoped.length,15);assert.ok(!scoped.some(n=>n.source.entityId===f.accountMetric));
 assert.equal(selectNodes(g,{workId:f.followup}).length,1);assert.equal(g.nodes.some(n=>/Method/.test(n.kind)),false);
});

test('defensive synchronous snapshot cannot be changed while native validation awaits; result is deeply frozen',async()=>{
 const f=scenario(),before=JSON.stringify(f.b.state),promise=projectWebState(f.b.state);
 const title=f.b.state.works[f.work].title;f.b.state.works[f.work].title='mutation after call';
 const g=await promise;assert.equal(node(g,f.work).record.title,title);f.b.state.works[f.work].title=title;
 assert.equal(JSON.stringify(f.b.state),before);assert.ok(Object.isFrozen(g));assert.ok(Object.isFrozen(g.nodes));assert.ok(Object.isFrozen(node(g,f.published).record.finalSnapshot));
 assert.throws(()=>{node(g,f.work).record.title='forbidden'},TypeError);
});

test('invalid/private/accessor state is unavailable; accessors are never invoked',async()=>{
 const f=scenario();let reads=0;const accessor=structuredClone(f.b.state);Object.defineProperty(accessor,'id',{get(){reads++;return 'bad'},enumerable:true});
 await assert.rejects(projectWebState(accessor));assert.equal(reads,0);
 await assert.rejects(projectWebState({...f.b.state,dataClass:'private'}),e=>e.code==='SYNTHETIC_ONLY');
 const broken=structuredClone(f.b.state);broken.publications[f.published].finalRevisionId='missing';await assert.rejects(projectWebState(broken));
 const s=createGraphSession();await s.load(broken);assert.equal(s.status.graph,null);assert.equal(s.status.pending,false);assert.ok(s.status.error);
});

test('session late success, late failure, duplicate loads, retry, cross-workspace and close obey newest request',async()=>{
 const pending=[],session=createGraphSession({project:s=>new Promise((resolve,reject)=>pending.push({s,resolve,reject}))});
 const a=builder('scope:a'),b=builder('scope:b');a.command('captureIdea',{title:'a',angle:'a'});b.command('captureIdea',{title:'b',angle:'b'});
 const pa=session.load(a.state),pb=session.load(b.state);assert.equal(session.load(b.state),pb);assert.equal(pending.length,2);
 pending[1].resolve(await projectWebState(b.state));await pb;const accepted=session.status.graph;
 pending[0].resolve(await projectWebState(a.state));await pa;assert.equal(session.status.graph,accepted);
 const bad=session.load(a.state);pending[2].reject(new Error('independent failure'));await bad;assert.equal(session.status.graph,accepted);assert.ok(session.status.error);
 const retry=session.load(a.state,{retry:true});pending[3].resolve(await projectWebState(a.state));await retry;assert.equal(session.status.error,null);assert.equal(session.status.graph.workspaceId,'scope:a');
 const abandoned=session.load(b.state);session.close();pending[4].reject(new Error('late failure'));await abandoned;assert.equal(session.status.graph.workspaceId,'scope:a');
});

test('31 duplicate names enumerate exactly once over pages; searching the last work crosses pagination',async()=>{
 const b=builder();const ids=[];for(let i=0;i<31;i++)ids.push(b.command('captureIdea',{title:TITLE,angle:`独立定位 ${i}`}).workId);
 const v=fixture();await v.setState(b.state);const seen=[];
 for(let p=0;p<3;p++){seen.push(...list(v).map(n=>n.dataset.entityId));if(p<2)await fire(v.element.querySelector('[aria-label="记录分页下一页"]'),'click')}
 assert.equal(seen.length,31);assert.deepEqual(new Set(seen),new Set(ids));assert.equal(list(v).length,7);
 const search=v.element.querySelector('[name="graph-search"]');search.value='独立定位 30';await fire(search,'input');assert.equal(list(v).length,1);assert.equal(list(v)[0].dataset.entityId,ids.at(-1));
 search.value='no record matches';await fire(search,'input');assert.match(v.element.textContent,/没有匹配记录/);assert.doesNotMatch(v.element.textContent,/校验通过的空工作区/);v.close();
});

test('DOM full body exact including NUL, newline and HTML; graph never creates link from record URL',async()=>{
 const f=scenario(),v=fixture();await v.setState(f.b.state);await change(v,'graph-kind','Draft');await fire(list(v).find(n=>n.dataset.entityId===f.oldDraft),'click');
 assert.equal(v.element.querySelector('[data-fulltext="body"]').textContent,BODY);assert.equal(v.element.querySelectorAll('script,img,svg,iframe,form').length,0);
 assert.ok(v.element.querySelectorAll('a').every(a=>a.getAttribute('href').startsWith('#view=')));
 assert.match(v.element.textContent,/方法笔记：未接入/);assert.match(v.element.textContent,/不代表完整存储或备份验收/);v.close();
});

test('incoming relation pages preserve direction and reach all 15 metric identities',async()=>{
 const f=scenario(),v=fixture();await v.setState(f.b.state);await change(v,'graph-kind','Publication');await fire(list(v).find(n=>n.dataset.entityId===f.published),'click');
 const seen=[];for(let p=0;p<3;p++){const section=v.element.querySelector('[aria-label="指向此记录"]');seen.push(...section.querySelectorAll('[data-node-id]').map(n=>n.dataset.entityId));if(p<2)await fire(section.querySelector('[aria-label="指向此记录关系分页下一页"]'),'click')}
 assert.deepEqual(new Set(seen),new Set(f.metricIds));assert.equal(seen.length,15);
 const last=v.element.querySelector('[aria-label="指向此记录"]').querySelector('[data-node-id]');const id=last.dataset.entityId;await fire(last,'click');assert.match(v.element.querySelector('[aria-label="选中记录详情"]').textContent,new RegExp(id.replaceAll('.','\\.')));assert.equal(v.element.querySelector('[name="graph-kind"]').value,'');v.close();
});

test('pending/failed refresh removes editor jumps, retains old body, then same-input retry restores valid jumps',async()=>{
 const f=scenario();let mode='ok',resolve;const v=fixture({project:s=>mode==='ok'?projectWebState(s):mode==='fail'?Promise.reject(new Error('synthetic rejection')):new Promise(r=>{resolve=()=>projectWebState(s).then(r)})});
 await v.setState(f.b.state);await change(v,'graph-kind','Draft');assert.ok(v.element.querySelector('[data-focus-key="graph:editor"]'));
 const first=v.status.graph;f.b.command('updateIdea',{workId:f.work,title:'new'});mode='wait';const loading=v.setState(f.b.state);assert.equal(v.status.pending,true);assert.equal(v.element.querySelector('[data-focus-key="graph:editor"]'),null);assert.equal(v.status.graph,first);resolve();await loading;
 mode='fail';f.b.command('updateIdea',{workId:f.work,title:'newest'});await v.setState(f.b.state);assert.match(v.element.textContent,/保留以下旧快照/);assert.equal(v.element.querySelector('[data-focus-key="graph:editor"]'),null);
 mode='ok';await fire(findButton(v.element,'重新校验'),'click');assert.equal(v.status.graph.revision,f.b.state.revision);assert.ok(v.element.querySelector('[data-focus-key="graph:editor"]'));v.close();
});

test('editor routing is identity-based and denies missing, obsolete, cross-workspace and global records',async()=>{
 const f=scenario(),g=await projectWebState(f.b.state);
 for(const [id,view]of [[f.oldDraft,'production'],[f.published,'library'],[f.metricIds[0],'database'],[f.review,'database'],[f.followup,'ideas']])assert.deepEqual(editorTarget(g,node(g,id),f.b.state),{view,workId:id===f.followup?f.followup:f.work});
 assert.equal(editorTarget(g,node(g,f.accountMetric),f.b.state),null);assert.equal(editorTarget(g,node(g,f.work),{...f.b.state,id:'another'}),null);
 const missing=structuredClone(f.b.state);delete missing.drafts[f.oldDraft];assert.equal(editorTarget(g,node(g,f.oldDraft),missing),null);
 f.b.command('updateIdea',{workId:f.work,title:'changed'});assert.equal(editorTarget(g,node(g,f.work),f.b.state),null);
});

test('actual app retains unsaved body and full business state across graph navigation and six-module themes',async()=>{
 const f=scenario(),app=await mountCreator(createMemoryStore({initialState:f.b.state,policy:storagePolicy({origin:'https://example.github.io'})}));app.navigate('production',f.work);
 const form=document.querySelector(`[data-buffer="draft:${f.work}"]`);await input(form,'body','unsaved independent synthetic body');const before=JSON.stringify(app.controller.state);
 await fire(findButton(document.body,'查看关系'),'click');await settle();assert.equal(location.hash,routeHash('database',f.work,'relations'));assert.equal(document.querySelectorAll('[data-buffer]').length,0);assert.doesNotMatch(document.getElementById('main').textContent,/unsaved independent/);
 for(const [name,value]of [['presentation','classic'],['layout','A'],['color','light'],['layout','B'],['color','dark'],['presentation','studio']]){const el=document.querySelector(`[name="${name}"]`);el.value=value;await fire(el,'change');assert.equal(document.querySelector('[aria-label="创作模块"]').querySelectorAll('[data-view]').length,6)}
 const jump=document.querySelector('[data-focus-key="graph:editor"]');assert.ok(jump);await fire(jump,'click');assert.equal(document.querySelector(`[data-buffer="draft:${f.work}"]`).querySelector('[name="body"]').value,'unsaved independent synthetic body');
 assert.equal(JSON.stringify(app.controller.state),before);assert.equal(app.controller.policy.allowBackupImport,false);assert.match(document.body.textContent,/请勿输入真实私稿/);
 location.hash='#view=database&work=absent:work&panel=relations';await events.get('hashchange')();await settle();assert.match(document.getElementById('main').textContent,/不存在的作品/);assert.equal(document.getElementById('work-detail'),null);assert.equal(document.querySelector('[data-focus-key="graph:editor"]'),null);
 location.hash='#view=database&panel=relations';await events.get('popstate')();await settle();assert.ok(document.querySelector('[aria-label="只读关系浏览器"]'));
 await fire(findButton(document.body,'返回数据表'),'click');assert.equal(location.hash,'#view=database');assert.ok(findButton(document.body,'录入指标'));assert.equal(JSON.stringify(app.controller.state),before);app.close();
});

test('old six route forms roundtrip, malicious route input falls back and relation panel is database-only',()=>{
 for(const view of VIEWS)assert.deepEqual(parseRoute(routeHash(view,'work:colon.test')),{view,workId:'work:colon.test'});
 assert.deepEqual(parseRoute('#view=production&panel=relations'),{view:'production',workId:null});
 assert.deepEqual(parseRoute('#view=<script>&work=__proto__&panel=relations'),{view:'desk',workId:null});
});

// Independent regression assertions retain the originally failing review cases.
test('REGRESSION R1: raw quoted body phrase must be searchable',async()=>{
 const f=scenario(),g=await projectWebState(f.b.state);const result=selectNodes(g,{search:'quoted "literal"'});
 assert.deepEqual(new Set(result.map(n=>n.source.entityId)),new Set([f.oldDraft,f.published]));
});

test('REGRESSION R1: raw backslash body phrase must be searchable',async()=>{
 const f=scenario(),g=await projectWebState(f.b.state);const result=selectNodes(g,{search:'C:\\review\\file'});
 assert.deepEqual(new Set(result.map(n=>n.source.entityId)),new Set([f.oldDraft,f.published]));
});

test('REGRESSION R2: planned/cancelled Publication without finalSnapshot must not claim title/body came from final snapshot',async()=>{
 const f=scenario(),v=fixture();await v.setState(f.b.state);await change(v,'graph-kind','Publication');await fire(list(v).find(n=>n.dataset.entityId===f.planned),'click');
 const detail=v.element.querySelector('[aria-label="选中记录详情"]');assert.equal(node(v.status.graph,f.planned).record.finalSnapshot,null);assert.equal(detail.querySelector('[data-fulltext="body"]'),null);
 assert.doesNotMatch(detail.textContent,/标题和正文来自此 Publication 的最终快照/);
 assert.match(detail.textContent,/尚无|没有|未生成|未登记/);
 f.b.command('cancelSchedule',{publicationId:f.planned});await v.setState(f.b.state);
 const cancelled=v.element.querySelector('[aria-label="选中记录详情"]');assert.equal(node(v.status.graph,f.planned).record.status,'draft');
 assert.equal(cancelled.querySelector('[data-fulltext="body"]'),null);assert.doesNotMatch(cancelled.textContent,/标题和正文来自此 Publication 的最终快照/);assert.match(cancelled.textContent,/尚无|没有|未生成|未登记/);v.close();
});
