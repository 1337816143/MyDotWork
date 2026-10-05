/* Independent MyDotWork creator business core. No DOM, network or storage access. */
export const COLLECTIONS = Object.freeze(['works','references','drafts','tasks','publications','metrics','accounts','goals','reviews','assets']);
export class CreatorError extends Error {
  constructor(code, message, details = null) { super(message); this.name = 'CreatorError'; this.code = code; this.details = details; }
}
export const fail = (code, message, details) => { throw new CreatorError(code, message, details); };
export const clone = value => JSON.parse(JSON.stringify(value));
export function assertSafe(value, path = '$', depth = 0) {
  if (depth > 64) fail('INVALID_DATA', '数据嵌套过深', {path});
  if (value === null || ['string','boolean'].includes(typeof value)) return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('INVALID_DATA','非有限数值',{path}); return; }
  if (typeof value !== 'object') fail('INVALID_DATA','数据必须为 JSON 值',{path});
  if (!Array.isArray(value) && ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail('INVALID_DATA','不支持的对象类型',{path});
  for (const key of Object.keys(value)) {
    if (['__proto__','prototype','constructor'].includes(key)) fail('UNSAFE_KEY','拒绝危险对象属性',{path: `${path}.${key}`});
    assertSafe(value[key],`${path}.${key}`,depth+1);
  }
}
export function canonical(value) {
  assertSafe(value);
  return JSON.stringify(value, function(_key, item) {
    if (!item || Array.isArray(item) || typeof item !== 'object') return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]]));
  });
}
export function randomId(prefix = 'id') {
  if (!globalThis.crypto?.randomUUID) fail('RANDOM_UNAVAILABLE','安全随机 ID 不可用');
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}
export function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(id) && !['prototype',...Object.getOwnPropertyNames(Object.prototype)].includes(id); }
const idCheck = id => { if (!validId(id)) fail('INVALID_ID','ID 格式无效',{id}); return id; };
export function isoTime(value, label = '时间') {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) fail('INVALID_TIME',`${label}必须包含有效日期、时间和 UTC 偏移`);
  const m=value.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)(?::(\d\d))?/);
  validDate(m[1]); if (+m[2]>23 || +m[3]>59 || +(m[4]||0)>59) fail('INVALID_TIME',`${label}无效`);
  return value;
}
export function safeUrl(value, optional = false) {
  if ((value === '' || value == null) && optional) return null;
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\u007f]/.test(value)) fail('UNSAFE_URL','网址必须是完整 HTTP(S) 链接');
  let url; try { url = new URL(value); } catch { fail('UNSAFE_URL','网址无效'); }
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password) fail('UNSAFE_URL','网址协议或嵌入凭据不受支持');
  return url.href;
}
function text(value, label, {optional=false,max=200000}={}) {
  if (value == null && optional) return '';
  if (typeof value !== 'string' || value.length>max || (!optional && !value.trim())) fail('VALIDATION',`${label}不能为空且不能超出长度限制`);
  return value;
}
const validZones=new Set();
export function zoneCheck(zone) {
  if (typeof zone !== 'string') fail('INVALID_TIMEZONE','请选择时区');
  if(validZones.has(zone))return zone;
  try { new Intl.DateTimeFormat('en',{timeZone:zone}).format(); } catch { fail('INVALID_TIMEZONE','无效时区',{timeZone:zone}); }
  validZones.add(zone);
  return zone;
}
function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date) fail('INVALID_DATE','日期无效');
  return date;
}
const dateFormatters=new Map();
export function dateInZone(instant,timeZone) {
  zoneCheck(timeZone); isoTime(instant);
  if(!dateFormatters.has(timeZone)) {if(dateFormatters.size>100)dateFormatters.clear();dateFormatters.set(timeZone,new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));}
  const parts=Object.fromEntries(dateFormatters.get(timeZone).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function resolveSchedule(input) {
  assertSafe(input); const date=validDate(input?.date),timeZone=zoneCheck(input.timeZone);
  if (typeof input.allDay !== 'boolean') fail('INVALID_TIME','必须明确选择全天或具体时间');
  if (input.allDay) return {date,time:null,timeZone,allDay:true,offsetMinutes:null,plannedAt:null};
  if (!/^\d\d:\d\d$/.test(input.time||'') || +input.time.slice(0,2)>23 || +input.time.slice(3)>59) fail('INVALID_TIME','时间应为 HH:mm');
  const wall=Date.parse(`${date}T${input.time}:00Z`),candidates=[];
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  // Enumerate every legal minute offset; no guessing across DST gaps or folds.
  for(let offset=-14*60;offset<=14*60;offset++) {
    const instant=new Date(wall-offset*60000).toISOString();
    const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const local={date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
    if(local.date===date && local.time===input.time) candidates.push({instant,offset});
  }
  if(!candidates.length) fail('NONEXISTENT_LOCAL_TIME','该本地时间因夏令时切换不存在');
  let chosen;
  if(input.offsetMinutes!=null) chosen=candidates.find(c=>c.offset===input.offsetMinutes);
  else if(candidates.length===1) chosen=candidates[0];
  else fail('AMBIGUOUS_LOCAL_TIME','该本地时间出现两次，请明确 UTC 偏移',{offsets:candidates.map(c=>c.offset)});
  if(!chosen) fail('OFFSET_MISMATCH','UTC 偏移与所选时区不符');
  return {date,time:input.time,timeZone,allDay:false,offsetMinutes:chosen.offset,plannedAt:chosen.instant};
}
export function createWorkspace({id=randomId('workspace'),now=new Date().toISOString(),dataClass='synthetic'}={}) {
  idCheck(id); isoTime(now); if(!['synthetic','private'].includes(dataClass)) fail('VALIDATION','工作区类型无效');
  return {schemaVersion:1,id,revision:0,createdAt:now,updatedAt:now,visibility:'private',dataClass,
    ...Object.fromEntries(COLLECTIONS.map(c=>[c,{}])),history:{},operations:{},changes:[],imports:{},sourceWorkspaces:[]};
}
const get = (state,col,id) => Object.hasOwn(state[col]||{},id) ? state[col][id] : fail('NOT_FOUND','记录不存在',{collection:col,id});
export function readiness(state,workId) {
  const work=get(state,'works',workId),tasks=Object.values(state.tasks).filter(t=>t.workId===workId&&t.required);
  return readinessFromTasks(state,work,tasks);
}
function readinessFromTasks(state,work,tasks) {
  const completed=tasks.filter(t=>['done','na'].includes(t.status)).length;
  const missing=tasks.filter(t=>!['done','na'].includes(t.status)).map(t=>({taskId:t.id,label:t.title,reason:t.reason||null}));
  if(!tasks.length) missing.push({label:'尚未开始创作'});
  if(!work.bodyRevisionId || !state.drafts[work.bodyRevisionId]?.body.trim()) missing.push({label:'缺少已保存稿件'});
  if(work.draftNeedsReview) missing.push({label:'切入点已变更，稿件待复核保存'});
  return {ready:!missing.length,completed,total:tasks.length,missing};
}
export const TEMPLATES = {video:[['outline','提纲'],['script','脚本'],['record','录制'],['roughEdit','粗剪'],['finalEdit','精剪'],['cover','封面'],['captions','字幕'],['check','检查']],text:[['outline','提纲'],['script','正文'],['cover','配图／封面'],['check','检查']]};
const METRICS=['views','likes','comments','saves','shares','followers'];
export function metricIdentity(m) { return [m.publicationId||'',m.accountId||'',m.metricKey,m.unit,m.definition,new Date(m.observedAt).toISOString()].join('|'); }
export function validateMetric(state,input) {
  const publicationId=input.publicationId||null,accountId=input.accountId||null;
  if(Boolean(publicationId)===Boolean(accountId)) fail('VALIDATION','指标必须且只能选择一次发布或一个账号');
  if(publicationId) { const p=get(state,'publications',publicationId); if(p.status!=='published') fail('VALIDATION','作品指标只可登记到已发布记录'); }
  if(accountId) get(state,'accounts',accountId);
  if(!METRICS.includes(input.metricKey) || (accountId && input.metricKey!=='followers') || (publicationId && input.metricKey==='followers')) fail('VALIDATION','指标与目标类型不匹配');
  if(input.value!==null && (!Number.isFinite(input.value)||input.value<0)) fail('VALIDATION','指标值应为非负数或 null');
  if((input.unit||'count')!=='count') fail('VALIDATION','当前只支持 count 计数单位');
  return {publicationId,accountId,metricKey:input.metricKey,value:input.value,unit:'count',definition:text(input.definition||'cumulative','指标口径',{max:200}),observedAt:isoTime(input.observedAt,'采样时间'),sourceRef:text(input.sourceRef||'manual','指标来源',{max:2000}),importRowId:input.importRowId?text(input.importRowId,'导入行标识',{max:500}):null};
}
export function applyCommand(state,command,{now=new Date().toISOString(),idFactory=randomId}={}) {
  assertSafe(command); isoTime(now); idCheck(command.operationId);
  const fingerprint=canonical({type:command.type,payload:command.payload||{}});
  const prior=Object.hasOwn(state.operations,command.operationId)?state.operations[command.operationId]:null;
  if(prior) {
    if(prior.fingerprint!==fingerprint) fail('OPERATION_ID_REUSED','操作 ID 已用于不同内容');
    return {state:clone(state),result:clone(prior.result),replayed:true};
  }
  if(command.expectedRevision!==state.revision) fail('STALE_REVISION','内容已被其他操作修改，请比较后重试',{expected:command.expectedRevision,actual:state.revision});
  const next=clone(state),p=clone(command.payload||{}),changed=new Map(); let result={},reversible=false;
  function add(col,data,prefix=col.slice(0,-1)) {
    const id=idCheck(idFactory(prefix));
    if(COLLECTIONS.some(c=>Object.hasOwn(next[c],id))) fail('DUPLICATE_ID','生成的 ID 重复',{id});
    const entity={schemaVersion:1,id,revision:1,createdAt:now,updatedAt:now,sourceRefs:[],visibility:'private',...data};
    next[col][id]=entity; changed.set(`${col}:${id}`,{col,id,before:null}); return entity;
  }
  function touch(col,id) {
    const entity=get(next,col,id),key=`${col}:${id}`;
    if(!changed.has(key)) { changed.set(key,{col,id,before:clone(entity)}); entity.revision++; entity.updatedAt=now; }
    return entity;
  }
  function active(id) { const work=get(next,'works',id); if(work.trashedAt||work.phase==='archived') fail('ARCHIVED_WORK','请先恢复作品再编辑'); return work; }
  function editWork(id) { active(id); return touch('works',id); }
  function demote(id) { const w=touch('works',id); if(w.phase==='ready') w.phase='producing'; return w; }
  function capture(payload,extra={}) {
    const contentType=payload.contentType||'video'; if(!TEMPLATES[contentType]) fail('VALIDATION','请选择视频或图文');
    const priority=payload.priority??2; if(![1,2,3].includes(priority)) fail('VALIDATION','优先级无效');
    const tags=payload.tags||[]; if(!Array.isArray(tags)||tags.length>50) fail('VALIDATION','标签无效'); tags.forEach(t=>text(t,'标签',{max:100}));
    const work=add('works',{title:text(payload.title,'选题标题',{max:1000}),summary:text(payload.summary,'简述',{optional:true}),angle:text(payload.angle,'原创切入点',{optional:true}),contentType,priority,tags,phase:'idea',bodyRevisionId:null,draftNeedsReview:false,completedAt:null,trashedAt:null,parentWorkId:null,reviewId:null,previousPhase:null,relatedProjectIds:[],...extra},'work');
    const duplicates=[];
    for(const ref of payload.references||[]) {
      const url=safeUrl(ref.url,true);
      const existing=Object.values(next.references).filter(r=>url&&r.url===url);
      if(existing.length) duplicates.push({url,existingReferenceIds:existing.map(r=>r.id)});
      add('references',{workId:work.id,url,title:text(ref.title,'参考标题',{optional:true,max:1000}),analysis:text(ref.analysis,'参考拆解',{optional:true}),excerpt:text(ref.excerpt,'引用摘录',{optional:true}),author:text(ref.author,'作者',{optional:true,max:1000}),rightsNote:text(ref.rightsNote,'权利备注',{optional:true}),retrievedAt:null,availability:'unverified',assetId:null},'reference');
    }
    return {workId:work.id,duplicateReferences:duplicates};
  }
  switch(command.type) {
    case 'createAccount': {
      const a=add('accounts',{displayName:text(p.displayName,'账号名称',{max:200}),platform:text(p.platform,'平台',{max:100}),handle:text(p.handle,'账号标识',{optional:true,max:200})},'account'); result={accountId:a.id}; break;
    }
    case 'updateAccount': {
      const a=touch('accounts',p.accountId);
      if(p.platform!==undefined&&p.platform!==a.platform&&Object.values(next.publications).some(pub=>pub.accountId===a.id)) fail('PLATFORM_IN_USE','已有发布记录的账号不可改变平台口径，请新建账号');
      if(p.displayName!==undefined) a.displayName=text(p.displayName,'账号名称',{max:200});
      if(p.platform!==undefined) a.platform=text(p.platform,'平台',{max:100});
      if(p.handle!==undefined) a.handle=text(p.handle,'账号标识',{optional:true,max:200}); result={accountId:a.id}; break;
    }
    case 'addReference': case 'updateReference': {
      let r;
      if(command.type==='addReference') { active(p.workId); r=add('references',{workId:p.workId,url:null,title:'',analysis:'',excerpt:'',author:'',rightsNote:'',retrievedAt:null,availability:'unverified',assetId:null},'reference'); }
      else { r=get(next,'references',p.referenceId); active(r.workId); touch('references',r.id); }
      if(p.url!==undefined) r.url=safeUrl(p.url,true);
      for(const key of ['title','analysis','excerpt','author','rightsNote']) if(p[key]!==undefined) r[key]=text(p[key],key,{optional:true});
      result={referenceId:r.id,duplicateReferences:Object.values(next.references).filter(x=>x.id!==r.id&&r.url&&x.url===r.url).map(x=>x.id)}; break;
    }
    case 'setGoal': {
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month||'')) fail('VALIDATION','月份无效'); zoneCheck(p.timeZone);
      if(!['worksCompleted','publications'].includes(p.metric)||!Number.isInteger(p.target)||p.target<0) fail('VALIDATION','目标应为非负整数');
      if(p.accountId) get(next,'accounts',p.accountId);
      const data={month:p.month,timeZone:p.timeZone,metric:p.metric,target:p.target,accountId:p.accountId||null};
      const priorGoal=Object.values(next.goals).find(g=>g.month===data.month&&g.timeZone===data.timeZone&&g.metric===data.metric&&g.accountId===data.accountId);
      const g=p.goalId?touch('goals',p.goalId):priorGoal?touch('goals',priorGoal.id):add('goals',data,'goal'); Object.assign(g,data); result={goalId:g.id}; break;
    }
    case 'captureIdea': result=capture(p); break;
    case 'updateIdea': {
      const w=editWork(p.workId);
      for(const key of ['title','summary','angle']) if(p[key]!==undefined) w[key]=text(p[key],key,{optional:key!=='title',max:key==='title'?1000:200000});
      if(p.priority!==undefined) { if(![1,2,3].includes(p.priority)) fail('VALIDATION','优先级无效'); w.priority=p.priority; }
      if(p.tags!==undefined) { if(!Array.isArray(p.tags)||p.tags.length>50) fail('VALIDATION','标签无效'); p.tags.forEach(t=>text(t,'标签',{max:100})); w.tags=p.tags; }
      if(p.angle!==undefined && p.angle!==state.works[w.id].angle && w.bodyRevisionId) { w.draftNeedsReview=true; demote(w.id); }
      result={workId:w.id}; break;
    }
    case 'startProduction': {
      const old=active(p.workId),existing=Object.values(next.tasks).filter(t=>t.workId===old.id);
      if(existing.length) { if(p.contentType&&p.contentType!==old.contentType) fail('TEMPLATE_EXISTS','已建任务，不能静默替换内容模板'); result={workId:old.id,taskIds:existing.map(t=>t.id)}; break; }
      if(!old.title.trim()||!old.angle.trim()) fail('VALIDATION','开始创作需要标题和原创切入点');
      const w=editWork(old.id); w.contentType=p.contentType||w.contentType; if(!TEMPLATES[w.contentType]) fail('VALIDATION','模板无效'); w.phase='producing';
      const tasks=TEMPLATES[w.contentType].map(([stage,title])=>add('tasks',{workId:w.id,stage,title,required:true,status:'todo',reason:null,completedAt:null},'task'));
      result={workId:w.id,taskIds:tasks.map(t=>t.id)}; break;
    }
    case 'saveDraft': {
      const w=editWork(p.workId); if(!['producing','ready'].includes(w.phase)) fail('VALIDATION','请先开始创作');
      const d=add('drafts',{workId:w.id,title:text(p.title??w.title,'稿件标题',{max:1000}),body:text(p.body,'正文'),parentDraftId:w.bodyRevisionId},'draft');
      w.bodyRevisionId=d.id; w.draftNeedsReview=false; if(w.phase==='ready') w.phase='producing';
      const check=Object.values(next.tasks).find(t=>t.workId===w.id&&t.stage==='check'); if(check&&['done','na'].includes(check.status)) Object.assign(touch('tasks',check.id),{status:'todo',reason:null,completedAt:null});
      result={workId:w.id,draftId:d.id}; break;
    }
    case 'setTaskState': {
      active(p.workId); const t=get(next,'tasks',p.taskId); if(t.workId!==p.workId) fail('RELATION_MISMATCH','任务不属于此作品');
      if(!['todo','doing','blocked','done','na'].includes(p.status)) fail('VALIDATION','任务状态无效');
      const reason=['blocked','na'].includes(p.status)?text(p.reason,'原因',{max:10000}):null;
      Object.assign(touch('tasks',t.id),{status:p.status,reason,completedAt:['done','na'].includes(p.status)?now:null});
      if(!['done','na'].includes(p.status)) demote(p.workId); result={workId:p.workId,taskId:t.id}; break;
    }
    case 'setReady': {
      const w=editWork(p.workId),gate=readiness(next,w.id); if(!gate.ready) fail('NOT_READY','尚未满足可发布条件',gate);
      w.phase='ready'; if(!w.completedAt) w.completedAt=now; result={workId:w.id}; break;
    }
    case 'setSchedule': {
      active(p.workId); get(next,'accounts',p.accountId); const schedule=resolveSchedule(p.schedule);
      let pub=p.publicationId?get(next,'publications',p.publicationId):null;
      if(pub&&(pub.workId!==p.workId||pub.accountId!==p.accountId)) fail('RELATION_MISMATCH','发布计划的作品或账号不一致');
      if(pub?.status==='published'||pub?.status==='withdrawn') fail('ALREADY_PUBLISHED','改期不可改变已登记发布事实');
      if(!pub) pub=add('publications',{workId:p.workId,accountId:p.accountId,status:'planned',schedule,actualPublishedAt:null,publicUrl:null,finalRevisionId:null,finalSnapshot:null,verification:'not-published'},'publication');
      else Object.assign(touch('publications',pub.id),{status:'planned',schedule});
      result={workId:p.workId,publicationId:pub.id,undoOperationId:command.operationId}; reversible=true; break;
    }
    case 'cancelSchedule': {
      const pub=get(next,'publications',p.publicationId); active(pub.workId);
      if(pub.status!=='planned') fail('VALIDATION','只有未发布的排期可以取消');
      Object.assign(touch('publications',pub.id),{status:'draft',schedule:null}); result={publicationId:pub.id,undoOperationId:command.operationId}; reversible=true; break;
    }
    case 'recordPublication': {
      const w=active(p.workId); get(next,'accounts',p.accountId);
      if(w.phase!=='ready'||!readiness(next,w.id).ready) fail('NOT_READY','登记发布前请完成可发布检查');
      const finalRevisionId=p.finalRevisionId||w.bodyRevisionId,d=get(next,'drafts',finalRevisionId);
      if(d.workId!==w.id) fail('RELATION_MISMATCH','稿件不属于此作品');
      let pub=p.publicationId?get(next,'publications',p.publicationId):null;
      if(pub&&(pub.workId!==w.id||pub.accountId!==p.accountId)) fail('RELATION_MISMATCH','发布记录的作品或账号不一致');
      if(pub?.status==='published'||pub?.status==='withdrawn') fail('IMMUTABLE_PUBLICATION','已登记发布快照不可覆盖');
      const data={workId:w.id,accountId:p.accountId,status:'published',actualPublishedAt:isoTime(p.actualPublishedAt,'实际发布时间'),publicUrl:safeUrl(p.publicUrl),finalRevisionId,finalSnapshot:{title:d.title,body:d.body,draftId:d.id,assetIds:Object.values(next.assets).filter(a=>a.workId===w.id).map(a=>a.id)},verification:'user-recorded'};
      if(pub) Object.assign(touch('publications',pub.id),data); else pub=add('publications',{...data,schedule:null},'publication'); result={workId:w.id,publicationId:pub.id}; break;
    }
    case 'appendMetrics': {
      if(!Array.isArray(p.snapshots)||!p.snapshots.length||p.snapshots.length>10000) fail('VALIDATION','指标批次必须为 1–10000 行');
      const metricIds=[],skipped=[];
      for(const input of p.snapshots) {
        const m=validateMetric(next,input),key=metricIdentity(m),existing=Object.values(next.metrics).find(x=>metricIdentity(x)===key || (m.importRowId&&x.importRowId===m.importRowId));
        if(existing) { if(existing.value!==m.value||metricIdentity(existing)!==key) fail('METRIC_CONFLICT','相同指标采样已有不同数据',{metricId:existing.id}); skipped.push(existing.id); continue; }
        const record=add('metrics',m,'metric'); metricIds.push(record.id);
      }
      result={metricIds,skipped}; break;
    }
    case 'saveReview': {
      active(p.workId); const ids=p.evidenceMetricIds||[]; if(!Array.isArray(ids)||!ids.length) fail('VALIDATION','复盘至少需要一个指标快照作为证据');
      for(const id of ids) { const m=get(next,'metrics',id); if(!m.publicationId||get(next,'publications',m.publicationId).workId!==p.workId) fail('RELATION_MISMATCH','复盘证据应来自此作品的发布'); }
      const r=add('reviews',{workId:p.workId,observation:text(p.observation,'观察'),hypothesis:text(p.hypothesis,'可能原因',{optional:true}),nextExperiment:text(p.nextExperiment,'下次试验'),evidenceMetricIds:[...new Set(ids)],followupWorkIds:[]},'review'); result={workId:p.workId,reviewId:r.id}; break;
    }
    case 'deriveFollowupIdea': {
      const review=get(next,'reviews',p.reviewId); if(review.followupWorkIds.length) { result={workId:review.followupWorkIds[0],reviewId:review.id}; break; }
      const source=get(next,'works',review.workId); result=capture({title:p.title,angle:p.angle||review.nextExperiment,contentType:source.contentType,summary:review.observation},{parentWorkId:source.id,reviewId:review.id});
      touch('reviews',review.id).followupWorkIds.push(result.workId); result.reviewId=review.id; break;
    }
    case 'archiveWork': case 'trashWork': case 'restoreWork': {
      const w=get(next,'works',p.workId); touch('works',w.id);
      if(command.type==='restoreWork') { if(w.trashedAt) w.trashedAt=null; else if(w.phase==='archived') { w.phase=w.previousPhase||'idea'; w.previousPhase=null; } else fail('VALIDATION','此作品不需要恢复'); }
      else if(command.type==='archiveWork') { if(w.trashedAt) fail('VALIDATION','请先从回收站恢复'); if(w.phase!=='archived') { w.previousPhase=w.phase; w.phase='archived'; } }
      else if(!w.trashedAt) w.trashedAt=now;
      result={workId:w.id,undoOperationId:command.operationId}; reversible=true; break;
    }
    case 'addAsset': {
      active(p.workId); const name=text(p.name,'素材文件名',{max:250});
      if(/[\\/]/.test(name)||['.','..'].includes(name)) fail('UNSAFE_PATH','素材只记录文件名，不能含路径');
      if(p.size!=null&&(!Number.isSafeInteger(p.size)||p.size<0)) fail('VALIDATION','素材大小无效');
      if(p.sha256&&!/^[a-f0-9]{64}$/.test(p.sha256)) fail('VALIDATION','素材 SHA-256 无效');
      const a=add('assets',{workId:p.workId,name,mimeType:text(p.mimeType||'application/octet-stream','文件类型',{max:200}),size:p.size??null,sha256:p.sha256||null,url:safeUrl(p.url,true),availability:'unverified',note:'仅保存引用，未保存或验证文件本体'},'asset'); result={assetId:a.id}; break;
    }
    case 'setAssetAvailability': {
      const a=get(next,'assets',p.assetId); active(a.workId); if(!['missing','unverified'].includes(p.availability)) fail('VALIDATION','没有文件本体验证时不可声称可用');
      Object.assign(touch('assets',a.id),{availability:p.availability,note:text(p.note,'素材说明',{optional:true})}); result={assetId:a.id}; break;
    }
    case 'undo': {
      const op=next.operations[p.targetOperationId]; if(!op?.undo) fail('UNDO_UNAVAILABLE','该操作不可撤销');
      if(op.revision!==state.revision) fail('UNDO_CONFLICT','操作后已有新修改，不能覆盖后续内容');
      for(const entry of op.undo) {
        const current=get(next,entry.col,entry.id); changed.set(`${entry.col}:${entry.id}`,{col:entry.col,id:entry.id,before:clone(current)});
        if(entry.before===null) delete next[entry.col][entry.id];
        else next[entry.col][entry.id]={...clone(entry.before),revision:current.revision+1,updatedAt:now};
      }
      result={undoneOperationId:p.targetOperationId}; break;
    }
    default: fail('UNKNOWN_COMMAND','不支持的命令',{type:command.type});
  }
  next.revision++; next.updatedAt=now;
  for(const [key,entry] of changed) if(entry.before) { next.history[key]??=[]; next.history[key].push(entry.before); }
  const undo=reversible?[...changed.values()]:null;
  next.operations[command.operationId]={fingerprint,result:clone(result),revision:next.revision,undo};
  next.changes.push({schemaVersion:1,id:command.operationId,revision:1,createdAt:now,updatedAt:now,visibility:'private',sourceRefs:[],operationId:command.operationId,actor:'user',type:command.type,expectedRevision:state.revision,nextRevision:next.revision,entityIds:[...changed.values()].map(e=>e.id),summary:command.type});
  return {state:next,result,replayed:false};
}

