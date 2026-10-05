import {test as base, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

export const ORIGIN='http://127.0.0.1:4173';
export const VIEWS={desk:'工作台',ideas:'选题池',production:'创作台',calendar:'日历',library:'作品库',database:'数据库'};
export async function guardNetwork(context){
  const external=[];
  await context.route('**/*',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    if(url.origin===ORIGIN&&['GET','HEAD'].includes(request.method()))return route.continue();
    external.push({origin:url.origin,method:request.method(),resourceType:request.resourceType()});
    await route.abort('blockedbyclient');
  });
  return ()=>expect(external,'Unexpected external or mutating browser requests').toEqual([]);
}
export const test=base.extend({
  protectedContext:[async({context},use)=>{
    const assertNetwork=await guardNetwork(context);
    const errors=[];
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    await use(context);
    assertNetwork();
    expect(errors,'Uncaught browser page errors').toEqual([]);
  },{auto:true}],
});
export {expect};
test.afterEach(async({page},testInfo)=>{
  if(testInfo.status!==testInfo.expectedStatus&&!page.isClosed()&&page.url().startsWith(ORIGIN+'/creator/')){
    try{await screenshot(page,testInfo,'failure-synthetic-creator');}catch{/* Preserve the original test failure if capture itself fails. */}
  }
});
export const form=(page,key)=>page.locator(`form[data-buffer="${key}"]`);
export const input=(scope,name)=>scope.locator(`[name="${name}"]`);
export async function boot(page,path='/creator/index.html'){
  await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'));
  await page.goto(path);
  await expect(page.locator('#view-title')).toBeVisible();
  await expect(page.locator('#policy-band')).toContainText('虚构演示');
}
export async function readState(page){
  return page.evaluate(async()=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');
    const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    try{return await store.read();}finally{store.close();}
  });
}
export async function waitRevision(page,before){
  await expect.poll(async()=>(await readState(page)).revision).toBeGreaterThan(before);
}
export async function submit(page,scope){
  const before=(await readState(page)).revision;
  await scope.locator('button[type="submit"]').click();
  await waitRevision(page,before);
}
export async function detailView(page,view){
  await page.locator('#work-detail .tabs').getByRole('button',{name:VIEWS[view],exact:true}).click();
  await expect(page.locator('#view-title')).toHaveText(VIEWS[view]);
}
export async function disclose(page,title){
  // CSS :has is a supported Locator selector; no DOM state is forced.
  const summary=page.locator('#work-detail summary').filter({hasText:title}).first();
  const parent=summary.locator('..');
  if(await parent.getAttribute('open')===null)await summary.click();
  return parent;
}
export async function writeEvidence(testInfo,name,data){
  const file=testInfo.outputPath(name+'.json');
  await writeFile(file,JSON.stringify({schema:'mydotwork.creator-browser-evidence.v1',sourceCommit:process.env.GITHUB_SHA,...data},null,2)+'\n');
  await testInfo.attach(name,{path:file,contentType:'application/json'});
}
export async function screenshot(page,testInfo,name){
  const file=testInfo.outputPath(name+'.png');
  await page.screenshot({path:file,fullPage:true});
  await testInfo.attach(name,{path:file,contentType:'image/png'});
}
export async function assertNoOverflow(page){
  const result=await page.evaluate(()=>{
    const viewport=document.documentElement.clientWidth;
    const roots=[document.documentElement,document.body,document.querySelector('#main')].filter(Boolean);
    const overflow=roots.filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({element:el.id||el.tagName,client:el.clientWidth,scroll:el.scrollWidth}));
    const outside=[...document.querySelectorAll('main input,main select,main textarea,main button,dialog[open] input,dialog[open] select,dialog[open] textarea,dialog[open] button')].filter(el=>el.getClientRects().length).map(el=>({element:el.tagName,name:el.getAttribute('name')||'',rect:el.getBoundingClientRect()})).filter(({rect})=>rect.left < -2 || rect.right > viewport+2).map(({element,name,rect})=>({element,name,left:rect.left,right:rect.right}));
    return {overflow,outside};
  });
  expect(result,'Page/content/control horizontal overflow').toEqual({overflow:[],outside:[]});
  return result;
}
