// Test data is constructed exclusively by the candidate's actual business commands.
import {createWorkspace,applyCommand} from '../../../src/creator/core/core.mjs';
export const NOW='2026-10-06T00:00:00.000Z';
export function builder(id='synthetic-ui-graph') {
  let state=createWorkspace({id,now:NOW,dataClass:'synthetic'}),operation=0,sequence=0;
  return {get state(){return state},run(type,payload){const r=applyCommand(state,{type,payload,operationId:`ui-synthetic-op-${++operation}`,expectedRevision:state.revision},{now:NOW,idFactory:prefix=>`${prefix}-ui-${++sequence}`});state=r.state;return r.result}};
}
export function ideas(count=31){const b=builder();for(let i=0;i<count;i++)b.run('captureIdea',{title:'重名虚构标题',summary:`合成序号 ${i}`,angle:'原创测试切入点',contentType:'text'});return b}
export function rich({count=1,body='长正文'.repeat(2100)+'末页全文尾标记\r\n\t<script>synthetic only</script> \u0000 🧪',metrics=15}={}) {
  const b=builder(),accountId=b.run('createAccount',{displayName:'虚构账号',platform:'Example',handle:'synthetic'}).accountId;
  const workId=b.run('captureIdea',{title:'重名虚构标题',summary:'纯合成UI验收数据',angle:'自己的切入点',contentType:'text',references:[{title:'<img onerror=synthetic>参考',url:'https://example.com/reference',analysis:'不执行HTML',rightsNote:'虚构占位符'}]}).workId;
  const started=b.run('startProduction',{workId});
  const draft1=b.run('saveDraft',{workId,body:'第一份稿件'}).draftId;
  const draftId=b.run('saveDraft',{workId,body}).draftId;
  for(const taskId of started.taskIds)b.run('setTaskState',{workId,taskId,status:'done'});
  b.run('setReady',{workId});
  const pubs=[1,2].map(i=>b.run('recordPublication',{workId,accountId,actualPublishedAt:NOW,publicUrl:`https://example.com/synthetic-${i}`}).publicationId);
  const metricIds=b.run('appendMetrics',{snapshots:Array.from({length:metrics},(_,i)=>({publicationId:pubs[i%2],metricKey:'views',value:i===1?null:i,observedAt:new Date(Date.parse(NOW)+i*1000).toISOString(),sourceRef:`synthetic-${i}`}))}).metricIds;
  const globalMetricId=b.run('appendMetrics',{snapshots:[{accountId,metricKey:'followers',value:0,observedAt:NOW,sourceRef:'synthetic-global'}]}).metricIds[0];
  const review=b.run('saveReview',{workId,observation:'虚构复盘',nextExperiment:'下次虚构测试',evidenceMetricIds:metricIds.slice(0,3)});
  const followupId=b.run('deriveFollowupIdea',{reviewId:review.reviewId,title:'重名虚构标题'}).workId;
  const assetId=b.run('addAsset',{workId,name:'虚构素材.txt',size:0,mimeType:'text/plain',sha256:'0'.repeat(64)}).assetId;
  b.run('setGoal',{month:'2026-10',timeZone:'UTC',metric:'publications',target:0,accountId});
  for(let i=1;i<count;i++)b.run('captureIdea',{title:'重名虚构标题',summary:`合成序号 ${i}`,angle:'测试',contentType:'text'});
  return {b,body,workId,draftId,draft1,publicationIds:pubs,metricIds,globalMetricId,followupId,accountId,assetId};
}
