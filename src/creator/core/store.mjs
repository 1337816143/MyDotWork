import {CreatorError,fail,clone,canonical,createWorkspace,applyCommand,randomId,validId} from './core.mjs';
import {previewImport,prepareImport} from './exchange.mjs';

export function storagePolicy({origin='',approvedPrivateOrigin=false,persistence='indexeddb'}={}) {
  let hostname='',protocol=''; try { const u=new URL(origin); hostname=u.hostname.toLowerCase(); protocol=u.protocol; } catch { /* Unknown origin stays demo. */ }
  const sharedPublicOrigin=hostname==='github.io'||hostname.endsWith('.github.io');
  const privateAllowed=approvedPrivateOrigin===true&&!sharedPublicOrigin&&['https:','http:','file:','memory:'].includes(protocol);
  return Object.freeze({mode:privateAllowed?'private':'demo',persistence,origin,sharedPublicOrigin,allowBackupImport:privateAllowed,
    warning:privateAllowed?'浏览器本地数据可能被清理；本地保存不等于云备份。附件本体未保存。':'仅限虚构演示数据。尚未批准独立私有来源，真实私稿和备份导入已禁用；不同路径或数据库名称不构成同源隔离。'});
}
function storageError(error) {
  if(error instanceof CreatorError) return error;
  return new CreatorError(error?.name==='QuotaExceededError'?'STORAGE_QUOTA':'STORAGE_FAILED',error?.name==='QuotaExceededError'?'本地存储空间不足；此次内容未保存，请保留编辑内容并导出已有记录。':'本地存储写入未完成；此次内容未保存。',{name:error?.name||'Error',message:error?.message||String(error)});
}
function importAllowed(policy) { if(!policy.allowBackupImport) fail('DEMO_IMPORT_DISABLED','此来源仅可演示，备份导入已禁用'); }
function checkStatePolicy(policy,state) {if(policy.mode==='demo'&&state?.dataClass!=='synthetic')fail('PRIVATE_DATA_BLOCKED','演示来源不可打开真实私有工作区');}
function notifySubscribers(subscribers,state) { for(const fn of subscribers) { try { fn(clone(state)); } catch { /* A view error must not change a committed write. */ } } }
function restoreCandidate(current,snapshot,{operationId,expectedRevision,restorePointId}) {
  if(!validId(operationId)) fail('INVALID_ID','恢复操作 ID 无效');
  const fingerprint=canonical({type:'restore',restorePointId});
  const previous=current.operations[operationId];
  if(previous) { if(previous.fingerprint!==fingerprint) fail('OPERATION_ID_REUSED','操作 ID 已用于不同内容'); return {state:clone(current),result:clone(previous.result),replayed:true}; }
  if(expectedRevision!==current.revision) fail('STALE_REVISION','工作区已有新修改，请重新检查恢复点',{expected:expectedRevision,actual:current.revision});
  const state=clone(snapshot); state.id=current.id; state.revision=current.revision+1; state.updatedAt=new Date().toISOString();
  const result={restoredFrom:restorePointId,restorePointId:null};
  state.operations[operationId]={fingerprint,result:clone(result),revision:state.revision,undo:null};
  state.changes.push({schemaVersion:1,id:operationId,revision:1,createdAt:state.updatedAt,updatedAt:state.updatedAt,visibility:'private',sourceRefs:[],operationId,actor:'user',type:'restoreWorkspace',expectedRevision:current.revision,nextRevision:state.revision,entityIds:[],summary:'从恢复点恢复工作区'});
  return {state,result,replayed:false};
}
function addRestorePoint(prepared,previous,operationId,kind,idFactory) {
  if(!prepared.needsRestorePoint) return null;
  const id=idFactory('restore'),point={id,createdAt:new Date().toISOString(),workspaceId:previous.id,workspaceRevision:previous.revision,reason:kind,operationId,snapshot:clone(previous)};
  prepared.result.restorePointId=id;
  if(prepared.state.operations[operationId]) prepared.state.operations[operationId].result.restorePointId=id;
  return point;
}
const pointSummary=({snapshot,...metadata})=>clone(metadata);

