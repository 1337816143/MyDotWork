import {COLLECTIONS,TEMPLATES,CreatorError,fail,clone,assertSafe,canonical,randomId,validId,isoTime,safeUrl,zoneCheck,resolveSchedule,readiness,validateMetric,metricIdentity} from './core.mjs';

export const PROTOCOL='mydotwork.creator.v1';
const MAX_BYTES=16*1024*1024,MAX_RECORDS=50000;
export async function sha256(value) {
  if(!globalThis.crypto?.subtle) fail('HASH_UNAVAILABLE','SHA-256 不可用，无法校验备份');
  const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const entityHash = entity => sha256(canonical(entity));
const keyOf = (col,id) => `${col}:${id}`;
const FIELDS={
  works:'title summary angle contentType priority tags phase bodyRevisionId draftNeedsReview completedAt trashedAt parentWorkId reviewId previousPhase relatedProjectIds',
  references:'workId url title analysis excerpt author rightsNote retrievedAt availability assetId',
  drafts:'workId title body parentDraftId',
  tasks:'workId stage title required status reason completedAt',
  publications:'workId accountId status schedule actualPublishedAt publicUrl finalRevisionId finalSnapshot verification',
  metrics:'publicationId accountId metricKey value unit definition observedAt sourceRef importRowId',
  accounts:'displayName platform handle',goals:'month timeZone metric target accountId',
  reviews:'workId observation hypothesis nextExperiment evidenceMetricIds followupWorkIds',
  assets:'workId name mimeType size sha256 url availability note'
};
const META='schemaVersion id revision createdAt updatedAt sourceRefs visibility'.split(' ');
function recordShape(col,e) {
  if(!e||typeof e!=='object'||Array.isArray(e)) fail('INVALID_ENTITY','记录应为对象',{collection:col});
  const allowed=new Set([...META,...FIELDS[col].split(' ')]);
  for(const field of Object.keys(e)) if(!allowed.has(field)) fail('UNKNOWN_FIELD','记录包含不支持的字段',{collection:col,id:e.id,field});
  for(const field of allowed) if(!Object.hasOwn(e,field)) fail('MISSING_FIELD','记录缺少必需字段',{collection:col,id:e.id,field});
  if(e.schemaVersion!==1) fail('UNSUPPORTED_SCHEMA','记录版本不受支持',{collection:col,id:e.id});
  if(!validId(e.id)||!Number.isSafeInteger(e.revision)||e.revision<1) fail('INVALID_ENTITY','记录 ID 或 revision 无效',{collection:col,id:e.id});
  isoTime(e.createdAt); isoTime(e.updatedAt);
  if(e.visibility!=='private'||!Array.isArray(e.sourceRefs)||e.sourceRefs.some(x=>typeof x!=='string')) fail('INVALID_ENTITY','记录隐私或来源元数据无效',{collection:col,id:e.id});
  if(['references','drafts','tasks','publications','reviews','assets'].includes(col)&&!validId(e.workId)) fail('INVALID_ENTITY','所属作品 ID 无效',{collection:col,id:e.id});
  if(col==='publications'&&!validId(e.accountId)) fail('INVALID_ENTITY','发布账号 ID 无效',{id:e.id});
  for(const field of ['bodyRevisionId','parentWorkId','reviewId','assetId','parentDraftId','accountId','publicationId','finalRevisionId']) if(Object.hasOwn(e,field)&&e[field]!==null&&!validId(e[field])) fail('INVALID_ENTITY','关联 ID 无效',{collection:col,id:e.id,field});
  const str=(field,required=false)=>{ if(typeof e[field]!=='string'||(required&&!e[field].trim())) fail('INVALID_ENTITY','文本字段无效',{collection:col,id:e.id,field}); };
  const enumeration=(field,values)=>{if(!values.includes(e[field])) fail('INVALID_ENTITY','枚举字段无效',{collection:col,id:e.id,field});};
  for(const field of ['url','publicUrl']) if(e[field]!=null) safeUrl(e[field]);
  for(const field of ['completedAt','trashedAt','retrievedAt','actualPublishedAt','observedAt']) if(e[field]!=null) isoTime(e[field]);
  if(col==='works') {
    str('title',true); str('summary'); str('angle'); enumeration('phase',['idea','selected','producing','ready','archived']); enumeration('contentType',['video','text']);
    if(![1,2,3].includes(e.priority)||typeof e.draftNeedsReview!=='boolean'||!Array.isArray(e.tags)||e.tags.some(x=>typeof x!=='string')||!Array.isArray(e.relatedProjectIds)||e.relatedProjectIds.some(x=>typeof x!=='string')) fail('INVALID_ENTITY','作品字段无效',{id:e.id});
    if(e.phase==='archived'&&!['idea','selected','producing','ready'].includes(e.previousPhase)) fail('INVALID_ENTITY','归档作品缺少恢复阶段',{id:e.id});
  }
  if(col==='references') { for(const f of ['title','analysis','excerpt','author','rightsNote']) str(f); enumeration('availability',['missing','unverified']); }
  if(col==='drafts') { str('title',true); str('body',true); }
  if(col==='tasks') {
    for(const f of ['title','stage']) str(f,true); enumeration('status',['todo','doing','blocked','done','na']);
    if(typeof e.required!=='boolean') fail('INVALID_ENTITY','任务 required 必须为布尔值',{id:e.id});
    if(['blocked','na'].includes(e.status)) str('reason',true);
    if(['done','na'].includes(e.status)!==Boolean(e.completedAt)) fail('INVALID_ENTITY','任务状态与完成时间不一致',{id:e.id});
  }
  if(col==='publications') {
    enumeration('status',['draft','planned','published','withdrawn']);
    if(e.schedule) { const normalized=resolveSchedule(e.schedule); if(canonical(normalized)!==canonical(e.schedule)) fail('INVALID_ENTITY','排期字段不一致',{id:e.id}); }
    if(e.status==='planned'&&!e.schedule) fail('INVALID_ENTITY','计划发布缺少排期',{id:e.id});
    if(['published','withdrawn'].includes(e.status)) { if(!e.actualPublishedAt||!e.publicUrl||!e.finalRevisionId||!e.finalSnapshot||e.verification!=='user-recorded') fail('INVALID_ENTITY','已发布记录缺少实际事实和快照',{id:e.id}); }
    else if(e.actualPublishedAt||e.finalRevisionId||e.finalSnapshot||e.publicUrl) fail('INVALID_ENTITY','未发布记录不应包含实际发布事实',{id:e.id});
  }
  if(col==='accounts') { for(const f of ['displayName','platform']) str(f,true); str('handle'); }
  if(col==='goals') {
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.month)||!Number.isInteger(e.target)||e.target<0) fail('INVALID_ENTITY','月目标无效',{id:e.id});
    zoneCheck(e.timeZone); enumeration('metric',['worksCompleted','publications']);
  }
  if(col==='reviews') {
    str('observation',true); str('hypothesis'); str('nextExperiment',true);
    if(!Array.isArray(e.evidenceMetricIds)||!e.evidenceMetricIds.length||!Array.isArray(e.followupWorkIds)||[...e.evidenceMetricIds,...e.followupWorkIds].some(id=>!validId(id))||new Set(e.evidenceMetricIds).size!==e.evidenceMetricIds.length||new Set(e.followupWorkIds).size!==e.followupWorkIds.length) fail('INVALID_ENTITY','复盘关系无效',{id:e.id});
  }
  if(col==='assets') {
    str('name',true); str('mimeType',true); str('note'); enumeration('availability',['missing','unverified']);
    if(/[\\/]/.test(e.name)||['.','..'].includes(e.name)||e.size!=null&&(!Number.isSafeInteger(e.size)||e.size<0)||e.sha256!=null&&!/^[a-f0-9]{64}$/.test(e.sha256)) fail('UNSAFE_PATH','素材文件名、大小或哈希无效',{id:e.id});
  }
}
export function relationsFor(collection,id,entity) {
  const refs=[]; const add=(field,col,target)=>{if(target) refs.push({from:keyOf(collection,id),field,to:keyOf(col,target)});};
  add('workId','works',entity.workId);
  if(collection==='works') { add('bodyRevisionId','drafts',entity.bodyRevisionId); add('parentWorkId','works',entity.parentWorkId); add('reviewId','reviews',entity.reviewId); }
  if(collection==='references') add('assetId','assets',entity.assetId);
  if(collection==='drafts') add('parentDraftId','drafts',entity.parentDraftId);
  if(collection==='publications') { add('accountId','accounts',entity.accountId); add('finalRevisionId','drafts',entity.finalRevisionId); for(const a of entity.finalSnapshot?.assetIds||[]) add('finalSnapshot.assetIds','assets',a); }
  if(collection==='metrics') { add('publicationId','publications',entity.publicationId); add('accountId','accounts',entity.accountId); }
  if(collection==='goals') add('accountId','accounts',entity.accountId);
  if(collection==='reviews') { for(const metric of entity.evidenceMetricIds) add('evidenceMetricIds','metrics',metric); for(const work of entity.followupWorkIds) add('followupWorkIds','works',work); }
  return refs;
}
function validateRelations(state) {
  const keys=new Set(COLLECTIONS.flatMap(c=>Object.keys(state[c]).map(id=>keyOf(c,id))));
  const relations=[];
  for(const col of COLLECTIONS) for(const entity of Object.values(state[col])) {
    recordShape(col,entity);
    for(const ref of relationsFor(col,entity.id,entity)) { if(!keys.has(ref.to)) fail('DANGLING_REFERENCE','记录引用不存在',{...ref}); relations.push(ref); }
    if(entity.workId&&!state.works[entity.workId]) fail('DANGLING_REFERENCE','所属作品不存在',{id:entity.id});
    if(col==='works') {
      if(entity.bodyRevisionId&&state.drafts[entity.bodyRevisionId].workId!==entity.id) fail('RELATION_MISMATCH','当前稿件属于其他作品',{id:entity.id});
      if(entity.reviewId&&(state.reviews[entity.reviewId].workId!==entity.parentWorkId||!state.reviews[entity.reviewId].followupWorkIds.includes(entity.id))) fail('RELATION_MISMATCH','后续选题与复盘关系不一致',{id:entity.id});
      const effectivePhase=entity.phase==='archived'?entity.previousPhase:entity.phase;
      if(effectivePhase==='ready'&&!readiness(state,entity.id).ready) fail('INVALID_READY_STATE','当前或归档恢复后的可发布状态未满足必需任务和稿件门槛',{id:entity.id});
      const tasks=Object.values(state.tasks).filter(t=>t.workId===entity.id),stages=new Set(tasks.map(t=>t.stage)),expected=TEMPLATES[entity.contentType].map(t=>t[0]);
      if(tasks.length&&(tasks.length!==expected.length||stages.size!==expected.length||expected.some(stage=>!stages.has(stage))||tasks.some(t=>!t.required))) fail('INVALID_TASK_TEMPLATE','制作任务集合不完整或重复',{id:entity.id});
      if(['producing','ready'].includes(effectivePhase)&&!tasks.length) fail('INVALID_TASK_TEMPLATE','当前或归档恢复后的制作阶段缺少任务集合',{id:entity.id});
    }
    if(col==='drafts'&&entity.parentDraftId&&state.drafts[entity.parentDraftId].workId!==entity.workId) fail('RELATION_MISMATCH','稿件父版本属于其他作品',{id:entity.id});
    if(col==='references'&&entity.assetId&&state.assets[entity.assetId].workId!==entity.workId) fail('RELATION_MISMATCH','参考素材属于其他作品',{id:entity.id});
    if(col==='publications'&&entity.finalRevisionId) {
      const d=state.drafts[entity.finalRevisionId];
      if(d.workId!==entity.workId||entity.finalSnapshot.draftId!==d.id||entity.finalSnapshot.title!==d.title||entity.finalSnapshot.body!==d.body||!Array.isArray(entity.finalSnapshot.assetIds)||Object.keys(entity.finalSnapshot).some(k=>!['title','body','draftId','assetIds'].includes(k))) fail('RELATION_MISMATCH','发布快照与不可变稿件不一致',{id:entity.id});
      for(const a of entity.finalSnapshot.assetIds) if(state.assets[a].workId!==entity.workId) fail('RELATION_MISMATCH','发布素材属于其他作品',{id:entity.id});
    }
    if(col==='metrics') validateMetric(state,entity);
    if(col==='reviews') {
      for(const id of entity.evidenceMetricIds) { const m=state.metrics[id]; if(!m.publicationId||state.publications[m.publicationId].workId!==entity.workId) fail('RELATION_MISMATCH','复盘证据属于其他作品',{id:entity.id}); }
      for(const id of entity.followupWorkIds) if(state.works[id].reviewId!==entity.id||state.works[id].parentWorkId!==entity.workId) fail('RELATION_MISMATCH','复盘后续选题关系不一致',{id:entity.id});
    }
  }
  const identities=new Map();
  for(const metric of Object.values(state.metrics)) { const key=metricIdentity(metric); if(identities.has(key)) fail('DUPLICATE_METRIC','指标重复',{id:metric.id,other:identities.get(key)}); identities.set(key,metric.id); }
  // Prevent cycles in immutable draft ancestry and idea derivation.
  for(const [col,parentField] of [['drafts','parentDraftId'],['works','parentWorkId']]) for(const e of Object.values(state[col])) { const seen=new Set([e.id]); let parent=e[parentField]; while(parent) { if(seen.has(parent)) fail('CYCLIC_REFERENCE','父记录形成循环',{id:e.id}); seen.add(parent); parent=state[col][parent]?.[parentField]; } }
  return relations.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
}
function emptyRecords() { return Object.fromEntries(COLLECTIONS.map(c=>[c,{}])); }
export async function exportPackage(state,{packageId=randomId('package'),generatedAt=new Date().toISOString(),workIds}={}) {
  state=cloneSafe(state);
  if(!validId(packageId)) fail('INVALID_ID','备份包 ID 无效'); isoTime(generatedAt);
  const selected=new Set(workIds||Object.keys(state.works)); for(const id of selected) if(!state.works[id]) fail('NOT_FOUND','导出作品不存在',{id});
  // Include connected follow-ups and parent work; never emit dangling partial backups.
  let grew=true; while(grew) { grew=false; for(const w of Object.values(state.works)) if((selected.has(w.id)&&w.parentWorkId&&!selected.has(w.parentWorkId)) || (w.parentWorkId&&selected.has(w.parentWorkId)&&!selected.has(w.id))) { selected.add(w.id); if(w.parentWorkId) selected.add(w.parentWorkId); grew=true; } }
  const selectedAccounts=workIds?new Set(Object.values(state.publications).filter(p=>selected.has(p.workId)).map(p=>p.accountId)):new Set(Object.keys(state.accounts));
  const included=emptyRecords();
  for(const col of COLLECTIONS) for(const e of Object.values(state[col])) {
    const keep=col==='works'?selected.has(e.id):e.workId?selected.has(e.workId):col==='accounts'?selectedAccounts.has(e.id):col==='goals'?(!workIds||e.accountId&&selectedAccounts.has(e.accountId)):col==='metrics'?(e.publicationId?selected.has(state.publications[e.publicationId]?.workId):selectedAccounts.has(e.accountId)):true;
    if(keep) included[col][e.id]=clone(e);
  }
  const relations=validateRelations(included),records=[];
  for(const col of COLLECTIONS) for(const entity of Object.values(included[col]).sort((a,b)=>a.id.localeCompare(b.id))) {
    const ancestors=[]; const seen=new Set();
    for(const old of state.history[keyOf(col,entity.id)]||[]) { const hash=await entityHash(old); if(!seen.has(hash)) { ancestors.push({hash,entity:clone(old)}); seen.add(hash); } }
    records.push({collection:col,id:entity.id,revision:entity.revision,hash:await entityHash(entity),entity,ancestors});
  }
  const pkg={protocol:PROTOCOL,schemaVersion:1,packageId,generatedAt,sourceWorkspace:{id:state.id,revision:state.revision,createdAt:state.createdAt,updatedAt:state.updatedAt,dataClass:state.dataClass,visibility:'private'},records,relations,assetManifest:Object.values(included.assets).map(a=>({assetId:a.id,name:a.name,mimeType:a.mimeType,size:a.size,sha256:a.sha256,included:false,availability:a.availability,bytesVerified:false}))};
  pkg.packageHash=await sha256(canonical(pkg)); return pkg;
}
export async function validatePackage(input) {
  let pkg;
  if(typeof input==='string') { if(new TextEncoder().encode(input).length>MAX_BYTES) fail('PACKAGE_TOO_LARGE','备份超过 16 MiB 上限'); try { pkg=JSON.parse(input); } catch { fail('INVALID_JSON','备份 JSON 无法解析'); } }
  else pkg=cloneSafe(input);
  if(!pkg||typeof pkg!=='object'||Array.isArray(pkg))fail('INVALID_PACKAGE','备份顶层必须为对象');
  assertSafe(pkg); if(new TextEncoder().encode(canonical(pkg)).length>MAX_BYTES) fail('PACKAGE_TOO_LARGE','备份超过 16 MiB 上限');
  const topAllowed=['protocol','schemaVersion','packageId','generatedAt','sourceWorkspace','records','relations','assetManifest','packageHash'];
  if(Object.keys(pkg).some(k=>!topAllowed.includes(k))) fail('UNKNOWN_FIELD','备份包含不支持字段');
  if(pkg.protocol!==PROTOCOL||pkg.schemaVersion!==1) fail('UNSUPPORTED_SCHEMA','仅支持 mydotwork.creator.v1');
  if(!validId(pkg.packageId)||!validId(pkg.sourceWorkspace?.id)||!Number.isSafeInteger(pkg.sourceWorkspace?.revision)||pkg.sourceWorkspace.revision<0||!['synthetic','private'].includes(pkg.sourceWorkspace.dataClass)||pkg.sourceWorkspace.visibility!=='private') fail('INVALID_PACKAGE','备份来源元数据无效');
  isoTime(pkg.generatedAt); isoTime(pkg.sourceWorkspace.createdAt); isoTime(pkg.sourceWorkspace.updatedAt);
  if(!Array.isArray(pkg.records)||pkg.records.length>MAX_RECORDS||!Array.isArray(pkg.relations)||!Array.isArray(pkg.assetManifest)) fail('INVALID_PACKAGE','备份记录结构无效');
  const withoutHash=clone(pkg); delete withoutHash.packageHash;
  if(await sha256(canonical(withoutHash))!==pkg.packageHash) fail('BAD_HASH','备份包 SHA-256 不符');
  const records=emptyRecords(),allIds=new Set();
  for(const envelope of pkg.records) {
    if(!COLLECTIONS.includes(envelope.collection)||!validId(envelope.id)||envelope.id!==envelope.entity?.id||envelope.revision!==envelope.entity?.revision||!Array.isArray(envelope.ancestors)) fail('INVALID_ENTITY','记录封装无效',{id:envelope.id});
    if(Object.keys(envelope).some(k=>!['collection','id','revision','hash','entity','ancestors'].includes(k))) fail('UNKNOWN_FIELD','记录封装含不支持字段',{id:envelope.id});
    if(allIds.has(envelope.id)) fail('DUPLICATE_ID','备份中记录 ID 重复',{id:envelope.id}); allIds.add(envelope.id);
    recordShape(envelope.collection,envelope.entity);
    if(await entityHash(envelope.entity)!==envelope.hash) fail('BAD_HASH','记录 SHA-256 不符',{id:envelope.id});
    const ancestors=new Set();
    for(const ancestor of envelope.ancestors) {
      if(Object.keys(ancestor).some(k=>!['hash','entity'].includes(k))||ancestor.entity?.id!==envelope.id) fail('INVALID_ANCESTOR','共同基线身份无效',{id:envelope.id});
      recordShape(envelope.collection,ancestor.entity);
      if(await entityHash(ancestor.entity)!==ancestor.hash||ancestors.has(ancestor.hash)||ancestor.hash===envelope.hash) fail('BAD_HASH','共同基线哈希重复或不符',{id:envelope.id}); ancestors.add(ancestor.hash);
    }
    records[envelope.collection][envelope.id]=envelope.entity;
  }
  const relations=validateRelations(records);
  if(canonical(relations)!==canonical([...pkg.relations].sort((a,b)=>canonical(a).localeCompare(canonical(b))))) fail('INVALID_RELATIONS','备份关系清单与实际记录不符');
  const manifestIds=new Set();
  for(const asset of pkg.assetManifest) {
    const e=records.assets[asset.assetId];
    if(!e||manifestIds.has(asset.assetId)||asset.included!==false||asset.bytesVerified!==false||Object.keys(asset).some(k=>!['assetId','name','mimeType','size','sha256','included','availability','bytesVerified'].includes(k))||['name','mimeType','size','sha256','availability'].some(k=>e[k]!==asset[k])) fail('INVALID_ASSET_MANIFEST','素材清单错误或声称包含未提供的文件本体',{assetId:asset.assetId});
    manifestIds.add(asset.assetId);
  }
  if(manifestIds.size!==Object.keys(records.assets).length) fail('INVALID_ASSET_MANIFEST','素材清单不完整');
  return {pkg,records};
}
function cloneSafe(value) { assertSafe(value); return clone(value); }
export async function previewImport(state,input) {
  state=cloneSafe(state);
  const {pkg}=await validatePackage(input);
  const receipt=state.imports[pkg.packageId];
  if(receipt&&receipt.packageHash!==pkg.packageHash) fail('PACKAGE_ID_REUSED','此备份 ID 已对应另一份内容');
  const preview={packageId:pkg.packageId,packageHash:pkg.packageHash,sourceWorkspaceId:pkg.sourceWorkspace.id,sourceDataClass:pkg.sourceWorkspace.dataClass,new:[],same:[],older:[],conflicts:[],missingAssets:pkg.assetManifest.map(a=>({...a,reason:'备份仅含引用，未包含文件本体；可用性未验证'})),summary:{},alreadyImported:Boolean(receipt)};
  for(const incoming of pkg.records) {
    const key=keyOf(incoming.collection,incoming.id),local=state[incoming.collection][incoming.id];
    const info={key,collection:incoming.collection,id:incoming.id,revision:incoming.revision};
    if(!local) { preview.new.push({...info,kind:'new'}); continue; }
    const localHash=await entityHash(local);
    if(localHash===incoming.hash) { preview.same.push(info); continue; }
    const localHistory=await Promise.all((state.history[key]||[]).map(async entity=>({hash:await entityHash(entity),entity})));
    if(localHistory.some(h=>h.hash===incoming.hash)) { preview.older.push({...info,localRevision:local.revision}); continue; }
    if(incoming.ancestors.some(h=>h.hash===localHash)) { preview.new.push({...info,kind:'descendant',localRevision:local.revision}); continue; }
    const common=incoming.ancestors.filter(h=>localHistory.some(l=>l.hash===h.hash)).sort((a,b)=>b.entity.revision-a.entity.revision)[0];
    preview.conflicts.push({...info,local:clone(local),incoming:clone(incoming.entity),commonBase:common?clone(common.entity):null,noCommonBase:!common});
  }
  preview.summary={new:preview.new.length,same:preview.same.length,older:preview.older.length,conflicts:preview.conflicts.length,missingAssets:preview.missingAssets.length};
  return preview;
}
export async function prepareImport(state,input,{expectedRevision,operationId,choices={}}={}) {
  if(!validId(operationId)) fail('INVALID_ID','导入操作 ID 无效'); assertSafe(choices);choices=clone(choices);state=cloneSafe(state);
  const {pkg}=await validatePackage(input),fingerprint=canonical({type:'importPackage',packageId:pkg.packageId,packageHash:pkg.packageHash,choices});
  if(state.operations[operationId]) {
    if(state.operations[operationId].fingerprint!==fingerprint) fail('OPERATION_ID_REUSED','操作 ID 已用于不同内容');
    return {state:clone(state),result:clone(state.operations[operationId].result),replayed:true,needsRestorePoint:false};
  }
  if(expectedRevision!==state.revision) fail('STALE_REVISION','导入预览后工作区已变更，请重新预览',{expected:expectedRevision,actual:state.revision});
  const preview=await previewImport(state,pkg);
  // A receipt does not bypass content comparison after a restore or later local edits.
  for(const conflict of preview.conflicts) if(!['local','incoming'].includes(choices[conflict.key])) fail('IMPORT_CONFLICT','请选择每个冲突保留哪一份',{preview});
  for(const key of Object.keys(choices)) if(!preview.conflicts.some(c=>c.key===key)) fail('INVALID_CHOICE','冲突选择与当前预览不一致',{key});
  if(preview.alreadyImported&&!preview.new.length&&!preview.conflicts.some(c=>choices[c.key]==='incoming')) return {state:clone(state),result:{preview,imported:0,skipped:pkg.records.length,restorePointId:null},replayed:true,needsRestorePoint:false};
  const next=clone(state),keys=new Set([...preview.new.map(r=>r.key),...preview.conflicts.filter(c=>choices[c.key]==='incoming').map(c=>c.key)]);
  for(const record of pkg.records) {
    const key=keyOf(record.collection,record.id); if(!keys.has(key)) continue;
    const old=next[record.collection][record.id];
    // Published body snapshots, draft revisions and metric observations are immutable identities.
    if(old&&['drafts','metrics'].includes(record.collection)) fail('IMMUTABLE_CONFLICT','不可变记录 ID 对应不同内容，必须保留本地或另建新记录',{key});
    if(old&&record.collection==='publications'&&['published','withdrawn'].includes(old.status)) fail('IMMUTABLE_CONFLICT','已登记发布快照不可由导入覆盖',{key});
    if(old&&record.collection==='accounts'&&old.platform!==record.entity.platform&&Object.values(next.publications).some(p=>p.accountId===old.id))fail('PLATFORM_IN_USE','已有发布记录的账号不可通过导入改变平台口径',{key});
    next.history[key]??=[];
    if(old) next.history[key].push(clone(old));
    next.history[key].push(...record.ancestors.map(a=>clone(a.entity)));
    const dedup=new Map(next.history[key].map(e=>[canonical(e),e])); next.history[key]=[...dedup.values()].filter(e=>canonical(e)!==canonical(record.entity));
    next[record.collection][record.id]=clone(record.entity);
  }
  validateRelations(next); // Mixed conflict choices must form a valid complete graph.
  next.revision++; next.updatedAt=new Date().toISOString();
  if(!next.sourceWorkspaces.some(w=>w.id===pkg.sourceWorkspace.id)) next.sourceWorkspaces.push(clone(pkg.sourceWorkspace));
  if(pkg.sourceWorkspace.dataClass==='private') next.dataClass='private';
  next.imports[pkg.packageId]={packageHash:pkg.packageHash,sourceWorkspaceId:pkg.sourceWorkspace.id,importedAt:next.updatedAt};
  const result={preview,imported:keys.size,skipped:pkg.records.length-keys.size,restorePointId:null};
  next.operations[operationId]={fingerprint,result:clone(result),revision:next.revision,undo:null};
  next.changes.push({schemaVersion:1,id:operationId,revision:1,createdAt:next.updatedAt,updatedAt:next.updatedAt,visibility:'private',sourceRefs:[],operationId,actor:'user',type:'importPackage',expectedRevision:state.revision,nextRevision:next.revision,entityIds:[...keys],summary:'原子导入经校验的私有备份'});
  return {state:next,result,replayed:false,needsRestorePoint:true};
}
