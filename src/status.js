/* Explicit, dated public task snapshots; no live monitoring or private discovery. */
const StatusModel=(()=>{
  const labels={running:'运行中',waiting:'等待',blocked:'受阻',round_complete:'本轮完成'};
  const filter=(items,state='')=>items.filter(item=>!state||item.state===state);
  const counts=items=>Object.fromEntries(Object.keys(labels).map(state=>[state,items.filter(item=>item.state===state).length]));
  return {labels,filter,counts};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StatusModel;
if(typeof document!=='undefined')(()=>{
  const data=JSON.parse(document.getElementById('catalog-data').textContent).statusSnapshot,e=ResearchModel.esc;
  const date=value=>new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Shanghai'}).format(new Date(value))+' 北京时间';
  const link=(label,url,style='')=>`<a class="${style}" href="${e(url)}"${url.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':''}>${e(label)}</a>`;
  const card=item=>`<article class="status-card" data-workstream="${e(item.id)}" data-state="${e(item.state)}"><div class="status-topline"><span class="status-number">${item.number}</span><h3>${e(item.title)}</h3><span class="status-pill">${StatusModel.labels[item.state]}</span></div><p class="status-action">${e(item.currentAction)}</p><p class="status-wait"><b>等待：</b>${e(item.waitingFor)}</p><div class="status-links">${item.links.map((a,i)=>link(a.label,a.url,i===0?'button primary':'button')).join('')}</div><details class="status-details"><summary>已发布内容与剩余需求</summary><div><p><b>已交付：</b>${e(item.publication)}</p><p><b>完成边界：</b>${e(item.completion)}</p><p class="status-evidence">相关原话：${item.evidenceMessageIds.map((id,i)=>link('记录'+(i+1),'../chat/index.html#'+id)).join(' · ')}</p></div></details><p class="status-verified">最近核验：<time datetime="${e(item.verifiedAt)}">${date(item.verifiedAt)}</time></p></article>`;
  const counts=StatusModel.counts(data.items);
  for(const mount of document.querySelectorAll('[data-status-board]')){
    mount.innerHTML=`<div class="status-heading"><div><p class="eyebrow">任务状态快照</p><h2>最近核验的任务状态</h2></div><time datetime="${e(data.asOf)}">${date(data.asOf)}</time></div><details class="status-launcher"><summary>快速打开七项任务成果</summary><div>${data.items.map(item=>link(item.number+' · '+item.title,item.links[0].url,'button')).join('')}</div></details><p class="status-notice">${e(data.notice)}</p><div class="status-filters" role="group" aria-label="筛选任务状态"><button type="button" data-state-filter="" aria-pressed="true">全部 ${data.items.length}</button>${Object.entries(StatusModel.labels).map(([key,label])=>`<button type="button" data-state-filter="${key}" aria-pressed="false">${label} ${counts[key]}</button>`).join('')}</div><div class="status-grid"></div><p class="status-empty" hidden>此快照没有这个状态的任务。其他状态和需求缺口仍可查看。</p>`;
    const render=state=>{const items=StatusModel.filter(data.items,state);mount.querySelector('.status-grid').innerHTML=items.map(card).join('');mount.querySelector('.status-empty').hidden=items.length>0;for(const b of mount.querySelectorAll('[data-state-filter]'))b.setAttribute('aria-pressed',String(b.dataset.stateFilter===state));};
    mount.addEventListener('click',event=>{const b=event.target.closest('[data-state-filter]');if(b)render(b.dataset.stateFilter);});render('');
  }
  const coverage=data.coverage;
  document.getElementById('hub-coverage').innerHTML=`<h2>归档覆盖与缺口</h2><p><b>${coverage.messageCount}条记录 · ${coverage.nonemptyCount}条有文字</b></p><p>${e(coverage.summary)}</p><p>最晚已取得消息：${date(coverage.end)}。时间范围不代表区间内所有消息都已取得。</p><div class="status-links">${link('核对原文与覆盖','../chat/index.html','button')}</div>`;
  document.getElementById('hub-decisions').innerHTML=`<h2>最近澄清的方向</h2>${data.decisions.map(note=>`<article><h3>${e(note.title)}</h3><p>${e(note.summary)}</p>${link('查看用户原话','../chat/index.html#'+note.messageId)}${note.supersedes.length?' · '+note.supersedes.map((id,i)=>link('较早表述'+(i+1),'../chat/index.html#'+id)).join(' · '):''}</article>`).join('')}`;
})();
