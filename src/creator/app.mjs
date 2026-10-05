import {createIndexedDBStore} from './core/store.mjs';
import {readiness,selectWorkspace,latestMetrics,metricDelta} from './core/core.mjs';
import {exportPackage} from './core/exchange.mjs';
import {previewMetricsCsv,exportMetricsCsv} from './core/csv.mjs';
import {selectPerformanceRows,PERFORMANCE_METRICS,goalProgress} from './performance.mjs';
import {createStudioOrb} from './studio-orb.mjs';
import {createController,VIEWS,VIEW_NAMES,PHASE_NAMES,TASK_NAMES,METRIC_NAMES,values,randomOperationId,safeExternalUrl,routeHash,parseRoute,calendarCells,matchWork,parseNullableNumber,utcOffsetIso,scheduleLabel,metricSeries,trendPoints,dialogTabTarget} from './controller.mjs';

const document=globalThis.document;
const h=(tag,props={},...children)=>{
  const node=document.createElement(tag);
  for(const [key,value]of Object.entries(props)){
    if(key.startsWith('on')&&typeof value==='function')node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='class')node.className=value;
    else if(key==='dataset')Object.assign(node.dataset,value);
    else if(['checked','disabled','open','hidden','selected'].includes(key))node[key]=Boolean(value);
    else if(key==='value')node.value=value??'';
    else if(value!==undefined&&value!==null)node.setAttribute(key,String(value));
  }
  for(const child of children.flat(Infinity))if(child!==undefined&&child!==null&&child!==false)node.append(child instanceof Node?child:document.createTextNode(String(child)));
  return node;
};
const text=(value,fallback='未记录')=>value===null||value===undefined||value===''?fallback:String(value);
const button=(label,fn,cls='',props={})=>h('button',{type:'button',class:cls,onClick:fn,...props},label);
const badge=(label,cls='')=>h('span',{class:`badge ${cls}`},label);
const para=(value,cls='muted')=>h('p',{class:cls},value);
const iconPaths={desk:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',ideas:'M9 18h6 M10 21h4 M8 14a7 7 0 1 1 8 0c-1 1-1 3-1 3H9s0-2-1-3',production:'M4 4h16v16H4z M9 8l7 4-7 4z',calendar:'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18',library:'M4 3v18 M8 3v18 M12 3v18 M16 4l5 16',database:'M3 5c0-4 18-4 18 0s-18 4-18 0 M3 5v14c0 4 18 4 18 0V5 M3 12c0 4 18 4 18 0'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',iconPaths[name]||iconPaths.ideas);svg.append(path);return svg}
function external(url,label){const safe=safeExternalUrl(url);return safe?h('a',{href:safe,target:'_blank',rel:'noopener noreferrer'},label||url):h('span',{class:'warning'},'链接不安全或未填写，不可打开')}
const empty=(title,description,action)=>h('div',{class:'empty'},h('h3',{},title),para(description),action);
function download(name,content,mime='application/json'){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=h('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}

let controller,route=parseRoute(location.hash),activeDialog=null,dialogReturnFocus=null,liveMessage=null;
const filters={month:new Date().toISOString().slice(0,7),timeZone:'UTC',accountId:'',platform:'',search:'',phase:'',date:'',asOf:''};
const expanded=new Set();
let content,toast,nav,dialog,storageStatus;
let lastUndo=null;
let detailReturn=null;
let renderQueued=false;
let renderCutoff=new Date().toISOString();
const STUDIO_VIEWS=['desk','library','production','ideas','calendar','database'];
let sidebarNavSlot,studioNavSlot,sidebarLegacySlot,studioLegacySlot,legacyLinks,studioOrb=null;
const studioMode=()=>document.documentElement.dataset.presentation==='studio';
function setPresentation(value){
  document.documentElement.dataset.presentation=value==='classic'?'classic':'studio';
  try{localStorage.setItem('mydotwork-creator-presentation',document.documentElement.dataset.presentation)}catch{}
  const order=studioMode()?STUDIO_VIEWS:VIEWS;
  nav.replaceChildren(...order.map(view=>routeLink(view,[icon(view),h('span',{},VIEW_NAMES[view])],null,{class:'nav-link',dataset:{view}})));
  (studioMode()?studioNavSlot:sidebarNavSlot).append(nav);
  (studioMode()?studioLegacySlot:sidebarLegacySlot).append(legacyLinks);
  render();
}
function identityDetails(key,label,value){return disclosure(`identity:${key}`,label,h('p',{class:'id'},value))}
function studioHero(){
  studioOrb=createStudioOrb(document,{motion:document.documentElement.dataset.motion});
  return h('section',{class:'studio-hero','aria-label':'创作工作台介绍'},h('div',{class:'studio-hero-copy'},h('p',{class:'eyebrow'},'MY CREATIVE SPACE'),h('h2',{},'把想法，慢慢做成作品'),para('选题、创作和复盘，回到同一份记录。','hero-summary'),h('div',{class:'actions'},button('收集新灵感',showCapture,'primary'),routeLink('production','继续创作',null,{class:'button'})),para('原创球体动效 · 数据手动登记','hint')),h('div',{class:'orb-frame'},studioOrb.element));
}
function goalRing(actual,target){
  const progress=goalProgress(actual,target),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('class','goal-ring');svg.setAttribute('aria-hidden','true');
  for(const [name,offset]of [['ring-track',null],['ring-value',progress.ratio===null?null:100*(1-progress.ratio)]]){
    if(name==='ring-value'&&offset===null)continue;
    const circle=document.createElementNS(svg.namespaceURI,'circle');
    for(const [key,value]of Object.entries({cx:60,cy:60,r:48,fill:'none',class:name,pathLength:100,'stroke-dasharray':100,'stroke-dashoffset':offset??0}))circle.setAttribute(key,String(value));
    svg.append(circle);
  }
  return h('div',{class:'goal-visual'},svg,h('span',{class:'goal-count'},h('b',{},text(progress.actual,'未知')),h('small',{},`/ ${text(progress.target,'未设置')}`)),h('span',{class:'sr-only'},progress.kind==='tracked'?`已完成 ${progress.actual}，目标 ${progress.target}${progress.exceeded?'，已超过目标':''}`:progress.kind==='zero-target'?'目标明确设置为 0，不计算百分比':'目标进度尚未确定'));
}
function showPerformanceSource(row){
  openDialog('核对作品表现来源',()=>h('div',{class:'stack'},h('h3',{},row.title),para(`${row.accountName} · ${row.platform} · 登记发布 ${row.publishedAt}`,'hint'),para('各指标取截至当前视图时间的最新同口径快照；多个口径并列，未知值不当成 0。','hint'),...PERFORMANCE_METRICS.map(key=>h('section',{class:'work-row'},h('h3',{},METRIC_NAMES[key]),row.metrics[key].choices.length?row.metrics[key].choices.map(m=>h('div',{class:'version'},para(`${m.value===null?'未知':m.value} · ${m.unit} · ${m.definition||'未注明口径'}`),para(`观测 ${m.observedAt} · 来源 ${text(m.sourceRef)}`,'hint'),identityDetails(m.id,'快照标识',m.id))):para('没有记录','hint'))),identityDetails(row.publicationId,'作品与发布标识',`WorkID ${row.workId}\nPublicationID ${row.publicationId}`)));
}
function renderPerformance({workIds=null,limit=null}={}){
  const rows=selectPerformanceRows(state(),{workIds,limit,accountId:filters.accountId,platform:route.view==='database'?filters.platform:'',asOf:renderCutoff});
  return rows.length?h('div',{class:'performance-wrap'},h('table',{class:'performance-table',role:'table'},h('caption',{},'作品表现 · 各账号最新同口径记录（不按月份截取）；未知与 0 分开。'),h('thead',{role:'rowgroup'},h('tr',{role:'row'},h('th',{scope:'col',role:'columnheader'},'作品 / 账号'),...PERFORMANCE_METRICS.map(key=>h('th',{scope:'col',role:'columnheader'},METRIC_NAMES[key])),h('th',{scope:'col',role:'columnheader'},'依据'))),h('tbody',{role:'rowgroup'},rows.map(row=>h('tr',{role:'row',dataset:{performanceRow:row.publicationId,workId:row.workId}},h('th',{scope:'row',role:'rowheader',class:'performance-work'},routeLink('library',row.title,row.workId),para(`${row.accountName} · ${row.platform}`,'hint')),...PERFORMANCE_METRICS.map(key=>{const m=row.metrics[key];return h('td',{role:'cell','data-label':METRIC_NAMES[key],dataset:{metric:key,snapshotId:m.snapshotId||'',kind:m.kind}},h('span',{},m.kind==='mixed'?'多口径':m.value===null?'未记录':m.value))}),h('td',{role:'cell',class:'performance-source'},button('核对来源',()=>showPerformanceSource(row),'tiny'))))))):para('当前筛选范围内没有登记发布的作品。登记发布后可手动记录表现，空白指标保持未知。','hint');
}
const state=()=>controller.state;
const accounts=()=>values(state().accounts);
const workRecords=()=>values(state().works);
const workOptions=()=>workRecords().filter(w=>!w.trashedAt&&w.phase!=='archived').map(w=>[w.id,w.title]);
const accountOptions=()=>accounts().map(a=>[a.id,`${a.displayName} · ${a.platform}`]);
const workName=id=>state().works[id]?.title||id;
const accountName=id=>{const a=state().accounts[id];return a?`${a.displayName} · ${a.platform}`:'账号不存在'};
const related=(collection,workId)=>values(state()[collection]).filter(item=>item.workId===workId);
function scopeText(){return `范围：${filters.accountId?accountName(filters.accountId):'所有本地账号'}；${filters.month}；时区 ${filters.timeZone}。来源：本地用户登记记录，统计截至 ${renderCutoff}。`}
function query(){return selectWorkspace(state(),{month:filters.month,timeZone:filters.timeZone,accountId:filters.accountId||undefined,platform:route.view==='database'&&filters.platform||undefined,asOf:renderCutoff})}
function announce(message,error=false){liveMessage={message,error};toast.replaceChildren(h('span',{},message));toast.className=`status-box ${error?'error':'good'}`;toast.setAttribute('role',error?'alert':'status')}
function snapshotFocus(){const e=document.activeElement;if(!e||!content.contains(e))return null;return {key:e.dataset.focusKey,start:e.selectionStart,end:e.selectionEnd,scroll:scrollY}}
function restoreFocus(snapshot){if(!snapshot?.key)return;const target=[...content.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===snapshot.key);if(target){target.focus({preventScroll:true});if(typeof target.setSelectionRange==='function'&&snapshot.start!==null){try{target.setSelectionRange(snapshot.start,snapshot.end)}catch{}}}}
function queueRender(){if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;render()})}
function currentHistory(){return {creator:true,filters:{...filters},scroll:scrollY,focusKey:document.activeElement?.dataset.focusKey||null}}
function navigate(view,workId=null,{replace=false}={}){
  if(workId&&!route.workId)detailReturn={view:route.view,scroll:scrollY,focusKey:document.activeElement?.dataset.focusKey||`work:${workId}`};
  history.replaceState(currentHistory(),'');
  route={view:VIEWS.includes(view)?view:'desk',workId};
  const next=routeHash(route.view,workId);history[replace?'replaceState':'pushState']({creator:true,filters:{...filters},scroll:0},'',next);
  render();const target=document.getElementById(workId?'work-detail':'view-title');target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});
}
function closeDetail(){const back=detailReturn;detailReturn=null;navigate(route.view);if(back&&back.view===route.view)requestAnimationFrame(()=>{scrollTo(0,back.scroll);[...content.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===back.focusKey)?.focus({preventScroll:true})})}
function routeLink(view,label,workId=null,props={}){return h('a',{href:routeHash(view,workId),onClick:e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0){e.preventDefault();navigate(view,workId)}},...props},label)}
function onHistory(){const incoming=parseRoute(location.hash);route=incoming;if(history.state?.creator)Object.assign(filters,history.state.filters);render();requestAnimationFrame(()=>{scrollTo(0,history.state?.scroll||0);const key=history.state?.focusKey;[...content.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===key)?.focus({preventScroll:true})})}