export function latestMetrics(state,{publicationId,accountId,asOf,platform}={}) {
  if(asOf) isoTime(asOf); const grouped=new Map();
  for(const m of Object.values(state.metrics)) {
    if(publicationId&&m.publicationId!==publicationId || accountId&&m.accountId!==accountId || asOf&&Date.parse(m.observedAt)>Date.parse(asOf)) continue;
    const acct=m.accountId?state.accounts[m.accountId]:state.accounts[state.publications[m.publicationId]?.accountId];
    if(platform&&acct?.platform!==platform) continue;
    const key=[m.publicationId||m.accountId,m.metricKey,m.unit,m.definition].join('|'),prior=grouped.get(key);
    if(!prior||Date.parse(prior.observedAt)<Date.parse(m.observedAt)) grouped.set(key,m);
  }
  return [...grouped.values()].map(clone);
}
export function metricDelta(state,{publicationId,accountId,metricKey,definition='cumulative',asOf}={}) {
  const metrics=Object.values(state.metrics).filter(m=>(publicationId?m.publicationId===publicationId:m.accountId===accountId)&&m.metricKey===metricKey&&m.definition===definition&&(!asOf||Date.parse(m.observedAt)<=Date.parse(asOf))).sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
  const current=metrics[0]||null,previous=metrics[1]||null;
  return {value:current?.value!=null&&previous?.value!=null&&current.unit===previous.unit?current.value-previous.value:null,current:current&&clone(current),previous:previous&&clone(previous)};
}
export function selectWorkspace(state,{month,timeZone='UTC',accountId,platform,asOf=new Date().toISOString()}={}) {
  zoneCheck(timeZone); isoTime(asOf);
  if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('INVALID_DATE','月份无效');
  const accounts=Object.values(state.accounts).filter(a=>!platform||a.platform===platform);
  const accountIds=new Set(accounts.filter(a=>!accountId||a.id===accountId).map(a=>a.id));
  const pubs=Object.values(state.publications).filter(p=>accountIds.has(p.accountId));
  const scopedWorkIds=new Set(pubs.map(p=>p.workId));
  const tasksByWork=new Map(),pubsByWork=new Map(),reviewWorkIds=new Set(),metricPublicationIds=new Set(),progressByWork=new Map();
  for(const task of Object.values(state.tasks)){if(!tasksByWork.has(task.workId))tasksByWork.set(task.workId,[]);tasksByWork.get(task.workId).push(task);}
  for(const pub of pubs){if(!pubsByWork.has(pub.workId))pubsByWork.set(pub.workId,[]);pubsByWork.get(pub.workId).push(pub);}
  for(const review of Object.values(state.reviews))reviewWorkIds.add(review.workId);
  for(const metric of Object.values(state.metrics))if(metric.publicationId)metricPublicationIds.add(metric.publicationId);
  const works=Object.values(state.works).filter(w=>(!accountId&&!platform)||scopedWorkIds.has(w.id)).map(w=>{const progress=readinessFromTasks(state,w,(tasksByWork.get(w.id)||[]).filter(t=>t.required));progressByWork.set(w.id,progress);return {...clone(w),progress};});
  const live=works.filter(w=>!w.trashedAt&&w.phase!=='archived');
  const decorated=pubs.map(p=>({...clone(p),work:clone(state.works[p.workId]),account:clone(state.accounts[p.accountId]),progress:progressByWork.get(p.workId),needsVerification:p.status==='planned'&&(p.schedule.allDay?p.schedule.date<dateInZone(asOf,p.schedule.timeZone).date:Date.parse(p.schedule.plannedAt)<Date.parse(asOf))}));
  const publications=decorated.filter(p=>p.status==='published'&&(!month||dateInZone(p.actualPublishedAt,timeZone).date.startsWith(month)));
  const calendar=decorated.filter(p=>p.status==='planned'&&!p.work.trashedAt&&(!month||p.schedule.date.startsWith(month))).sort((a,b)=>(a.schedule.date+(a.schedule.time||'')).localeCompare(b.schedule.date+(b.schedule.time||'')));
  const goals=Object.values(state.goals).filter(g=>(!month||g.month===month)&&(!accountId||g.accountId===accountId)&&(!platform||g.accountId&&state.accounts[g.accountId]?.platform===platform)).map(g=>{
    const matching=Object.values(state.publications).filter(p=>!g.accountId||p.accountId===g.accountId);
    const completed=new Set(matching.map(p=>p.workId));
    const actual=g.metric==='publications'?matching.filter(p=>p.status==='published'&&dateInZone(p.actualPublishedAt,g.timeZone).date.startsWith(g.month)).length:Object.values(state.works).filter(w=>w.completedAt&&dateInZone(w.completedAt,g.timeZone).date.startsWith(g.month)&&(!g.accountId||completed.has(w.id))).length;
    return {...clone(g),actual};
  });
  const nextActions=live.map(w=>{
    const task=(tasksByWork.get(w.id)||[]).find(t=>t.required&&!['done','na'].includes(t.status));
    const schedule=calendar.find(p=>p.workId===w.id);
    const published=(pubsByWork.get(w.id)||[]).filter(p=>p.status==='published');
    const hasMetrics=published.some(p=>metricPublicationIds.has(p.id));
    const hasReview=reviewWorkIds.has(w.id);
    const postPublication=hasReview?'查看复盘与后续选题':hasMetrics?'根据指标复盘':'录入发布后指标';
    return {workId:w.id,taskId:task?.id||null,publicationId:schedule?.id||published[0]?.id||null,label:w.phase==='idea'?'补充切入点并开始创作':task?task.title:w.draftNeedsReview?'复核并保存稿件':w.phase==='ready'?(schedule?'按实际发布情况登记':published.length?postPublication:'安排排期或登记实际发布'):'执行可发布检查',blocked:task?.status==='blocked',reason:task?.reason||null,due:schedule?.schedule||null,priority:w.priority};
  }).sort((a,b)=>(a.due?.date||'9999').localeCompare(b.due?.date||'9999')||Number(b.blocked)-Number(a.blocked)||a.priority-b.priority);
  const metricGroupsMap=new Map(),visiblePublicationIds=new Set(publications.map(p=>p.id));
  for(const m of latestMetrics(state,{asOf,platform})) {
    if(!m.publicationId) continue; const pub=state.publications[m.publicationId];
    if(!visiblePublicationIds.has(pub.id)) continue;
    const acct=state.accounts[pub.accountId],key=[acct.platform,m.metricKey,m.unit,m.definition].join('|');
    const group=metricGroupsMap.get(key)||{platform:acct.platform,metricKey:m.metricKey,unit:m.unit,definition:m.definition,value:null,knownCount:0,unknownCount:0,snapshotIds:[]};
    group.snapshotIds.push(m.id); if(m.value===null) group.unknownCount++; else { group.value=(group.value??0)+m.value; group.knownCount++; } metricGroupsMap.set(key,group);
  }
  for(const group of metricGroupsMap.values())group.unknownCount+=publications.filter(p=>p.account.platform===group.platform).length-group.snapshotIds.length;
  return {works,ideas:live.filter(w=>w.phase==='idea'||w.phase==='selected'),production:live.filter(w=>['producing','ready'].includes(w.phase)),calendar,library:works.filter(w=>(pubsByWork.get(w.id)||[]).some(p=>p.status==='published')),publications,unscheduled:live.filter(w=>!(pubsByWork.get(w.id)||[]).some(p=>p.status==='planned')),reviews:Object.values(state.reviews).filter(r=>progressByWork.has(r.workId)).map(clone),accounts:accounts.map(clone),goals,nextActions,totals:{works:works.length,activeWorks:live.length,ideas:live.filter(w=>w.phase==='idea').length,producing:live.filter(w=>w.phase==='producing').length,ready:live.filter(w=>w.phase==='ready').length,publications:publications.length,publishedWorks:new Set(publications.map(p=>p.workId)).size,overdue:calendar.filter(p=>p.needsVerification).length},metricGroups:[...metricGroupsMap.values()]};
}
