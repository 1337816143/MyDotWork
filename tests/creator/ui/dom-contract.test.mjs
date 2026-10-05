import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {installDomFixture,fire,input,submit,findButton} from './dom-fixture.mjs';
const ui=process.env.CREATOR_UI_DIR||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {document}=installDomFixture();
const {mountCreator}=await import(pathToFileURL(path.join(ui,'app.mjs')));
const {createMemoryStore,storagePolicy}=await import(pathToFileURL(path.join(ui,'core/store.mjs')));
const {createWorkspace}=await import(pathToFileURL(path.join(ui,'core/core.mjs')));

test('DOM fixture: actual form callbacks create account, idea, draft, tasks and schedule across all six views',async()=>{
  const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'}),policy:storagePolicy({origin:'https://example.github.io',persistence:'memory-test'})});
  const app=await mountCreator(store);const getForm=key=>document.querySelector(`[data-buffer="${key}"]`);
  assert.match(document.body.textContent,/虚构演示/);assert.match(document.body.textContent,/浏览器本地保存不是云端备份/);
  await fire(findButton(document.body,'账号'),'click');let form=getForm('account:new');await input(form,'displayName','虚构账号甲');await input(form,'platform','演示平台');await submit(form);
  assert.equal(Object.keys(app.controller.state.accounts).length,1);const accountId=Object.keys(app.controller.state.accounts)[0];
  await fire(findButton(document.body,'关闭'),'click');await fire(findButton(document.body,'新建选题'),'click');form=getForm('capture-idea');
  await input(form,'title','DOM 合成选题');await input(form,'angle','独立切入点');await input(form,'referenceTitle','离线参考');await input(form,'synthetic',true);await submit(form);
  assert.equal(Object.keys(app.controller.state.works).length,1);const workId=Object.keys(app.controller.state.works)[0];
  assert.equal(app.controller.state.works[workId].title,'DOM 合成选题');
  await fire(findButton(document.body,'开始创作'),'click');form=getForm(`start:${workId}`);
  assert.equal(form.querySelector('[name="contentType"]').value,'video');await submit(form);
  assert.equal(app.controller.state.works[workId].phase,'producing');
  form=getForm(`draft:${workId}`);await input(form,'title','已保存标题');await input(form,'body','<script>这是原文，不应执行</script>');await submit(form);
  assert.equal(Object.keys(app.controller.state.drafts).length,1);
  for(const task of Object.values(app.controller.state.tasks)){form=getForm(`task:${task.id}`);assert.equal(form.querySelector('[name="status"]').value,'todo');await input(form,'status','done');await submit(form)}
  await fire(findButton(document.body,'检查并设为可发布'),'click');assert.equal(app.controller.state.works[workId].phase,'ready');
  await fire(findButton(document.body,'新增账号排期'),'click');form=getForm(`schedule:${workId}`);await input(form,'accountId',accountId);await input(form,'date','2026-10-06');await input(form,'time','18:00');await input(form,'timeZone','Asia/Shanghai');await submit(form);
  assert.equal(Object.keys(app.controller.state.publications).length,1);assert.match(document.body.textContent,/Asia\/Shanghai/);
  await fire(findButton(document.body,'登记已发布事实'),'click');form=getForm(`publication:${workId}`);
  await input(form,'accountId',accountId);await input(form,'actualDateTime','2026-10-01T18:05');await input(form,'offset','+08:00');await input(form,'publicUrl','https://example.com/synthetic/published');await input(form,'confirmed',true);await submit(form);
  assert.equal(Object.values(app.controller.state.publications).filter(p=>p.status==='published').length,1);assert.equal(Object.keys(app.controller.state.publications).length,1);assert.ok(Object.values(app.controller.state.publications)[0].schedule);
  app.navigate('database',workId);
  for(const [value,observed]of [['100','2026-10-02T18:00'],['160','2026-10-03T18:00']]){
    await fire(findButton(document.body,'为这件作品录入指标'),'click');form=getForm(`metrics:${workId}`);
    await input(form,'value',value);await input(form,'observedDateTime',observed);await input(form,'offset','+08:00');await input(form,'definition','演示累计播放');await input(form,'sourceRef','虚构手工记录');await submit(form);
  }
  assert.equal(Object.keys(app.controller.state.metrics).length,2);assert.match(document.body.textContent,/160/);assert.match(document.body.textContent,/\+60/);
  form=getForm(`review:${workId}`);await input(form,'observation','合成数据增加 60');await input(form,'nextExperiment','下一次验证标题');const evidence=form.querySelector('input[type="checkbox"]');evidence.checked=true;await fire(evidence,'change');await submit(form);
  assert.equal(Object.keys(app.controller.state.reviews).length,1,document.getElementById('save-status').textContent);
  const reviewId=Object.keys(app.controller.state.reviews)[0];await fire(findButton(document.body,'转为后续选题'),'click');form=getForm(`followup:${reviewId}`);await input(form,'title','后续虚构选题');await submit(form);
  assert.equal(Object.keys(app.controller.state.works).length,2);assert.equal(Object.values(app.controller.state.works).find(w=>w.id!==workId).parentWorkId,workId);
  for(const view of ['desk','ideas','production','calendar','library','database']){app.navigate(view,workId);assert.ok(document.getElementById('work-detail'));assert.ok(document.body.textContent.includes(workId));assert.equal(location.hash,`#view=${view}&work=${workId}`)}
  await fire(findButton(document.body,'备份 / 恢复'),'click');assert.ok(document.querySelectorAll('input').filter(i=>i.type==='file').every(i=>i.disabled));await fire(findButton(document.body,'关闭'),'click');
  app.navigate('database',workId);await fire(findButton(document.body,'指标 CSV'),'click');assert.ok(document.querySelector('input[type="file"]').disabled);app.close();
});

