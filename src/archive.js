/* Filters visible, already-public text only; source records remain unchanged. */
const ArchiveModel=(()=>{
  const projects={archive:['聊天归档','聊天与项目','入库','覆盖'],workbench:['工作台','MyDotWork','Evolution'],upstream:['上游','供货','发票','Claude'],takeover:['接管','Codex','GPT对话','导出ChatGPT'],income:['副业','漫剧','收益','样品','minimaxh3'],paper:['Paper','论文','博士','FarmSTEPS'],farm:['FarmSystemDesign','海南','农场','地图','Landscape IMAGES']};
  function matches(item,state={}){
    const text=[item.id,item.text].join(' ').toLocaleLowerCase();
    const terms=(state.q||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const parsed=Date.parse(item.time),date=Number.isFinite(parsed)?new Date(parsed).toISOString().slice(0,10):'';
    return (!(state.from||state.to)||!!date)&&!(state.role&&item.role!==state.role)&&terms.every(term=>text.includes(term))&&(!state.from||date>=state.from)&&(!state.to||date<=state.to)&&(!state.project||(projects[state.project]||[]).some(term=>text.includes(term.toLocaleLowerCase())));
  }
  return {projects,matches};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ArchiveModel;
if(typeof document!=='undefined')(()=>{
  const $=id=>document.getElementById(id),fields=['query','role','from','to','project'],items=[...document.querySelectorAll('article.record')],count=$('count');
  const data=item=>({id:item.id,role:item.dataset.role,time:item.dataset.time,text:item.querySelector('.text').textContent});
  function filter(){const state={q:$('query').value,role:$('role').value,from:$('from').value,to:$('to').value,project:$('project').value};const invalid=state.from&&state.to&&state.from>state.to;let shown=0;for(const item of items){item.hidden=invalid||!ArchiveModel.matches(data(item),state);if(!item.hidden)shown++;}count.textContent=shown+' / '+items.length+' 条';$('date-error').textContent=invalid?'开始日期不能晚于结束日期。':'';$('empty').hidden=shown!==0;}
  for(const id of fields)$(id).addEventListener(id==='query'?'input':'change',filter);
  $('reset').addEventListener('click',()=>{for(const id of fields)$(id).value='';filter();$('query').focus();});
  $('empty-reset').addEventListener('click',()=>$('reset').click());
  filter();
})();
