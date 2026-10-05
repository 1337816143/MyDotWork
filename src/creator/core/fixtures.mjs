/* Explicitly synthetic; no private user data and no automatic seeding. */
import {fail} from './core.mjs';
export async function seedDemo(store) {
  const initial=await store.read();
  if(initial.dataClass!=='synthetic')fail('DEMO_ONLY','演示数据只能加入虚构工作区');
  if(Object.keys(initial.works).length||Object.keys(initial.accounts).length)fail('DEMO_NOT_EMPTY','请在空白演示工作区运行示例，避免混入已有内容');
  const run=async(type,payload,step)=>{const s=await store.read();return (await store.dispatch({type,payload,operationId:`demo-v1-${step}`,expectedRevision:s.revision})).result;};
  const a=await run('createAccount',{displayName:'示例账号 · 视频',platform:'示例视频平台',handle:'synthetic-video'},'account-video');
  const b=await run('createAccount',{displayName:'示例账号 · 图文',platform:'示例图文平台',handle:'synthetic-text'},'account-text');
  const w=await run('captureIdea',{title:'示例作品一：观察一杯水的变化',summary:'虚构内容，用于验证六模块完整创作流程。',angle:'用三个镜头解释同一个小变化。',contentType:'video',tags:['虚构演示'],references:[{url:'https://example.com/creator-reference',title:'示例参考',analysis:'只借鉴观察顺序；原创切入点另存。',rightsNote:'example.com 占位来源，未下载媒体。'}]},'idea');
  const started=await run('startProduction',{workId:w.workId},'start');
  await run('saveDraft',{workId:w.workId,body:'这是完全虚构的示例脚本。\n第一镜：展示一杯水。\n第二镜：记录表面变化。\n第三镜：解释观察方法。'},'draft-one');
  for(let i=0;i<started.taskIds.length;i++)await run('setTaskState',{workId:w.workId,taskId:started.taskIds[i],status:'done'},`task-${i}`);
  await run('setReady',{workId:w.workId},'ready');
  const plan=await run('setSchedule',{workId:w.workId,accountId:a.accountId,schedule:{date:'2026-10-02',time:'18:00',timeZone:'Asia/Shanghai',allDay:false}},'schedule');
  const publication=await run('recordPublication',{workId:w.workId,accountId:a.accountId,publicationId:plan.publicationId,actualPublishedAt:'2026-10-02T18:05:00+08:00',publicUrl:'https://example.com/synthetic-publication'},'published');
  const metrics=await run('appendMetrics',{snapshots:[{publicationId:publication.publicationId,metricKey:'views',value:100,observedAt:'2026-10-03T10:00:00+08:00',sourceRef:'虚构手工样本'},{publicationId:publication.publicationId,metricKey:'views',value:160,observedAt:'2026-10-04T10:00:00+08:00',sourceRef:'虚构手工样本'},{publicationId:publication.publicationId,metricKey:'comments',value:null,observedAt:'2026-10-04T10:00:00+08:00',sourceRef:'未录入'},{publicationId:publication.publicationId,metricKey:'shares',value:0,observedAt:'2026-10-04T10:00:00+08:00',sourceRef:'虚构手工样本'}]},'metrics');
  const review=await run('saveReview',{workId:w.workId,observation:'累计播放从100变为160，增量60；评论尚未记录。',hypothesis:'变化可能与发布后累计曝光有关，未证明因果。',nextExperiment:'下一条只改变开头镜头，继续记录同口径快照。',evidenceMetricIds:metrics.metricIds},'review');
  const followup=await run('deriveFollowupIdea',{reviewId:review.reviewId,title:'示例后续选题：先展示结果还是先提问'},'followup');
  await run('setGoal',{month:'2026-10',timeZone:'Asia/Shanghai',metric:'publications',target:4,accountId:a.accountId},'goal');
  await run('addAsset',{workId:w.workId,name:'synthetic-demo-video.mp4',mimeType:'video/mp4',size:1024,sha256:'0'.repeat(64)},'asset');
  return {workId:w.workId,accountIds:[a.accountId,b.accountId],publicationId:publication.publicationId,followupWorkId:followup.workId,state:await store.read()};
}