test('DOM fixture: a failed submit keeps visible text and never reports successful save',async()=>{
  let fail=false;const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'}),failWrite:()=>{if(fail)throw new Error('simulated interrupted write')}});
  const app=await mountCreator(store);app.navigate('ideas');await fire(findButton(document.body,'新建选题'),'click');let form=document.querySelector('[data-buffer="capture-idea"]');
  await input(form,'title','仍在输入框的标题');await input(form,'angle','保留全文');await input(form,'synthetic',true);fail=true;await submit(form);
  assert.equal(Object.keys(app.controller.state.works).length,0);assert.equal(form.querySelector('[name="title"]').value,'仍在输入框的标题');assert.match(document.getElementById('save-status').textContent,/尚未保存/);
  fail=false;await submit(form);assert.equal(Object.keys(app.controller.state.works).length,1);assert.match(document.getElementById('save-status').textContent,/已保存到此浏览器/);app.close();
});

test('DOM fixture: full versus selected export previews report their actual account scope',async()=>{
  const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'})});const app=await mountCreator(store);app.navigate('desk');
  await app.controller.action('createAccount',{displayName:'Independent synthetic account',platform:'Demo'});
  await fire(findButton(document.body,'备份 / 恢复'),'click');await fire(findButton(document.body,'核对全部已保存业务记录'),'click');
  assert.match(document.body.textContent,/作品 0 · 账号 1/);await fire(findButton(document.body,'关闭'),'click');
  await fire(findButton(document.body,'备份 / 恢复'),'click');await fire(findButton(document.body,'核对勾选作品备份'),'click');
  assert.match(document.body.textContent,/作品 0 · 账号 0/);assert.match(document.body.textContent,/不包含无关账号和全局目标/);app.close();
});

test('DOM fixture: future snapshots stay out of default cards/trends/deltas and require explicit future cutoff',async()=>{
  const store=createMemoryStore({initialState:createWorkspace({dataClass:'synthetic'})});const app=await mountCreator(store);app.navigate('desk');
  const accountId=(await app.controller.action('createAccount',{displayName:'Cutoff demo',platform:'Synthetic'})).result.accountId;
  for(const [value,observedAt]of [[100,'2020-01-01T00:00:00Z'],[160,'2020-01-02T00:00:00Z'],[900,'2099-01-01T00:00:00Z']])await app.controller.action('appendMetrics',{snapshots:[{accountId,metricKey:'followers',value,definition:'cumulative followers',observedAt,sourceRef:'Cutoff synthetic evidence'}]});
  app.render();const metricValues=()=>document.querySelectorAll('span').filter(n=>n.className==='metric-value').map(n=>n.textContent);
  assert.deepEqual(metricValues(),['160']);assert.match(document.getElementById('main').textContent,/\+60/);assert.doesNotMatch(document.getElementById('main').textContent,/2099-01-01|900/);assert.equal(document.getElementById('main').querySelectorAll('circle').length,2);
  app.navigate('database');assert.deepEqual(metricValues(),['160']);assert.match(document.getElementById('main').textContent,/\+60/);
  const cutoff=document.querySelector('[data-focus-key="filter:asof"]');cutoff.value='2100-01-01T00:00:00Z';await fire(cutoff,'change');
  assert.deepEqual(metricValues(),['900']);assert.match(document.getElementById('main').textContent,/\+740/);assert.match(document.getElementById('main').textContent,/2099-01-01/);assert.equal(document.getElementById('main').querySelectorAll('circle').length,3);
  // A database-only future filter must not silently carry into the dashboard.
  app.navigate('desk');assert.deepEqual(metricValues(),['160']);assert.match(document.getElementById('main').textContent,/\+60/);app.close();
});