/** Deterministic adapter contract, not a claim of browser persistence. */
export function createMemoryStore({initialState=createWorkspace(),failWrite=null,idFactory=randomId,now,policy=storagePolicy({origin:'memory://isolated-unit-test',approvedPrivateOrigin:true,persistence:'memory'})}={}) {
  checkStatePolicy(policy,initialState);
  let current=clone(initialState),closed=false,queue=Promise.resolve(); const points=new Map(),subscribers=new Set();
  const guard=()=>{if(closed) fail('STORE_CLOSED','存储已关闭');};
  const serial=task=>{ const work=queue.then(()=>{guard();return task();}); queue=work.catch(()=>{}); return work; };
  async function commit(prepared,kind,operationId) {
    if(prepared.replayed) return clone(prepared);
    const point=addRestorePoint(prepared,current,operationId,kind,idFactory);
    try { if(failWrite) await failWrite({kind,next:clone(prepared.state),previous:clone(current),restorePoint:point&&clone(point)}); }
    catch(error) { throw storageError(error); }
    // Assignment and recovery point insertion are the memory adapter's single commit boundary.
    if(point) points.set(point.id,point); current=clone(prepared.state);
    notifySubscribers(subscribers,current); return clone(prepared);
  }
  return {
    policy,
    async read(){guard();checkStatePolicy(policy,current);return clone(current);},
    subscribe(fn){guard();subscribers.add(fn);return()=>subscribers.delete(fn);},
    dispatch(command){const request=clone(command);return serial(()=>commit(applyCommand(current,request,{idFactory,now:typeof now==='function'?now():now}),'command',request.operationId));},
    async previewImport(pkg){guard();importAllowed(policy);return previewImport(current,pkg);},
    importPackage(pkg,options){return serial(async()=>{importAllowed(policy);return commit(await prepareImport(current,pkg,options),'import',options.operationId);});},
    async listRestorePoints(){guard();return [...points.values()].map(pointSummary);},
    restore(options){return serial(async()=>{importAllowed(policy);const point=points.get(options.restorePointId);if(!point) fail('NOT_FOUND','恢复点不存在'); const result=restoreCandidate(current,point.snapshot,options);result.needsRestorePoint=!result.replayed;return commit(result,'restore',options.operationId);});},
    close(){closed=true;subscribers.clear();}
  };
}

