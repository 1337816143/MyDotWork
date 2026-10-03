/* Reviewed public catalogue. No discovery, requests, telemetry or private file storage. */
const CatalogModel = (() => {
  const types={report:'研究报告',dataset:'结构化数据',tutorial:'使用教程',guide:'排障指南',archive:'公开归档',website:'项目网站',progress:'进度快照'};
  const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
  function filter(records,state={},tasks=[]){
    const names=Object.fromEntries(tasks.map(t=>[t.id,t.title]));
    const terms=(state.q||'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const from=state.from?stamp(state.from+'T00:00:00Z'):null,to=state.to?stamp(state.to+'T23:59:59.999Z'):null;
    return records.filter(r=>{
      if(r.metadataApproved!==true||!['public','login'].includes(r.access))return false;
      if(state.task&&r.task!==state.task||state.type&&r.type!==state.type||state.access&&r.access!==state.access)return false;
      const t=stamp(r.updatedAt);if((from!==null||to!==null)&&t===null)return false;
      if(from!==null&&t<from||to!==null&&t>to)return false;
      const text=[r.title,r.summary,names[r.task],types[r.type]].join(' ').toLocaleLowerCase();
      return terms.every(term=>text.includes(term));
    }).sort((a,b)=>{
      if(state.sort==='title')return a.title.localeCompare(b.title,'zh-CN');
      const x=stamp(a.updatedAt),y=stamp(b.updatedAt);
      if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
      const time=x===null||y===null?0:(state.sort==='oldest'?x-y:y-x);
      return time||a.id.localeCompare(b.id);
    });
  }
  return {types,stamp,filter};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CatalogModel;
if(typeof document!=='undefined')(()=>{
  'use strict';
  const $=id=>document.getElementById(id),e=ResearchModel.esc;
  const data=JSON.parse($('catalog-data').textContent),taskNames=Object.fromEntries(data.tasks.map(t=>[t.id,t.title]));
  const date=value=>!value?'更新时间未记录':/^\d{4}-\d{2}-\d{2}$/.test(value)?'截至 '+value:new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC';
  const access=r=>r.access==='login'?'需登录':'公开';
  function link(r,label='打开资料') {return `<a class="button" href="${e(r.url)}"${r.url.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${label}<span class="visually-hidden">：${e(r.title)}</span></a>`;}
  const bases={library:data.records,websites:data.records.filter(r=>r.category==='websites'),tasks:data.records.filter(r=>r.category==='tasks')};
  const controls=['q','task','type','from','to','access','sort'];
  function state(page){return Object.fromEntries(controls.map(k=>[k,$(page+'-'+k).value]));}
  function recordCard(r){return `<article class="catalog-card" data-catalog-id="${e(r.id)}"><div class="catalog-card-meta"><span class="tag">${e(CatalogModel.types[r.type])}</span><span>${access(r)}</span></div><h2>${e(r.title)}</h2><p class="catalog-summary">${e(r.summary)}</p><div class="catalog-card-footer"><span>${e(taskNames[r.task])}<br><time>${date(r.updatedAt)}</time></span>${link(r,r.type==='website'?'进入网站':'打开资料')}</div></article>`;}
  function taskCard(r){const t=data.tasks.find(t=>t.id===r.task);return `<article class="task-card" data-catalog-id="${e(r.id)}"><div class="catalog-card-meta"><span class="tag">${e(t.status)}</span><time>${date(t.updatedAt)}</time></div><h2>${e(t.title)}</h2><p class="catalog-summary">${e(t.progress)}</p><details><summary>待完成与验收范围</summary><div class="disclosure-body"><p>${e(t.gaps)}</p><p class="small-note">${e(t.evidence)}</p>${t.children.map(c=>`<section class="task-child"><h3>${e(c.name)}</h3><span class="tag">${e(c.status)}</span><p>${e(c.progress)}</p><p class="small-note">待办：${e(c.gaps)}</p></section>`).join('')}<a href="${e(t.source)}">原始公开进度数据 ↗</a></div></details>${link(r,'查看原始项目快照')}</article>`;}
  function render(page){
    const s=state(page),invalid=s.from&&s.to&&s.from>s.to;
    $(page+'-date-error').textContent=invalid?'开始日期不能晚于结束日期。':'';
    const list=invalid?[]:CatalogModel.filter(bases[page],s,data.tasks);
    $(page+'-count').textContent=`${list.length} / ${bases[page].length} ${page==='tasks'?'项任务':page==='websites'?'个网站入口':'条目录记录'}`;
    const tags=controls.filter(k=>s[k]&&k!=='sort').map(k=>`${{q:'关键词',task:'任务',type:'类型',from:'起始日期',to:'结束日期',access:'访问'}[k]}：${k==='task'?taskNames[s[k]]:k==='type'?CatalogModel.types[s[k]]:k==='access'?s[k]==='public'?'公开':'需登录':s[k]}`);
    $(page+'-active').innerHTML=tags.map(t=>`<span class="tag">${e(t)}</span>`).join('');
    $(page+'-results').innerHTML=list.length?`<div class="catalog-grid">${list.map(page==='tasks'?taskCard:recordCard).join('')}</div>`:`<div class="empty"><h2>${invalid?'请调整日期范围':'没有符合条件的公开目录记录'}</h2><p>可减少关键词或筛选条件。需登录资料只在获得明确公开许可后收录；未收录不代表不存在。</p><button type="button" class="button catalog-empty-reset">重置筛选</button></div>`;
    $(page+'-results').querySelector('.catalog-empty-reset')?.addEventListener('click',()=>{$(page+'-form').reset();render(page);$(page+'-q').focus();});
  }
  for(const page of Object.keys(bases)){
    const knownTypes=[...new Set(bases[page].map(r=>r.type))];
    $(page+'-tools').innerHTML=`<form id="${page}-form" class="catalog-filters panel" role="search"><div class="catalog-filter-primary"><label>搜索资料与任务<input id="${page}-q" type="search" autocomplete="off" placeholder="标题、内容或项目名称"></label><label>所属任务<select id="${page}-task"><option value="">全部任务</option>${data.tasks.map(t=>`<option value="${e(t.id)}">${e(t.title)}</option>`).join('')}</select></label><label>资料类型<select id="${page}-type"><option value="">全部类型</option>${knownTypes.map(t=>`<option value="${e(t)}">${e(CatalogModel.types[t])}</option>`).join('')}</select></label></div><details class="catalog-more"><summary>日期、访问范围与排序</summary><div class="catalog-filter-secondary"><label>更新起始日期（UTC）<input id="${page}-from" type="date"></label><label>更新结束日期（UTC）<input id="${page}-to" type="date"></label><label>访问范围<select id="${page}-access"><option value="">全部已收录范围</option><option value="public">公开</option><option value="login">需登录</option></select></label><label>排序<select id="${page}-sort"><option value="latest">更新时间从新到旧</option><option value="oldest">更新时间从旧到新</option><option value="title">标题</option></select></label></div><p class="small-note">日期筛选不包含更新时间未记录的资料；未知日期始终排在末尾。</p></details><p id="${page}-date-error" class="catalog-error" role="alert"></p><div class="catalog-filter-footer"><b id="${page}-count" role="status"></b><button class="button" type="reset">重置筛选</button></div></form><div id="${page}-active" class="active-filters"></div>`;
    const form=$(page+'-form'),primary=form.querySelector('.catalog-filter-primary'),more=form.querySelector('.catalog-more');
    const open=document.createElement('button');open.type='button';open.className='button catalog-refine-open';open.textContent='筛选';open.setAttribute('aria-haspopup','dialog');open.setAttribute('aria-controls',page+'-refine');primary.append(open);
    const drawer=document.createElement('dialog');drawer.id=page+'-refine';drawer.className='catalog-refine';drawer.setAttribute('aria-label','目录多维筛选');drawer.innerHTML='<div class="settings-heading"><h2>筛选与排序</h2><button type="button" class="button catalog-refine-close" aria-label="关闭筛选">×</button></div><div class="catalog-refine-fields"></div><button type="button" class="button primary catalog-refine-done">查看结果</button>';form.append(drawer);
    const fields=drawer.querySelector('.catalog-refine-fields'),taskLabel=$(page+'-task').closest('label'),typeLabel=$(page+'-type').closest('label');
    const arrange=()=>{if(matchMedia('(max-width:700px)').matches){fields.append(taskLabel,typeLabel,more);}else{primary.insertBefore(taskLabel,open);primary.insertBefore(typeLabel,open);primary.after(more);if(drawer.open)drawer.close();}};arrange();addEventListener('resize',arrange);
    open.addEventListener('click',()=>{more.open=true;drawer.showModal();$(page+'-task').focus();});drawer.querySelector('.catalog-refine-close').addEventListener('click',()=>drawer.close());drawer.querySelector('.catalog-refine-done').addEventListener('click',()=>drawer.close());drawer.addEventListener('close',()=>open.focus());drawer.addEventListener('click',event=>{if(event.target===drawer){const r=drawer.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)drawer.close();}});
    addEventListener('hashchange',()=>{if(drawer.open)drawer.close();});
    for(const k of controls){const n=$(page+'-'+k);n.name=k;n.addEventListener(k==='q'?'input':'change',()=>render(page));}
    $(page+'-form').addEventListener('submit',ev=>ev.preventDefault());$(page+'-form').addEventListener('reset',()=>setTimeout(()=>render(page),0));render(page);
  }
  $('hub-summary').innerHTML=[['library',data.counts.artifacts,'已收录成果资料','报告、数据、教程与公开归档'],['websites',data.counts.websites,'明确网站入口','主站与既有个人进化镜像'],['tasks',data.counts.tasks,'公开任务快照','状态与待办分别保留']].map(([id,n,title,note])=>`<a class="hub-stat" href="#${id}"><b>${n}</b><span>${title}</span><small>${note}</small></a>`).join('');
  const featured=['upstream-round3-7','side-income-report'];
  const reportPool=CatalogModel.filter(data.records.filter(r=>r.category==='artifacts'&&r.type==='report'),{},data.tasks);
  const recent=[...featured.map(id=>reportPool.find(r=>r.id===id)).filter(Boolean),...reportPool.filter(r=>!featured.includes(r.id))].slice(0,4);
  $('hub-recent').innerHTML=recent.map(r=>`<a class="hub-item" href="${e(r.url)}"><span class="tag">${e(CatalogModel.types[r.type])}</span><div><b>${e(r.title)}</b><small>${date(r.updatedAt)}</small></div><span aria-hidden="true">↗</span></a>`).join('');
  $('hub-tasks').innerHTML=['project-1','project-17','project-5','project-6'].map(id=>data.tasks.find(t=>t.id===id)).filter(Boolean).map(t=>`<a class="hub-item" href="#tasks" data-task-id="${e(t.id)}"><div><b>${e(t.title)}</b><small>${e(t.status)} · ${date(t.updatedAt)}</small></div><span aria-hidden="true">→</span></a>`).join('');
  document.querySelectorAll('[data-task-id]').forEach(a=>a.addEventListener('click',()=>{$('tasks-task').value=a.dataset.taskId;render('tasks');}));
  $('catalog-scope').textContent=data.scope+' 当前任务整理快照：'+date(data.projectSnapshotUpdatedAt)+'。';
  $('hub-search').addEventListener('submit',ev=>{ev.preventDefault();$('library-q').value=$('hub-query').value;render('library');location.hash='library';});
})();
