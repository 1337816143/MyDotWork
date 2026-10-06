// Independent browser coverage. Install beside helpers.mjs in qa/creator/tests/.
// This file never launches a browser or changes the existing candidate-runner gate.
import {test,expect,boot,readState,form,input,assertNoOverflow,screenshot,writeEvidence} from './helpers.mjs';

async function seedGraph(page){
  return page.evaluate(async()=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');
    const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    let operation=0;
    const run=async(type,payload)=>{
      const state=await store.read();
      return (await store.dispatch({type,payload,operationId:`graph-browser-synthetic-${++operation}`,expectedRevision:state.revision})).result;
    };
    try{
      const initial=await store.read();
      if(initial.dataClass!=='synthetic'||Object.keys(initial.works).length)throw new Error('Graph QA requires a fresh synthetic workspace');
      const accountId=(await run('createAccount',{displayName:'虚构图谱账号',platform:'Synthetic',handle:'synthetic-graph'})).accountId;
      const workIds=[];
      for(let i=0;i<31;i++)workIds.push((await run('captureIdea',{
        title:'同名虚构图谱作品',summary:i===30?'全文末页唯一线索':'纯合成分页验收',angle:'独立虚构切入点',contentType:'text',
        ...(i===0?{references:[{title:'<img src=x onerror=synthetic>虚构参考',url:'https://example.com/graph-synthetic',analysis:'仅显示原文，不访问来源'}]}:{}),
      })).workId);
      const workId=workIds[0];
      const started=await run('startProduction',{workId});
      const body='虚构长正文。'.repeat(1050)+'\r\n\t原文 "引号" 与 C:\\synthetic\\draft\n<script>synthetic only</script>\n'+'unbroken-synthetic-'.repeat(35)+'\n末尾全文标记 🧪';
      const draftId=(await run('saveDraft',{workId,body})).draftId;
      for(const taskId of started.taskIds)await run('setTaskState',{workId,taskId,status:'done'});
      await run('setReady',{workId});
      const publicationIds=[];
      for(let i=0;i<2;i++)publicationIds.push((await run('recordPublication',{
        workId,accountId,actualPublishedAt:'2026-10-05T12:00:00Z',publicUrl:`https://example.com/synthetic-graph-publication-${i}`,
      })).publicationId);
      const metricIds=(await run('appendMetrics',{snapshots:Array.from({length:15},(_,i)=>({
        publicationId:publicationIds[0],metricKey:'views',value:i===1?null:i,
        observedAt:new Date(Date.parse('2026-10-05T12:00:00Z')+i*1000).toISOString(),sourceRef:`synthetic-graph-observation-${i}`,
      }))})).metricIds;
      const globalMetricId=(await run('appendMetrics',{snapshots:[{accountId,metricKey:'followers',value:999,observedAt:'2026-10-05T12:00:00Z',sourceRef:'synthetic-account-global'}]})).metricIds[0];
      return {workId,workIds,draftId,publicationIds,metricIds,globalMetricId,body};
    }finally{store.close();}
  });
}

const graph=page=>page.getByRole('region',{name:'只读关系浏览器',exact:true});
const cards=page=>graph(page).locator('.graph-node-list > [data-entity-id]');
const card=(page,id)=>cards(page).filter({has:page.locator(`.id`,{hasText:id})});
async function readyGraph(page){
  await expect(page.locator('#view-title')).toHaveText('关系视图');
  await expect(graph(page)).toHaveAttribute('aria-busy','false');
  await expect(graph(page).locator('.status-box')).toContainText('已校验');
  await expect(graph(page).locator('[role="alert"]')).toHaveCount(0);
}
async function openGraph(page){
  await page.locator('nav [data-view="database"]').click();
  await page.locator('.page-heading').getByRole('button',{name:'关系视图',exact:true}).click();
  await readyGraph(page);
}
async function chooseRecord(page,kind,id){
  await graph(page).locator('[name="graph-kind"]').selectOption(kind);
  await card(page,id).click();
  await expect(graph(page).locator('.graph-detail > .id')).toContainText(id);
}