function requestPromise(request) { return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}); }
function completed(tx) { return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));}); }
export async function createIndexedDBStore({name='mydotwork-creator-stage1-demo',workspaceId='workspace',initialState,indexedDB=globalThis.indexedDB,origin='',approvedPrivateOrigin=false,broadcastChannelFactory,now,idFactory=randomId}={}) {
  if(!indexedDB) fail('STORAGE_UNAVAILABLE','此浏览器未提供 IndexedDB；不能承诺刷新后保留内容');
  const policy=storagePolicy({origin,approvedPrivateOrigin,persistence:'indexeddb'});
  const opening=indexedDB.open(name,1);
  opening.onupgradeneeded=()=>{const db=opening.result;if(!db.objectStoreNames.contains('workspaces'))db.createObjectStore('workspaces');if(!db.objectStoreNames.contains('restorePoints'))db.createObjectStore('restorePoints',{keyPath:'id'});};
  const db=await new Promise((resolve,reject)=>{opening.onsuccess=()=>resolve(opening.result);opening.onerror=()=>reject(storageError(opening.error));opening.onblocked=()=>reject(new CreatorError('STORAGE_BLOCKED','数据库升级被其他标签页阻塞，请关闭旧页面后重试'));});
  let closed=false; const subscribers=new Set(); let channel=null;
  const guard=()=>{if(closed) fail('STORE_CLOSED','存储已关闭');};
  const tx=(mode,stores=['workspaces'])=>db.transaction(stores,mode);
  async function read(){guard();const transaction=tx('readonly'),done=completed(transaction);const record=await requestPromise(transaction.objectStore('workspaces').get(workspaceId));await done;if(!record) fail('NOT_FOUND','工作区不存在');checkStatePolicy(policy,record);return clone(record);}
  async function publish(state){notifySubscribers(subscribers,state);try{channel?.postMessage({workspaceId,revision:state.revision});}catch{/* Cross-tab messaging is advisory; revision compare remains mandatory. */}}
  try {
    const transaction=tx('readwrite'),done=completed(transaction),store=transaction.objectStore('workspaces');
    const request=store.get(workspaceId);
    request.onsuccess=()=>{if(!request.result){const state=initialState||createWorkspace();if(policy.mode==='demo'&&state.dataClass!=='synthetic'){transaction.abort();return;}store.put(clone(state),workspaceId);}};
    await done;
  } catch(error) {db.close();throw storageError(error);}
  const existing=await read();
  if(policy.mode==='demo'&&existing.dataClass!=='synthetic'){db.close();fail('PRIVATE_DATA_BLOCKED','演示来源不可打开真实私有工作区');}
  const factory=broadcastChannelFactory||(typeof globalThis.BroadcastChannel==='function'?name=>new globalThis.BroadcastChannel(name):null);
  if(factory) { channel=factory(`creator:${name}`);channel.onmessage=async event=>{if(event.data?.workspaceId===workspaceId&&!closed){try{notifySubscribers(subscribers,await read());}catch{/* Next command still checks the database. */}}}; }
  db.onversionchange=()=>{closed=true;db.close();channel?.close();};
  async function atomicPrepared(prepared,expectedRevision,operationId,kind) {
    guard(); let output,domainError;
    const transaction=tx('readwrite',['workspaces','restorePoints']),done=completed(transaction),store=transaction.objectStore('workspaces');
    const request=store.get(workspaceId);
    request.onsuccess=()=>{
      try {
        const current=request.result;
        checkStatePolicy(policy,current);checkStatePolicy(policy,prepared.state);
        if(current.revision!==expectedRevision) fail('STALE_REVISION','写入前工作区已变更，请重新预览',{expected:expectedRevision,actual:current.revision});
        output=prepared;
        if(!prepared.replayed) {const point=addRestorePoint(prepared,current,operationId,kind,idFactory);if(point)transaction.objectStore('restorePoints').put(point);store.put(prepared.state,workspaceId);}
      } catch(error) {domainError=error;transaction.abort();}
    };
    try{await done;}catch(error){throw storageError(domainError||error);}
    if(!output.replayed) await publish(output.state); return clone(output);
  }
  return {
    policy,read,
    subscribe(fn){guard();subscribers.add(fn);return()=>subscribers.delete(fn);},
    async dispatch(command) {
      command=clone(command);
      guard();let output,domainError;const transaction=tx('readwrite'),done=completed(transaction),store=transaction.objectStore('workspaces');
      const request=store.get(workspaceId);
      request.onsuccess=()=>{try{checkStatePolicy(policy,request.result);output=applyCommand(request.result,command,{idFactory,now:typeof now==='function'?now():now});checkStatePolicy(policy,output.state);if(!output.replayed)store.put(output.state,workspaceId);}catch(error){domainError=error;transaction.abort();}};
      try{await done;}catch(error){throw storageError(domainError||error);}
      if(!output.replayed)await publish(output.state);return clone(output);
    },
    async previewImport(pkg){importAllowed(policy);return previewImport(await read(),pkg);},
    async importPackage(pkg,options){importAllowed(policy);const before=await read(),prepared=await prepareImport(before,pkg,options);return atomicPrepared(prepared,before.revision,options.operationId,'import');},
    async listRestorePoints(){guard();const transaction=tx('readonly',['restorePoints']),done=completed(transaction);const all=await requestPromise(transaction.objectStore('restorePoints').getAll());await done;return all.filter(p=>p.workspaceId===existing.id).map(pointSummary);},
    async restore(options){
      importAllowed(policy);guard();const transaction=tx('readonly',['workspaces','restorePoints']),done=completed(transaction);
      const currentRequest=transaction.objectStore('workspaces').get(workspaceId),pointRequest=transaction.objectStore('restorePoints').get(options.restorePointId);
      const [current,point]=await Promise.all([requestPromise(currentRequest),requestPromise(pointRequest)]);await done;
      if(!point||point.workspaceId!==current.id)fail('NOT_FOUND','此工作区的恢复点不存在');
      const prepared=restoreCandidate(current,point.snapshot,options);prepared.needsRestorePoint=!prepared.replayed;return atomicPrepared(prepared,current.revision,options.operationId,'restore');
    },
    close(){closed=true;subscribers.clear();channel?.close();db.close();}
  };
}
