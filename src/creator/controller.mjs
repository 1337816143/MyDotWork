export const VIEWS = Object.freeze(['desk','ideas','production','calendar','library','database']);
export const VIEW_NAMES = Object.freeze({desk:'工作台',ideas:'选题池',production:'创作台',calendar:'日历',library:'作品库',database:'数据库'});
export const PHASE_NAMES = Object.freeze({idea:'待整理',selected:'已选题',producing:'创作中',ready:'可发布',archived:'已归档'});
export const TASK_NAMES = Object.freeze({todo:'未开始',doing:'进行中',blocked:'阻塞',done:'完成',na:'不适用'});
export const METRIC_NAMES = Object.freeze({views:'播放量',likes:'点赞',comments:'评论',saves:'收藏',shares:'分享',followers:'粉丝数'});
export const randomOperationId = () => `ui-${globalThis.crypto.randomUUID()}`;
export const values = map => Object.values(map || {});
export function dialogTabTarget(focusables,current,shiftKey=false){
  if(!focusables.length)return null;
  const index=focusables.indexOf(current);
  if(index<0)return shiftKey?focusables.at(-1):focusables[0];
  if(shiftKey&&index===0)return focusables.at(-1);
  if(!shiftKey&&index===focusables.length-1)return focusables[0];
  return null;
}
// Optional form fields must be omitted, not serialized as undefined into strict commands.
export function compactPayload(value){
  if(Array.isArray(value))return value.map(compactPayload);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,compactPayload(v)]));
  return value;
}
const isRouteId=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(id)&&!['prototype',...Object.getOwnPropertyNames(Object.prototype)].includes(id);
export function safeExternalUrl(raw) {
  try { const u = new URL(String(raw)); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}
export function routeHash(view,workId=null) {
  const validView=VIEWS.includes(view)?view:'desk';
  return `#view=${validView}${isRouteId(workId)?`&work=${encodeURIComponent(workId)}`:''}`;
}
export function parseRoute(hash) {
  const p=new URLSearchParams(String(hash).replace(/^#/,''));
  const view=VIEWS.includes(p.get('view'))?p.get('view'):'desk';
  const candidate=p.get('work');
  return {view,workId:isRouteId(candidate)?candidate:null};
}
export function calendarCells(month) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [y,m]=month.split('-').map(Number);
  const start=new Date(Date.UTC(y,m-1,1));
  const offset=(start.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(y,m,0)).getUTCDate();
  return [...Array(offset).fill(null),...Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}
export function matchWork(work,state,search='') {
  const q=search.trim().toLocaleLowerCase();
  if(!q)return true;
  const drafts=values(state.drafts).filter(d=>d.workId===work.id).map(d=>d.body);
  return [work.title,work.summary,work.angle,work.id,...(work.tags||[]),...drafts].join('\n').toLocaleLowerCase().includes(q);
}
export function parseNullableNumber(text) {
  const raw=String(text??'').trim();
  if(!raw)return null;
  const n=Number(raw);
  if(!Number.isFinite(n)||n<0)throw new Error('指标必须留空（未知）或填写非负数字');
  return n;
}
export function utcOffsetIso(local,offset) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local))throw new Error('请填写实际日期与时间');
  if(!/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset)||(/^[-+]14:/.test(offset)&&!offset.endsWith(':00')))throw new Error('请明确填写 UTC 偏移，例如 +08:00 或 +00:00');
  return `${local.length===16?local+':00':local}${offset}`;
}
export function scheduleLabel(publication) {
  const s=publication.schedule;
  if(!s)return '未排期';
  return `${s.date} ${s.allDay?'全天':s.time||'时间未设置'} · ${s.timeZone}${s.offsetMinutes!=null?` · UTC偏移 ${s.offsetMinutes} 分钟`:''}`;
}
export function metricSeries(state,{publicationId,accountId,metricKey,definition='',asOf}) {
  const cutoff=asOf?Date.parse(asOf):Infinity;
  return values(state.metrics).filter(m=>
    (publicationId?m.publicationId===publicationId:m.accountId===accountId)&&
    m.metricKey===metricKey&&(m.definition||'')===definition&&Date.parse(m.observedAt)<=cutoff
  ).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
}
export function trendPoints(series) {
  const numeric=series.filter(m=>m.value!==null&&Number.isFinite(m.value));
  if(!numeric.length)return [];
  const max=Math.max(1,...numeric.map(m=>m.value));
  return series.map((m,i)=>m.value===null?null:{x:12+(series.length>1?i/(series.length-1):0.5)*376,y:104-m.value/max*86,id:m.id});
}
export function createController(store,{idFactory=randomOperationId}={}) {
  let state=null,closed=false;
  const listeners=new Set(),buffers=new Map(),pending=new Map();
  const emit=()=>{if(!closed)for(const fn of listeners)fn(state)};
  const unsubscribe=store.subscribe(next=>{state=next;emit()});
  const api={
    async init(){state=await store.read();emit();return state},
    get state(){return state},get policy(){return store.policy},get buffers(){return buffers},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
    buffer(key,defaults={}){
      if(!buffers.has(key))buffers.set(key,{values:{...defaults},baseRevision:state?.revision??0,dirty:false,generation:0,attempt:null,error:null});
      const b=buffers.get(key);
      if(!b.dirty&&!pending.has(key)){b.values={...defaults};b.baseRevision=state?.revision??0;b.attempt=null;b.error=null}
      return b;
    },
    edit(key,name,value,defaults={}){const b=api.buffer(key,defaults);b.values[name]=value;b.dirty=true;b.generation++;b.error=null;return b},
    discard(key){buffers.delete(key)},
    rebase(key,comparedRevision=state.revision){if(comparedRevision!==state.revision){const error=new Error('比较后又出现新的修改，请重新比较后选择');error.code='STALE_REVISION';throw error}const b=buffers.get(key);if(b){b.baseRevision=comparedRevision;b.attempt=null;b.error=null}},
    isPending(key){return pending.has(key)},
    async refresh(){state=await store.read();emit();return state},
    async execute(key,type,payload){
      if(pending.has(key))return pending.get(key);
      payload=compactPayload(payload);
      const b=buffers.get(key)||api.buffer(key,{}),generation=b.generation;
      const fingerprint=JSON.stringify({type,payload});
      const envelope=b.attempt?.fingerprint===fingerprint?b.attempt.envelope:{type,payload,operationId:idFactory(),expectedRevision:b.baseRevision};
      b.attempt={fingerprint,envelope};b.error=null;
      const promise=(async()=>{
        try{const result=await store.dispatch(envelope);state=result.state;if(b.generation===generation)buffers.delete(key);emit();return result}
        catch(error){b.error={code:error.code||'SAVE_FAILED',message:error.message,details:error.details};throw error}
        finally{pending.delete(key)}
      })();
      pending.set(key,promise);return promise;
    },
    async action(type,payload){const key=`action:${type}:${JSON.stringify(payload)}`;api.buffer(key,{});return api.execute(key,type,payload)},
    async importPackage(pkg,options){const result=await store.importPackage(pkg,options);state=result.state||await store.read();emit();return result},
    async previewImport(pkg){return store.previewImport(pkg)},
    async listRestorePoints(){return store.listRestorePoints()},
    async restore(options){const result=await store.restore(options);state=result.state||await store.read();emit();return result},
    close(){closed=true;unsubscribe();listeners.clear();store.close()},
  };
  return api;
}
