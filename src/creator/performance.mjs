import {latestMetrics} from './core/core.mjs';

export const PERFORMANCE_METRICS=Object.freeze(['views','likes','comments','saves','shares']);

// A read model only: views share publication/snapshot identities and never copy metrics.
export function selectPerformanceRows(state,{accountId='',platform='',workIds=null,asOf=new Date().toISOString(),month='',timeZone='UTC',limit=null}={}){
  const cutoff=Date.parse(asOf);
  if(!Number.isFinite(cutoff))throw new TypeError('Performance cutoff must be an explicit valid time');
  const calendar=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit'});
  if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new TypeError('Performance month must be YYYY-MM');
  const allowed=workIds===null?null:new Set(workIds);
  const rows=[];
  for(const publication of Object.values(state.publications)){
    const work=state.works[publication.workId],account=state.accounts[publication.accountId];
    if(publication.status!=='published'||!work||work.trashedAt||!account)continue;
    if(allowed&&!allowed.has(work.id)||accountId&&account.id!==accountId||platform&&account.platform!==platform)continue;
    const publishedAt=Date.parse(publication.actualPublishedAt);
    if(!Number.isFinite(publishedAt)||publishedAt>cutoff)continue;
    if(month&&calendar.format(new Date(publishedAt))!==month)continue;
    const snapshots=latestMetrics(state,{publicationId:publication.id,asOf});
    const metrics={};
    for(const key of PERFORMANCE_METRICS){
      const choices=snapshots.filter(snapshot=>snapshot.metricKey===key);
      if(!choices.length)metrics[key]={kind:'unknown',value:null,snapshotId:null,choices:[]};
      else if(choices.length>1)metrics[key]={kind:'mixed',value:null,snapshotId:null,choices};
      else{
        const snapshot=choices[0];
        metrics[key]={kind:snapshot.value===null?'unknown':'observed',value:snapshot.value,snapshotId:snapshot.id,observedAt:snapshot.observedAt,sourceRef:snapshot.sourceRef,unit:snapshot.unit,definition:snapshot.definition,choices};
      }
    }
    rows.push({workId:work.id,publicationId:publication.id,accountId:account.id,title:publication.finalSnapshot?.title||work.title,accountName:account.displayName,platform:account.platform,publishedAt:publication.actualPublishedAt,metrics});
  }
  rows.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||a.publicationId.localeCompare(b.publicationId));
  if(limit===null)return rows;
  if(!Number.isInteger(limit)||limit<0)throw new TypeError('Performance limit must be a nonnegative integer');
  return rows.slice(0,limit);
}

export function goalProgress(actual,target){
  const knownActual=typeof actual==='number'&&Number.isFinite(actual)&&actual>=0;
  const knownTarget=typeof target==='number'&&Number.isFinite(target)&&target>=0;
  if(!knownTarget)return {kind:'unset',actual:knownActual?actual:null,target:null,ratio:null};
  if(!knownActual)return {kind:'unknown',actual:null,target,ratio:null};
  if(target===0)return {kind:'zero-target',actual,target,ratio:null};
  return {kind:'tracked',actual,target,ratio:Math.min(1,actual/target),exceeded:actual>target};
}
