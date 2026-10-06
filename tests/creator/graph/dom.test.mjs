import test from 'node:test';
import assert from 'node:assert/strict';
import {installDomFixture,fire,findButton,input} from '../../../tests/creator/ui/dom-fixture.mjs';
import {ideas,rich,builder} from './fixtures.mjs';
import {createGraphView} from '../../../src/creator/graph/view.mjs';
import {projectWebState} from '../../../src/creator/graph/web.mjs';
import {createMemoryStore,storagePolicy} from '../../../src/creator/core/store.mjs';
const {document,events}=installDomFixture();
const {mountCreator}=await import('../../../src/creator/app.mjs');
const settled=async()=>{
 const deadline=Date.now()+5000;
 do{
  await new Promise(r=>setTimeout(r,5));
  const view=document.querySelector('[aria-label="只读关系浏览器"]');
  if(!view||view.getAttribute('aria-busy')!=='true')return;
 }while(Date.now()<deadline);
 throw new Error('Graph did not finish validation');
};
function fixture(options={}){const v=createGraphView(document,options);document.getElementById('app').replaceChildren(v.element);return v}
function records(v){return v.element.querySelector('[aria-label="记录列表"]').querySelectorAll('[data-node-id]')}
const selectValue=async(root,name,value)=>{const n=root.querySelector(`[name="${name}"]`);n.value=value;await fire(n,'change')};

test('semantic DOM: 31 duplicate-title records accessible over three pages, with stable IDs and truthful empty filters',async()=>{
 const v=fixture();await v.setState(ideas().state);assert.equal(records(v).length,12);const seen=records(v).map(n=>n.dataset.entityId);
 await fire(v.element.querySelector('[aria-label="记录分页下一页"]'),'click');seen.push(...records(v).map(n=>n.dataset.entityId));assert.equal(records(v).length,12);
 await fire(v.element.querySelector('[aria-label="记录分页下一页"]'),'click');seen.push(...records(v).map(n=>n.dataset.entityId));assert.equal(records(v).length,7);assert.equal(new Set(seen).size,31);
 assert.equal(v.element.querySelector('[aria-label="记录分页下一页"]').disabled,true);assert.equal(document.activeElement,v.element.querySelector('[aria-label="记录分页上一页"]'));
 const search=v.element.querySelector('[name="graph-search"]');search.value='不存在的合成词';await fire(search,'input');assert.equal(records(v).length,0);assert.match(v.element.textContent,/没有匹配记录/);assert.doesNotMatch(v.element.textContent,/校验通过的空工作区/);
 await fire(findButton(v.element,'清除筛选'),'click');assert.equal(records(v).length,12);v.close();
});

test('semantic DOM: full long draft and Publication body stay exact, markup never becomes executable DOM',async()=>{
 const f=rich({count:31}),v=fixture();await v.setState(f.b.state);const search=v.element.querySelector('[name="graph-search"]');search.value='末页全文尾标记';await fire(search,'input');assert.equal(records(v).length,3);
 for(const record of records(v)){await fire(record,'click');assert.equal(v.element.querySelector('[data-fulltext="body"]').textContent,f.body)}
 assert.equal(v.element.querySelectorAll('script,img,iframe').length,0);assert.equal(v.element.querySelectorAll('textarea,input').filter(n=>n.tagName==='TEXTAREA').length,0);
 assert.match(v.element.textContent,/方法笔记：未接入/);assert.equal(v.element.querySelectorAll('form').length,0);v.close();
});

test('semantic DOM: observed zero and unknown differ visibly, and no invented metric is inserted',async()=>{
 const f=rich(),v=fixture();await v.setState(f.b.state);await selectValue(v.element,'graph-kind','MetricObservation');
 const zero=records(v).find(n=>n.dataset.entityId===f.metricIds[0]),unknown=records(v).find(n=>n.dataset.entityId===f.metricIds[1]);assert.ok(zero);assert.ok(unknown);
 assert.match(zero.textContent,/观测值：0/);assert.match(unknown.textContent,/观测值：未知/);assert.equal(zero.querySelector('[data-kind="observed"]').dataset.value,'0');
 assert.equal(v.status.graph.nodes.filter(n=>n.kind==='MetricObservation').length,16);v.close();
});

