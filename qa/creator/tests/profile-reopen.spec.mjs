import {chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test,expect,boot,guardNetwork,form,input,submit,readState,screenshot,writeEvidence,ORIGIN} from './helpers.mjs';

test('real persistent synthetic browser profile survives full close and relaunch',async({},testInfo)=>{
  test.setTimeout(120000);
  const profile=await mkdtemp(join(tmpdir(),'creator-synthetic-qa-'));
  let context;
  const guards=[];
  try{
    context=await chromium.launchPersistentContext(profile,{channel:'chrome',chromiumSandbox:true,headless:true,baseURL:ORIGIN,viewport:{width:1280,height:900},locale:'zh-CN',timezoneId:'UTC',serviceWorkers:'block'});
    guards.push(await guardNetwork(context));
    let page=await context.newPage();
    await boot(page);
    expect(Object.keys((await readState(page)).works)).toHaveLength(0);
    await page.getByRole('button',{name:'新建选题',exact:true}).first().click();
    let editor=form(page,'capture-idea');
    await input(editor,'title').fill('虚构浏览器重启保存样本');
    await input(editor,'angle').fill('整个测试浏览器关闭后再次打开');
    await input(editor,'synthetic').check();
    await submit(page,editor);
    const workId=Object.keys((await readState(page)).works)[0];
    await page.locator('#work-detail').getByRole('button',{name:'开始创作',exact:true}).click();
    await submit(page,form(page,`start:${workId}`));
    editor=form(page,`draft:${workId}`);
    await input(editor,'body').fill('这段合成稿件通过真实 UI 保存，应在全新浏览器进程中保留。');
    await submit(page,editor);
    const before=await readState(page);
    await context.close();
    context=null;
    // A second successful launch of the same isolated profile verifies actual
    // on-disk IndexedDB preservation; this is not a fallback after failure.
    context=await chromium.launchPersistentContext(profile,{channel:'chrome',chromiumSandbox:true,headless:true,baseURL:ORIGIN,viewport:{width:1280,height:900},locale:'zh-CN',timezoneId:'UTC',serviceWorkers:'block'});
    guards.push(await guardNetwork(context));
    page=await context.newPage();
    await boot(page,`/creator/index.html#view=production&work=${workId}`);
    const reopened=await readState(page);
    expect(reopened).toEqual(before);
    await expect(input(form(page,`draft:${workId}`),'body')).toHaveValue('这段合成稿件通过真实 UI 保存，应在全新浏览器进程中保留。');
    await screenshot(page,testInfo,'ui-persistent-profile-reopened');
    await writeEvidence(testInfo,'profile-reopen',{scope:'Actual UI writes then complete browser close and persistent-profile relaunch',syntheticOnly:true,profileNewAtStart:true,workId,draftId:reopened.works[workId].bodyRevisionId,identicalCommittedState:true,chromiumSandbox:true,profileUploaded:false,distinctFromBackupImport:true});
  }finally{
    try{await context?.close();}finally{
      // Delete only the temporary synthetic profile created by this test.
      await rm(profile,{recursive:true,force:true});
      for(const verify of guards)verify();
    }
  }
});
