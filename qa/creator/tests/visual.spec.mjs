import {test,expect,boot,assertNoOverflow,screenshot,writeEvidence,VIEWS} from './helpers.mjs';

async function freshVisualDocument(page,path='/creator/index.html'){
  await boot(page,path);
  // Hash-only navigation retains shell CSSOM mutations. Reload the document
  // before each case so a prior 200% pass cannot compound into 400% or more.
  await page.reload();
  await expect(page.locator('#view-title')).toBeVisible();
  await expect(page.locator('#policy-band')).toContainText('虚构演示');
  const baseline=await page.evaluate(()=>({
    inlineFontSizes:[...document.querySelectorAll('body,body *')].filter(el=>el instanceof HTMLElement&&el.style.fontSize).length,
    bodyFontSize:parseFloat(getComputedStyle(document.body).fontSize),
    shellLabelFontSize:parseFloat(getComputedStyle(document.querySelector('.topbar strong')).fontSize),
  }));
  expect(baseline,'Every visual case must begin with untouched baseline text').toEqual({inlineFontSizes:0,bodyFontSize:16,shellLabelFontSize:14});
  return baseline;
}

async function doubleRenderedText(page){
  return page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('body,body *')].filter(el=>el instanceof HTMLElement);
    const before=nodes.map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)}));
    // Set CSSOM properties directly; no injected stylesheet and no CSP bypass.
    // Take the whole baseline first so inherited sizes are not doubled twice.
    for(const {el,size} of before)if(Number.isFinite(size))el.style.fontSize=`${size*2}px`;
    const failed=before.filter(({el,size})=>Number.isFinite(size)&&Math.abs(parseFloat(getComputedStyle(el).fontSize)-size*2)>.1).length;
    return {method:'Each existing HTMLElement computed font-size doubled through CSSOM',elements:before.length,failed};
  });
}

async function assertCalendarDateLabels(page){
  const measured=await page.locator('.calendar .calendar-day').evaluateAll(buttons=>buttons.map(button=>{
    const number=button.querySelector(':scope > .day-number');
    if(!number)return {date:null,violations:['missing date-number span']};
    const text=number.textContent.trim();
    const box=button.getBoundingClientRect(),span=number.getBoundingClientRect();
    const range=document.createRange();range.selectNodeContents(number);
    const lines=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
    const epsilon=0.5; // Only fractional CSS-pixel rounding, never whole-pixel overflow.
    const inside=rect=>rect.left>=box.left-epsilon&&rect.right<=box.right+epsilon&&rect.top>=box.top-epsilon&&rect.bottom<=box.bottom+epsilon;
    const violations=[];
    if(!/^([1-9]|[12][0-9]|3[01])$/.test(text))violations.push('invalid day text');
    if(lines.length!==1)violations.push(`date text occupies ${lines.length} line rectangles`);
    if(span.width<=0||span.height<=0||!inside(span))violations.push('date span is hidden or extends outside its button');
    if(lines.some(rect=>!inside(rect)))violations.push('visible date text extends outside its button');
    const rectData=rect=>({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height});
    return {date:Number(text),violations,...(violations.length?{button:rectData(box),span:rectData(span),textRects:lines.map(rectData)}:{})};
  }));
  expect(measured.map(item=>item.date),'All 31 October date labels must be tested').toEqual(Array.from({length:31},(_,index)=>index+1));
  const violations=measured.filter(item=>item.violations.length);
  expect(violations,'Every calendar date must be one visible line fully contained in its button').toEqual([]);
  return {checked:measured.length,twoDigitDates:measured.filter(item=>item.date>=10).length,method:'Native Range.getClientRects single-line text and span/button bounds',subpixelTolerance:0.5,violations};
}

