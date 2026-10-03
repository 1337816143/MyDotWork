/* Filters visible, already-public text only; source records remain unchanged. */
const ArchiveModel=(()=>{
  const projects={archive:['聊天归档','聊天与项目','入库','覆盖'],workbench:['工作台','MyDotWork','Evolution'],upstream:['上游','供货','发票','Claude'],takeover:['接管','Codex','GPT对话','导出ChatGPT'],income:['副业','漫剧','收益','样品','minimaxh3'],paper:['Paper','论文','博士','FarmSTEPS'],farm:['FarmSystemDesign','海南','农场','地图','Landscape IMAGES']};
  function matches(item,state={}){
    const text=[item.id,item.text].join(' ').toLocaleLowerCase();
    const terms=(state.q||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const parsed=Date.parse(item.time),date=Number.isFinite(parsed)?new Date(parsed).toISOString().slice(0,10):'';
    return (!(state.from||state.to)||!!date)&&!(state.role&&item.role!==state.role)&&terms.every(term=>text.includes(term))&&(!state.from||date>=state.from)&&(!state.to||date<=state.to)&&(!state.project||(projects[state.project]||[]).some(term=>text.includes(term.toLocaleLowerCase())));
  }
  function messageId(hash){try{const id=decodeURIComponent(String(hash||'').replace(/^#/,''));return /^Sentinel_[a-z0-9]+$/.test(id)?id:null;}catch{return null;}}
  return {projects,matches,messageId};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ArchiveModel;
if(typeof document!=='undefined')(()=>{
  const $=id=>document.getElementById(id),fields=['query','role','from','to','project'],items=[...document.querySelectorAll('article.record')],count=$('count'),records=new Map(items.map(item=>[item.id,item]));
  let previousFilter=null,highlighted=null,selectedId=null,lastLocation=location.href,lastHandled='',serial=0;
  const data=item=>({id:item.id,role:item.dataset.role,time:item.dataset.time,text:item.querySelector('.text').textContent});
  const state=()=>({q:$('query').value,role:$('role').value,from:$('from').value,to:$('to').value,project:$('project').value});
  const validState=s=>s&&['q','role','from','to','project'].every(key=>typeof s[key]==='string');
  const putState=s=>{for(const id of fields)$(id).value=s[id==='query'?'q':id]||'';};
  function clearContext(){if(highlighted)highlighted.classList.remove('anchor-target');highlighted=null;selectedId=null;previousFilter=null;$('anchor-context').hidden=true;$('anchor-return').hidden=true;$('anchor-message').textContent='';}
  function filter(){const s=state(),invalid=s.from&&s.to&&s.from>s.to;let shown=0;for(const item of items){item.hidden=invalid||!ArchiveModel.matches(data(item),s);if(!item.hidden)shown++;}count.textContent=shown+' / '+items.length+' 条';$('date-error').textContent=invalid?'开始日期不能晚于结束日期。':'';$('empty').hidden=shown!==0;}
  function showTarget(id,scroll=true){
    if(highlighted)highlighted.classList.remove('anchor-target');highlighted=null;selectedId=id;
    const target=records.get(id);$('anchor-context').hidden=false;$('anchor-return').hidden=!previousFilter;
    if(!target){$('anchor-message').textContent='这条记录未包含在当前公开归档中，或链接标识无效。筛选条件未改变。';if(scroll){$('anchor-context').tabIndex=-1;$('anchor-context').focus({preventScroll:true});$('anchor-context').scrollIntoView({block:'start',behavior:'auto'});}return;}
    if(target.hidden)return;
    highlighted=target;target.classList.add('anchor-target');target.tabIndex=-1;
    $('anchor-message').textContent=previousFilter?'为显示目标原文，已暂时清除筛选。可返回原来的筛选结果。':'已定位并高亮目标原文。';
    if(scroll){target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});}
  }
  function reveal(hash,{origin=null,previousHash=location.hash}={}){
    const id=ArchiveModel.messageId(hash);if(!id){clearContext();let named=false;try{named=!!document.getElementById(decodeURIComponent(String(hash).replace(/^#/,'')));}catch{}if(hash&&!named)showTarget('__invalid_hash__');return;}
    const target=records.get(id);
    if(!target){clearContext();showTarget(id);return;}
    if(target?.hidden){
      if(!previousFilter)previousFilter={state:state(),hash:previousHash,scrollY:window.scrollY,origin};
      putState({});filter();
    }
    showTarget(id);
  }
  function saveHistory(method='replace',hash=location.hash,focusId=null){
    const context={version:1,key:Date.now()+'-'+(++serial),hash,filters:state(),previousFilter,selectedId,scrollY:window.scrollY,focusId:focusId||document.activeElement?.closest('article.record')?.id||null};
    const existing=history.state&&typeof history.state==='object'?history.state:{};
    history[method+'State']({...existing,mydotworkArchive:context},'',location.pathname+location.search+hash);
    lastLocation=location.href;lastHandled=location.href+'|'+context.key;
  }
  function restoreFilter(){
    if(!previousFilter)return;const saved=previousFilter;clearContext();putState(saved.state);filter();
    const origin=records.get(saved.origin);if(origin&&!origin.hidden){origin.tabIndex=-1;origin.focus({preventScroll:true});}else $('query').focus({preventScroll:true});
    window.scrollTo(0,saved.scrollY);saveHistory('replace',saved.hash,saved.origin);
  }
  function restoreHistory(saved){
    clearContext();putState(saved.filters);filter();
    if(saved.previousFilter&&validState(saved.previousFilter.state))previousFilter=saved.previousFilter;
    if(saved.selectedId)showTarget(saved.selectedId,false);
    const focus=records.get(saved.focusId)||highlighted;if(focus&&!focus.hidden){focus.tabIndex=-1;focus.focus({preventScroll:true});}
    window.scrollTo(0,Number.isFinite(saved.scrollY)?saved.scrollY:0);
  }
  function historyChanged(event){
    const saved=history.state?.mydotworkArchive,key=location.href+'|'+(saved?.key||'');if(key===lastHandled)return;
    if(saved?.version===1&&saved.hash===location.hash&&validState(saved.filters)){
      restoreHistory(saved);lastHandled=key;lastLocation=location.href;
    }else{
      reveal(location.hash,{previousHash:new URL(event.oldURL||lastLocation).hash});saveHistory();
    }
  }
  for(const id of fields)$(id).addEventListener(id==='query'?'input':'change',()=>{clearContext();filter();saveHistory();});
  $('reset').addEventListener('click',()=>{clearContext();putState({});filter();$('query').focus();saveHistory();});
  $('empty-reset').addEventListener('click',()=>$('reset').click());
  $('anchor-return').addEventListener('click',restoreFilter);
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!==location.pathname||!ArchiveModel.messageId(url.hash))return;
    event.preventDefault();const oldHash=location.hash,origin=link.closest('article.record')?.id||null;
    saveHistory('replace',oldHash,origin);reveal(url.hash,{origin,previousHash:oldHash});saveHistory(oldHash===url.hash?'replace':'push',url.hash);
  });
  window.addEventListener('popstate',historyChanged);window.addEventListener('hashchange',historyChanged);
  const initial=history.state?.mydotworkArchive;
  if(initial?.version===1&&initial.hash===location.hash&&validState(initial.filters)){restoreHistory(initial);reveal(location.hash,{previousHash:initial.hash,origin:initial.focusId});saveHistory();}
  else{filter();reveal(location.hash,{previousHash:''});saveHistory();}
})();