test('readonly graph: actual entry, duplicate identities, full text, directed relation pages, zero/unknown and unchanged IndexedDB',async({page},testInfo)=>{
  test.setTimeout(180000);
  await boot(page);const ids=await seedGraph(page);await page.reload();
  const before=await readState(page);
  await openGraph(page);
  await expect(page.locator('nav [data-view]')).toHaveCount(6);
  await expect(graph(page)).toContainText('方法笔记：未接入');
  await graph(page).locator('[name="graph-kind"]').selectOption('Work');
  const seen=[];
  for(let pageNumber=0;pageNumber<3;pageNumber++){
    seen.push(...await cards(page).evaluateAll(nodes=>nodes.map(node=>node.dataset.entityId)));
    await expect(graph(page).getByRole('navigation',{name:'记录分页',exact:true})).toContainText(`第 ${pageNumber+1}/3 页`);
    const next=graph(page).getByRole('button',{name:'记录分页下一页',exact:true});
    if(pageNumber<2)await next.click();else await expect(next).toBeDisabled();
  }
  expect(seen).toHaveLength(31);expect(new Set(seen).size).toBe(31);
  expect([...seen].sort()).toEqual([...ids.workIds].sort());
  await graph(page).locator('[name="graph-search"]').fill('全文末页唯一线索');
  await expect(cards(page)).toHaveCount(1);await expect(cards(page).first()).toHaveAttribute('data-entity-id',ids.workIds[30]);
  await graph(page).getByRole('button',{name:'清除筛选',exact:true}).click();
  const search=graph(page).locator('[name="graph-search"]');
  await search.focus();await page.keyboard.press('Tab');await expect(graph(page).locator('[name="graph-kind"]')).toBeFocused();
  await graph(page).locator('[name="graph-work"]').selectOption(ids.workId);
  await chooseRecord(page,'Draft',ids.draftId);
  await expect(graph(page).locator('[data-fulltext="body"]')).toHaveJSProperty('textContent',ids.body);
  await search.fill('原文 "引号" 与 C:\\synthetic\\draft');
  await expect(cards(page)).toHaveCount(1);
  await cards(page).first().focus();await page.keyboard.press('Enter');
  await expect(graph(page).locator('[data-focus-key="graph:detail"]')).toBeFocused();
  await search.fill('');
  await graph(page).locator('[name="graph-kind"]').selectOption('Publication');
  expect((await cards(page).evaluateAll(nodes=>nodes.map(node=>node.dataset.entityId))).sort()).toEqual([...ids.publicationIds].sort());
  await card(page,ids.publicationIds[0]).click();
  await expect(graph(page).locator('[data-fulltext="body"]')).toHaveJSProperty('textContent',ids.body);
  await expect(graph(page).locator('script,iframe,img,video,audio')).toHaveCount(0);
  expect(await graph(page).locator('a').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')))).toEqual([`#view=library&work=${encodeURIComponent(ids.workId)}`]);
  const incoming=graph(page).getByRole('region',{name:'指向此记录',exact:true});
  const linked=[];
  for(let pageNumber=0;pageNumber<3;pageNumber++){
    linked.push(...await incoming.locator('.graph-edge-list [data-entity-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.entityId)));
    const next=incoming.getByRole('button',{name:'指向此记录关系分页下一页',exact:true});
    if(pageNumber<2)await next.click();else await expect(next).toBeDisabled();
  }
  expect(linked).toHaveLength(15);expect([...linked].sort()).toEqual([...ids.metricIds].sort());
  await incoming.locator('.graph-edge-list [data-entity-id]').first().click();
  await expect(graph(page).locator('[name="graph-kind"]')).toHaveValue('');
  await expect(graph(page).locator('[name="graph-work"]')).toHaveValue('');
  await graph(page).locator('[name="graph-work"]').selectOption(ids.workId);
  await graph(page).locator('[name="graph-kind"]').selectOption('MetricObservation');
  await search.fill(ids.metricIds[0]);await expect(cards(page).locator('[data-kind="observed"]')).toHaveText('观测值：0');
  await search.fill(ids.metricIds[1]);await expect(cards(page).locator('[data-kind="unknown"]')).toHaveText('观测值：未知');
  await search.fill(ids.globalMetricId);await expect(cards(page)).toHaveCount(0);
  await graph(page).getByRole('button',{name:'清除筛选',exact:true}).click();
  await chooseRecord(page,'Publication',ids.publicationIds[1]);
  await screenshot(page,testInfo,'graph-readonly-functional');
  expect(await readState(page)).toEqual(before);
  await writeEvidence(testInfo,'graph-navigation',{scope:'Native read-only graph, actual IndexedDB and business-command synthetic fixtures',worksReached:seen.length,relationsReached:linked.length,publicationIdentities:ids.publicationIds.length,fullBodyCharacters:ids.body.length,zeroAndUnknownDistinct:true,accountGlobalExcludedFromWork:true,businessRevisionBefore:before.revision,businessRevisionAfter:(await readState(page)).revision,privateImportsEnabled:false});
});

test('readonly graph: work-detail entry, editor return, native Back/Forward and unsubmitted draft preservation',async({page},testInfo)=>{
  await boot(page);const ids=await seedGraph(page);
  await page.goto(`/creator/index.html#view=production&work=${encodeURIComponent(ids.workId)}`);
  await page.reload();await expect(page.locator('#work-detail')).toContainText(ids.workId);
  const before=await readState(page),draft=form(page,`draft:${ids.workId}`),unsaved='仅存在表单中的虚构未保存稿件';
  await input(draft,'body').fill(unsaved);
  await page.locator('#work-detail').getByRole('button',{name:'查看关系',exact:true}).click();await readyGraph(page);
  await expect(graph(page).locator('[name="graph-work"]')).toHaveValue(ids.workId);
  await chooseRecord(page,'Draft',ids.draftId);
  await expect(graph(page).locator('[data-fulltext="body"]')).toHaveJSProperty('textContent',ids.body);
  await graph(page).getByRole('link',{name:'打开所属作品编辑器',exact:true}).click();
  await expect(page.locator('#view-title')).toHaveText('创作台');await expect(input(form(page,`draft:${ids.workId}`),'body')).toHaveValue(unsaved);
  await page.goBack();await readyGraph(page);await expect(graph(page).locator('[name="graph-work"]')).toHaveValue(ids.workId);
  await page.goForward();await expect(page.locator('#view-title')).toHaveText('创作台');await expect(input(form(page,`draft:${ids.workId}`),'body')).toHaveValue(unsaved);
  await page.goBack();await readyGraph(page);
  await page.getByRole('button',{name:'返回数据表',exact:true}).click();await expect(page.locator('#view-title')).toHaveText('数据库');await expect(graph(page)).toHaveCount(0);
  await page.goBack();await readyGraph(page);
  expect(await readState(page)).toEqual(before);
  await writeEvidence(testInfo,'graph-history',{scope:'Native same-document history and existing editor, no synthetic history-event substitution',nativeBackForward:true,unsavedBodyRetained:true,savedBodyUnchanged:true,businessRevisionBefore:before.revision,businessRevisionAfter:(await readState(page)).revision});
});

async function doubleText(page){
  return page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('body,body *')].filter(node=>node instanceof HTMLElement);
    const before=nodes.map(node=>({node,size:parseFloat(getComputedStyle(node).fontSize)}));
    for(const {node,size}of before)if(Number.isFinite(size))node.style.fontSize=`${size*2}px`;
    return {checked:before.length,failed:before.filter(({node,size})=>Number.isFinite(size)&&Math.abs(parseFloat(getComputedStyle(node).fontSize)-size*2)>.1).length};
  });
}