test('12-case appearance/width matrix: six modules, 200% text and reduced motion',async({page,context},testInfo)=>{
  test.setTimeout(180000);
  const {layout,color,width}=testInfo.project.metadata;
  await context.addInitScript(({layout,color})=>localStorage.setItem('mydotwork-appearance',JSON.stringify({layout,color,effects:'auto'})),{layout,color});
  await freshVisualDocument(page);
  const ids=await page.evaluate(async()=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');
    const {seedDemo}=await import('/creator/core/fixtures.mjs');
    const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    try{
      const result=await seedDemo(store);
      const before=await store.read();
      await store.dispatch({type:'updateIdea',payload:{workId:result.workId,title:'虚构长标题：一个只有演示内容的完整创作流程，用于检验窄屏文字与控制按钮能否自然换行',angle:'已改动的虚构视角，需要重新保存稿件'},operationId:'visual-title',expectedRevision:before.revision});
      const current=await store.read();
      await store.dispatch({type:'setSchedule',payload:{workId:result.workId,accountId:result.accountIds[1],schedule:{date:'2026-10-07',allDay:true,timeZone:'Asia/Shanghai'}},operationId:'visual-all-day',expectedRevision:current.revision});
      return {workId:result.workId};
    }finally{store.close();}
  });
  const observations=[];
  for(const [view,title]of Object.entries(VIEWS)){
    for(const textScale of [1,2]){
      const baseline=await freshVisualDocument(page,`/creator/index.html#view=${view}&work=${ids.workId}`);
      await expect(page.locator('#view-title')).toHaveText(title);
      await expect(page.locator('html')).toHaveAttribute('data-layout',layout);
      await expect(page.locator('html')).toHaveAttribute('data-color',color);
      if(view==='calendar'||view==='desk'){
        await page.locator('[data-focus-key="filter:month"]').fill('2026-10');
        await page.locator('[data-focus-key="filter:month"]').blur();
      }
      let scaling=null;
      if(textScale===2){scaling=await doubleRenderedText(page);expect(scaling.failed).toBe(0);}
      await screenshot(page,testInfo,`${view}-${width}-${layout}-${color}-text${textScale*100}`);
      const calendarDates=view==='calendar'?await assertCalendarDateLabels(page):null;
      const geometry=await assertNoOverflow(page);
      observations.push({view,width,layout,color,textScale,baseline,scaling,calendarDates,...geometry});
    }
  }
  // Test a native dialog and a domain-validation error at enlarged text.
  await freshVisualDocument(page,`/creator/index.html#view=production&work=${ids.workId}`);
  await page.getByRole('button',{name:'检查并设为可发布'}).click();
  await expect(page.locator('#save-status')).toHaveAttribute('role','alert');
  await doubleRenderedText(page);
  await screenshot(page,testInfo,`error-${width}-${layout}-${color}-text200`);
  await assertNoOverflow(page);
  await freshVisualDocument(page);
  await page.getByRole('button',{name:'账号',exact:true}).click();
  const scale=await doubleRenderedText(page);
  expect(scale.failed).toBe(0);
  await screenshot(page,testInfo,`dialog-${width}-${layout}-${color}-text200`);
  await assertNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'账号',exact:true})).toBeFocused();

  await page.emulateMedia({reducedMotion:'reduce'});
  await freshVisualDocument(page);
  await expect(page.locator('html')).toHaveAttribute('data-glass','solid');
  const motion=await page.evaluate(()=>({
    system:matchMedia('(prefers-reduced-motion: reduce)').matches,
    maximumDuration:Math.max(0,...[...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length).flatMap(el=>[getComputedStyle(el).transitionDuration,getComputedStyle(el).animationDuration]).flatMap(value=>value.split(',').map(v=>v.trim().endsWith('ms')?parseFloat(v):parseFloat(v)*1000)).filter(Number.isFinite)),
  }));
  expect(motion.system).toBe(true);
  expect(motion.maximumDuration).toBeLessThanOrEqual(1);
  await page.locator('select[name="motion"]').selectOption('off');
  await expect(page.locator('html')).toHaveAttribute('data-motion','off');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion','off');
  await screenshot(page,testInfo,`reduced-motion-${width}-${layout}-${color}`);
  await assertNoOverflow(page);
  await writeEvidence(testInfo,'visual-matrix',{scope:'Real-browser visual geometry with synthetic adapter-seeded records; UI creation is tested separately',observations,reducedMotion:motion,explicitMotionOffPersists:true,visualReview:'Screenshots require human review; not an automatic pixel-quality approval'});
});