test('semantic DOM: direction, relation pagination and neighbor navigation preserve source identity',async()=>{
 const f=rich(),v=fixture();await v.setState(f.b.state);await selectValue(v.element,'graph-kind','Publication');await fire(records(v).find(n=>n.dataset.entityId===f.publicationIds[0]),'click');
 const incoming=v.element.querySelector('[aria-label="指向此记录"]');assert.equal(incoming.querySelectorAll('[data-edge-id]').length,6);assert.match(incoming.textContent,/来源 → 当前 · 观测发布登记/);
 await fire(incoming.querySelector('[aria-label="指向此记录关系分页下一页"]'),'click');const later=v.element.querySelector('[aria-label="指向此记录"]');assert.ok(later.querySelectorAll('[data-edge-id]').length>0);
 const neighbor=later.querySelector('[data-node-id]');const id=neighbor.dataset.entityId;await fire(neighbor,'click');assert.equal(v.element.querySelector('[name="graph-kind"]').value,'');assert.ok(v.element.querySelector('[aria-label="选中记录详情"]').textContent.includes(id));assert.equal(document.activeElement.dataset.focusKey,'graph:detail');v.close();
});

test('semantic DOM: failed refresh retains old graph, blocks stale editor links, and supports explicit retry',async()=>{
 const f=rich();let fail=false;const v=fixture({project:async s=>{if(fail)throw Object.assign(new Error('模拟失败'),{code:'TEST_INVALID'});return projectWebState(s)}});
 await v.setState(f.b.state);await selectValue(v.element,'graph-kind','Work');assert.ok(v.element.querySelector('[data-focus-key="graph:editor"]'));
 const before=v.status.graph;fail=true;f.b.run('updateIdea',{workId:f.workId,title:'新版本'});await v.setState(f.b.state);assert.equal(v.status.graph,before);assert.match(v.element.querySelector('[role="alert"]').textContent,/保留以下旧快照/);assert.equal(v.element.querySelector('[data-focus-key="graph:editor"]'),null);
 fail=false;await fire(findButton(v.element,'重新校验'),'click');assert.equal(v.status.error,null);assert.equal(v.status.graph.revision,f.b.state.revision);assert.ok(v.element.querySelector('[data-focus-key="graph:editor"]'));v.close();
});

test('semantic DOM: initial failure is unavailable, not zero; missing Work route does not open a different work',async()=>{
 const v=fixture();await v.setState({bad:'invalid'});assert.equal(v.status.graph,null);assert.match(v.element.textContent,/尚无可用快照/);assert.doesNotMatch(v.element.textContent,/校验通过的空工作区/);
 await v.setState(ideas(1).state);v.setWorkScope('missing-work');assert.equal(records(v).length,0);assert.match(v.element.textContent,/不存在的作品/);assert.equal(v.element.querySelector('[data-focus-key="graph:editor"]'),null);v.close();
});

test('semantic DOM: keyboard focus survives snapshot refresh and input is not truncated',async()=>{
 const f=rich(),v=fixture();await v.setState(f.b.state);await selectValue(v.element,'graph-kind','Work');const n=records(v)[0];n.focus();const key=n.dataset.focusKey;
 f.b.run('updateIdea',{workId:f.workId,title:'再次改名'});await v.setState(f.b.state);assert.equal(document.activeElement.dataset.focusKey,key);assert.equal(document.activeElement.isConnected,true);
 const s=v.element.querySelector('[name="graph-search"]');s.focus();s.value='x'.repeat(2000);await fire(s,'input');assert.equal(s.value.length,2000);assert.equal(document.activeElement,s);v.close();
});