test('readonly graph: mobile classic/studio A/B modes at native 200% text, long-body geometry and reduced motion',async({page},testInfo)=>{
  test.setTimeout(180000);
  await boot(page);const ids=await seedGraph(page);const before=await readState(page),observations=[];
  for(const width of [320,390])for(const presentation of ['classic','studio'])for(const [layout,color]of [['A','light'],['B','light'],['B','dark']]){
    await page.setViewportSize({width,height:900});
    await page.goto(`/creator/index.html#view=database&work=${encodeURIComponent(ids.workId)}&panel=relations`);
    await page.reload();await readyGraph(page);
    expect(await page.locator('body').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBe(16);
    expect(await page.locator('body,body *').evaluateAll(nodes=>nodes.filter(node=>node instanceof HTMLElement&&node.style.fontSize).length)).toBe(0);
    await page.locator('[name="presentation"]').selectOption(presentation);
    await page.locator('[name="layout"]').selectOption(layout);await page.locator('[name="color"]').selectOption(color);
    await chooseRecord(page,'Draft',ids.draftId);
    await expect(page.locator('html')).toHaveAttribute('data-presentation',presentation);await expect(page.locator('html')).toHaveAttribute('data-layout',layout);await expect(page.locator('html')).toHaveAttribute('data-color',color);
    const scaling=await doubleText(page);expect(scaling.checked).toBeGreaterThan(20);expect(scaling.failed).toBe(0);
    const geometry=await assertNoOverflow(page);
    const bodyGeometry=await graph(page).locator('[data-fulltext="body"]').evaluate(node=>{
      const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);
      const lines=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
      return {lines:lines.length,clipped:node.scrollWidth>node.clientWidth+2,outside:lines.filter(rect=>rect.left<box.left-1||rect.right>box.right+1).length};
    });
    expect(bodyGeometry.lines).toBeGreaterThan(5);expect(bodyGeometry.clipped).toBe(false);expect(bodyGeometry.outside).toBe(0);
    await expect(graph(page).locator('[data-fulltext="body"]')).toHaveJSProperty('textContent',ids.body);
    observations.push({width,presentation,layout,color,textScale:2,scaling,...geometry,bodyGeometry});
    if((width===320&&presentation==='classic'&&layout==='A')||(width===390&&presentation==='studio'&&layout==='B'&&color==='dark'))await screenshot(page,testInfo,`graph-readonly-${width}-${presentation}-${layout}-${color}-text200`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await readyGraph(page);
  const durations=await graph(page).evaluate(node=>[node,...node.querySelectorAll('*')].flatMap(el=>[getComputedStyle(el).animationDuration,getComputedStyle(el).transitionDuration]).flatMap(value=>value.split(',').map(part=>part.trim().endsWith('ms')?parseFloat(part):parseFloat(part)*1000)));
  expect(Math.max(...durations)).toBeLessThanOrEqual(1);
  expect(await readState(page)).toEqual(before);
  await writeEvidence(testInfo,'graph-mobile-layout',{scope:'Actual browser text and element geometry; synthetic graph only',observations,reducedMotionMaximumMs:Math.max(...durations),businessRevisionBefore:before.revision,businessRevisionAfter:(await readState(page)).revision,limitations:['No screen-reader assistive technology was run','200% is exact computed-font doubling, not browser zoom']});
});