function selectInput(name,current,options,onChange,props={}){return h('select',{name,...props,onChange:e=>onChange(e.target.value)},options.map(([value,label])=>h('option',{value,selected:value===String(current)},label)))}
function field(key,name,label,{type='text',options,required=false,hint,rows,placeholder,disabled=false,min,step,checkedLabel}={}){
  const b=controller.buffers.get(key),val=b.values[name]??'';
  const props={name,id:`f-${key.replace(/[^a-zA-Z0-9_-]/g,'_')}-${name}`,required:required||undefined,disabled,placeholder,min,step,dataset:{focusKey:`${key}:${name}`}};
  const change=e=>{controller.edit(key,name,type==='checkbox'?e.target.checked:e.target.value,b.values)};
  let input;
  if(options)input=selectInput(name,val,options,value=>controller.edit(key,name,value,b.values),props);
  else if(type==='textarea')input=h('textarea',{...props,rows:rows||4,onInput:change},val);
  else input=h('input',{...props,type,value:type==='checkbox'?undefined:val,checked:type==='checkbox'?Boolean(val):undefined,onInput:change});
  return h('label',{class:type==='checkbox'?'check-label':''},type==='checkbox'?input:label,type==='checkbox'?checkedLabel||label:input,hint?h('span',{class:'hint'},hint):null);
}
function form(key,defaults,build,onSubmit,{submit='保存',secondary}={}){
  const b=controller.buffer(key,defaults);const formNode=h('form',{class:'form-stack',dataset:{buffer:key},onSubmit:async e=>{
    e.preventDefault();if(controller.isPending(key))return;const submitter=e.submitter||e.currentTarget.querySelector('[type=submit]');if(submitter)submitter.disabled=true;const original=submitter?.textContent;if(submitter)submitter.textContent='正在保存…';
    try{await onSubmit({...controller.buffers.get(key).values},key)}catch(error){handleError(error,key)}finally{if(submitter?.isConnected){submitter.disabled=false;submitter.textContent=original}}
  }},build(b.values),h('div',{class:'form-actions'},h('button',{type:'submit',class:'primary',disabled:controller.isPending(key)},submit),secondary,b.dirty?badge('有未保存输入','warn'):null));
  return formNode;
}
async function save(key,type,payload,message='已保存到此浏览器'){const result=await controller.execute(key,type,payload);announce(message);if(result.result?.undoOperationId)lastUndo=result.result.undoOperationId;render();return result}
async function action(type,payload,message){try{const result=await controller.action(type,payload);if(result.result?.undoOperationId)lastUndo=result.result.undoOperationId;announce(message||'已保存到此浏览器');render();return result}catch(error){handleError(error);return null}}
function handleError(error,key){announce(`${error.message||'保存失败'}。输入仍保留，尚未保存。`,true);if(key&&/CONFLICT|REVISION|STALE/.test(error.code||''))showConflict(key,error)}
async function showConflict(key,error){
  try{await controller.refresh()}catch(refreshError){announce(`无法读取当前版本：${refreshError.message}。输入仍保留`,true);return}
  const comparedRevision=state().revision;
  const currentWork=route.workId?state().works[route.workId]:null;
  const entityId=key.slice(key.indexOf(':')+1);
  const relatedEntity=['accounts','goals','references','tasks','publications','reviews','assets'].map(collection=>state()[collection][entityId]).find(Boolean)||null;
  const currentSaved=currentWork?{workspaceRevision:state().revision,work:currentWork,draft:state().drafts[currentWork.bodyRevisionId]||null,relatedEntity}:{workspaceRevision:state().revision,relatedEntity};
  openDialog('保存遇到并发修改',()=>h('div',{class:'stack'},para('其他页面或操作已经改变了已保存版本。请比较内容后选择；不会按时间覆盖。'),
    h('div',{class:'preview-grid'},h('section',{class:'preview-piece'},h('h3',{},'当前输入（未保存）'),h('pre',{},JSON.stringify(controller.buffers.get(key)?.values,null,2))),h('section',{class:'preview-piece'},h('h3',{},'当前已保存内容（含稿件正文）'),h('pre',{},JSON.stringify(currentSaved,null,2)))),
    para(error.details?JSON.stringify(error.details):'','hint'),h('div',{class:'actions'},button('保留输入，采用当前版本作为重试基线',async()=>{try{await controller.refresh();if(state().revision!==comparedRevision){announce('比较后又出现新的修改，请重新比较后选择',true);await showConflict(key,error);return}controller.rebase(key,comparedRevision);closeDialog();announce('已保留输入。请核对后再次点击保存');render()}catch(rebaseError){handleError(rebaseError,key)}},'primary'),button('继续编辑，不保存',closeDialog))))
}
function openDialog(title,builder){if(!dialog.open)dialogReturnFocus=document.activeElement;activeDialog={title,builder};renderDialog();if(!dialog.open)dialog.showModal();dialog.querySelector('input,select,textarea,button')?.focus()}
function renderDialog(){if(!activeDialog)return;dialog.replaceChildren(h('div',{class:'dialog-head'},h('h2',{id:'dialog-title'},activeDialog.title),button('关闭',closeDialog,'quiet',{'aria-label':'关闭对话框'})),h('div',{class:'dialog-body'},activeDialog.builder()))}
function closeDialog(){if(dialog.open)dialog.close();activeDialog=null;dialogReturnFocus?.focus({preventScroll:true});dialogReturnFocus=null}
function handleDialogKeydown(event){
  if(event.key!=='Tab'||!dialog.open)return;
  const focusables=[...dialog.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(node=>!node.disabled&&!node.hidden&&node.tabIndex>=0&&node.getClientRects().length>0);
  const target=dialogTabTarget(focusables,document.activeElement,event.shiftKey);
  if(target){event.preventDefault();target.focus()}
  else if(!focusables.length){event.preventDefault();dialog.focus()}
}
function disclosure(key,title,body,{open=false}={}){const item=h('details',{open:expanded.has(key)||open,onToggle:e=>{if(e.target.open)expanded.add(key);else expanded.delete(key)}},h('summary',{},title),h('div',{class:'disclosure-body'},body));return item}

function setAppearance(){const preference=globalThis.WorkbenchAppearance||{layout:'B',color:'dark',effects:'auto'};const root=document.documentElement;root.dataset.layout=preference.layout;root.dataset.color=preference.layout==='A'?'light':preference.color;root.dataset.glass=preference.effects==='solid'?'solid':globalThis.WorkbenchBoot?.glass||'solid';try{localStorage.setItem('mydotwork-appearance',JSON.stringify(preference))}catch{announce('外观已应用；浏览器未允许记住偏好',true)}}
function shell(){
  const preference=globalThis.WorkbenchAppearance||{layout:'B',color:'dark',effects:'auto'};
  try{document.documentElement.dataset.motion=localStorage.getItem('mydotwork-creator-motion')||'auto'}catch{}
  nav=h('nav',{'aria-label':'创作模块'});sidebarNavSlot=h('div',{class:'sidebar-nav-slot'});studioNavSlot=h('div',{class:'studio-nav-slot'});sidebarLegacySlot=h('div',{class:'sidebar-legacy-slot'});studioLegacySlot=h('div',{class:'studio-legacy-slot'});
  legacyLinks=h('nav',{class:'legacy-links','aria-label':'既有公开内容'},h('span',{class:'muted'},'既有公开内容'),h('a',{href:'../dashboard/'},'研究与成果目录'),h('a',{href:'../chat/'},'公开聊天'),h('a',{href:'../projects/'},'项目进度'));
  content=h('main',{id:'main'});toast=h('div',{id:'save-status',class:'status-box','aria-live':'polite','aria-atomic':'true'});
  storageStatus=h('span',{},'本地读取中');
  dialog=h('dialog',{'aria-labelledby':'dialog-title',tabindex:'-1',onKeydown:handleDialogKeydown,onCancel:e=>{e.preventDefault();closeDialog()},onClose:()=>{if(dialog.open)return;if(activeDialog){activeDialog=null;dialogReturnFocus?.focus({preventScroll:true})}}});
  const appearance=h('div',{class:'appearance'},h('label',{},'外观',selectInput('layout',preference.layout,[['B','B 默认'],['A','A 经典']],v=>{preference.layout=v;globalThis.WorkbenchAppearance=preference;setAppearance()})),h('label',{},'B 配色',selectInput('color',preference.color,[['dark','深色'],['light','浅色']],v=>{preference.color=v;globalThis.WorkbenchAppearance=preference;setAppearance()})),h('label',{},'动效',selectInput('motion',document.documentElement.dataset.motion,[['auto','跟随系统'],['off','关闭']],v=>{document.documentElement.dataset.motion=v;studioOrb?.setMotion(v);try{localStorage.setItem('mydotwork-creator-motion',v)}catch{}})),h('label',{},'工作区',selectInput('presentation','studio',[['studio','创作面板'],['classic','经典侧栏']],setPresentation)));
  const sidebar=h('aside',{class:'sidebar'},
    h('a',{class:'brand',href:'../dashboard/'},h('span',{class:'brand-mark'},'MW'),'创作工作区'),sidebarNavSlot,
    sidebarLegacySlot);
  const workspace=h('div',{class:'workspace'},
    h('header',{class:'topbar'},h('strong',{},'MyDotWork · 六模块创作'),studioLegacySlot,appearance),studioNavSlot,
    h('div',{class:'safety-band',id:'policy-band'}),
    h('div',{class:'topbar'},storageStatus,h('div',{class:'actions'},button('账号',()=>showAccounts()),button('月目标',()=>showGoals()),button('备份 / 恢复',showBackup),button('回收站',showTrash))),
    h('div',{class:'notification-wrap'},toast),content,
    h('footer',{class:'footer'},'独立实现 · 手动登记发布与数据 · 无社媒自动发布、抓取或模型连接。',
      h('div',{class:'actions'},h('a',{href:'../dashboard/'},'研究与目录'),h('a',{href:'../chat/'},'聊天'),h('a',{href:'../projects/'},'项目'))));
  document.getElementById('app').replaceChildren(h('div',{class:'shell'},sidebar,workspace),dialog);
  let presentation='studio';try{if(localStorage.getItem('mydotwork-creator-presentation')==='classic')presentation='classic'}catch{}
  appearance.querySelector('[name="presentation"]').value=presentation;setPresentation(presentation);
}
function filterBar({month=false,platform=false,phase=false,search=true}={}){
  const update=(key,val)=>{filters[key]=val;if(key==='month')filters.date='';queueRender()};
  return h('div',{class:'toolbar'},search?h('label',{class:'wide'},'搜索作品、正文、标签',h('input',{type:'search',value:filters.search,placeholder:'输入关键词',dataset:{focusKey:'filter:search'},onInput:e=>update('search',e.target.value)})):null,h('label',{},'账号范围',selectInput('account-filter',filters.accountId,[['','所有账号'],...accountOptions()],v=>update('accountId',v),{dataset:{focusKey:'filter:account'}})),month?h('label',{},'月份',h('input',{type:'month',value:filters.month,required:true,dataset:{focusKey:'filter:month'},onChange:e=>{if(e.target.value)update('month',e.target.value)}})):null,month?h('label',{},'统计时区',h('input',{value:filters.timeZone,placeholder:'例如 Asia/Shanghai',list:'time-zones',dataset:{focusKey:'filter:zone'},onChange:e=>{try{new Intl.DateTimeFormat('zh-CN',{timeZone:e.target.value});update('timeZone',e.target.value)}catch{announce('请输入有效的 IANA 时区，例如 Asia/Shanghai',true)}}})):null,platform?h('label',{},'平台',selectInput('platform-filter',filters.platform,[['','所有平台'],...[...new Set(accounts().map(a=>a.platform))].map(x=>[x,x])],v=>update('platform',v))):null,phase?h('label',{},'制作阶段',selectInput('phase-filter',filters.phase,[['','所有阶段'],...Object.entries(PHASE_NAMES)],v=>update('phase',v))):null);
}
function heading(title,description,actions=[]){return h('div',{class:'page-heading'},h('div',{},h('h1',{id:'view-title',tabindex:'-1'},title),para(description)),h('div',{class:'actions'},actions))}
function workRow(work,{view=route.view,showActions=true}={}){
  const p=readiness(state(),work.id);const pending=related('tasks',work.id).find(t=>t.required&&!['done','na'].includes(t.status));
  return h('article',{class:`work-row ${route.workId===work.id?'is-selected':''}`},h('div',{class:'row-head'},button(work.title,()=>navigate(view,work.id),'work-title',{dataset:{focusKey:`work:${work.id}`}}),badge(PHASE_NAMES[work.phase]||work.phase,work.phase==='ready'?'good':'')),h('div',{class:'work-meta'},badge(work.contentType==='video'?'短视频':'图文'),badge(`优先级 ${work.priority||2}`),work.draftNeedsReview?badge('切入点已改，稿件待复核','warn'):null,...(work.tags||[]).map(x=>badge(x))),para(work.angle||work.summary||'尚未填写原创切入点','muted'),identityDetails(`work-${work.id}`,'查看作品标识',`WorkID ${work.id}`),work.phase!=='idea'?h('div',{},h('progress',{class:'progress',value:p.completed,max:Math.max(1,p.total),'aria-label':`必需任务 ${p.completed}/${p.total}`}),para(`必需任务 ${p.completed}/${p.total}${pending?` · 下一步：${pending.title}`:''}`,'hint')):null,showActions?h('div',{class:'actions'},button('打开作品',()=>navigate(view,work.id),'tiny'),work.phase==='idea'?button('开始创作',()=>showStart(work),'tiny'):null,work.phase==='ready'?button('登记发布',()=>{navigate('library',work.id);document.getElementById(`publication-${work.id}`)?.scrollIntoView()},'tiny'):null):null);
}
function scopedWorks(q){return q.works.filter(w=>!w.trashedAt&&matchWork(w,state(),filters.search)&&(!['ideas','production','library'].includes(route.view)||!filters.phase||w.phase===filters.phase))}
function listWorks(rows,message='还没有作品',view=route.view){return rows.length?h('div',{class:'stack'},rows.map(w=>workRow(w,{view}))):empty(message,'先把一个想法存下来，再开始创作。',button('新建选题',showCapture,'primary'))}
function progressLine(workId){const p=readiness(state(),workId);return `${p.completed}/${p.total} 必需任务完成`}
function publicationRow(pub,{controls=true}={}){
  const w=state().works[pub.workId];const passed=pub.needsVerification??(pub.status==='planned'&&pub.schedule&&(pub.schedule.allDay?pub.schedule.date<new Date().toLocaleDateString('sv-SE',{timeZone:pub.schedule.timeZone}):Date.parse(pub.schedule.plannedAt)<Date.now()));
  return h('article',{class:'publication-row'},h('div',{class:'row-head'},routeLink('calendar',w?.title||pub.workId,pub.workId),badge(pub.status==='published'?'用户已登记发布':pub.status==='planned'?'已排期':'未排期',pub.status==='published'?'good':'')),para(`${accountName(pub.accountId)} · ${scheduleLabel(pub)}`,'hint'),para(`${progressLine(pub.workId)}${passed?' · 计划已过期，发布事实待核实':''}`,passed?'warning small':'muted small'),pub.actualPublishedAt?para(`实际发布时间 ${pub.actualPublishedAt} · 用户手动登记`,'hint'):null,pub.publicUrl?external(pub.publicUrl,'打开登记链接'):null,identityDetails(`pub-${pub.id}`,'查看发布标识',`PublicationID ${pub.id}`),controls?h('div',{class:'actions'},pub.status!=='published'?button(pub.schedule?'改期':'安排日期',()=>showSchedule(w,pub),'tiny'):null,pub.status==='planned'?button('取消排期',()=>confirmCancelSchedule(pub),'tiny'):null,pub.status!=='published'?button('登记已经发布',()=>showPublication(w,pub),'tiny'):null):null);
}

function renderDesk(q){
  const rows=scopedWorks(q);const published=q.publications.filter(p=>p.status==='published');
  const ideas=rows.filter(w=>w.phase==='idea'),production=rows.filter(w=>w.phase==='producing'||w.phase==='selected');
  const completed=rows.filter(w=>w.completedAt&&new Date(w.completedAt).toLocaleDateString('sv-SE',{timeZone:filters.timeZone}).startsWith(filters.month));
  const monthPublished=published.filter(p=>rows.some(w=>w.id===p.workId)&&p.actualPublishedAt&&new Date(p.actualPublishedAt).toLocaleDateString('sv-SE',{timeZone:filters.timeZone}).startsWith(filters.month));
  const stat=(num,label,description,fn)=>button([h('b',{},num),h('span',{},label),h('small',{},description)],fn,'stat');
  const next=q.nextActions.filter(item=>rows.some(w=>w.id===item.workId)).map(item=>({...state().works[item.workId],nextAction:item}));
  const stats=h('div',{class:'metrics-grid'},
    stat(ideas.length,'待整理灵感','当前账号范围',()=>showRecords('待整理灵感',ideas)),
    stat(production.length,'制作中的作品','按 WorkID 去重',()=>showRecords('制作中的作品',production)),
    stat(completed.length,'本月可发布作品','按完成日期与时区',()=>showRecords('本月完成记录',completed)),
    stat(monthPublished.length,'本月登记发布次数','手动登记的 Publication',()=>openDialog('本月发布登记',()=>h('div',{class:'stack'},para(scopeText(),'hint'),monthPublished.map(p=>publicationRow(p,{controls:false}))))));
  const actionsPanel=h('section',{class:'panel'},h('div',{class:'section-heading'},h('h2',{},'下一步'),badge(`${next.length} 件作品`)),
    next.length?h('div',{class:'stack'},next.slice(0,12).map(w=>h('div',{class:'work-row'},
      routeLink(w.phase==='idea'?'ideas':'production',w.title,w.id),
      para(`${w.nextAction.label}${w.nextAction.reason?`：${w.nextAction.reason}`:''}${w.nextAction.due?` · ${w.nextAction.due.date} ${w.nextAction.due.timeZone}`:''}`,'hint'),
      button('处理下一步',()=>navigate(w.phase==='idea'?'ideas':'production',w.id),'tiny')))):
      empty('当前没有待办作品','新选题会出现在这里。',button('新建选题',showCapture)));
  const goalPanel=h('section',{class:'panel'},h('div',{class:'section-heading'},h('h2',{},'本月目标'),button('设置',()=>showGoals(),'tiny')),renderGoalList(),
    h('hr',{class:'divider'}),h('h3',{},'即将发布 / 待核实'),q.calendar.length?h('div',{class:'stack'},q.calendar.slice(0,5).map(p=>publicationRow(p))):para('本月还没有发布排期','hint'));
  return [studioMode()?studioHero():null,heading('工作台','从下一步行动开始。每个数字都能展开查看构成记录。',[button('新建选题',showCapture,'primary')]),
    filterBar({month:true}),stats,para(scopeText(),'scope'),h('div',{class:'two-columns studio-overview'},h('div',{class:'stack'},h('section',{class:'panel'},h('div',{class:'section-heading'},h('h2',{},'作品表现'),routeLink('library','作品库')),renderPerformance({workIds:rows.map(w=>w.id),limit:8})),actionsPanel),goalPanel),
    h('section',{class:'panel'},h('div',{class:'section-heading'},h('h2',{},'最新表现（不按月份筛选）'),routeLink('database','查看全部快照')),renderMetricCards({limit:4}))];
}
function renderIdeas(q){const rows=scopedWorks(q).filter(w=>w.phase!=='archived');return [heading('选题池','参考来源与自己的切入点分别保存。开始创作沿用同一个 WorkID。',[button('新建选题',showCapture,'primary')]),filterBar({phase:true}),para(`${rows.length} 件作品 · 数据来源：此浏览器的已提交选题，包含已进入创作的作品。`,'scope'),listWorks(rows)]}
function renderProduction(q){const rows=scopedWorks(q).filter(w=>['selected','producing','ready'].includes(w.phase));return [heading('创作台','写稿、录制、剪辑、封面与检查。进度来自必需任务的实际完成记录。',[button('去选题池',()=>navigate('ideas'))]),filterBar({phase:true}),para('录制与剪辑在这里记录进度；请使用你自己的录制和剪辑工具。','scope'),listWorks(rows,'还没有进入创作的作品')]}
function renderCalendar(q){
  const rows=q.calendar.filter(p=>!filters.search||matchWork(state().works[p.workId],state(),filters.search));
  const agenda=rows.filter(p=>!filters.date||p.schedule?.date===filters.date).sort((a,b)=>scheduleLabel(a).localeCompare(scheduleLabel(b)));
  return [heading('日历','按账号分别安排发布时间。排期不会自动发布，也不会改变稿件。',[lastUndo?button('撤销最近一次可恢复操作',()=>action('undo',{targetOperationId:lastUndo},'已撤销最近一次可恢复变更')):null,button('新增排期',()=>showSchedulePicker(),'primary')]),filterBar({month:true}),para(scopeText(),'scope'),h('section',{class:'panel calendar-panel'},h('div',{class:'section-heading'},h('h2',{},`${filters.month} 发布安排`),filters.date?button('显示整月',()=>{filters.date='';render()},'tiny'):null),h('div',{class:'calendar','aria-label':`${filters.month} 日历`},['一','二','三','四','五','六','日'].map(d=>h('div',{class:'day-name'},d)),calendarCells(filters.month).map(date=>{if(!date)return h('div',{class:'calendar-blank','aria-hidden':'true'});const count=rows.filter(p=>p.schedule?.date===date).length;return button([h('span',{class:'day-number'},Number(date.slice(-2))),h('span',{class:'day-count'},count?`${count} 条`:'无排期')],()=>{filters.date=date;render();document.getElementById('agenda-title')?.focus()},`calendar-day ${count?'has-events':''} ${filters.date===date?'selected':''}`,{'aria-label':`${date}，${count} 条排期`,'aria-pressed':filters.date===date})})),h('div',{class:'agenda'},h('h3',{id:'agenda-title',tabindex:'-1'},filters.date?`${filters.date} 日程`:'整月日程'),agenda.length?h('div',{class:'stack'},agenda.map(p=>publicationRow(p))):para('所选日期没有排期','hint'))),h('section',{class:'panel'},h('div',{class:'section-heading'},h('h2',{},'未排期队列')),listWorks(q.unscheduled.filter(w=>matchWork(w,state(),filters.search)),'没有待排期作品','calendar'))];
}
function renderLibrary(q){
  const rows=scopedWorks(q).filter(w=>w.phase==='archived'||related('publications',w.id).some(p=>p.status==='published'));
  const listing=rows.length?h('div',{class:'stack'},rows.map(w=>{
    const publications=related('publications',w.id).filter(p=>p.status==='published'&&(!filters.accountId||p.accountId===filters.accountId)).map(p=>
      disclosure(`final-${p.id}`,`${accountName(p.accountId)} · ${p.actualPublishedAt}`,
        h('div',{class:'stack'},publicationRow(p,{controls:false}),h('h3',{},p.finalSnapshot?.title||'发布时标题未记录'),
          h('pre',{class:'prose'},p.finalSnapshot?.body||'发布时正文未记录'),para(`发布快照对应稿件 ${p.finalRevisionId}；后续修改不改变此快照`,'hint'))));
    return h('section',{class:'panel'},workRow(w),publications);
  })):empty('还没有已登记发布的作品','先完成创作，再登记真实发生的发布。',button('打开创作台',()=>navigate('production')));
  return [heading('作品库','按作品归档。两个账号的发布仍属于同一个作品；保留发布时标题和稿件快照。',[button('手动登记发布',showPublicationPicker,'primary')]),
    filterBar({phase:true}),para(`${rows.length} 件作品；每件作品可展开多次发布。归档与已发布分别记录。`,'scope'),h('section',{class:'panel'},h('h2',{},'作品表现'),renderPerformance({workIds:rows.map(w=>w.id)})),listing];
}
function renderDatabase(q){return [heading('数据库','手工录入、核对快照、形成复盘。空值表示未知；累计快照不会跨日期相加。',[button('录入指标',()=>showMetrics(),'primary'),button('指标 CSV',showCsv)]),filterBar({platform:true}),h('div',{class:'toolbar'},h('label',{},'截止时刻（含 UTC 偏移；留空为现在）',h('input',{value:filters.asOf,placeholder:'2026-10-05T23:59:59+08:00',dataset:{focusKey:'filter:asof'},onChange:e=>{const v=e.target.value;if(!v||(!Number.isNaN(Date.parse(v))&&/(Z|[+-]\d{2}:\d{2})$/.test(v))){filters.asOf=v;render()}else announce('截止时刻需要有效日期和明确 UTC 偏移',true)}}))),para(`来源：用户手工记录或经预览导入的指标。截止：${renderCutoff}${filters.asOf?'':'（当前渲染时刻）'}。按平台、指标、单位和口径分开显示，无跨平台排行榜。`,'scope'),h('section',{class:'panel'},h('h2',{},'作品表现'),renderPerformance({workIds:scopedWorks(q).map(w=>w.id)})),h('section',{class:'panel'},h('h2',{},'最新值与同口径增量'),renderMetricCards()),h('section',{class:'panel'},h('h2',{},'作品复盘'),listWorks(scopedWorks(q).filter(w=>related('publications',w.id).some(p=>p.status==='published')),'发布登记后可录入数据并复盘','database'))]}

function render(){
  if(!controller?.state||!content)return;
  // One instant per render: query, visible cards, history/trends and deltas share it.
  renderCutoff=route.view==='database'&&filters.asOf?filters.asOf:new Date().toISOString();
  const focus=snapshotFocus();let q;
  try{q=query()}catch(error){announce(error.message,true);return}
  for(const item of nav.querySelectorAll('[data-view]')){if(item.dataset.view===route.view)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')}
  const renderers={desk:renderDesk,ideas:renderIdeas,production:renderProduction,calendar:renderCalendar,library:renderLibrary,database:renderDatabase};
  studioOrb?.dispose();studioOrb=null;
  const nodes=renderers[route.view](q).filter(Boolean);
  if(route.workId){const work=state().works[route.workId];nodes.push(work?renderDetail(work):empty('找不到这个作品','它可能尚未导入、已移至另一个工作区，或链接 ID 无效。',button('返回列表',()=>navigate(route.view))))}
  content.replaceChildren(...nodes,h('datalist',{id:'time-zones'},['UTC','Asia/Shanghai','Asia/Tokyo','America/New_York','Europe/London','Europe/Berlin','Australia/Sydney'].map(v=>h('option',{value:v}))));
  storageStatus.textContent=`${controller.policy.mode==='demo'?'虚构演示工作区':'私有工作区'} · 本地版本 ${state().revision} · ${controller.policy.persistence||'浏览器本地存储'}`;
  restoreFocus(focus);
}

function showRecords(title,rows){openDialog(title,()=>h('div',{class:'stack'},para(scopeText(),'hint'),rows.length?rows.map(w=>workRow(w,{showActions:false})):para('当前范围没有记录')))}

export async function mountCreator(store){
  controller=createController(store);await controller.init();shell();
  const policy=controller.policy;
  document.getElementById('policy-band').replaceChildren(h('strong',{},'虚构演示 · 请勿输入真实私稿或真实账号数据。 '),h('span',{},`${policy.warning||''} 浏览器本地保存不是云端备份。清理浏览器数据或换设备可能丢失内容。`));
  controller.subscribe(queueRender);render();history.replaceState(currentHistory(),'',routeHash(route.view,route.workId));
  addEventListener('popstate',onHistory);addEventListener('hashchange',()=>{const p=parseRoute(location.hash);if(p.view!==route.view||p.workId!==route.workId)onHistory()});
  addEventListener('beforeunload',e=>{if([...controller.buffers.values()].some(b=>b.dirty)){e.preventDefault();e.returnValue=''}});
  if(!workRecords().length)announce('虚构演示工作区已打开；可新建选题开始。保存操作完成后会在这里显示结果');
  return {controller,navigate,render,close:()=>{studioOrb?.dispose();studioOrb=null;controller.close()}};
}
async function boot(){
  try{
    // No UI switch can approve a production origin. Parent integration must keep this false.
    const store=await createIndexedDBStore({name:'mydotwork-creator-stage1-demo',origin:location.origin,approvedPrivateOrigin:false});
    await mountCreator(store);
  }catch(error){document.getElementById('app').replaceChildren(h('main',{class:'boot'},h('h1',{},'本地存储未能打开'),para(error.message,'warning'),para('尚未建立可持久保存的工作区。请使用支持 IndexedDB 的浏览器环境后重试。此页不会假装保存成功。'),button('重新打开',()=>location.reload(),'primary'),h('p',{},h('a',{href:'../dashboard/'},'返回研究与目录'))))}
}

// Detail editors and management dialogs follow below; all writes use controller commands.
function showCapture(){
  const key='capture-idea';
  openDialog('新建虚构选题',()=>form(key,{title:'',summary:'',angle:'',contentType:'video',priority:'2',tags:'',referenceUrl:'',referenceTitle:'',analysis:'',synthetic:false},()=>h('div',{class:'field-grid'},field(key,'title','选题标题',{required:true}),field(key,'contentType','制作类型',{options:[['video','短视频'],['text','图文']]}),h('div',{class:'full'},field(key,'summary','简述',{type:'textarea',rows:2})),h('div',{class:'full'},field(key,'angle','自己的切入点',{type:'textarea',hint:'参考内容与自己的观点分开；开始创作前必须填写切入点。'})),field(key,'referenceTitle','参考名称'),field(key,'referenceUrl','参考网址',{type:'url',hint:'仅保存引用，不自动访问或抓取。'}),h('div',{class:'full'},field(key,'analysis','参考拆解',{type:'textarea',rows:2})),field(key,'priority','优先级',{options:[['1','1 · 高'],['2','2 · 中'],['3','3 · 低']]}),field(key,'tags','标签（逗号分隔）'),h('div',{class:'full'},field(key,'synthetic','内容确认',{type:'checkbox',required:true,checkedLabel:'这些是虚构测试内容，不含真实账号或私稿'}))),async(v,k)=>{if(!v.synthetic)throw new Error('当前仅允许虚构测试内容');const references=v.referenceUrl||v.referenceTitle||v.analysis?[{url:v.referenceUrl||undefined,title:v.referenceTitle||undefined,analysis:v.analysis}]:[];const result=await save(k,'captureIdea',{title:v.title,summary:v.summary,angle:v.angle,contentType:v.contentType,priority:Number(v.priority),tags:v.tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean),references});closeDialog();navigate('ideas',result.result.workId);if(result.result.duplicateReferences?.length)announce('选题已保存。参考网址与现有记录重复，可在详情比较；未自动删除或合并')},{submit:'保存选题'}));
}
function showStart(work){const key=`start:${work.id}`;openDialog('选择制作模板',()=>form(key,{contentType:work.contentType||'video'},()=>h('div',{class:'stack'},para(`作品：${work.title}。沿用 WorkID ${work.id}`,'hint'),field(key,'contentType','制作模板',{options:[['video','短视频：写稿 / 录制 / 剪辑 / 封面 / 检查'],['text','图文：写稿 / 配图 / 封面 / 检查']]}),para('必需任务必须完成，或填写理由后标为“不适用”。重复开始不会生成重复任务。','hint')),async(v,k)=>{await save(k,'startProduction',{workId:work.id,contentType:v.contentType});closeDialog();navigate('production',work.id)},{submit:'开始创作'}))}

function renderDetail(work){
  const workId=work.id,p=readiness(state(),workId),currentDraft=state().drafts[work.bodyRevisionId];
  const detail=h('section',{id:'work-detail',class:'detail panel',tabindex:'-1','aria-label':`${work.title} 作品详情`},h('div',{class:'page-heading detail-head'},h('div',{},h('h2',{},work.title),identityDetails(`detail-${work.id}`,'作品标识与修订',`WorkID ${work.id} · 修订 ${work.revision}`),h('div',{class:'badges'},badge(PHASE_NAMES[work.phase]||work.phase),work.trashedAt?badge('在回收站','warn'):null,work.draftNeedsReview?badge('切入点有变，稿件需复核','warn'):null)),button('关闭详情',closeDetail,'quiet')),h('div',{class:'tabs','aria-label':'同一作品的模块入口'},VIEWS.map(v=>button(VIEW_NAMES[v],()=>navigate(v,work.id),'tiny',{'aria-pressed':route.view===v}))),para('此详情显示这件作品的全部账号关联记录，与六个模块共用同一 WorkID；列表上的账号筛选不隐藏详情历史。未保存输入暂存于当前页面，关闭或刷新前请完成保存。','hint'));
  if(work.trashedAt){detail.append(para('作品已移入可恢复回收站，历史版本和发布事实仍保留。','warning'),button('还原作品',()=>action('restoreWork',{workId},'作品已还原'),'primary'));return detail}
  const metaKey=`idea:${workId}`;
  detail.append(disclosure(`idea:${workId}`,'选题与参考',h('div',{class:'stack'},form(metaKey,{title:work.title,summary:work.summary||'',angle:work.angle||'',priority:String(work.priority||2),tags:(work.tags||[]).join(', ')},()=>h('div',{class:'field-grid'},field(metaKey,'title','选题标题',{required:true}),field(metaKey,'priority','优先级',{options:[['1','1 · 高'],['2','2 · 中'],['3','3 · 低']]}),h('div',{class:'full'},field(metaKey,'summary','简述',{type:'textarea',rows:2})),h('div',{class:'full'},field(metaKey,'angle','自己的切入点',{type:'textarea'})),h('div',{class:'full'},field(metaKey,'tags','标签（逗号分隔）'))),async(v,k)=>save(k,'updateIdea',{workId,title:v.title,summary:v.summary,angle:v.angle,priority:Number(v.priority),tags:v.tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean)}),{submit:'保存选题修改'}),h('div',{class:'section-heading'},h('h3',{},'参考来源'),button('新增参考',()=>showReference(work),'tiny')),related('references',workId).map(ref=>h('article',{class:'work-row'},h('h3',{},ref.title||'参考'),ref.url?external(ref.url,ref.url):null,para(ref.analysis||'尚未拆解参考','small'),ref.excerpt?h('pre',{class:'prose'},ref.excerpt):null,para(`来源作者：${text(ref.author)} · 访问状态：未自动核验`,'hint'),button('编辑参考',()=>showReference(work,ref),'tiny'))),work.phase==='idea'?button('开始创作',()=>showStart(work),'primary'):null),{open:route.view==='ideas'}));
  if(work.phase!=='idea'){
    const draftKey=`draft:${workId}`;
    detail.append(disclosure(`draft:${workId}`,'稿件与版本',h('div',{class:'stack'},form(draftKey,{title:currentDraft?.title||work.title,body:currentDraft?.body||''},()=>h('div',{class:'stack'},field(draftKey,'title','稿件标题',{required:true}),field(draftKey,'body','正文 / 脚本',{type:'textarea',rows:14,required:true,hint:'按原文保存，不解释成 HTML。保存后产生新版本。'})),async(v,k)=>save(k,'saveDraft',{workId,title:v.title,body:v.body},'新稿件版本已保存'),{submit:'保存新版本'}),disclosure(`versions:${workId}`,`历史版本（${related('drafts',workId).length}）`,related('drafts',workId).slice().reverse().map(d=>h('article',{class:'version'},h('h3',{},d.title),para(`${d.createdAt} · ${d.id}${d.id===work.bodyRevisionId?' · 当前版本':''}`,'id'),h('pre',{class:'prose'},d.body))))),{open:route.view==='production'}));
    detail.append(disclosure(`tasks:${workId}`,`制作任务 · ${p.completed}/${p.total} 必需项完成`,h('div',{class:'stack'},related('tasks',workId).map(t=>{const key=`task:${t.id}`;return h('article',{class:'task-row'},h('div',{class:'row-head'},h('h3',{},t.title),badge(t.required?'必需':'可选')),form(key,{status:t.status,reason:t.reason||''},()=>h('div',{class:'field-grid'},field(key,'status','任务状态',{options:Object.entries(TASK_NAMES)}),field(key,'reason','阻塞 / 不适用原因',{hint:'选择阻塞或不适用时必须填写。'})),async(v,k)=>save(k,'setTaskState',{workId,taskId:t.id,status:v.status,reason:v.reason}),{submit:'保存任务状态'}))}),p.missing.length?h('div',{class:'status-box'},h('strong',{},'可发布检查尚缺：'),h('ul',{},p.missing.map(m=>h('li',{},m.label)))):para('必需任务与稿件检查通过；仍需主动确认可发布状态。','success'),button('检查并设为可发布',()=>action('setReady',{workId},'作品已设为可发布；尚未登记任何发布'),'primary')),{open:route.view==='production'}));
  }
  detail.append(disclosure(`schedule:${workId}`,'按账号排期',h('div',{class:'stack'},related('publications',workId).length?related('publications',workId).map(pub=>publicationRow(pub)):para('当前没有发布计划或登记。','hint'),button('新增账号排期',()=>showSchedule(work),'primary')),{open:route.view==='calendar'}));
  detail.append(disclosure(`publication:${workId}`,'手动登记发布与历史快照',h('div',{class:'stack',id:`publication-${workId}`},para('只记录你已完成的发布。这里不会上传、代发或向平台请求数据。','hint'),button('登记已发布事实',()=>showPublication(work),'primary'),related('publications',workId).filter(pub=>pub.status==='published').map(pub=>disclosure(`snapshot:${pub.id}`,`${accountName(pub.accountId)} · ${pub.actualPublishedAt}`,h('div',{class:'stack'},h('h3',{},pub.finalSnapshot?.title),h('pre',{class:'prose'},pub.finalSnapshot?.body),external(pub.publicUrl,'查看已登记链接'),para(`对应稿件版本：${pub.finalRevisionId} · 来源：用户登记`,'hint'))))),{open:route.view==='library'}));
  detail.append(disclosure(`assets:${workId}`,'素材引用与可用性',h('div',{class:'stack'},para('仅保存文件清单或安全网址，不保存视频本体。备份恢复不会凭空恢复素材；可用性默认未核验。','hint'),related('assets',workId).map(a=>h('article',{class:'work-row'},h('h3',{},a.name),para(`${a.mimeType||'类型未记录'} · ${a.size==null?'大小未记录':`${a.size} 字节`} · ${a.availability==='missing'?'素材缺失':'未核验素材本体'}`,'hint'),a.url?external(a.url,'素材引用链接'):null,h('div',{class:'actions'},button('标记素材缺失',()=>action('setAssetAvailability',{assetId:a.id,availability:'missing',note:'用户标记缺失'}),'tiny'),button('标为待核验',()=>action('setAssetAvailability',{assetId:a.id,availability:'unverified'}),'tiny')))),button('添加素材引用',()=>showAsset(work),'tiny'))));
  detail.append(disclosure(`metrics:${workId}`,'表现快照与复盘',h('div',{class:'stack'},button('为这件作品录入指标',()=>showMetrics(workId),'primary'),renderMetricCards({workId}),renderReviewForm(work),related('reviews',workId).map(r=>h('article',{class:'work-row'},h('h3',{},r.observation),para(`可能原因：${r.hypothesis||'未填写'}`,'small'),para(`下次试验：${r.nextExperiment}`,'small'),para(`证据快照：${(r.evidenceMetricIds||[]).join('、')||'未关联证据'} · ${r.createdAt}`,'id'),(r.followupWorkIds||[]).length?(r.followupWorkIds||[]).map(id=>routeLink('ideas',`打开后续选题：${workName(id)}`,id)):button('转为后续选题',()=>showFollowup(r),'tiny')))),{open:route.view==='database'}));
  detail.append(h('div',{class:'danger-zone actions'},work.phase==='archived'?button('恢复到活动作品',()=>action('restoreWork',{workId},'作品已恢复')):button('归档作品',()=>confirmWorkAction(work,'archiveWork','归档后从活动队列移出，稿件与历史保留。')),button('移入回收站',()=>confirmWorkAction(work,'trashWork','作品进入可恢复回收站；不会永久删除。'),'danger')));
  return detail;
}
function showReference(work,ref){const key=`reference:${ref?.id||work.id}`;openDialog(ref?'编辑参考':'新增参考',()=>form(key,{title:ref?.title||'',url:ref?.url||'',analysis:ref?.analysis||'',excerpt:ref?.excerpt||'',author:ref?.author||'',rightsNote:ref?.rightsNote||''},()=>h('div',{class:'field-grid'},field(key,'title','参考名称'),field(key,'url','网址',{type:'url'}),field(key,'author','来源作者'),field(key,'rightsNote','使用权利备注'),h('div',{class:'full'},field(key,'analysis','参考拆解',{type:'textarea'})),h('div',{class:'full'},field(key,'excerpt','少量必要摘录',{type:'textarea'}))),async(v,k)=>{await save(k,ref?'updateReference':'addReference',{...(ref?{referenceId:ref.id}:{workId:work.id}),...v,url:ref?(v.url||null):(v.url||undefined)});closeDialog()},{submit:'保存参考'}))}