test('actual app integration: six navigation items, shared appearance, relation route, editor jump, and Back/Forward route restoration',async()=>{
 const f=rich(),store=createMemoryStore({initialState:f.b.state,policy:storagePolicy({origin:'https://example.github.io'})});const app=await mountCreator(store);app.navigate('database');
 const originalRevision=app.controller.state.revision;await fire(findButton(document.body,'关系视图'),'click');await settled();assert.equal(location.hash,'#view=database&panel=relations');assert.equal(document.querySelector('[aria-label="创作模块"]').querySelectorAll('[data-view]').length,6);
 assert.equal(document.querySelectorAll('[data-buffer]').length,0,'graph does not mount editors');assert.match(document.getElementById('main').textContent,/方法笔记：未接入/);
 for(const [name,value]of [['presentation','classic'],['layout','A'],['layout','B'],['color','light'],['color','dark'],['presentation','studio']]){await selectValue(document,name,value);await settled();assert.equal(app.controller.state.revision,originalRevision);assert.ok(document.querySelector('[aria-label="只读关系浏览器"]'))}
 await selectValue(document,'graph-kind','Draft');const first=document.querySelector('[aria-label="记录列表"]').querySelector('[data-node-id]');await fire(first,'click');const jump=document.querySelector('[data-focus-key="graph:editor"]');assert.ok(jump);await fire(jump,'click');assert.equal(location.hash,`#view=production&work=${f.workId}`);assert.ok(document.getElementById('work-detail'));
 // The minimal fixture has no browser history stack. Invoke actual route handlers with the observed hashes.
 location.hash='#view=database&panel=relations';await events.get('popstate')();await settled();assert.ok(document.querySelector('[aria-label="只读关系浏览器"]'));assert.equal(document.getElementById('work-detail'),null);
 location.hash=`#view=production&work=${f.workId}`;await events.get('popstate')();assert.ok(document.getElementById('work-detail'));
 assert.equal(app.controller.state.revision,originalRevision);app.close();
});

test('actual app integration: graph opening, filtering and return preserve unsaved draft buffers, backups, original links and synthetic policy',async()=>{
 const f=rich(),app=await mountCreator(createMemoryStore({initialState:f.b.state,policy:storagePolicy({origin:'https://example.github.io'})}));app.navigate('production',f.workId);
 const form=document.querySelector(`[data-buffer="draft:${f.workId}"]`);await input(form,'body','未保存的合成稿件');const before=JSON.stringify(app.controller.state);
 await fire(findButton(document.body,'查看关系'),'click');await settled();assert.equal(location.hash,`#view=database&work=${f.workId}&panel=relations`);assert.equal(document.querySelector('[name="graph-work"]').value,f.workId);assert.equal(document.getElementById('work-detail'),null);assert.doesNotMatch(document.getElementById('main').textContent,/未保存的合成稿件/);
 app.navigate('production',f.workId);assert.equal(document.querySelector(`[data-buffer="draft:${f.workId}"]`).querySelector('[name="body"]').value,'未保存的合成稿件');assert.equal(JSON.stringify(app.controller.state),before);
 await fire(findButton(document.body,'备份 / 恢复'),'click');assert.ok(document.querySelectorAll('input').filter(n=>n.type==='file').every(n=>n.disabled));await fire(findButton(document.querySelector('dialog'),'关闭'),'click');
 for(const href of ['../dashboard/','../chat/','../projects/'])assert.ok(document.querySelectorAll('a').some(a=>a.getAttribute('href')===href));assert.match(document.body.textContent,/请勿输入真实私稿/);app.close();
});

test('actual app: hashchange panel switch is honored and clicking return data table closes graph without writes',async()=>{
 const app=await mountCreator(createMemoryStore({initialState:builder().state}));app.navigate('database');const revision=app.controller.state.revision;
 location.hash='#view=database&panel=relations';await events.get('hashchange')();await settled();assert.ok(document.querySelector('[aria-label="只读关系浏览器"]'));assert.match(document.getElementById('main').textContent,/校验通过的空工作区/);
 await fire(findButton(document.body,'返回数据表'),'click');assert.equal(location.hash,'#view=database');assert.equal(document.querySelector('[aria-label="只读关系浏览器"]'),null);assert.ok(findButton(document.body,'录入指标'));assert.equal(app.controller.state.revision,revision);app.close();
});

test('semantic DOM: planned and cancelled draft publications truthfully have no final publication snapshot',async()=>{
 const f=rich(),planned=f.b.run('setSchedule',{workId:f.followupId,accountId:f.accountId,schedule:{date:'2026-10-10',timeZone:'UTC',allDay:true}}).publicationId,v=fixture();
 for(const cancel of [false,true]){
  if(cancel)f.b.run('cancelSchedule',{publicationId:planned});
  await v.setState(f.b.state);await selectValue(v.element,'graph-kind','Publication');await fire(records(v).find(n=>n.dataset.entityId===planned),'click');
  const detail=v.element.querySelector('[aria-label="选中记录详情"]');assert.match(detail.textContent,/尚无最终发布快照/);assert.doesNotMatch(detail.textContent,/标题和正文来自此 Publication 的最终快照/);assert.equal(detail.querySelector('[data-fulltext="body"]'),null);
 }
 v.close();
});
