/* Shared deterministic model. Appearance preferences alone use local storage; no requests or telemetry. */
const ResearchModel = (() => {
  const esc = value => String(value ?? '未知').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = (r, basis) => {
    if (basis === 'preview') return r.payment_group === '人民币预览' ? number(r.payable_preview) : null;
    if (basis === 'invoice') return number(r.invoice_total_claim);
    return number(r.display_price);
  };
  const number = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
  const isHigh = r => /^HIGH/i.test(r.credential_risk || '');
  const merchantName = r => r.merchant.replace(' AI代采', '');
  const invoiceClaim = r => r.invoice_supported_claim === true;
  const groupKey = (r, basis) => [r.sku_group, r.period, r.delivery, r.display_currency, basis === 'preview' ? (r.payment_group === '人民币预览' ? '人民币付款预览 · 非成交' : r.payment_group) : r.payment_group].join(' / ');
  function filter(records, f) {
    const q = (f.q || '').trim().toLocaleLowerCase();
    return records.filter(r => (!q || JSON.stringify(r).toLocaleLowerCase().includes(q))
      && (!f.tier || r.tier.split(' / ')[0] === f.tier)
      && (!f.invoice || (f.invoice === 'claim' ? invoiceClaim(r) : f.invoice === 'priced' ? number(r.invoice_total_claim) !== null : f.invoice === 'unknown' ? r.invoice_supported_claim == null : r.invoice_supported_claim === false))
      && (!f.risk || (f.risk === 'high' ? isHigh(r) : !isHigh(r)))
      && (!f.resale || (f.resale === 'prohibited' ? r.resale === '标准条款禁止转售' : r.resale !== '标准条款禁止转售'))
      && (!f.agency || (f.agency === 'no-upfront' ? r.agency === '未见代理费前置' : r.agency === '未知')));
  }
  function compare(a, b, f) {
    if (f.sort === 'merchant') return a.merchant.localeCompare(b.merchant, 'zh-CN') || a.id.localeCompare(b.id);
    const av = amount(a, f.basis), bv = amount(b, f.basis);
    if (av === null && bv !== null) return 1;
    if (av !== null && bv === null) return -1;
    if (f.sort === 'invoice') {
      const d = Number(invoiceClaim(b)) - Number(invoiceClaim(a)); if (d) return d;
    }
    if (f.sort === 'agency') {
      const d = Number(b.agency === '未见代理费前置') - Number(a.agency === '未见代理费前置'); if (d) return d;
    }
    return (av === null ? 0 : av - bv) || a.id.localeCompare(b.id);
  }
  function groups(records, f) {
    const map = new Map();
    for (const r of filter(records, f)) { const key = groupKey(r, f.basis); if (!map.has(key)) map.set(key, []); map.get(key).push(r); }
    return [...map].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN', {numeric:true})).map(([key, rows]) => ({key, rows:rows.slice().sort((a,b) => compare(a,b,f))}));
  }
  return {esc, amount, number, isHigh, merchantName, invoiceClaim, groupKey, filter, compare, groups};
})();
if (typeof module !== 'undefined') module.exports = ResearchModel;

