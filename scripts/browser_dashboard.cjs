/* Real local Chrome + built-in Node CDP client; no package install or external service. */
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output','playwright');fs.mkdirSync(out,{recursive:true});
const chrome=process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-extensions','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9227',`--user-data-dir=${path.join(out,'cdp-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,seq=0;const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
async function connect(){for(let i=0;i<100;i++){try{const targets=await(await fetch('http://127.0.0.1:9227/json/list')).json();const target=targets.find(t=>t.type==='page');ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};return;}catch(err){await sleep(100);}}throw Error('Local Chrome CDP unavailable');}
async function navigate(hash){await send('Page.navigate',{url:pathToFileURL(path.join(root,'dist/dashboard/index.html')).href+'?viewport='+Date.now()+'#'+hash});await sleep(150);for(let i=0;i<100;i++){if(await evaluate("document.readyState==='complete' && !!document.getElementById('result-count')?.textContent"))return;await sleep(30);}throw Error('Dashboard initialization timed out');}
const smoke=async()=>{
 const checks=[],check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);},$=id=>document.getElementById(id),wait=()=>new Promise(r=>setTimeout(r,30));
 check('initial metrics',document.querySelectorAll('.metric').length===4&&document.querySelector('.metric b').textContent==='45');
 check('viewport overflow',document.documentElement.scrollWidth<=innerWidth);
 check('Chinese labels/tags contained',[...document.querySelectorAll('#overview .tag')].every(n=>n.scrollWidth<=n.clientWidth+1));
 location.hash='quotes';await wait();check('quotes route',!$('quotes').hidden);
 const mobile=innerWidth<700;check('mobile card default',!mobile||!!document.querySelector('.quote-card'));
 if(mobile){$('open-filters').click();check('filter sheet', $('filters').classList.contains('open'));}
 const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event(id==='q'?'input':'change',{bubbles:true}));};
 set('tier','Plus');set('invoice','priced');set('q','ProPlus');check('combination filters',$('result-count').textContent.startsWith('1 条'));
 set('q','no-results-987654');check('empty results',!!document.querySelector('.reset-button'));document.querySelector('.reset-button').click();check('reset to 45',$('result-count').textContent.startsWith('45 条'));
 if(mobile)document.querySelector('#filters .mobile-close').click();
 $('card-view').click();check('card count',document.querySelectorAll('.quote-card').length===45);$('table-view').click();check('table count',document.querySelectorAll('.quote-table tbody tr').length===45);
 check('table overflow contained',document.documentElement.scrollWidth<=innerWidth);
 document.querySelector('.detail-button').click();check('drawer opens',$('detail').open);check('source links',[...document.querySelectorAll('.detail-sources a')].every(a=>a.href.startsWith('https:')));$('close-detail').click();check('drawer closes',!$('detail').open);
 location.hash='tutorial';await wait();check('tutorial route',!$('claude').hidden);location.hash='troubleshooting';await wait();check('troubleshooting route',!$('phone').hidden);
 if(mobile){document.querySelector('.nav-toggle').click();check('mobile nav drawer',document.querySelector('.sidebar').classList.contains('open'));document.querySelector('.sidebar .mobile-close').click();check('mobile nav closes',!document.querySelector('.sidebar').classList.contains('open'));document.querySelector('.nav-toggle').click();document.querySelector('[data-page="overview"]').click();await wait();check('navigation link closes sidebar',!document.querySelector('.sidebar').classList.contains('open'));history.back();await wait();check('browser back restores phone',!$('phone').hidden);}
 location.hash='sources';await wait();$('source-search').value='no-source-987654';$('source-search').dispatchEvent(new Event('input'));check('source empty',!!$('reset-sources'));$('reset-sources').click();check('source reset',!!document.querySelector('.source-row'));
 return {status:'PASS',width:innerWidth,checks};
};
(async()=>{try{
 await connect();await send('Page.enable');const results=[];
 for(const width of [1280,390,768]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<700});await navigate('overview');const result=await evaluate(`(${smoke.toString()})()`);assert(result&&result.status==='PASS','Browser smoke failed');assert.equal(result.width,width);results.push(result);console.log(JSON.stringify(result));}
 for(const [name,width,height,hash] of [['desktop-overview',1280,1100,'overview'],['desktop-quotes',1280,1200,'quotes'],['mobile-overview',390,1000,'overview'],['mobile-quotes',390,1100,'quotes']]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});await navigate(hash);await evaluate('window.scrollTo(0,0)');await sleep(100);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));
 }
 for(const [name,expression] of [['mobile-navigation',"document.querySelector('.nav-toggle').click()"],['mobile-filter-sheet',"document.getElementById('open-filters').click()"],['mobile-detail-drawer',"document.querySelector('.detail-button').click()"],['mobile-quote-cards',"document.getElementById('result-count').scrollIntoView({behavior:'instant'})"],['mobile-empty-results',"document.getElementById('q').value='no-match-987654';document.getElementById('q').dispatchEvent(new Event('input'));document.getElementById('result-count').scrollIntoView({behavior:'instant'})"]]){
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate('quotes');await evaluate('window.scrollTo(0,0)');await evaluate(expression);await sleep(100);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64'));
 }
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));console.log('PASS: actual 1280/390/768px Chrome viewports and nine screenshots');
 }finally{if(ws){try{await send('Browser.close');}catch(err){}ws.close();}child.kill();}})().catch(err=>{console.error(err);process.exitCode=1;});
