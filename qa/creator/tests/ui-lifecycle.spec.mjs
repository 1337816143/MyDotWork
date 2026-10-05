import {test,expect,boot,form,input,readState,submit,waitRevision,detailView,disclose,screenshot,writeEvidence} from './helpers.mjs';

test('actual UI: empty capture through manual publication, snapshots and review',async({page,context},testInfo)=>{
  test.setTimeout(180000);
  await boot(page);
  let state=await readState(page);
  expect(Object.keys(state.works)).toHaveLength(0);
  expect(Object.keys(state.accounts)).toHaveLength(0);
  await expect(page.locator('html')).toHaveAttribute('data-layout','B');
  await expect(page.locator('html')).toHaveAttribute('data-color','dark');

  await page.getByRole('button',{name:'账号',exact:true}).click();
  let editor=form(page,'account:new');
  await input(editor,'displayName').fill('虚构 QA 账号');
  await input(editor,'platform').fill('虚构 QA 平台');
  await input(editor,'handle').fill('synthetic-qa');
  await submit(page,editor);
  await page.getByRole('button',{name:'关闭对话框'}).click();
  const accountId=Object.keys((await readState(page)).accounts)[0];

  await page.getByRole('button',{name:'新建选题',exact:true}).first().click();
  editor=form(page,'capture-idea');
  await input(editor,'title').fill('虚构 QA：一杯水的三个镜头');
  await input(editor,'summary').fill('纯合成资料，用于真实浏览器流程验证');
  await input(editor,'angle').fill('通过三个虚构镜头讲清观察顺序');
  await input(editor,'referenceTitle').fill('合成参考');
  await input(editor,'referenceUrl').fill('https://example.com/synthetic-reference');
  await input(editor,'analysis').fill('只记录来源和拆解；不访问来源');
  await input(editor,'tags').fill('虚构, QA');
  await input(editor,'synthetic').check();
  await submit(page,editor);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  state=await readState(page);
  const workId=Object.keys(state.works)[0];
  expect(new URL(page.url()).hash).toContain(encodeURIComponent(workId));
  expect(Object.values(state.references)[0].workId).toBe(workId);
  await expect(page.locator('#work-detail')).toContainText(workId);

  await page.locator('#work-detail').getByRole('button',{name:'开始创作',exact:true}).click();
  await submit(page,form(page,`start:${workId}`));
  state=await readState(page);
  expect(Object.keys(state.works)).toEqual([workId]);
  expect(Object.values(state.tasks)).toHaveLength(8);
  expect(state.works[workId].phase).toBe('producing');
  await expect(page.locator('#view-title')).toHaveText('创作台');

  editor=form(page,`draft:${workId}`);
  await input(editor,'body').fill('合成初稿\n镜头一：水杯。\n镜头二：表面变化。\n镜头三：观察结论。');
  await submit(page,editor);
  const firstDraftId=(await readState(page)).works[workId].bodyRevisionId;
  const taskIds=Object.keys((await readState(page)).tasks);
  editor=form(page,`task:${taskIds[0]}`);
  await input(editor,'status').selectOption('blocked');
  const beforeRejected=(await readState(page)).revision;
  await editor.locator('button[type="submit"]').click();
  await expect(page.locator('#save-status')).toHaveAttribute('role','alert');
  expect((await readState(page)).revision).toBe(beforeRejected);
  await expect(input(editor,'status')).toHaveValue('blocked');
  await input(editor,'reason').fill('虚构阻塞：等待演示素材');
  await submit(page,editor);
  expect((await readState(page)).tasks[taskIds[0]].reason).toBe('虚构阻塞：等待演示素材');

  await detailView(page,'desk');
  await expect(page.locator('#main')).toContainText('虚构阻塞：等待演示素材');
  await detailView(page,'production');
  for(const taskId of taskIds){
    editor=form(page,`task:${taskId}`);
    await input(editor,'status').selectOption('done');
    await submit(page,editor);
  }

  await detailView(page,'calendar');
  await page.locator('#work-detail').getByRole('button',{name:'新增账号排期',exact:true}).click();
  editor=form(page,`schedule:${workId}`);
  await input(editor,'accountId').selectOption(accountId);
  await input(editor,'date').fill('2026-10-01');
  await input(editor,'timeZone').fill('Asia/Shanghai');
  await input(editor,'allDay').check();
  await submit(page,editor);
  state=await readState(page);
  const publicationId=Object.keys(state.publications)[0];
  expect(state.publications[publicationId].status).toBe('planned');
  expect(state.publications[publicationId].schedule.allDay).toBe(true);
  expect(state.publications[publicationId].schedule.plannedAt).toBeNull();
  const publication=()=>page.locator('#work-detail .publication-row').filter({hasText:publicationId});
  await publication().getByRole('button',{name:'改期',exact:true}).click();
  editor=form(page,`schedule:${publicationId}`);
  await input(editor,'allDay').uncheck();
  await input(editor,'date').fill('2026-10-02');
  await input(editor,'time').fill('18:30');
  await input(editor,'timeZone').fill('Asia/Shanghai');
  await submit(page,editor);
  state=await readState(page);
  expect(Object.keys(state.publications)).toEqual([publicationId]);
  expect(state.publications[publicationId].schedule.plannedAt).toBe('2026-10-02T10:30:00.000Z');
  await publication().getByRole('button',{name:'取消排期',exact:true}).click();
  let before=(await readState(page)).revision;
  await page.getByRole('dialog').getByRole('button',{name:'确认取消排期'}).click();
  await waitRevision(page,before);
  state=await readState(page);
  expect(state.publications[publicationId].schedule).toBeNull();
  expect(state.publications[publicationId].status).toBe('draft');
  before=state.revision;
  await page.getByRole('button',{name:'撤销最近一次可恢复操作'}).click();
  await waitRevision(page,before);
  state=await readState(page);
  expect(state.publications[publicationId].status).toBe('planned');
  expect(state.publications[publicationId].actualPublishedAt).toBeNull();
  expect(state.publications[publicationId].finalSnapshot).toBeNull();

  await detailView(page,'production');
  before=(await readState(page)).revision;
  await page.getByRole('button',{name:'检查并设为可发布'}).click();
  await waitRevision(page,before);
  expect((await readState(page)).works[workId].phase).toBe('ready');
  await detailView(page,'calendar');
  await publication().getByRole('button',{name:'登记已经发布',exact:true}).click();
  editor=form(page,`publication:${publicationId}`);
  await input(editor,'actualDateTime').fill('2026-10-02T18:35');
  await input(editor,'offset').fill('+08:00');
  await input(editor,'publicUrl').fill('https://example.com/synthetic-publication');
  await input(editor,'confirmed').check();
  await submit(page,editor);
  state=await readState(page);
  expect(state.publications[publicationId].status).toBe('published');
  expect(state.publications[publicationId].finalRevisionId).toBe(firstDraftId);
  expect(state.publications[publicationId].finalSnapshot.body).toBe(state.drafts[firstDraftId].body);
  await expect(page.locator('#view-title')).toHaveText('作品库');

  await detailView(page,'database');
  for(const entry of [{metricKey:'views',value:'100',day:'03'},{metricKey:'views',value:'160',day:'04'},{metricKey:'comments',value:'',day:'04'}]){
    await page.locator('#work-detail').getByRole('button',{name:'为这件作品录入指标'}).click();
    editor=form(page,`metrics:${workId}`);
    await input(editor,'metricKey').selectOption(entry.metricKey);
    await input(editor,'value').fill(entry.value);
    await input(editor,'observedDateTime').fill(`2026-10-${entry.day}T10:00`);
    await input(editor,'offset').fill('+08:00');
    await input(editor,'definition').fill('虚构平台累计次数');
    await input(editor,'sourceRef').fill('合成手工观测');
    await submit(page,editor);
  }
  const viewsCard=page.locator('#work-detail .snapshot-row').filter({has:page.getByRole('heading',{name:/播放量$/})});
  await expect(viewsCard.locator('.metric-value')).toHaveText('160');
  await expect(viewsCard).toContainText('上次同口径增量：+60');
  const unknownCard=page.locator('#work-detail .snapshot-row').filter({has:page.getByRole('heading',{name:/评论$/})});
  await expect(unknownCard.locator('.metric-value')).toHaveText('未记录');
  state=await readState(page);
  expect(Object.values(state.metrics).find(m=>m.metricKey==='comments').value).toBeNull();
  expect(Object.values(state.metrics).filter(m=>m.metricKey==='views').map(m=>m.value).sort((a,b)=>a-b)).toEqual([100,160]);

  editor=form(page,`review:${workId}`);
  await input(editor,'observation').fill('虚构累计播放由100变160，增量60');
  await input(editor,'hypothesis').fill('只是假设，不据此认定因果');
  await input(editor,'nextExperiment').fill('下个虚构样本只改变开头镜头');
  for(const checkbox of await editor.locator('input[type="checkbox"]').all())await checkbox.check();
  await submit(page,editor);
  const reviewId=Object.keys((await readState(page)).reviews)[0];
  await page.locator('#work-detail').getByRole('button',{name:'转为后续选题'}).click();
  editor=form(page,`followup:${reviewId}`);
  await input(editor,'title').fill('虚构 QA 后续：先展示结果');
  await submit(page,editor);
  state=await readState(page);
  const followupId=Object.keys(state.works).find(id=>id!==workId);
  expect(state.works[followupId].parentWorkId).toBe(workId);
  expect(state.works[followupId].reviewId).toBe(reviewId);

  // Reload and a new tab reopen the real committed IndexedDB database.
  await page.reload();
  await expect(page.locator('#work-detail')).toContainText(followupId);
  const reopened=await context.newPage();
  await boot(reopened,`/creator/index.html#view=database&work=${workId}`);
  const persisted=await readState(reopened);
  for(const collection of ['works','references','accounts','drafts','tasks','publications','metrics','reviews'])expect(persisted[collection]).toEqual(state[collection]);
  await expect(reopened.locator('#work-detail .snapshot-row').filter({hasText:'播放量'}).locator('.metric-value')).toHaveText('160');
  await screenshot(reopened,testInfo,'ui-flow-synthetic-final');
  await writeEvidence(testInfo,'ui-flow',{scope:'Actual production UI writes, real browser IndexedDB persistence',workId,publicationId,firstDraftId,reviewId,followupId,latestViews:160,viewDelta:60,unknownComments:null,privateUiImportEnabled:false});
  await reopened.close();
});