function showSchedulePicker(){if(!workOptions().length)return openDialog('新增排期',()=>empty('还没有可安排的作品','先保存一个虚构选题。',button('新建选题',()=>{closeDialog();showCapture()},'primary')));const key='schedule-picker';openDialog('选择要排期的作品',()=>form(key,{workId:workOptions()[0][0]},()=>field(key,'workId','作品',{options:workOptions()}),async v=>{const work=state().works[v.workId];closeDialog();showSchedule(work)},{submit:'继续安排日期'}))}
function showSchedule(work,pub){
  if(!accounts().length)return openDialog('先创建演示账号',()=>h('div',{class:'stack'},para('排期必须指向一个明确账号。'),button('添加虚构账号',()=>{closeDialog();showAccounts()},'primary')));
  const key=`schedule:${pub?.id||work.id}`;const s=pub?.schedule;
  openDialog(pub?.schedule?'修改排期':'新增账号排期',()=>form(key,{accountId:pub?.accountId||'',date:s?.date||'',time:s?.time||'',timeZone:s?.timeZone||'',allDay:s?.allDay||false,offsetMinutes:s?.offsetMinutes??''},()=>h('div',{class:'stack'},para(`作品：${work.title} · ${progressLine(work.id)}`,'hint'),h('div',{class:'field-grid'},field(key,'accountId','目标账号',{options:[['','请选择账号'],...accountOptions()],required:true,disabled:Boolean(pub)}),field(key,'date','计划日期',{type:'date',required:true}),field(key,'time','计划时间',{type:'time',hint:'未选择全天时必须填写，不会自动填午夜。'}),field(key,'timeZone','IANA 时区',{required:true,placeholder:'例如 Asia/Shanghai'}),field(key,'allDay','全天安排',{type:'checkbox',checkedLabel:'这是明确的全天日程，不指定钟点'}),field(key,'offsetMinutes','歧义时刻的 UTC 偏移（分钟，可留空）',{type:'number',step:'1',hint:'夏令时回拨时按错误提示明确选择；例如 UTC+8 为 480。'}))),async(v,k)=>{if(!v.allDay&&!v.time)throw new Error('非全天日程必须填写具体时间');await save(k,'setSchedule',{workId:work.id,accountId:v.accountId,publicationId:pub?.id,schedule:{date:v.date,timeZone:v.timeZone,allDay:Boolean(v.allDay),...(!v.allDay?{time:v.time}:{}),...(String(v.offsetMinutes).trim()?{offsetMinutes:Number(v.offsetMinutes)}:{})}},'排期已保存；不会自动发布');closeDialog()},{submit:pub?.schedule?'保存改期':'保存排期'}));
}
function confirmCancelSchedule(pub){openDialog('取消这条排期',()=>h('div',{class:'stack'},para(`${workName(pub.workId)} · ${accountName(pub.accountId)} · ${scheduleLabel(pub)}`),para('取消后返回未排期队列；稿件和任务保留。取消不会撤销已经发布的事实。','hint'),h('div',{class:'actions'},button('确认取消排期',async()=>{const result=await action('cancelSchedule',{publicationId:pub.id},'排期已取消，可撤销');if(result)closeDialog()},'primary'),button('保留排期',closeDialog))))}
function showPublicationPicker(){const available=workOptions();if(!available.length)return openDialog('登记已发布事实',()=>empty('没有可登记的作品','请先保存稿件并完成制作检查。',button('打开创作台',()=>{closeDialog();navigate('production')})));const key='publication-picker';openDialog('选择作品',()=>form(key,{workId:available[0][0]},()=>field(key,'workId','作品',{options:available}),async v=>{const work=state().works[v.workId];closeDialog();showPublication(work)},{submit:'填写发布事实'}))}
function showPublication(work,pub){
  const drafts=related('drafts',work.id),key=`publication:${pub?.id||work.id}`;
  const pendingPlans=related('publications',work.id).filter(p=>p.status!=='published');
  const initialPlan=pub||(pendingPlans.length===1?pendingPlans[0]:null);
  if(!accounts().length||!drafts.length)return openDialog('暂时不能登记',()=>h('div',{class:'stack'},para('登记发布需要一个账号和已保存的稿件版本。'),button(!accounts().length?'添加虚构账号':'打开稿件编辑',()=>{closeDialog();if(!accounts().length)showAccounts();else navigate('production',work.id)},'primary')));
  openDialog('登记已经发布的事实',()=>form(key,{publicationId:initialPlan?.id||'',accountId:initialPlan?.accountId||'',actualDateTime:'',offset:'',publicUrl:'',finalRevisionId:work.bodyRevisionId||'',confirmed:false},()=>h('div',{class:'stack'},para(`作品：${work.title}。保存的是手动发布记录，非平台核验。`,'hint'),h('div',{class:'field-grid'},h('div',{class:'full'},field(key,'publicationId','关联原发布计划',{options:[['','不关联计划，新建一次发布'],...pendingPlans.map(p=>[p.id,`${accountName(p.accountId)} · ${scheduleLabel(p)}`])],disabled:Boolean(pub),hint:'选择原计划可同时保留计划与实际时间，避免重复记录同一次发布。'})),field(key,'accountId','已发布账号',{options:[['','请选择账号'],...accountOptions()],required:true,disabled:Boolean(pub)}),field(key,'finalRevisionId','发布对应的稿件版本',{options:drafts.map(d=>[d.id,`${d.title} · ${d.createdAt}`]),required:true}),field(key,'actualDateTime','实际发布日期与时间',{type:'datetime-local',required:true}),field(key,'offset','该时刻 UTC 偏移',{placeholder:'+08:00',required:true}),h('div',{class:'full'},field(key,'publicUrl','已发布公开链接',{type:'url',required:true})),h('div',{class:'full'},field(key,'confirmed','事实确认',{type:'checkbox',required:true,checkedLabel:'确认这是已发生的发布（本演示中使用虚构事实）'}))),para('所选版本的标题、正文和素材清单会形成不可变发布快照。计划时间与实际时间分别保留。','hint')),async(v,k)=>{if(!v.confirmed)throw new Error('请确认发布事实');if(v.publicationId&&state().publications[v.publicationId]?.accountId!==v.accountId)throw new Error('所选计划与已发布账号不一致，请核对');await save(k,'recordPublication',{workId:work.id,accountId:v.accountId,publicationId:v.publicationId||undefined,actualPublishedAt:utcOffsetIso(v.actualDateTime,v.offset),publicUrl:v.publicUrl,finalRevisionId:v.finalRevisionId},'发布事实已登记；没有向平台发送内容');closeDialog();navigate('library',work.id)},{submit:'保存发布登记'}));
}

