import {performance} from 'node:perf_hooks';
import {cpus,platform,arch} from 'node:os';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const base=process.env.CREATOR_CORE_DIR?pathToFileURL(resolve(process.env.CREATOR_CORE_DIR)+'/'):new URL('../',import.meta.url);
const {createWorkspace,applyCommand,selectWorkspace,COLLECTIONS}=await import(new URL('core.mjs',base));
const now='2026-10-05T00:00:00Z';let seq=0;
const make=()=>{let state=createWorkspace({id:'benchmark-source',now});const run=(type,payload)=>{const next=applyCommand(state,{type,payload,operationId:`op-${++seq}`,expectedRevision:state.revision},{now,idFactory:prefix=>`${prefix}-${++seq}`});state=next.state;return next.result;};return {run,get state(){return state;}};};
export function createBenchmarkWorkspace(count=1000) {
  const h=make(),accountId=h.run('createAccount',{displayName:'Synthetic benchmark account',platform:'Synthetic platform'}).accountId;
  const workId=h.run('captureIdea',{title:'Synthetic work',angle:'Independent synthetic angle'}).workId;
  const taskIds=h.run('startProduction',{workId}).taskIds;
  h.run('saveDraft',{workId,body:'Synthetic benchmark draft body. '.repeat(20)});
  for(const taskId of taskIds)h.run('setTaskState',{workId,taskId,status:'done'});
  h.run('setReady',{workId});
  const publicationId=h.run('recordPublication',{workId,accountId,actualPublishedAt:'2026-10-03T00:00:00Z',publicUrl:'https://example.com/benchmark'}).publicationId;
  h.run('appendMetrics',{snapshots:[{publicationId,metricKey:'views',value:100,observedAt:'2026-10-04T00:00:00Z'},{publicationId,metricKey:'views',value:160,observedAt:now}]});
  const template=h.state,target=createWorkspace({id:'synthetic-1000-benchmark',now});target.accounts=structuredClone(template.accounts);
  for(let index=0;index<count;index++) {
    const map=new Map(COLLECTIONS.filter(c=>c!=='accounts').flatMap(c=>Object.keys(template[c]).map(id=>[id,`${id}-sample-${index}`])));
    const rewrite=value=>{if(typeof value==='string')return map.get(value)||value;if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));return value;};
    for(const col of COLLECTIONS)if(col!=='accounts')for(const e of Object.values(template[col])){const record=rewrite(e);if(col==='works')record.title+=` ${index+1}`;target[col][record.id]=record;}
  }
  return target;
}
const state=createBenchmarkWorkspace();
const coldStart=performance.now(),first=selectWorkspace(state,{month:'2026-10',timeZone:'UTC',asOf:now}),coldMs=performance.now()-coldStart;
const warm=[];for(let i=0;i<3;i++){const start=performance.now();selectWorkspace(state,{month:'2026-10',timeZone:'UTC',asOf:now});warm.push(performance.now()-start);}
const id=Object.keys(state.works)[0],writeStart=performance.now();const changed=applyCommand(state,{type:'saveDraft',operationId:'benchmark-save',expectedRevision:0,payload:{workId:id,body:'New synthetic revision'}},{now,idFactory:prefix=>`${prefix}-benchmark-new`});const writeMs=performance.now()-writeStart;
console.log(JSON.stringify({benchmark:'creator-node-only-1000-works',runtime:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model,cpuCount:cpus().length,dataset:Object.fromEntries(COLLECTIONS.map(c=>[c,Object.keys(state[c]).length])),workspaceJsonBytes:Buffer.byteLength(JSON.stringify(state)),coldSelectMs:+coldMs.toFixed(3),warmSelectMs:warm.map(n=>+n.toFixed(3)),saveDraftPureCommandMs:+writeMs.toFixed(3),verification:{returnedWorks:first.works.length,publishedWorks:first.totals.publishedWorks,latestViews:first.metricGroups[0].value,newDraftCount:Object.keys(changed.state.drafts).length},limits:'Node CPU/JSON business-query benchmark only. No browser load, rendering, IndexedDB durability, native input, mobile viewport or pixel performance measured.'},null,2));