test('native keyboard, dialog focus/Escape, history, and closed private import',async({page},testInfo)=>{
  await boot(page);
  const opener=page.getByRole('button',{name:'账号',exact:true});
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  for(let i=0;i<10;i++){
    await page.keyboard.press('Tab');
    expect(await page.evaluate(()=>document.activeElement?.closest('dialog')?.open)).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(()=>document.activeElement?.closest('dialog')?.open)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(opener).toBeFocused();

  const nav=page.getByRole('navigation',{name:'创作模块'});
  await nav.getByRole('link',{name:'选题池',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#view-title')).toHaveText('选题池');
  await expect(page.locator('#view-title')).toBeFocused();
  await nav.getByRole('link',{name:'日历',exact:true}).click();
  await expect(page.locator('#view-title')).toHaveText('日历');
  await page.goBack();
  await expect(page.locator('#view-title')).toHaveText('选题池');
  await page.goForward();
  await expect(page.locator('#view-title')).toHaveText('日历');

  await page.getByRole('button',{name:'备份 / 恢复',exact:true}).click();
  await expect(page.getByRole('dialog').locator('input[type="file"]')).toBeDisabled();
  await expect(page.getByRole('button',{name:'查看可恢复导入点'})).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('所有备份与真实/私有导入均关闭');
  await screenshot(page,testInfo,'ui-private-import-disabled');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'备份 / 恢复',exact:true})).toBeFocused();
  await writeEvidence(testInfo,'native-interaction',{scope:'Native keyboard and browser history on unmodified production UI',dialogEscape:true,focusReturn:true,historyBackForward:true,privateUiImportEnabled:false});
});
