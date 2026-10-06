/* Original semantic relation explorer; records are always untrusted plain text. */
import {KIND_NAMES,EDGE_NAMES,PAGE_SIZE,RELATION_PAGE_SIZE,metricLabel,selectNodes,paginate,relationsForNode,editorTarget,createGraphSession} from './model.mjs';
import {routeHash} from '../controller.mjs';

export function createGraphView(document,{onNavigate=()=>{},project}={}) {
  const h=(tag,attrs={},...children)=>{
    const node=document.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) {
      if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
      else if(key==='class')node.className=value;
      else if(key==='dataset')Object.assign(node.dataset,value);
      else if(key==='disabled'||key==='selected'||key==='open')node[key]=Boolean(value);
      else if(key==='value')node.value=value;
      else node.setAttribute(key,String(value));
    }
    for(const child of children.flat(Infinity))if(child!==null&&child!==undefined&&child!==false)node.append(typeof child==='object'?child:document.createTextNode(String(child)));
    return node;
  };
  const p=(message,className='hint')=>h('p',{class:className},message);
  const button=(label,fn,attrs={})=>h('button',{type:'button',onClick:fn,...attrs},label);
  const element=h('section',{class:'graph-view stack','aria-label':'只读关系浏览器'});
  const status=h('div',{class:'status-box',role:'status','aria-live':'polite','aria-atomic':'true'});
  const output=h('div',{class:'stack'});
  const resultSummary=h('p',{class:'graph-result-count',role:'status','aria-live':'polite','aria-atomic':'true'});
  const filters={search:'',kind:'',workId:''};
  let current=null,selectedId=null,page=0,relationPages={incoming:0,outgoing:0},routeWorkId=null,closed=false;
  let session;
  const sourceLine=h('p',{class:'hint'});
  const search=h('input',{type:'search',name:'graph-search',placeholder:'搜索全部已校验记录与全文',dataset:{focusKey:'graph:search'},onInput:e=>change('search',e.target.value)});
  const kind=h('select',{name:'graph-kind',dataset:{focusKey:'graph:kind'},onChange:e=>change('kind',e.target.value)},h('option',{value:''},'全部类型'),Object.entries(KIND_NAMES).map(([value,name])=>h('option',{value},name)));
  const work=h('select',{name:'graph-work',dataset:{focusKey:'graph:work'},onChange:e=>change('workId',e.target.value)});
  const clear=button('清除筛选',()=>{Object.assign(filters,{search:'',kind:'',workId:''});page=0;selectedId=null;syncControls();render()}, {dataset:{focusKey:'graph:clear'}});
  const toolbar=h('div',{class:'toolbar'},h('label',{class:'wide'},'搜索标题、标识、来源与全文',search),h('label',{},'记录类型',kind),h('label',{},'所属作品（不含账号全局记录）',work),clear);
  element.append(p('只读检查已保存的虚构记录。关系不会生成稿件、写入、导入或同步；未保存的编辑输入不在图中。'),
    p('方法笔记：未接入。当前没有原生业务模型，不生成替代节点。','graph-boundary'),status,sourceLine,toolbar,resultSummary,output);

  function syncControls(){search.value=filters.search;kind.value=filters.kind;work.value=filters.workId}
  function change(key,value){filters[key]=value;page=0;selectedId=null;relationPages={incoming:0,outgoing:0};render()}
  function focusKey(key){[...element.querySelectorAll('[data-focus-key]')].find(n=>n.dataset.focusKey===key)?.focus({preventScroll:true})}
  function select(id,{reveal=false}={}) {
    if(reveal){Object.assign(filters,{search:'',kind:'',workId:''});syncControls();const index=session.status.graph.nodes.findIndex(n=>n.id===id);page=Math.floor(Math.max(0,index)/PAGE_SIZE)}
    selectedId=id;relationPages={incoming:0,outgoing:0};render();focusKey('graph:detail');
  }
  function pager(result,onPage,key,label) {
    return h('nav',{class:'graph-pager','aria-label':label},
      button('上一页',()=>{onPage(result.page-1);render();focusKey(`${key}:next`)},{disabled:result.page===0,dataset:{focusKey:`${key}:previous`},'aria-label':`${label}上一页`}),
      p(`${result.start}–${result.end} / ${result.total} · 第 ${result.page+1}/${result.pages} 页`),
      button('下一页',()=>{onPage(result.page+1);render();focusKey(`${key}:previous`)},{disabled:result.page===result.pages-1,dataset:{focusKey:`${key}:next`},'aria-label':`${label}下一页`}));
  }
  function nodeButton(node,fn,selected=false) {
    const metric=metricLabel(node);
    return button([h('span',{class:'graph-node-kind'},KIND_NAMES[node.kind]||node.kind),h('strong',{},node.label||'（空标题）'),h('span',{class:'id'},node.source.entityId),metric===null?null:h('span',{class:'graph-observation',dataset:{kind:node.observation.kind,value:metric}},`观测值：${metric}`)],fn,
      {class:`graph-node${selected?' is-selected':''}`,'aria-pressed':selected,'aria-label':`${KIND_NAMES[node.kind]||node.kind}：${node.label||'空标题'}；标识 ${node.source.entityId}${metric===null?'':`；观测值 ${metric}`}`,dataset:{nodeId:node.id,entityId:node.source.entityId,focusKey:`graph:node:${node.id}`}});
  }
  function relationColumn(graph,node,direction,edges) {
    const incoming=direction==='incoming',label=incoming?'指向此记录':'此记录指向';
    const result=paginate(edges,relationPages[direction],RELATION_PAGE_SIZE);relationPages[direction]=result.page;
    const byId=new Map(graph.nodes.map(n=>[n.id,n]));
    return h('section',{class:'graph-relations','aria-label':label},h('h4',{},`${label} · ${edges.length}`),
      result.items.length?h('ul',{class:'graph-edge-list'},result.items.map(edge=>{
        const neighbor=byId.get(incoming?edge.from:edge.to);
        return h('li',{class:'graph-edge',dataset:{edgeId:edge.id}},
          p(`${incoming?'来源 → 当前':'当前 → 目标'} · ${EDGE_NAMES[edge.type]||edge.type}`,'graph-edge-label'),
          nodeButton(neighbor,()=>select(neighbor.id,{reveal:true})),p(`字段 ${edge.source.collection}.${edge.source.field}`),
          h('details',{},h('summary',{},'关系身份与来源'),h('pre',{class:'graph-fulltext'},JSON.stringify(edge,null,2))));
      })):p('没有这类已登记关系'),pager(result,n=>{relationPages[direction]=n},`graph:${direction}`,`${label}关系分页`));
  }
  function detail(graph,node) {
    const {incoming,outgoing}=relationsForNode(graph,node.id);
    const verified=!session.status.pending&&!session.status.error;
    const target=verified?editorTarget(graph,node,current):null;
    const jump=target?h('a',{class:'button',href:routeHash(target.view,target.workId),onClick:e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0){e.preventDefault();onNavigate(target.view,target.workId)}},dataset:{focusKey:'graph:editor'}},'打开所属作品编辑器'):p(verified?'此记录没有所属作品编辑入口':'旧快照暂时禁止跳转，请先完成当前版本校验');
    const body=node.kind==='Draft'?node.record.body:node.kind==='Publication'?node.record.finalSnapshot?.body:undefined;
    return h('section',{class:'panel graph-detail','aria-label':'选中记录详情'},
      h('h3',{tabindex:'-1',dataset:{focusKey:'graph:detail'}},`${KIND_NAMES[node.kind]||node.kind} · ${node.label||'（空标题）'}`),
      p(`标识 ${node.source.entityId} · 实体修订 ${node.source.entityRevision}`,'id'),
      node.kind==='Work'?p(`阶段 ${node.record.phase}${node.record.trashedAt?' · 可恢复回收站':''}`):null,
      node.kind==='Publication'?p(`发布状态 ${node.record.status}；${node.record.finalSnapshot?'标题和正文来自此 Publication 的最终快照；不是当前稿件推断':'尚无最终发布快照；当前卡片以 PublicationID 标识，不借用当前稿件冒充发布事实'}`):null,
      node.kind==='MetricObservation'?p(`观测值 ${metricLabel(node)} · ${node.record.metricKey} · ${node.record.unit} · 口径 ${node.record.definition||'未注明'} · 观测 ${node.record.observedAt}`):null,
      node.kind==='AssetReference'?p('只含素材引用；未读取文件本体，不代表可播放或已核验'):null,
      h('div',{class:'actions'},jump),
      p('箭头表示原始字段的引用方向，不表示执行顺序。点击关联卡片可查看该记录，筛选会随之清除。'),
      h('div',{class:'graph-neighborhood'},relationColumn(graph,node,'incoming',incoming),h('div',{class:'graph-focus'},h('span',{'aria-hidden':'true',class:'graph-arrow'},'→'),h('div',{},p('当前记录'),h('strong',{},node.label||node.source.entityId),p(node.source.entityId,'id')),h('span',{'aria-hidden':'true',class:'graph-arrow'},'→')),relationColumn(graph,node,'outgoing',outgoing)),
      body===undefined?null:h('section',{class:'graph-body'},h('h4',{},node.kind==='Publication'?'发布时正文（全文）':'稿件正文（全文）'),h('pre',{class:'graph-fulltext',dataset:{fulltext:'body'}},body)),
      h('details',{},h('summary',{},'完整记录、稳定图谱标识与来源'),h('pre',{class:'graph-fulltext',dataset:{fulltext:'record'}},JSON.stringify(node,null,2))));
  }
  function render() {
    if(closed||!session)return;
    const focused=element.contains(document.activeElement)?document.activeElement?.dataset.focusKey:null;
    const {graph,pending,error,requestedRevision,requestedWorkspaceId}=session.status;
    element.setAttribute('aria-busy',String(pending));
    status.setAttribute('role',error?'alert':'status');
    status.className=`status-box${error?' error':''}`;
    status.replaceChildren(...[p(error?`关系校验失败（${error.code}）：${error.message}。${graph?'保留以下旧快照，不能视为当前版本。':'尚无可用快照，不能视为有效空图。'}`:pending?`正在校验工作区 ${requestedWorkspaceId} 的版本 ${requestedRevision}…${graph?'以下仍是上一次快照。':''}`:graph?`已校验 · ${graph.counts.works} 件作品 · ${graph.counts.nodes} 条记录 · ${graph.counts.edges} 条关系`:'尚未读取'),error?button('重新校验',()=>session.load(current,{retry:true})):null].filter(Boolean));
    if(!graph){sourceLine.textContent='';resultSummary.textContent='';output.replaceChildren();return}
    sourceLine.textContent=`当前展示：${graph.workspaceId} · 工作区版本 ${graph.revision} · ${graph.source.contract} · synthetic / private。验证范围：当前原生实体及关系；不代表完整存储或备份验收。`;
    const workOptions=graph.nodes.filter(n=>n.kind==='Work');
    work.replaceChildren(h('option',{value:''},'全部记录'),...workOptions.map(n=>h('option',{value:n.source.entityId,selected:filters.workId===n.source.entityId},`${n.label} · ${n.source.entityId}`)));
    // Keep missing route targets explicit instead of silently showing another work.
    if(filters.workId&&!workOptions.some(n=>n.source.entityId===filters.workId))work.append(h('option',{value:filters.workId,selected:true},`不存在的作品 · ${filters.workId}`));
    syncControls();
    const nodes=selectNodes(graph,filters),result=paginate(nodes,page);page=result.page;
    if(!nodes.some(n=>n.id===selectedId))selectedId=result.items[0]?.id||null;
    const selected=nodes.find(n=>n.id===selectedId);
    resultSummary.textContent=`筛选结果 ${result.total} 条；全文搜索覆盖所有页。账号全局指标不会并入某件作品。`;
    output.replaceChildren(...[
      p('类型计数来自整个已校验工作区，不随筛选变化。'),
      h('div',{class:'graph-kind-counts','aria-label':'整个工作区的核心记录类型'},['Work','Draft','Publication','MetricObservation'].map(k=>button([h('b',{},graph.nodes.filter(n=>n.kind===k).length),h('span',{},KIND_NAMES[k])],()=>{change('kind',k);syncControls()}, {'aria-pressed':filters.kind===k}))),
      h('section',{'aria-label':'记录列表'},h('div',{class:'graph-node-list'},result.items.map(n=>nodeButton(n,()=>select(n.id),selectedId===n.id))),
        nodes.length?null:p(graph.counts.nodes?'没有匹配记录，请调整筛选':'这是校验通过的空工作区；没有虚构业务节点','empty'),
        pager(result,n=>{page=n;selectedId=null;relationPages={incoming:0,outgoing:0}},'graph:records','记录分页')),
      selected?detail(graph,selected):null].filter(Boolean));
    if(focused)focusKey(focused);
  }
  session=createGraphSession({project,onChange:render});
  return {
    element,
    setState(next){current=next;return session.load(next)},
    setWorkScope(workId=null){if(routeWorkId===workId)return;routeWorkId=workId;Object.assign(filters,{search:'',kind:'',workId:workId||''});page=0;selectedId=null;relationPages={incoming:0,outgoing:0};syncControls();render()},
    get status(){return session.status},
    close(){closed=true;session.close()},
  };
}
