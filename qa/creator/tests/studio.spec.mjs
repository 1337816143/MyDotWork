import {test,expect,boot,readState,form,input,assertNoOverflow,screenshot,writeEvidence} from './helpers.mjs';

async function seed(page){
  return page.evaluate(async()=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');
    const {seedDemo}=await import('/creator/core/fixtures.mjs');
    const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    try{
      const seeded=await seedDemo(store),before=await store.read();
      const result=await store.dispatch({type:'appendMetrics',payload:{snapshots:[{publicationId:seeded.publicationId,metricKey:'views',value:195,observedAt:'2026-10-04T11:00:00Z',sourceRef:'Studio synthetic sample'}]},operationId:'studio-synthetic-195',expectedRevision:before.revision});
      return {...seeded,metricId:result.result.metricIds[0],state:undefined};
    }finally{store.close();}
  });
}

test('studio actual three-view performance has identical snapshot identity, unknown/zero and source drilldown',async({page},testInfo)=>{
  await boot(page);const ids=await seed(page);await page.reload();
  const observations=[];
  for(const [width,view]of [[1280,'desk'],[390,'library'],[320,'database']]){
    await page.setViewportSize({width,height:900});
    await page.locator(`nav [data-view="${view}"]`).click();
    const row=page.locator(`[data-performance-row="${ids.publicationId}"]`),metric=row.locator('[data-metric="views"]');
    await expect(page.getByRole('table').getByRole('columnheader')).toHaveCount(7);
    await expect(metric).toHaveText('195');await expect(metric).toHaveAttribute('data-snapshot-id',ids.metricId);
    await expect(row).toHaveAttribute('data-work-id',ids.workId);
    await expect(row.locator('[data-metric="comments"]')).toHaveText('未记录');await expect(row.locator('[data-metric="shares"]')).toHaveText('0');
    observations.push({view,width,workId:ids.workId,publicationId:ids.publicationId,snapshotId:await metric.getAttribute('data-snapshot-id'),value:await metric.textContent(),...(await assertNoOverflow(page))});
    if(view==='desk')await screenshot(page,testInfo,'studio-overview-synthetic');
    if(view==='library')await screenshot(page,testInfo,'studio-performance-mobile-synthetic');
    await row.getByRole('button',{name:'核对来源'}).click();await expect(page.locator('dialog')).toContainText('Studio synthetic sample');
    const identity=page.locator('dialog details').filter({hasText:ids.metricId});await identity.locator('summary').click();await expect(identity).toContainText(ids.metricId);
    await page.keyboard.press('Escape');await expect(row.getByRole('button',{name:'核对来源'})).toBeFocused();
  }
  const added=await page.evaluate(async({publicationId})=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    try{const before=await store.read();return (await store.dispatch({type:'appendMetrics',payload:{snapshots:[{publicationId,metricKey:'views',value:201,observedAt:'2026-10-04T12:00:00Z',sourceRef:'Later studio synthetic sample'}]},operationId:'studio-synthetic-201',expectedRevision:before.revision})).result.metricIds[0]}finally{store.close()}
  },ids);
  for(const view of ['desk','library','database']){
    await page.locator(`nav [data-view="${view}"]`).click();const metric=page.locator(`[data-performance-row="${ids.publicationId}"] [data-metric="views"]`);
    await expect(metric).toHaveText('201');await expect(metric).toHaveAttribute('data-snapshot-id',added);
  }
  await writeEvidence(testInfo,'studio-shared-views',{scope:'Three actual rendered views and one IndexedDB record, explicit synthetic data only',observations,subsequentValue:201,subsequentSnapshotId:added,publicPrivateImportsEnabled:false});
});

test('studio native presentation switch preserves input, revision, navigation and classic fallback',async({page},testInfo)=>{
  await boot(page);await page.locator('nav [data-view="ideas"]').click();
  await page.locator('.page-heading').getByRole('button',{name:'新建选题',exact:true}).click();
  await input(form(page,'capture-idea'),'title').fill('Synthetic unsaved title across presentation switch');
  await page.keyboard.press('Escape');const before=await readState(page);
  await page.locator('[name="presentation"]').selectOption('classic');await expect(page.locator('.sidebar nav')).toBeVisible();
  await page.locator('.page-heading').getByRole('button',{name:'新建选题',exact:true}).click();await expect(input(form(page,'capture-idea'),'title')).toHaveValue('Synthetic unsaved title across presentation switch');await page.keyboard.press('Escape');
  await page.locator('[name="presentation"]').selectOption('studio');await expect(page.locator('.studio-nav-slot nav')).toBeVisible();
  expect(await page.locator('nav [data-view]').evaluateAll(nodes=>nodes.map(node=>node.dataset.view))).toEqual(['desk','library','production','ideas','calendar','database']);
  expect((await readState(page)).revision).toBe(before.revision);await expect(page).toHaveURL(/#view=ideas$/);
  await page.locator('nav [data-view="calendar"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#view-title')).toHaveText('日历');
  await page.locator('[name="presentation"]').selectOption('classic');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-presentation','classic');
  await page.locator('[name="presentation"]').selectOption('studio');await page.locator('[name="layout"]').selectOption('A');await expect(page.locator('html')).toHaveAttribute('data-layout','A');
  await page.locator('[name="layout"]').selectOption('B');await expect(page.locator('html')).toHaveAttribute('data-layout','B');await assertNoOverflow(page);
  await writeEvidence(testInfo,'studio-navigation',{scope:'Native controls and keyboard, unchanged saved state and retained unsubmitted synthetic buffer',businessRevision:before.revision,presentationPersisted:true,legacyLayouts:['A','B']});
});

test('studio SVG changes under normal motion and stays static for reduced motion and explicit off',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await boot(page);
  const orb=page.locator('.studio-orb');await orb.scrollIntoViewIfNeeded();await expect(orb).toHaveAttribute('aria-hidden','true');
  const shape=()=>orb.locator('path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')).join('|'));
  const initial=await shape();await expect.poll(shape).not.toBe(initial);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const reduced=await shape();await page.waitForTimeout(200);expect(await shape()).toBe(reduced);
  await page.emulateMedia({reducedMotion:'no-preference'});await expect.poll(shape).not.toBe(reduced);
  await page.locator('[name="motion"]').selectOption('off');await orb.scrollIntoViewIfNeeded();const off=await shape();await page.waitForTimeout(200);expect(await shape()).toBe(off);
  await page.locator('nav [data-view="ideas"]').click();await expect(orb).toHaveCount(0);
  await page.locator('nav [data-view="desk"]').click();await expect(orb).toHaveCount(1);await orb.scrollIntoViewIfNeeded();const returned=await shape();await page.waitForTimeout(200);expect(await shape()).toBe(returned);
  await writeEvidence(testInfo,'studio-motion',{scope:'Actual SVG path changes and stable samples; no claim of device battery/performance measurement',normalChanges:true,reducedStable:true,explicitOffStable:true,offSurvivesNavigation:true});
});
