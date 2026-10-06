/* Read-only presentation model. No store, command, import, URL or network capability. */
import {projectWebState} from './web.mjs';

export const KIND_NAMES = Object.freeze({Work:'作品',Draft:'稿件版本',Publication:'发布登记',MetricObservation:'指标观测',Reference:'参考',Task:'任务',Account:'账号',Goal:'目标',Review:'复盘',AssetReference:'素材引用'});
export const EDGE_NAMES = Object.freeze({belongsToWork:'属于作品',currentDraft:'当前稿件',derivedFromWork:'源自作品',derivedFromReview:'源自复盘',referencesAsset:'引用素材',previousDraft:'上一稿件',publicationAccount:'发布账号',publishedDraft:'登记采用稿件',publicationAsset:'发布素材引用',measuresPublication:'观测发布登记',measuresAccount:'观测账号',targetsAccount:'目标账号',usesMetricEvidence:'采用指标证据',producedFollowupWork:'产生后续作品'});
export const PAGE_SIZE = 12;
export const RELATION_PAGE_SIZE = 6;
const cleanQuery = text => String(text || '').trim().toLocaleLowerCase();
// Search raw validated values rather than JSON escapes. Literal quotes,
// backslashes, CRLF and other source text must remain searchable as written.
function searchText(value) {
  const parts=[];
  function visit(item) {
    if(item===null||typeof item!=='object'){parts.push(String(item??''));return}
    if(Array.isArray(item)){for(const child of item)visit(child);return}
    for(const [key,child] of Object.entries(item)){parts.push(key);visit(child)}
  }
  visit(value);return parts.join('\n').toLocaleLowerCase();
}

export function metricLabel(node) {
  return node.kind === 'MetricObservation' ? (node.observation.kind === 'unknown' ? '未知' : String(node.observation.value)) : null;
}

export function workIdFor(graph, node) {
  if (node.kind === 'Work') return node.source.entityId;
  if (node.record.workId) return node.record.workId;
  if (node.kind === 'MetricObservation' && node.record.publicationId) {
    return graph.nodes.find(n => n.kind === 'Publication' && n.source.entityId === node.record.publicationId)?.record.workId || null;
  }
  return null;
}

export function selectNodes(graph, {search='',kind='',workId=''}={}) {
  const query = cleanQuery(search);
  return graph.nodes.filter(node => (!kind || node.kind === kind) && (!workId || workIdFor(graph,node) === workId) &&
    (!query || searchText([node,KIND_NAMES[node.kind],metricLabel(node)]).includes(query)));
}

export function paginate(items, page=0, size=PAGE_SIZE) {
  const count=Math.max(1,Math.ceil(items.length/size));
  const index=Math.max(0,Math.min(count-1,Number.isFinite(page)?Math.floor(page):0));
  return {items:items.slice(index*size,(index+1)*size),page:index,pages:count,total:items.length,start:items.length?index*size+1:0,end:Math.min((index+1)*size,items.length)};
}

export function relationsForNode(graph,id) {
  return {incoming:graph.edges.filter(e=>e.to===id),outgoing:graph.edges.filter(e=>e.from===id)};
}

// Target identity is checked against the current host snapshot, not just a stale graph label.
export function editorTarget(graph,node,current) {
  if (!current || graph.workspaceId!==current.id || graph.revision!==current.revision) return null;
  if (!current[node.source.collection]?.[node.source.entityId]) return null;
  const workId=workIdFor(graph,node);
  if (!workId || !current.works[workId]) return null;
  return {workId,view:node.kind==='Publication'?'library':node.kind==='MetricObservation'||node.kind==='Review'?'database':node.kind==='Reference'||(node.kind==='Work'&&node.record.phase==='idea')?'ideas':'production'};
}

// Adapter takes its defensive copy synchronously. A request ticket prevents a late
// projection from replacing newer state; failure keeps the last verified view.
export function createGraphSession({project=projectWebState,onChange=()=>{}}={}) {
  let ticket=0,closed=false,lastInput,hasInput=false,inflight=Promise.resolve();
  let status={graph:null,pending:false,error:null,requestedWorkspaceId:null,requestedRevision:null};
  const notify=()=>{if(!closed)onChange(status)};
  return {
    get status(){return status},
    load(input,{retry=false}={}) {
      if(closed)return Promise.resolve();
      if(hasInput&&input===lastInput&&!retry)return inflight;
      hasInput=true;lastInput=input;
      const request=++ticket;
      const ownValue=key=>input&&typeof input==='object'?Object.getOwnPropertyDescriptor(input,key)?.value??null:null;
      status={...status,pending:true,error:null,requestedWorkspaceId:ownValue('id'),requestedRevision:ownValue('revision')};notify();
      inflight=(async()=>{
        try {
          const graph=await project(input);
          if(closed||request!==ticket)return;
          status={...status,graph,pending:false,error:null};notify();
        } catch(error) {
          if(closed||request!==ticket)return;
          status={...status,pending:false,error:{code:error.code||'GRAPH_UNAVAILABLE',message:error.message||'关系校验失败'}};notify();
        }
      })();
      return inflight;
    },
    close(){closed=true;ticket++},
  };
}