function showAccounts(editAccount=null){
  const key=`account:${editAccount?.id||'new'}`;
  openDialog(editAccount?'编辑演示账号':'账号管理',()=>h('div',{class:'stack'},para('只保存展示名、平台和自选标识，不填写密码、Cookie、令牌或密钥。本候选仅接受虚构测试账号。','hint'),!editAccount?h('div',{class:'stack'},accounts().length?accounts().map(a=>h('div',{class:'work-row'},h('div',{class:'row-head'},h('h3',{},a.displayName),button('编辑',()=>showAccounts(a),'tiny')),para(`${a.platform} · ${a.handle||'未设标识'}`,'hint'),h('p',{class:'id'},a.id))):para('尚未创建账号','hint')):null,form(key,{displayName:editAccount?.displayName||'',platform:editAccount?.platform||'',handle:editAccount?.handle||''},()=>h('div',{class:'field-grid'},field(key,'displayName','虚构账号展示名',{required:true,placeholder:'例如：演示账号甲'}),field(key,'platform','平台名称',{required:true,placeholder:'例如：演示平台'}),h('div',{class:'full'},field(key,'handle','自选标识（可选）'))),async(v,k)=>{await save(k,editAccount?'updateAccount':'createAccount',{...(editAccount?{accountId:editAccount.id}:{}),...v});closeDialog();showAccounts()},{submit:editAccount?'保存账号修改':'创建虚构账号'})));
}
function goalActual(goal){return selectWorkspace(state(),{month:goal.month,timeZone:goal.timeZone,accountId:goal.accountId||undefined}).goals.find(g=>g.id===goal.id)?.actual??0}
function renderGoalList(){const goals=values(state().goals).filter(g=>g.month===filters.month&&(!filters.accountId||g.accountId===filters.accountId));return goals.length?h('div',{class:'stack'},goals.map(g=>h('article',{class:'work-row'},h('div',{class:'goal-content'},goalRing(goalActual(g),g.target),h('h3',{},g.metric==='publications'?'登记发布次数':'完成作品数')),para(`${g.month} · ${g.timeZone} · ${g.accountId?accountName(g.accountId):'全部账号'}`,'hint'),button('编辑目标',()=>showGoals(g),'tiny')))):para('本月尚未设置目标。按你的计划设置，不预填目标数字。','hint')}
function showGoals(goal=null){const key=`goal:${goal?.id||'new'}`;openDialog(goal?'编辑月目标':'月目标',()=>h('div',{class:'stack'},!goal?renderGoalList():null,form(key,{month:goal?.month||filters.month,timeZone:goal?.timeZone||filters.timeZone,metric:goal?.metric||'worksCompleted',target:goal?.target??'',accountId:goal?.accountId||''},()=>h('div',{class:'field-grid'},field(key,'month','目标月份',{type:'month',required:true}),field(key,'timeZone','统计时区',{required:true}),field(key,'metric','目标指标',{options:[['worksCompleted','完成作品数（进入可发布）'],['publications','手动登记发布次数']]}),field(key,'target','目标值',{type:'number',min:'0',step:'1',required:true}),h('div',{class:'full'},field(key,'accountId','账号范围',{options:[['','所有账号'],...accountOptions()]}))),async(v,k)=>{await save(k,'setGoal',{goalId:goal?.id,month:v.month,timeZone:v.timeZone,metric:v.metric,target:Number(v.target),accountId:v.accountId||null});closeDialog()},{submit:'保存月目标'}),para('账号范围以该账号的发布记录或计划关联作品；未指定账号的灵感不计入单账号目标。','hint')))}