if (typeof document !== 'undefined') (() => {
  'use strict';
  const M = ResearchModel, e = M.esc, $ = id => document.getElementById(id);
  const d = JSON.parse($('research-data').textContent);
  let appearance=window.WorkbenchAppearance || {layout:'B',color:'dark',effects:'auto'};
  function applyAppearance(){
    document.documentElement.dataset.layout=appearance.layout;
    document.documentElement.dataset.color=appearance.layout==='A'?'light':appearance.color;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.dataset.glass=reduce||appearance.effects==='solid'||(appearance.effects==='auto'&&window.WorkbenchBoot?.constrained)?'solid':'full';
    document.body.dataset.layout=appearance.layout;
    document.body.dataset.color=appearance.layout==='A'?'light':appearance.color;
    $('layout-choice').value=appearance.layout;
    $('color-choice').hidden=appearance.layout==='A';
    $('color-choice').textContent=appearance.color==='dark'?'切换为浅色':'切换为深色';
    $('color-choice').setAttribute('aria-pressed',String(appearance.color==='light'));
    const light=appearance.layout==='A'||appearance.color==='light',solid=document.documentElement.dataset.glass==='solid';
    $('appearance-state').textContent=(appearance.layout==='A'?'A · 明亮布局':'B · '+(light?'浅色':'深色'))+' · '+(solid?'轻量效果':'液态玻璃');
    $('effects-choice').textContent='轻量效果';
    $('effects-choice').setAttribute('aria-label','轻量效果：关闭背景模糊和折射装饰');
    $('effects-choice').disabled=matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('effects-choice').setAttribute('aria-pressed',String(solid));
    try {localStorage.setItem('mydotwork-appearance',JSON.stringify(appearance));}catch {}
  }
  $('layout-choice').addEventListener('change',()=>{appearance.layout=$('layout-choice').value;applyAppearance();closeNav();closeFilters();});
  $('color-choice').addEventListener('click',()=>{appearance.color=appearance.color==='dark'?'light':'dark';applyAppearance();closeNav();});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>applyAppearance());
  $('effects-choice').addEventListener('click',()=>{appearance.effects=document.documentElement.dataset.glass==='solid'?'full':'solid';applyAppearance();});
  $('context-location').textContent=location.protocol==='file:'?'本地预览':location.pathname.includes('/Evolution/')?'个人进化镜像':location.pathname.includes('/MyDotWork/')?'MyDotWork主站':'工作台副本';
  applyAppearance();

  const settings=$('appearance-settings'),settingsBody=$('appearance-settings-body'),appearanceControls=document.querySelector('.appearance'),context=document.querySelector('.context-bar'),version=context.querySelector('.ui-version');
  const compactSettings=()=>{const compact=matchMedia('(max-width:700px)').matches;if(compact){document.querySelector('.header-brand').append(version);settingsBody.append(appearanceControls,context);}else{document.querySelector('.topbar').insertBefore(appearanceControls,$('header-download'));document.querySelector('.topbar').after(context);context.prepend(version);if(settings.open)settings.close();}};
  $('appearance-open').addEventListener('click',()=>{settings.showModal();$('layout-choice').focus();});
  $('appearance-close').addEventListener('click',()=>settings.close());settings.addEventListener('close',()=>$('appearance-open').focus());settings.addEventListener('click',event=>{if(event.target===settings){const r=settings.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)settings.close();}});addEventListener('resize',compactSettings);compactSettings();

  const labels = {workbench:'工作台首页',library:'成果资料目录',websites:'项目网站',tasks:'任务进度',overview:'研究总览',quotes:'低价供货与发票',routes:'源头与自主供货',phone:'成品号与手机验证',claude:'Claude Code',timeline:'任务与历史修正',sources:'来源索引'};
  const fields = ['q','tier','basis','invoice','risk','resale','agency','sort'];
  let mode = matchMedia('(max-width:700px)').matches ? 'cards' : 'table';
  const urlLink = (url, title) => {
    if (!/^https?:\/\//i.test(url)) return e(url);
    return `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(title || url)}</a>`;
  };
  const linked = text => String(text ?? '').split(/(https?:\/\/[^\s<>]+)/g).map(s => /^https?:\/\//.test(s) ? urlLink(s) : e(s)).join('');
  const money = (n, currency='CNY') => n == null ? '未知' : `${currency === 'CNY' ? '¥' : e(currency)+' '}${Number(n).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const value = v => v == null ? '未知' : typeof v === 'boolean' ? v ? '商家宣称支持' : '该SKU不支持' : typeof v === 'object' ? e(JSON.stringify(v)) : e(v);
  const disclosure = (heading, body, id='') => `<details${id ? ` id="${id}"` : ''}><summary>${e(heading)}</summary><div class="disclosure-body">${body}</div></details>`;
  const textBody = text => `<div class="prose">${linked(text)}</div>`;
  const mobileNav = document.createElement('button'); mobileNav.className='button mobile-only nav-toggle'; mobileNav.type='button'; mobileNav.textContent='菜单'; mobileNav.setAttribute('aria-expanded','false'); mobileNav.setAttribute('aria-label','打开模块导航'); mobileNav.setAttribute('aria-controls','module-sidebar');
  document.querySelector('.topbar').prepend(mobileNav);
  const sidebar = document.querySelector('.sidebar'); sidebar.id='module-sidebar';
  const navClose = document.createElement('button'); navClose.className='mobile-close'; navClose.type='button'; navClose.textContent='×'; navClose.setAttribute('aria-label','关闭模块导航'); sidebar.prepend(navClose);
  function closeNav() { sidebar.classList.remove('open'); mobileNav.setAttribute('aria-expanded','false'); sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
  mobileNav.addEventListener('click',()=>{sidebar.classList.add('open');mobileNav.setAttribute('aria-expanded','true');sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');navClose.focus();});
  navClose.addEventListener('click',()=>{closeNav();mobileNav.focus();});
  const navBackdrop=document.createElement('button');navBackdrop.className='nav-backdrop';navBackdrop.tabIndex=-1;navBackdrop.setAttribute('aria-label','关闭模块导航');sidebar.after(navBackdrop);navBackdrop.addEventListener('click',()=>{closeNav();mobileNav.focus();});
  const icons=['M3 4h18v16H3z M3 9h18 M8 9v11','M4 3h6v18H4z M14 3h6v18h-6z','M3 5h18v14H3z M3 9h18 M7 7h1 M11 7h1','M4 5h3v3H4z M11 6h9 M4 11h3v3H4z M11 12h9 M4 17h3v3H4z M11 18h9','M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z','M4 5h16v14H4z M4 10h16 M9 5v14','M5 5h5v5H5z M14 14h5v5h-5z M10 7h7v7','M8 3h8v18H8z M11 17h2','M4 6l5 6-5 6 M12 18h8','M12 3a9 9 0 1 1-8 5 M3 3v5h5 M12 7v5l3 2','M8 3h8l4 4v14H4V3z M8 11h8 M8 15h8'];
  [...sidebar.querySelectorAll('nav a')].forEach((a,i)=>{const text=a.textContent;a.setAttribute('aria-label',text);a.title=text;a.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[i]}"/></svg><span>${e(text)}</span>`;});
  [...sidebar.querySelectorAll('.sidebar-bottom>a')].forEach((a,i)=>{const text=a.textContent;a.setAttribute('aria-label',text);a.title=text;a.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${['M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5','M4 4h16v12H9l-5 4z','M3 6h7l2 3h9v11H3z','M8 3h8l4 4v14H4V3z M8 11h8 M8 15h8'][i]}"/></svg><span>${e(text)}</span>`;});
  const workspaceNav=document.createElement('nav');workspaceNav.className='workspace-nav';workspaceNav.setAttribute('aria-label','AI工作台区域');workspaceNav.innerHTML=[['workbench','工作台'],['library','成果目录'],['websites','项目网站'],['tasks','任务进度'],['overview','AI研究']].map(([id,title])=>`<a href="#${id}" data-workspace="${id}">${title}</a>`).join('');document.querySelector('.topbar').after(workspaceNav);
  const moduleNav=document.createElement('nav');moduleNav.className='module-nav';moduleNav.setAttribute('aria-label','四个研究模块');moduleNav.innerHTML=['overview','quotes','routes','phone','claude'].map(id=>`<a href="#${id}" data-module="${id}" aria-label="${e(labels[id])}"><span class="tab-long">${e(labels[id])}</span><span class="tab-short">${e({overview:"总览",quotes:"ChatGPT报价",routes:"自主供货",phone:"账号验证",claude:"Claude Code"}[id])}</span></a>`).join('');workspaceNav.after(moduleNav);
  addEventListener('resize',()=>{if(!matchMedia('(max-width:700px)').matches){closeNav();closeFilters();}});

  const filterOpen = document.createElement('button'); filterOpen.type='button';filterOpen.className='button mobile-only';filterOpen.id='open-filters';filterOpen.textContent='筛选与排序';filterOpen.setAttribute('aria-expanded','false');filterOpen.setAttribute('aria-controls','filters');
  $('filters').before(filterOpen);
  const filterClose=document.createElement('button');filterClose.type='button';filterClose.className='mobile-close';filterClose.textContent='×';filterClose.setAttribute('aria-label','完成筛选并返回结果');$('filters').prepend(filterClose);
  filterOpen.addEventListener('click',()=>{$('filters').classList.add('open');filterOpen.setAttribute('aria-expanded','true');$('filters').setAttribute('role','dialog');$('filters').setAttribute('aria-modal','true');if(matchMedia('(max-width:700px)').matches)filterClose.focus();else $('q').focus();});
  function closeFilters(){ $('filters').classList.remove('open');filterOpen.setAttribute('aria-expanded','false');$('filters').setAttribute('role','search');$('filters').removeAttribute('aria-modal'); }
  filterClose.addEventListener('click',()=>{closeFilters();filterOpen.focus();});
  const filterDone=document.createElement('button');filterDone.type='button';filterDone.className='button primary mobile-only';filterDone.textContent='完成筛选 · 查看结果';$('filters').querySelector('.filter-footer').append(filterDone);filterDone.addEventListener('click',()=>{closeFilters();$('result-count').scrollIntoView({behavior:'instant',block:'start'});});
  fields.forEach(id=>{$(id).name=id;$(id).setAttribute('autocomplete','off');});$('source-search').name='source';$('source-search').setAttribute('autocomplete','off');
  const more=document.createElement('details');more.className='more-filters';more.innerHTML='<summary>更多筛选与排序</summary><div class="filter-grid"></div>';
  for(const id of ['invoice','risk','resale','agency','sort'])more.querySelector('.filter-grid').append($(id).closest('label'));
  const filterBody=document.createElement('div');filterBody.className='filter-body';filterBody.append($('filters').querySelector('.filter-grid'),more);
  const filterHeader=document.createElement('div');filterHeader.className='filter-sheet-heading';filterHeader.innerHTML='<h2>筛选与排序</h2>';filterHeader.append(filterClose);
  $('filters').prepend(filterHeader,filterBody);
  filterOpen.addEventListener('click',()=>{more.open=true;});
  $('quotes').querySelector('.section-heading').insertBefore(filterOpen,$('quotes').querySelector('.segmented'));
  const quoteBoundary=$('quotes').querySelector('.callout'),boundary=document.createElement('details');boundary.className='quote-boundary';boundary.innerHTML='<summary>经营边界：自用报价不等于转售授权</summary><p>'+quoteBoundary.querySelector('span').textContent+'</p>';quoteBoundary.replaceWith(boundary);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){const f=$('filters').classList.contains('open'),n=sidebar.classList.contains('open');closeNav();closeFilters();if(f)filterOpen.focus();else if(n)mobileNav.focus();}
    const container=$('filters').classList.contains('open') ? $('filters') : sidebar.classList.contains('open') ? sidebar : null;
    if(container && event.key==='Tab'){
      const nodes=[...container.querySelectorAll('a,button,input,select')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');const first=nodes[0],last=nodes.at(-1);
      if(!container.contains(document.activeElement)){event.preventDefault();first?.focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  const stats = [
    [d.records.length,'第一轮报价记录','按原研究45条SKU记录，保留修正'],
    [new Set(d.records.map(M.merchantName)).size,'商家展示名','不是法人数或独立供货来源数'],
    [d.invoice.prior_candidates.length+d.invoice.new_candidates.length,'发票候选商家','第二轮主体与票证待核'],
    [d.routes.routes.length,'采购 / 经营路线','个人会员与API商业应用分开']
  ];
  $('metrics').innerHTML=stats.map(([n,label,note])=>`<div class="metric"><span>${e(label)}</span><b>${n}</b><small>${e(note)}</small></div>`).join('');
  const metricScope=document.createElement('details');metricScope.className='metric-scope mobile-only';metricScope.innerHTML='<summary>统计口径与证据边界</summary><div class="disclosure-body">'+stats.map(([n,label,note])=>'<p><b>'+e(label)+' '+n+'</b> · '+e(note)+'</p>').join('')+'</div>';$('metrics').after(metricScope);
  const skuCount=new Set(d.records.map(r=>r.id)).size;
  document.querySelector('#overview .footnote').prepend(`当前供货SKU ${skuCount} 个；研究来源URL ${d.sources.length} 个（去重、仅研究文件）。`);
  function state(){return Object.fromEntries(fields.map(id=>[id,$(id).value]));}
  function invoiceLabel(r){return r.invoice_supported_claim==null?'未知 / 仅线索':r.invoice_supported_claim?'商称支持 · 未验真':'该SKU不支持';}
  function priceMarkup(r,f){return `<span class="price">${money(M.amount(r,f.basis),r.display_currency)}</span><p class="small-note">${f.basis==='invoice'?'商家宣称 / 规则计算，非成交':f.basis==='preview'?'付款预览，非成交；未知票费未计':'公开展示价；总成本未闭合'}</p>`;}
  const basisNames={display:'展示价',preview:'人民币付款预览',invoice:'含票宣称 / 计算值'};
  function rowMarkup(r,f){return `<tr><td><b>${e(r.merchant)}</b><p>${e(r.id)}</p>${r.resale==='标准条款禁止转售'?'<span class="tag important">禁止转售</span>':''}</td><td>${e(r.tier)}<p>${e(r.period)} · 原号充值</p></td><td>${priceMarkup(r,f)}</td><td>${e(invoiceLabel(r))}<p>${r.invoice_total_claim==null?'含票总额未知':money(r.invoice_total_claim,r.display_currency)+' · 未验真'}</p></td><td>${M.isHigh(r)?'明确要求敏感凭据':'凭据条件待核'}<p>${e(r.agency)}</p></td><td><button class="button detail-button" data-id="${e(r.id)}" type="button">详情</button></td></tr>`;}
  function cardMarkup(r,f){return `<article class="quote-card"><div class="card-head"><h3>${e(r.merchant)}</h3>${r.resale==='标准条款禁止转售'?'<span class="tag important">禁止转售</span>':''}</div><p class="small-note">${e(r.tier)} · 原号 · 单月</p><div>${priceMarkup(r,f)}</div><div class="card-meta"><div>发票<b>${e(invoiceLabel(r))}</b></div><div>凭据<b>${M.isHigh(r)?'Token / Session要求':'条件待核'}</b></div><div>付款<b>${e(r.payment_group)}</b></div><div>代理费<b>${e(r.agency)}</b></div></div><button class="button detail-button" type="button" data-id="${e(r.id)}">查看SKU证据与来源</button></article>`;}
  function renderQuotes(){
    const f=state(),groups=M.groups(d.records,f),count=groups.reduce((n,g)=>n+g.rows.length,0);
    $('result-count').textContent=`${count} 条报价 · ${groups.length} 个比较组`;
    $('active-filters').innerHTML=`<span class="tag">${e(basisNames[f.basis])} · 同组内排序</span>`+fields.filter(id=>!['q','basis','sort'].includes(id)&&f[id]).map(id=>`<span class="tag">${e($(id).selectedOptions[0].textContent)}</span>`).join('');
    $('table-view').setAttribute('aria-pressed',String(mode==='table'));$('card-view').setAttribute('aria-pressed',String(mode==='cards'));
    if(!count){$('quote-results').innerHTML='<div class="empty"><h3>没有符合条件的报价</h3><p>试着减少筛选条件，或重置后查看全部研究记录。</p><button class="button reset-button" type="button">重置全部筛选</button></div>';return;}
    $('quote-results').innerHTML=groups.map(g=>`<section class="group"><div class="group-title"><h3>${e(g.key.replace('1 month','单月').replace('own-account top-up','原号充值'))}</h3><span>${g.rows.length} 个SKU</span></div>${mode==='table'?`<div class="table-wrap" tabindex="0" role="region" aria-label="${e(g.key)}报价表"><table class="quote-table"><thead><tr><th scope="col">商家 / SKU</th><th scope="col">档位与周期</th><th scope="col">${e(basisNames[f.basis])}</th><th scope="col">发票证据</th><th scope="col">凭据与门槛</th><th scope="col">来源</th></tr></thead><tbody>${g.rows.map(r=>rowMarkup(r,f)).join('')}</tbody></table></div>`:`<div class="quote-cards">${g.rows.map(r=>cardMarkup(r,f)).join('')}</div>`}</section>`).join('');
  }
  fields.forEach(id=>$(id).addEventListener(id==='q'?'input':'change',renderQuotes));
  $('filters').addEventListener('submit',event=>event.preventDefault());
  $('filters').addEventListener('reset',()=>setTimeout(renderQuotes,0));
  $('table-view').addEventListener('click',()=>{mode='table';renderQuotes();});$('card-view').addEventListener('click',()=>{mode='cards';renderQuotes();});
  document.addEventListener('click',event=>{const reset=event.target.closest('.reset-button');if(reset){$('filters').reset();renderQuotes();}const detail=event.target.closest('.detail-button');if(detail)openDetail(detail.dataset.id);});
  let detailTrigger=null;
  function openDetail(id){
    detailTrigger=document.activeElement;
    const r=d.records.find(r=>r.id===id);if(!r)return;
    const pairs=[['套餐',r.tier],['周期',r.period],['记录ID',r.id],['观察时间',r.observed_at_utc],['证据轮次',r.snapshot],['支付方式',r.payment_method],['支付附加费',r.payment_fee],['付款预览（非成交）',r.payable_preview==null?null:money(r.payable_preview,r.display_currency)],['发票支持',r.invoice_supported_claim],['含票宣称 / 计算金额',r.invoice_total_claim==null?null:money(r.invoice_total_claim,r.display_currency)],['库存（当时页面）',r.stock],['最低数量',r.minimum_quantity],['官方授权',r.official_authorization_verified?'有核验记录':'未取得核验记录'],['付款资金来源',r.funding_source_verified?'有核验记录':'未取得核验记录'],['凭据风险',r.credential_risk],['再销售资格',r.resale]];
    $('detail-content').innerHTML=`<h2>${e(r.merchant)}</h2><p class="muted">${e(r.tier)} · ${e(r.id)}</p>${r.resale==='标准条款禁止转售'?'<div class="callout"><b>标准条款禁止转售</b><span>零售报价仅作自用研究；分销需独立书面授权或合同。</span></div>':''}<div class="detail-price"><span class="price">${money(r.display_price,r.display_currency)}</span><p class="small-note">公开展示价；未知费用没有填0，未完成成交或票据验真。</p></div><dl class="detail-grid">${pairs.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${value(v)}</dd></div>`).join('')}</dl><h3>SKU条件与费用缺口</h3>${textBody(r.notes)}${r.bulk_tiers?.length?disclosure('批量阶梯（不等于当前可下单）',textBody(JSON.stringify(r.bulk_tiers,null,2))):''}${r.diligence?disclosure('经营主体与发票证据',textBody(JSON.stringify(r.diligence,null,2))):''}<h3>历史修正</h3>${r.corrections.length?`<ul class="detail-evidence">${r.corrections.map(s=>`<li>${e(s)}</li>`).join('')}</ul>`:'<p class="small-note">未记录该SKU的第二轮专项修正；不代表已重新验真。</p>'}<h3>原始来源</h3><ol class="detail-sources">${r.source_urls.map(s=>`<li>${urlLink(s)}</li>`).join('')}</ol><p class="small-note"><a href="../research/2026-10-02.html">第一轮完整原文</a> · <a href="../research/2026-10-02-round2.html">第二轮完整原文</a></p>`;
    if(!$('detail').open)$('detail').showModal();$('detail').scrollTop=0;
  }
  $('detail').addEventListener('close',()=>{if(detailTrigger?.isConnected)detailTrigger.focus();});
  $('close-detail').addEventListener('click',()=>$('detail').close());
  $('detail').addEventListener('click',event=>{if(event.target===$('detail')&&event.clientX<$('detail').getBoundingClientRect().left)$('detail').close();});
  const candidates=[...d.invoice.prior_candidates,...d.invoice.new_candidates];
  const named = name => candidates.find(c=>c.merchant===name);
  const invoiceCompare=[['贝果科技',143.10,'商称6%规则计算','标准条款禁止转售；普/专未明；总费用未全核'],['WStorm AI',144.20,'商称3%规则计算','未完成含票结算预览；票种与主体未知'],['gongsi.one',165,'商称含票价','占位样张不是验真；法定主体与交易链待核'],['ProPlus.CV',192,'第一轮勾选开票界面','8%文案与192取整未解释；不是192.24']];
  let selectedMerchant='贝果科技';
  const compareRows=invoiceCompare.map(([name,total,kind,note])=>({name,total,kind,note,c:named(name)}));
  function selectMerchant(name,focus=false){
    selectedMerchant=name;renderComparison();document.querySelector(`[data-merchant="${name}"]`).focus();
    if(matchMedia('(max-width:1050px)').matches){
      const r=d.records.find(r=>M.merchantName(r)===name && r.tier.split(' / ')[0]==='Plus');
      if(r)openDetail(r.id);else{detailTrigger=document.activeElement;$('detail-content').innerHTML=$('sku-inspector').innerHTML+'<p class="small-note">第二轮票据候选，未作为第一轮45条SKU新增报价。</p>';if(!$('detail').open)$('detail').showModal();}
    }else if(focus)$('sku-inspector').focus();
  }
  function renderComparison(){
    const ledgerFields=[['主体声明',r=>r.c.legal_entity_merchant_claim?'商家声明':'未披露'],['实际收款方',()=> '未取得'],['真实票证',()=> '未取得'],['转售授权',r=>r.name==='贝果科技'?'禁止转售':'未取得']];
    $('comparison-matrix').innerHTML=`<div class="horizontal-scale"><span>人民币金额 · 同规格</span><span>0</span><span>100</span><span>200</span></div><div class="merchant-comparison">`+compareRows.map(r=>`<button type="button" class="evidence-row ${r.name===selectedMerchant?'selected':''}" data-merchant="${e(r.name)}" aria-pressed="${r.name===selectedMerchant}"><span class="supplier"><b>${e(r.name)}</b><small>Plus · 单件单月</small><span class="quote-kind">${e(r.kind)}</span></span><span class="price-plot" role="img" aria-label="${e(r.name)}：${r.total}人民币；金额轴从零至200"><span class="horizontal-bar" style="width:${r.total/200*100}%"></span></span><span class="amount-cell"><b>${money(r.total)}</b></span></button>`).join('')+`</div><div class="shared-plot" role="img" aria-label="四家Plus单件单月含票商称或计算金额，从零至200人民币；贝果143.10，WStorm144.20，gongsi.one165，ProPlus.CV192"><svg viewBox="0 0 800 170" preserveAspectRatio="none" aria-hidden="true">${compareRows.map((r,i)=>`<rect class="plot-selection" x="${i*200}" y="16" width="200" height="134" opacity="${r.name===selectedMerchant?1:0}"/>`).join('')}${[0,100,200].map(v=>`<path class="plot-grid" d="M0 ${150-v*.65}H800"/><text x="-30" y="${154-v*.65}">${v}</text>`).join('')}${compareRows.map((r,i)=>`<path class="plot-value" d="M${100+i*200} 150V${150-r.total*.65}"/><circle cx="${100+i*200}" cy="${150-r.total*.65}" r="4"/>`).join('')}</svg><p>金额依据不同，均非成交；票费与资格仍需核查</p></div><div class="evidence-ledger"><h3>经营资格与证据缺口</h3><table><thead><tr><th scope="col">证据字段</th>${compareRows.map(r=>`<th scope="col">${e(r.name)}</th>`).join('')}</tr></thead><tbody>${ledgerFields.map(([label,get])=>`<tr><th scope="row">${label}</th>${compareRows.map(r=>`<td class="${label==='转售授权'&&r.name==='贝果科技'?'prohibited':'unknown'}">${get(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const r=compareRows.find(r=>r.name===selectedMerchant),c=r.c;
    $('sku-inspector').tabIndex=-1;
    $('sku-inspector').innerHTML=`<h2>${e(r.name)} / ${e(c.tier)}</h2><div class="inspector-amount">${money(r.total)}<span>${e(r.kind)}，非成交</span></div>${r.name==='贝果科技'?'<p class="restriction">标准条款禁止转售</p>':'<p class="unknown">转售授权：未取得</p>'}<p class="inspector-note">${e(r.note)}</p><dl><div><dt>票种</dt><dd>${value(c.invoice_type)}</dd></div><div><dt>主体（商称）</dt><dd>${value(c.legal_entity_merchant_claim)}</dd></div><div><dt>实际收款方</dt><dd>未取得</dd></div><div><dt>真实票证</dt><dd>未取得，未验真</dd></div></dl><h3>来源链接</h3>${c.urls.map(u=>`<p class="inspector-source">${urlLink(u)}</p>`).join('')}<h3>证据时间</h3><p class="small-note">第二轮 2026-10-02 06:26–06:38 UTC</p><a class="button" href="#quotes">展开完整SKU条件</a>`;
  }
  $('comparison-matrix').addEventListener('click',ev=>{const r=ev.target.closest('[data-merchant]');if(r)selectMerchant(r.dataset.merchant);});
  $('comparison-matrix').addEventListener('keydown',ev=>{const r=ev.target.closest('[data-merchant]');if(!r || !['ArrowDown','ArrowUp','Home','End'].includes(ev.key))return;ev.preventDefault();const i=compareRows.findIndex(x=>x.name===r.dataset.merchant),n=ev.key==='Home'?0:ev.key==='End'?3:(i+(ev.key==='ArrowDown'?1:-1)+4)%4;selectedMerchant=compareRows[n].name;renderComparison();document.querySelector(`[data-merchant="${selectedMerchant}"]`).focus();});
  $('pending-quotes').innerHTML=[['HuiAI','¥133：含票总额未知'],['PAYPRM','¥155：含票总额未知'],['token5555','¥159.90：付款预览，票费未知'],['PlusGO','¥169：普通SKU不提供发票']].map(([n,t])=>`<div class="pending-row"><b>${n}</b><span>${t}</span></div>`).join('');
  $('overview-timeline').innerHTML=d.timeline.map(t=>`<a class="pending-row" href="${e(t.url)}"><time>${e(t.time)}</time><span>${e(t.title)}</span></a>`).join('');
  renderComparison();
  const invoicePanel=document.createElement('section');invoicePanel.className='panel';invoicePanel.id='invoice-evidence';
  invoicePanel.innerHTML=`<div class="section-heading"><h2>Plus 单件单月 · 含票证据对照</h2><a href="#invoice-matrix">9家证据矩阵 →</a></div><p class="small-note">以下为人民币商称或计算金额。费用未全核、未成交、未取得可验真票证，不能称为“正规发票最低价”。</p><div class="invoice-compare">${invoiceCompare.map(([name,total,kind,note])=>`<article class="invoice-tile"><h3>${e(name)}</h3><span class="price">${money(total)}</span><span class="tag">${e(kind)}</span><p>${e(note)}</p>${urlLink(named(name).urls[0],'查看原始来源 ↗')}</article>`).join('')}</div><p class="small-note">HuiAI优惠后133、PAYPRM155、token5555付款预览159.90：含票费用未知，不参与以上比较。PlusGO169普通购买SKU不提供发票，企业报价须另议。</p>${disclosure('9家候选：主体、票种、金额与经营资格',`<div class="table-wrap" tabindex="0"><table class="invoice-matrix"><thead><tr><th>商家</th><th>金额证据</th><th>票种 / 主体</th><th>经营判断与缺口</th><th>来源</th></tr></thead><tbody>${candidates.map(c=>`<tr><td><b>${e(c.merchant)}</b><p>${e(c.tier)}</p></td><td>${value(c.invoice_total_calculated_cny ?? c.invoice_total_prior_ui_cny ?? c.invoice_total_merchant_claim_cny)}<p>商称 / 计算 / 界面，未验真</p></td><td>${value(c.invoice_type)}<p>${value(c.legal_entity_merchant_claim ?? c.invoice_issuer)}</p><p>税号 / 实收主体 / 验真：未取得</p></td><td>${e(c.decision)}</td><td>${c.urls.map((u,i)=>urlLink(u,`来源${i+1}`)).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`,'invoice-matrix')}`;
  const supplement=document.createElement('details');supplement.className='supplementary';supplement.innerHTML='<summary>独立票据补充资料 · 不受上方SKU筛选影响</summary><div class="disclosure-body">'+invoicePanel.innerHTML+'</div>';invoicePanel.replaceChildren(supplement);
  $('quote-results').after(invoicePanel);
  const routes=d.routes.routes;
  const routeField=(r,pattern)=>r.detail.split('\n').find(s=>pattern.test(s))||'详见完整路线条件';
  $('route-content').innerHTML=`<section class="panel"><h2>${routes.length}条路线 · 权利与门槛</h2><p class="small-note">展开每条路线查看真实地区、身份、最低投入和商业权利。所见最低充值是试用资金，不代表生产容量。</p>${disclosure('11路线对照矩阵',`<div class="table-wrap" tabindex="0"><table class="invoice-matrix"><thead><tr><th>路线</th><th>产品与权利</th><th>地区与客户</th><th>最低投入 / 折扣</th></tr></thead><tbody>${routes.map(r=>`<tr><td>${e(r.id)} · ${e(r.route)}</td><td>${e(routeField(r,/^权利|^产品/))}</td><td>${e(routeField(r,/^主体|^客户|^地区/))}</td><td>${e(routeField(r,/^最低|^投入|^折扣/))}</td></tr>`).join('')}</tbody></table></div>`)}</section>`+routes.map(r=>disclosure(`${r.id} · ${r.route}`,textBody(r.detail)+`<div class="route-sources">${d.routes.sources.filter(s=>r.detail.includes(s.id)).map(s=>`<p>${urlLink(s.url,s.name)}</p>`).join('')}</div><p class="small-note"><a href="#sources">查看全部来源索引</a></p>`)).join('')+disclosure('重要边界',textBody(typeof d.routes.important_limits==='string'?d.routes.important_limits:JSON.stringify(d.routes.important_limits,null,2)))+disclosure('路线引用的官方来源',d.routes.sources.map(s=>`<p>${e(s.id)} · ${urlLink(s.url,s.name)}</p>`).join(''));
  $('route-content').querySelector('details').open=true;
  const routeDetails=[...$('route-content').children].filter(n=>n.tagName==='DETAILS');routes.forEach((r,i)=>routeDetails[i].id='route-'+r.id);
  const routeIndex=document.createElement('div');routeIndex.className='route-index';routeIndex.innerHTML=routes.map(r=>`<a href="#route-${e(r.id)}"><b>${e(r.route)}</b><span>查看权利、地区与投入条件</span></a>`).join('');$('route-content').prepend(routeIndex);
  $('phone-content').innerHTML=d.phone.map((s,i)=>disclosure(s.heading,textBody(s.text),`phone-section-${i}`)).join('')+`<p class="small-note"><a href="../research/2026-10-02.html#phone">成品号核查完整原文</a></p>`;
  function claudeSection(s){let body=(s.paragraphs||[]).map(p=>`<p class="prose">${linked(p)}</p>`).join('');if(s.table)body+=`<div class="table-wrap" tabindex="0"><table class="summary-table"><thead><tr>${s.table.headers.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(row=>`<tr>${row.map(v=>`<td class="prose">${linked(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;if(s.note)body+=`<p class="small-note">${linked(s.note)}</p>`;return disclosure(s.heading,body);}
  const tutorial=d.claude.sections.filter(s=>/新手|Windows/.test(s.heading)), procurement=d.claude.sections.filter(s=>!tutorial.includes(s));
  $('claude-content').innerHTML=`<div class="callout"><b>采购与计费</b><span>${e(d.claude.summary)}</span></div>${procurement.map(claudeSection).join('')}<section class="panel" id="tutorial"><p class="eyebrow">独立使用入口</p><h2>Claude Code 新手教程</h2><p class="small-note">先核对官方资格和真实计费方式，再按原研究操作清单阅读。</p></section>${tutorial.map(claudeSection).join('')}${disclosure('Claude官方来源',d.claude.sources.map(s=>`<p>${e(s[0])} · ${urlLink(s[2],s[1])} · ${e(s[3])}</p>`).join(''))}`;
  $('claude-content').querySelector('details').open=true;
  const claudeBoundary=$('claude-content').querySelector('.callout');const claudeLimits=document.createElement('details');claudeLimits.className='quote-boundary';claudeLimits.innerHTML='<summary>采购资格与计费边界</summary><p>'+e(d.claude.summary)+'</p>';claudeBoundary.replaceWith(claudeLimits);
  document.querySelectorAll('.summary-table').forEach(t=>{const hs=[...t.querySelectorAll('th')].map(h=>h.textContent);t.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((td,i)=>td.dataset.label=hs[i]));});
  $('timeline-content').innerHTML=`<section class="panel"><h2>实际证据时间线</h2><div class="timeline">${d.timeline.map(t=>`<article><time>${e(t.time)}</time><h3>${e(t.title)}</h3><p>${e(t.text)}</p><a href="${e(t.url)}">完整记录 →</a></article>`).join('')}</div></section><section class="panel"><h2>待办：一次问齐的书面询证</h2><p class="small-note">研究建议，尚未联系商家。没有自动发出询证或收集资料。</p><ol class="inquiry-list">${d.invoice.written_inquiry_pack.map(t=>`<li>${e(t)}</li>`).join('')}</ol></section>${candidates.filter(c=>c.new_material_evidence?.length).map(c=>disclosure(`${c.merchant} · 第二轮修正`,c.new_material_evidence.map(t=>`<p class="prose">${e(t)}</p>`).join('')+c.urls.map(u=>`<p>${urlLink(u)}</p>`).join(''))).join('')}`;
  function renderSources(){const q=$('source-search').value.trim().toLowerCase(),sources=d.sources.filter(s=>s.toLowerCase().includes(q));$('source-count').textContent=`${sources.length} / ${d.sources.length} 个去重来源URL`;$('source-content').innerHTML=sources.length?sources.map(s=>`<div class="source-row"><span>${String(d.sources.indexOf(s)+1).padStart(3,'0')}</span>${urlLink(s)}</div>`).join(''):'<div class="empty"><h3>没有匹配来源</h3><p>减少域名或关键词，再试一次。</p><button type="button" class="button" id="reset-sources">清空搜索</button></div>';}
  $('source-search').addEventListener('input',renderSources);$('source-content').addEventListener('click',event=>{if(event.target.id==='reset-sources'){$('source-search').value='';renderSources();}});
  function navigate(){if($('detail').open)$('detail').close();const hash=decodeURIComponent(location.hash.slice(1)),page=labels[hash]?hash:hash.startsWith('route-')?'routes':hash==='tutorial'?'claude':hash==='troubleshooting'?'phone':hash==='invoice-matrix'||hash==='invoice-evidence'?'quotes':'workbench';document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==page);document.querySelectorAll('[data-page]').forEach(a=>{if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.querySelectorAll('[data-module]').forEach(a=>{if(a.dataset.module===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.querySelectorAll('[data-workspace]').forEach(a=>{if(a.dataset.workspace===page||(a.dataset.workspace==='overview'&&!['workbench','library','websites','tasks'].includes(page)))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});moduleNav.hidden=['workbench','library','websites','tasks'].includes(page);document.body.dataset.area=moduleNav.hidden?'workspace':'research';if(settings.open)settings.close();$('breadcrumb').textContent=labels[page];const catalogPage=['workbench','library','websites','tasks'].includes(page);$('header-download').href=catalogPage?'catalog.json':'data.json';$('header-download').textContent=catalogPage?'下载公开目录':'下载研究数据';closeNav();closeFilters();if(hash!==page&&$(hash)){if($(hash).tagName==='DETAILS')$(hash).open=true;let ancestor=$(hash).parentElement;while(ancestor){if(ancestor.tagName==='DETAILS')ancestor.open=true;ancestor=ancestor.parentElement;}if(hash==='invoice-evidence')$(hash).querySelector('details').open=true;if(hash==='tutorial'){let n=$(hash).nextElementSibling;for(let i=0;i<2&&n;i++,n=n.nextElementSibling)if(n.tagName==='DETAILS')n.open=true;}requestAnimationFrame(()=>$(hash).scrollIntoView());}else{window.scrollTo(0,0);if(document.readyState==='loading')addEventListener('load',()=>window.scrollTo(0,0),{once:true});}}
  window.addEventListener('hashchange',navigate);
  renderQuotes();renderSources();navigate();
})();
