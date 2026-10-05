import {test,expect,boot,form,input,readState,submit,writeEvidence,screenshot} from './helpers.mjs';

test('actual UI preserves unsaved text after injected IndexedDB quota error; retry and native backup',async({page},testInfo)=>{
  await boot(page);
  await page.getByRole('button',{name:'新建选题',exact:true}).first().click();
  const editor=form(page,'capture-idea');
  await input(editor,'title').fill('虚构故障恢复样本');
  await input(editor,'angle').fill('失败以后保留正在输入的合成内容');
  await input(editor,'synthetic').check();
  // Controlled, one-shot test fault. This is not actual quota exhaustion.
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){
      if(this.name==='workspaces'){
        IDBObjectStore.prototype.put=original;
        throw new DOMException('Synthetic one-shot quota test','QuotaExceededError');
      }
      return original.apply(this,args);
    };
  });
  const before=await readState(page);
  await editor.locator('button[type="submit"]').click();
  await expect(page.locator('#save-status')).toHaveAttribute('role','alert');
  await expect(page.locator('#save-status')).toContainText('未保存');
  await expect(input(editor,'title')).toHaveValue('虚构故障恢复样本');
  await expect(input(editor,'angle')).toHaveValue('失败以后保留正在输入的合成内容');
  expect(await readState(page)).toEqual(before);
  await screenshot(page,testInfo,'ui-injected-quota-preserves-buffer');
  await submit(page,editor);
  const state=await readState(page);
  const workId=Object.keys(state.works)[0];
  expect(state.works[workId].title).toBe('虚构故障恢复样本');
  await page.getByRole('button',{name:'备份 / 恢复',exact:true}).click();
  await page.getByRole('button',{name:'核对全部已保存业务记录',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('虚构故障恢复样本');
  await expect(page.getByRole('dialog')).toContainText('附件文件本体：0 个');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载已核对的私有备份',exact:true}).click();
  const download=await pending;
  expect(await download.failure()).toBeNull();
  const stream=await download.createReadStream();
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const pkg=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(pkg.protocol).toBe('mydotwork.creator.v1');
  expect(pkg.records.find(r=>r.collection==='works'&&r.id===workId).entity.title).toBe('虚构故障恢复样本');
  await writeEvidence(testInfo,'ui-failure-download',{scope:'Actual UI with explicit one-shot adapter fault injection and native browser download',fault:'Injected QuotaExceededError; not real storage exhaustion',persistedStateUnchangedOnFailure:true,bufferPreserved:true,retryCommitted:true,downloadParsed:true,exportedWorkId:workId,backupBytesAttached:false});
});

test('actual UI two-tab stale save compares retained input and saved draft before explicit retry',async({page,context},testInfo)=>{
  await boot(page);
  const workId=await page.evaluate(async()=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');
    const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    const run=async(type,payload,operationId)=>store.dispatch({type,payload,operationId,expectedRevision:(await store.read()).revision});
    try{
      const id=(await run('captureIdea',{title:'虚构双标签页样本',angle:'合成并发编辑'},'tabs-idea')).result.workId;
      await run('startProduction',{workId:id},'tabs-start');
      await run('saveDraft',{workId:id,body:'合成基线正文'},'tabs-base');
      return id;
    }finally{store.close();}
  });
  await boot(page,`/creator/index.html#view=production&work=${workId}`);
  const other=await context.newPage();
  await boot(other,`/creator/index.html#view=production&work=${workId}`);
  const local=form(page,`draft:${workId}`),remote=form(other,`draft:${workId}`);
  await input(local,'body').fill('合成标签页一尚未保存的正文');
  await input(remote,'body').fill('合成标签页二已经保存的正文');
  await submit(other,remote);
  await local.locator('button[type="submit"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('合成标签页一尚未保存的正文');
  await expect(page.getByRole('dialog')).toContainText('合成标签页二已经保存的正文');
  await screenshot(page,testInfo,'ui-two-tab-conflict');
  await page.getByRole('button',{name:'保留输入，采用当前版本作为重试基线'}).click();
  await expect(input(local,'body')).toHaveValue('合成标签页一尚未保存的正文');
  let current=await readState(page);
  expect(current.drafts[current.works[workId].bodyRevisionId].body).toBe('合成标签页二已经保存的正文');
  await submit(page,local);
  current=await readState(page);
  expect(current.drafts[current.works[workId].bodyRevisionId].body).toBe('合成标签页一尚未保存的正文');
  expect(Object.values(current.drafts)).toHaveLength(3);
  await writeEvidence(testInfo,'ui-two-tab-conflict',{scope:'Actual UI concurrency over shared browser IndexedDB',comparisonHasRetainedAndSavedBodies:true,explicitRebaseDoesNotWrite:true,separateRetryCommitted:true,immutableDraftCount:3});
  await other.close();
});