function metricsInScope({workId}={}){
  const cutoff=Date.parse(renderCutoff);
  return values(state().metrics).filter(m=>{
    const pub=m.publicationId?state().publications[m.publicationId]:null,account=state().accounts[m.accountId||pub?.accountId];
    if(workId&&pub?.workId!==workId)return false;
    if(filters.accountId&&account?.id!==filters.accountId)return false;
    if(route.view==='database'&&filters.platform&&account?.platform!==filters.platform)return false;
    if(Date.parse(m.observedAt)>cutoff)return false;
    if(filters.search&&pub&&!matchWork(state().works[pub.workId],state(),filters.search))return false;
    return true;
  });
}
function renderMetricCards({workId,limit}={}){
  const rows=metricsInScope({workId}),groups=new Map();
  for(const m of rows){const key=JSON.stringify([m.publicationId||m.accountId,m.metricKey,m.unit,m.definition||'']);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m)}
  let groupsList=[...groups.values()];if(limit)groupsList=groupsList.slice(0,limit);
  if(!groupsList.length)return empty('表现尚未记录','空白表示未知。录入明确观测到的 0 才会显示为 0。',button('手工录入快照',()=>showMetrics(workId),'tiny'));
  return h('div',{class:'data-list'},groupsList.map(group=>{
    group.sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));const current=group.at(-1);const target=current.publicationId?{publicationId:current.publicationId}:{accountId:current.accountId};
    const delta=metricDelta(state(),{...target,metricKey:current.metricKey,definition:current.definition||'',asOf:renderCutoff});
    const pub=current.publicationId?state().publications[current.publicationId]:null;
    const title=pub?`${workName(pub.workId)} · ${accountName(pub.accountId)}`:accountName(current.accountId);
    return h('article',{class:'snapshot-row'},h('div',{class:'row-head'},h('h3',{},`${title} · ${METRIC_NAMES[current.metricKey]||current.metricKey}`),h('span',{class:'metric-value'},current.value===null?'未记录':current.value)),para(`最新累计值，未将历次快照相加。上次同口径增量：${delta.value===null?'无法计算（缺少有效可比值）':`${delta.value>=0?'+':''}${delta.value}`}`,'hint'),para(`口径：${current.definition||'未注明'} · 单位：${current.unit||'count'} · 观测：${current.observedAt}`,'hint'),para(`来源：${text(current.sourceRef)}`,'hint'),identityDetails(`metric-id-${current.id}`,'快照标识',current.id),renderTrend(group),disclosure(`metric:${current.id}`,`核对 ${group.length} 条历史快照`,group.map(m=>h('div',{class:'version'},para(`${m.observedAt} · ${m.value===null?'未知':m.value} · ${text(m.sourceRef)}`,'small'),h('p',{class:'id'},m.id)))));
  }));
}
function renderTrend(series){
  if(series.length<2)return para('至少两个观测时刻后显示趋势；单点不推断增长。','hint');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 400 120');svg.setAttribute('class','spark');svg.setAttribute('role','img');svg.setAttribute('aria-label',`按时间排列的 ${series.length} 条同口径快照，未知值处断开。下方可展开精确数值。`);
  const points=trendPoints(series);let segment=[];
  const draw=()=>{if(segment.length>1){const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',segment.map(p=>`${p.x},${p.y}`).join(' '));svg.append(line)}segment=[]};
  for(const p of points){if(!p){draw();continue}segment.push(p);const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r','3');svg.append(circle)}draw();
  return svg;
}
function showMetrics(workId){
  const pubs=values(state().publications).filter(p=>p.status==='published'&&(!workId||p.workId===workId));
  const targets=[...pubs.map(p=>[`publication:${p.id}`,`${workName(p.workId)} · ${accountName(p.accountId)}`]),...(!workId?accounts().map(a=>[`account:${a.id}`,`账号粉丝 · ${a.displayName} · ${a.platform}`]):[])];
  if(!targets.length)return openDialog('录入指标',()=>h('div',{class:'stack'},para('作品指标需要先登记发布；账号粉丝指标需要先创建账号。'),button('管理账号',()=>{closeDialog();showAccounts()})));
  const key=`metrics:${workId||'any'}`;
  openDialog('新增手工指标快照',()=>form(key,{target:targets[0][0],metricKey:workId?'views':pubs.length?'views':'followers',value:'',observedDateTime:'',offset:'',definition:'',sourceRef:''},()=>h('div',{class:'field-grid'},h('div',{class:'full'},field(key,'target','作品发布 / 账号',{options:targets,required:true})),field(key,'metricKey','指标',{options:Object.entries(METRIC_NAMES)}),field(key,'value','指标值',{type:'number',min:'0',step:'any',hint:'留空保存为未知 null；0 是明确观测值。'}),field(key,'observedDateTime','原始采样日期与时间',{type:'datetime-local',required:true}),field(key,'offset','采样时刻 UTC 偏移',{required:true,placeholder:'+08:00'}),field(key,'definition','平台指标口径',{required:true,placeholder:'例如：平台累计播放次数'}),field(key,'sourceRef','来源说明',{required:true,placeholder:'例如：虚构手工快照 1'})),async(v,k)=>{const index=v.target.indexOf(':');const kind=v.target.slice(0,index),id=v.target.slice(index+1);await save(k,'appendMetrics',{snapshots:[{[kind==='publication'?'publicationId':'accountId']:id,metricKey:v.metricKey,value:parseNullableNumber(v.value),unit:'count',definition:v.definition,observedAt:utcOffsetIso(v.observedDateTime,v.offset),sourceRef:v.sourceRef}]},'指标快照已保存');closeDialog()},{submit:'保存指标快照'}));
}
function renderReviewForm(work){const key=`review:${work.id}`;const candidates=related('publications',work.id).flatMap(pub=>values(state().metrics).filter(m=>m.publicationId===pub.id));return form(key,{observation:'',hypothesis:'',nextExperiment:'',evidenceMetricIds:[]},()=>h('div',{class:'stack'},h('h3',{},'新复盘'),field(key,'observation','观察',{type:'textarea',required:true,rows:3}),field(key,'hypothesis','可能原因（假设）',{type:'textarea',rows:3}),field(key,'nextExperiment','下一次试验',{type:'textarea',required:true,rows:3}),h('fieldset',{},h('legend',{},'复盘依据快照（至少选择一条）'),candidates.length?h('div',{class:'checkbox-list'},candidates.map(m=>h('label',{class:'check-label'},h('input',{type:'checkbox',checked:(controller.buffers.get(key).values.evidenceMetricIds||[]).includes(m.id),onChange:e=>{const b=controller.buffers.get(key);const set=new Set(b.values.evidenceMetricIds);e.target.checked?set.add(m.id):set.delete(m.id);controller.edit(key,'evidenceMetricIds',[...set],b.values)}}),`${METRIC_NAMES[m.metricKey]} ${m.value===null?'未知':m.value} · ${m.observedAt} · ${m.definition||'未注明口径'}`))):para('尚无指标证据。请先录入至少一条快照，再选择依据保存复盘；假设不等于已验证因果。','hint'))),async(v,k)=>save(k,'saveReview',{workId:work.id,...v},'复盘已保存'),{submit:'保存复盘'})}
function showFollowup(review){const key=`followup:${review.id}`;openDialog('从复盘创建后续选题',()=>form(key,{title:'',angle:review.nextExperiment||''},()=>h('div',{class:'stack'},para(`来源作品：${workName(review.workId)}；来源复盘：${review.id}`,'hint'),field(key,'title','新选题标题',{required:true}),field(key,'angle','新选题切入点',{type:'textarea',required:true})),async(v,k)=>{const result=await save(k,'deriveFollowupIdea',{reviewId:review.id,title:v.title,angle:v.angle},'已创建并关联后续选题');closeDialog();navigate('ideas',result.result.workId)},{submit:'创建关联选题'}))}
function showAsset(work){const key=`asset:${work.id}`;openDialog('添加素材引用',()=>form(key,{name:'',mimeType:'',size:'',url:'',sha256:''},()=>h('div',{class:'stack'},para('只记录引用与文件清单。选择本地文件仅提取名称、类型、大小和哈希，不保存或上传文件本体。','hint'),h('label',{},'从本地文件读取清单（可选）',h('input',{type:'file',onChange:async e=>{const file=e.target.files[0];if(!file)return;if(file.size>100*1024*1024){announce('此处只为小于 100 MiB 的演示文件计算哈希；大文件请手填清单',true);return}const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());const b=controller.buffers.get(key);for(const [name,value]of Object.entries({name:file.name,mimeType:file.type,size:String(file.size),sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')}))controller.edit(key,name,value,b.values);renderDialog()}})),h('div',{class:'field-grid'},field(key,'name','文件名称',{required:true}),field(key,'mimeType','媒体类型'),field(key,'size','文件大小（字节）',{type:'number',min:'0'}),field(key,'url','可选素材 URL',{type:'url'}),h('div',{class:'full'},field(key,'sha256','SHA-256（可选）')))),async(v,k)=>{await save(k,'addAsset',{workId:work.id,name:v.name,mimeType:v.mimeType||undefined,size:v.size===''?undefined:Number(v.size),url:v.url||undefined,sha256:v.sha256||undefined},'素材清单已保存；文件本体未保存');closeDialog()},{submit:'保存素材引用'}))}
function confirmWorkAction(work,type,note){openDialog(type==='trashWork'?'移入可恢复回收站':'归档作品',()=>h('div',{class:'stack'},h('h3',{},work.title),para(note),h('div',{class:'actions'},button(type==='trashWork'?'确认移入回收站':'确认归档',async()=>{const result=await action(type,{workId:work.id},type==='trashWork'?'作品已移入回收站':'作品已归档');if(result){closeDialog();navigate(route.view)}},'primary'),button('取消',closeDialog))))}
function showTrash(){openDialog('可恢复回收站',()=>h('div',{class:'stack'},para('这里只执行恢复或移入；不提供永久清空。','hint'),workRecords().some(w=>w.trashedAt)?workRecords().filter(w=>w.trashedAt).map(w=>h('article',{class:'work-row'},h('h3',{},w.title),para(`移入时间 ${w.trashedAt}`,'hint'),button('恢复作品',async()=>{const result=await action('restoreWork',{workId:w.id},'作品已恢复');if(result)renderDialog()},'primary'))):empty('回收站为空','移入回收站的作品可在这里恢复。')))}

function showBackup(){
  const selected=new Set(workRecords().map(w=>w.id));
  openDialog('本地备份与恢复',()=>h('div',{class:'stack'},
    para('浏览器本地保存不是云端备份。此处只生成供你下载的交换文件，不上传或发布。当前数据均应为虚构测试数据。','hint'),
    h('section',{class:'panel'},h('h3',{},'导出范围'),
      workRecords().length?h('div',{class:'checkbox-list'},workRecords().map(w=>h('label',{class:'check-label'},h('input',{type:'checkbox',checked:true,onChange:e=>{e.target.checked?selected.add(w.id):selected.delete(w.id)}}),`${w.title}${w.trashedAt?'（回收站）':''}`))):para('当前没有作品；仍可导出账号和目标记录','hint'),
      para('全部已保存业务记录包包含作品、账号、账号指标与目标。勾选作品备份会包含相连的父作品与后续选题、相关账号和账号目标，不含无关账号或全局目标。素材仅含清单，不含文件本体。','hint'),
      h('div',{class:'actions'},button('核对全部已保存业务记录',()=>prepareExport(null),'primary'),button('核对勾选作品备份',()=>prepareExport([...selected])))),
    h('section',{class:'panel'},h('h3',{},'导入交换包'),
      !controller.policy.allowBackupImport?para('当前来源只启用演示。所有备份与真实/私有导入均关闭；换路径或数据库名不提供同源隔离。','warning'):para('先验证文件，再查看新增、相同、较旧、冲突与缺失素材。确认后原子写入，并生成恢复点。','hint'),
      h('label',{},'选择交换包 JSON',h('input',{type:'file',accept:'.json,application/json',disabled:!controller.policy.allowBackupImport,onChange:async e=>{
        const file=e.target.files[0];if(!file)return;
        if(!controller.policy.allowBackupImport)return announce('演示来源禁止导入',true);
        if(file.size>8*1024*1024)return announce('交换包不能超过 8 MiB',true);
        try{const pkg=JSON.parse(await file.text());const preview=await controller.previewImport(pkg);showImportPreview(pkg,preview)}catch(error){handleError(error)}
      }}))),
    button('查看可恢复导入点',async()=>{if(!controller.policy.allowBackupImport)return;try{const points=await controller.listRestorePoints();showRestorePoints(points)}catch(error){handleError(error)}},'',{disabled:!controller.policy.allowBackupImport}),
    h('section',{class:'panel'},h('h3',{},'未保存输入'),para('保存失败时可额外导出当前页面的编辑缓冲。它不是标准交换包，不会覆盖已保存记录。','hint'),button('导出未保存输入',()=>{
      const buffers=[...controller.buffers.entries()].filter(([,b])=>b.dirty).map(([form,b])=>({form,baseRevision:b.baseRevision,values:b.values}));
      download(`creator-unsaved-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({format:'mydotwork.unsaved-input.v1',generatedAt:new Date().toISOString(),workspaceId:state().id,buffers},null,2));announce('未保存输入文件已生成，请确认下载完成');
    },'',{disabled:![...controller.buffers.values()].some(b=>b.dirty)}))));
}
async function prepareExport(workIds){
  try{
    const pkg=await exportPackage(state(),workIds===null?{}:{workIds});
    const records=pkg.records||[];const count=collection=>records.filter(r=>r.collection===collection).length;
    const exportedWorks=records.filter(r=>r.collection==='works').map(r=>r.entity);
    openDialog('核对备份内容后下载',()=>h('div',{class:'stack'},
      para(workIds===null?'范围：全部已保存业务记录（含账号、账号指标与目标）。':'范围：勾选作品及必须关联的父作品、后续选题、相关账号与账号目标；不包含无关账号和全局目标。','hint'),
      para(`作品 ${count('works')} · 账号 ${count('accounts')} · 目标 ${count('goals')} · 发布 ${count('publications')} · 指标 ${count('metrics')} · 素材清单 ${pkg.assetManifest.length}`),
      exportedWorks.length?h('ul',{},exportedWorks.map(w=>h('li',{},w.title))):para('无作品记录。全部已保存业务记录包仍保留独立账号和目标。','hint'),
      para('附件文件本体：0 个。包含业务记录、版本关系与素材清单；不包含本地操作日志、撤销记录、恢复点或未保存输入。未保存输入需单独导出。用途：私有备份或显式交换；不上传、不公开。','warning'),
      h('div',{class:'actions'},button('下载已核对的私有备份',()=>{download(`mydotwork-creator-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(pkg,null,2));closeDialog();announce(`备份文件已生成（${new Date().toISOString()}），请确认浏览器下载完成。尚未上传云端。`)},'primary'),button('取消',closeDialog))));
  }catch(error){handleError(error)}
}
function showImportPreview(pkg,preview){
  const choices={},expectedRevision=state().revision,operationId=randomOperationId();
  openDialog('核对交换包导入',()=>h('div',{class:'stack'},
    para(`包 ${preview.packageId} · 来源工作区 ${preview.sourceWorkspaceId} · 当前本地版本 ${expectedRevision}`,'id'),
    h('div',{class:'metrics-grid'},...['new','same','older','conflicts'].map((k,i)=>h('div',{class:'stat'},h('b',{},preview[k].length),h('span',{},['新增','相同（跳过）','较旧（保留本地）','需要选择的冲突'][i])))),
    ...['new','same','older'].map((k,i)=>disclosure(`import-${k}`,`${['新增','相同','较旧'][i]}记录明细`,h('pre',{class:'prose'},JSON.stringify(preview[k],null,2)))),
    preview.conflicts.map(conflict=>h('section',{class:'panel'},h('h3',{},`冲突：${conflict.key||`${conflict.collection}:${conflict.id}`}`),
      para(conflict.noCommonBase?'没有共同基线：无法判断哪端较新，必须选择保留哪份。':'存在共同基线：请比较三个版本，明确选择。','warning'),
      h('div',{class:'preview-grid'},...[["本地",conflict.local],["导入",conflict.incoming],["共同基线",conflict.commonBase]].map(([title,value])=>h('section',{class:'preview-piece'},h('h3',{},title),h('pre',{},value?JSON.stringify(value,null,2):'无共同基线')))),
      h('label',{},'保留哪个版本',selectInput(conflict.key,'',[['','请选择，不自动覆盖'],['local','保留本地版本'],['incoming','使用导入版本']],value=>{choices[conflict.key]=value})))),
    h('section',{class:'panel'},h('h3',{},`缺少素材文件本体（${preview.missingAssets.length}）`),
      preview.missingAssets.length?h('ul',{},preview.missingAssets.map(a=>h('li',{},`${a.name||a.id||a.assetId}：${a.reason||'只含引用，文件本体未包含'}`))):para('此包没有素材清单。', 'hint')),
    para('确认将写入已选择的内容；同时保存导入前恢复点。不会按时间戳静默覆盖，也不会还原未提供的媒体本体。','hint'),
    h('div',{class:'actions'},button('确认导入所选内容',async()=>{
      if(preview.conflicts.some(c=>!['local','incoming'].includes(choices[c.key])))return announce('每一个冲突都必须选择本地或导入版本',true);
      try{const result=await controller.importPackage(pkg,{expectedRevision,operationId,choices});closeDialog();announce(result.replayed?'包内容相同，无需重复导入；没有创建新的恢复点':result.result?.restorePointId?'导入事务已完成，恢复点已保存；请检查缺失素材清单':'导入事务已完成；没有新增恢复点');render()}catch(error){handleError(error)}
    },'primary',{disabled:!controller.policy.allowBackupImport}),button('取消导入',closeDialog))));
}
function showRestorePoints(points){openDialog('导入与恢复点',()=>h('div',{class:'stack'},points.length?points.map(point=>h('article',{class:'work-row'},h('h3',{},`${point.createdAt} · ${point.reason}`),para(`工作区版本 ${point.workspaceRevision} · ${point.id}`,'id'),button('核对并恢复此版本',()=>openDialog('恢复整个工作区',()=>h('div',{class:'stack'},para(`将恢复到 ${point.createdAt} 保存的版本 ${point.workspaceRevision}。当前版本也会生成新的恢复点。`),button('确认恢复',async()=>{try{await controller.restore({restorePointId:point.id,expectedRevision:state().revision,operationId:randomOperationId()});closeDialog();announce('工作区恢复已完成');render()}catch(error){handleError(error)}},'primary'),button('取消',closeDialog)))))):empty('还没有恢复点','完成一次导入后才会生成导入前恢复点。')))}
function showCsv(){
  let csvText='',mapping={},preview=null;const previewBox=h('div',{class:'stack'});
  function drawPreview(){
    try{preview=previewMetricsCsv(state(),csvText,{mapping});previewBox.replaceChildren(
      h('h3',{},'列映射'),para('只接受指标字段；不能通过 CSV 修改稿件、许可或发布状态。','hint'),
      h('div',{class:'field-grid'},['publicationId','accountId','metricKey','value','unit','definition','observedAt','sourceRef','importRowId'].map(target=>h('label',{},target,selectInput(target,mapping[target]||target,[['','未映射'],...preview.columns.map(c=>[c,c])],value=>{if(value)mapping[target]=value;else delete mapping[target];drawPreview()})))),
      para(`有效新快照 ${preview.snapshots.length} · 重复 ${preview.duplicates.length} · 错误 ${preview.errors.length}`,'hint'),
      preview.errors.length?h('ul',{class:'warning'},preview.errors.map(e=>h('li',{},`第 ${e.row} 行${e.column?` / ${e.column}`:''}：${e.message}`))):para('列与行校验通过；尚未写入。','success'),
      disclosure('csv-dupes','重复行明细',h('pre',{class:'prose'},JSON.stringify(preview.duplicates,null,2))),
      disclosure('csv-rows','将新增的快照',h('pre',{class:'prose'},JSON.stringify(preview.snapshots,null,2)),{open:true}),
      button('确认导入指标快照',async()=>{if(!controller.policy.allowBackupImport)return announce('演示来源禁止导入',true);if(!preview.valid)return announce('请先修正全部错误',true);const result=await action('appendMetrics',{snapshots:preview.snapshots},'CSV 指标快照已保存');if(result)closeDialog()},'primary',{disabled:!preview.valid||!controller.policy.allowBackupImport}));
    }catch(error){previewBox.replaceChildren(para(error.message,'warning'))}
  }
  openDialog('指标 CSV 导出与导入',()=>h('div',{class:'stack'},para('导出的 CSV 会转义公式触发字符。指标值留空表示未知，0 表示明确观测到零。','hint'),button('导出全部已保存指标 CSV',()=>{download(`creator-metrics-${new Date().toISOString().slice(0,10)}.csv`,exportMetricsCsv(state()),'text/csv;charset=utf-8');announce('指标 CSV 已生成，请确认下载完成')}),
    !controller.policy.allowBackupImport?para('当前演示来源关闭 CSV 文件导入，避免把真实账号数据放入共享来源。可通过手工表单录入虚构测试快照。','warning'):null,
    h('label',{},'选择指标 CSV（最大 4 MiB）',h('input',{type:'file',accept:'.csv,text/csv',disabled:!controller.policy.allowBackupImport,onChange:async e=>{const file=e.target.files[0];if(!file)return;if(!controller.policy.allowBackupImport)return;if(file.size>4*1024*1024)return announce('CSV 超过 4 MiB',true);csvText=await file.text();mapping={};drawPreview()}})),previewBox));
}

if(typeof window!=='undefined')boot();
