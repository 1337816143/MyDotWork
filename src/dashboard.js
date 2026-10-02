/* Shared, deterministic comparison model. No requests, storage, or telemetry. */
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
  const labels = {overview:'研究总览',quotes:'低价供货与发票',routes:'源头与自主供货',phone:'成品号与手机验证',claude:'Claude Code',timeline:'任务与历史修正',sources:'来源索引'};
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
  const filterOpen = document.createElement('button'); filterOpen.type='button';filterOpen.className='button mobile-only';filterOpen.id='open-filters';filterOpen.textContent='筛选与排序';filterOpen.setAttribute('aria-expanded','false');filterOpen.setAttribute('aria-controls','filters');
  $('filters').before(filterOpen);
  const filterClose=document.createElement('button');filterClose.type='button';filterClose.className='mobile-close';filterClose.textContent='×';filterClose.setAttribute('aria-label','完成筛选并返回结果');$('filters').prepend(filterClose);
  filterOpen.addEventListener('click',()=>{$('filters').classList.add('open');filterOpen.setAttribute('aria-expanded','true');$('filters').setAttribute('role','dialog');$('filters').setAttribute('aria-modal','true');$('q').focus();});
  function closeFilters(){ $('filters').classList.remove('open');filterOpen.setAttribute('aria-expanded','false');$('filters').setAttribute('role','search');$('filters').removeAttribute('aria-modal'); }
  filterClose.addEventListener('click',()=>{closeFilters();filterOpen.focus();});
  const filterDone=document.createElement('button');filterDone.type='button';filterDone.className='button primary mobile-only';filterDone.textContent='完成筛选 · 查看结果';$('filters').querySelector('.filter-footer').append(filterDone);filterDone.addEventListener('click',()=>{closeFilters();$('result-count').scrollIntoView({behavior:'instant',block:'start'});});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeNav();closeFilters();}
    const container=$('filters').classList.contains('open') ? $('filters') : sidebar.classList.contains('open') ? sidebar : null;
    if(container && event.key==='Tab'){
      const nodes=[...container.querySelectorAll('a,button,input,select')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  const stats = [
    [d.records.length,'第一轮报价记录','按原研究45条SKU记录，保留修正'],
    [new Set(d.records.map(M.merchantName)).size,'商家展示名','不是法人数或独立供货来源数'],
    [d.invoice.prior_candidates.length+d.invoice.new_candidates.length,'发票候选商家','第二轮主体与票证待核'],
    [d.routes.routes.length,'采购 / 经营路线','个人会员与API商业应用分开']
  ];
  $('metrics').innerHTML=stats.map(([n,label,note])=>`<div class="metric"><span>${e(label)}</span><b>${n}</b><small>${e(note)}</small></div>`).join('');
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
  function openDetail(id){
    const r=d.records.find(r=>r.id===id);if(!r)return;
    const pairs=[['套餐',r.tier],['周期',r.period],['记录ID',r.id],['观察时间',r.observed_at_utc],['证据轮次',r.snapshot],['支付方式',r.payment_method],['支付附加费',r.payment_fee],['付款预览（非成交）',r.payable_preview==null?null:money(r.payable_preview,r.display_currency)],['发票支持',r.invoice_supported_claim],['含票宣称 / 计算金额',r.invoice_total_claim==null?null:money(r.invoice_total_claim,r.display_currency)],['库存（当时页面）',r.stock],['最低数量',r.minimum_quantity],['官方授权',r.official_authorization_verified?'有核验记录':'未取得核验记录'],['付款资金来源',r.funding_source_verified?'有核验记录':'未取得核验记录'],['凭据风险',r.credential_risk],['再销售资格',r.resale]];
    $('detail-content').innerHTML=`<h2>${e(r.merchant)}</h2><p class="muted">${e(r.tier)} · ${e(r.id)}</p>${r.resale==='标准条款禁止转售'?'<div class="callout"><b>标准条款禁止转售</b><span>零售报价仅作自用研究；分销需独立书面授权或合同。</span></div>':''}<div class="detail-price"><span class="price">${money(r.display_price,r.display_currency)}</span><p class="small-note">公开展示价；未知费用没有填0，未完成成交或票据验真。</p></div><dl class="detail-grid">${pairs.map(([k,v])=>`<div><dt>${e(k)}</dt><dd>${value(v)}</dd></div>`).join('')}</dl><h3>SKU条件与费用缺口</h3>${textBody(r.notes)}${r.bulk_tiers?.length?disclosure('批量阶梯（不等于当前可下单）',textBody(JSON.stringify(r.bulk_tiers,null,2))):''}${r.diligence?disclosure('经营主体与发票证据',textBody(JSON.stringify(r.diligence,null,2))):''}<h3>历史修正</h3>${r.corrections.length?`<ul class="detail-evidence">${r.corrections.map(s=>`<li>${e(s)}</li>`).join('')}</ul>`:'<p class="small-note">未记录该SKU的第二轮专项修正；不代表已重新验真。</p>'}<h3>原始来源</h3><ol class="detail-sources">${r.source_urls.map(s=>`<li>${urlLink(s)}</li>`).join('')}</ol><p class="small-note"><a href="../research/2026-10-02.html">第一轮完整原文</a> · <a href="../research/2026-10-02-round2.html">第二轮完整原文</a></p>`;
    $('detail').showModal();$('detail').scrollTop=0;
  }
  $('close-detail').addEventListener('click',()=>$('detail').close());
  $('detail').addEventListener('click',event=>{if(event.target===$('detail')&&event.clientX<$('detail').getBoundingClientRect().left)$('detail').close();});
  const candidates=[...d.invoice.prior_candidates,...d.invoice.new_candidates];
  const named = name => candidates.find(c=>c.merchant===name);
  const invoiceCompare=[['贝果科技',143.10,'商称6%规则计算','标准条款禁止转售；普/专未明；总费用未全核'],['WStorm AI',144.20,'商称3%规则计算','未完成含票结算预览；票种与主体未知'],['gongsi.one',165,'商称含票价','占位样张不是验真；法定主体与交易链待核'],['ProPlus.CV',192,'第一轮勾选开票界面','8%文案与192取整未解释；不是192.24']];
  const tiles=invoiceCompare.map(([name,total,kind,note])=>`<article class="invoice-tile"><h3>${e(name)}</h3><span class="price">${money(total)}</span><span class="tag">${e(kind)}</span><p>${e(note)}</p>${urlLink(named(name).urls[0],'原始来源 ↗')}</article>`).join('');
  const overview=$('overview'),columns=overview.querySelector('.overview-columns'),modules=overview.querySelector('.module-grid'),moduleHeading=modules.previousElementSibling;
  columns.before(moduleHeading,modules);
  const summary=document.createElement('div');summary.className='callout';summary.innerHTML='<b>当前结论</b><span>含票报价尚未验真；贝果标准条款禁止转售。自用采购与经营分销分开判断。</span>';overview.querySelector('.metrics').before(summary);
  columns.querySelector('.panel').innerHTML=`<div class="section-heading"><h2>Plus 单件单月 · 含票金额</h2><a href="#invoice-evidence">比较全部证据 →</a></div><p class="small-note">人民币商称 / 规则计算 / 界面金额，费用未全核；非成交、非验真。</p><div class="invoice-compare">${tiles}</div><p class="small-note">HuiAI133、PAYPRM155与token5555预览159.90的票费未知，不参与含票金额比较。</p>`;
  const invoicePanel=document.createElement('section');invoicePanel.className='panel';invoicePanel.id='invoice-evidence';
  invoicePanel.innerHTML=`<div class="section-heading"><h2>Plus 单件单月 · 含票证据对照</h2><a href="#invoice-matrix">9家证据矩阵 →</a></div><p class="small-note">以下为人民币商称或计算金额。费用未全核、未成交、未取得可验真票证，不能称为“正规发票最低价”。</p><div class="invoice-compare">${invoiceCompare.map(([name,total,kind,note])=>`<article class="invoice-tile"><h3>${e(name)}</h3><span class="price">${money(total)}</span><span class="tag">${e(kind)}</span><p>${e(note)}</p>${urlLink(named(name).urls[0],'查看原始来源 ↗')}</article>`).join('')}</div><p class="small-note">HuiAI优惠后133、PAYPRM155、token5555付款预览159.90：含票费用未知，不参与以上比较。PlusGO169普通购买SKU不提供发票，企业报价须另议。</p>${disclosure('9家候选：主体、票种、金额与经营资格',`<div class="table-wrap" tabindex="0"><table class="invoice-matrix"><thead><tr><th>商家</th><th>金额证据</th><th>票种 / 主体</th><th>经营判断与缺口</th><th>来源</th></tr></thead><tbody>${candidates.map(c=>`<tr><td><b>${e(c.merchant)}</b><p>${e(c.tier)}</p></td><td>${value(c.invoice_total_calculated_cny ?? c.invoice_total_prior_ui_cny ?? c.invoice_total_merchant_claim_cny)}<p>商称 / 计算 / 界面，未验真</p></td><td>${value(c.invoice_type)}<p>${value(c.legal_entity_merchant_claim ?? c.invoice_issuer)}</p><p>税号 / 实收主体 / 验真：未取得</p></td><td>${e(c.decision)}</td><td>${c.urls.map((u,i)=>urlLink(u,`来源${i+1}`)).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`,'invoice-matrix')}`;
  $('filters').before(invoicePanel);
  const routes=d.routes.routes;
  const routeField=(r,pattern)=>r.detail.split('\n').find(s=>pattern.test(s))||'详见完整路线条件';
  $('route-content').innerHTML=`<section class="panel"><h2>${routes.length}条路线 · 权利与门槛</h2><p class="small-note">展开每条路线查看真实地区、身份、最低投入和商业权利。所见最低充值是试用资金，不代表生产容量。</p>${disclosure('11路线对照矩阵',`<div class="table-wrap" tabindex="0"><table class="invoice-matrix"><thead><tr><th>路线</th><th>产品与权利</th><th>地区与客户</th><th>最低投入 / 折扣</th></tr></thead><tbody>${routes.map(r=>`<tr><td>${e(r.id)} · ${e(r.route)}</td><td>${e(routeField(r,/^权利|^产品/))}</td><td>${e(routeField(r,/^主体|^客户|^地区/))}</td><td>${e(routeField(r,/^最低|^投入|^折扣/))}</td></tr>`).join('')}</tbody></table></div>`)}</section>`+routes.map(r=>disclosure(`${r.id} · ${r.route}`,textBody(r.detail)+`<p class="small-note"><a href="#sources">查看全部来源索引</a></p>`)).join('')+disclosure('重要边界',textBody(typeof d.routes.important_limits==='string'?d.routes.important_limits:JSON.stringify(d.routes.important_limits,null,2)))+disclosure('路线引用的官方来源',d.routes.sources.map(s=>`<p>${e(s.id)} · ${urlLink(s.url,s.name)}</p>`).join(''));
  $('phone-content').innerHTML=d.phone.map((s,i)=>disclosure(s.heading,textBody(s.text),`phone-section-${i}`)).join('')+`<p class="small-note"><a href="../research/2026-10-02.html#phone">成品号核查完整原文</a></p>`;
  function claudeSection(s){let body=(s.paragraphs||[]).map(p=>`<p class="prose">${linked(p)}</p>`).join('');if(s.table)body+=`<div class="table-wrap" tabindex="0"><table class="summary-table"><thead><tr>${s.table.headers.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(row=>`<tr>${row.map(v=>`<td class="prose">${linked(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;if(s.note)body+=`<p class="small-note">${linked(s.note)}</p>`;return disclosure(s.heading,body);}
  const tutorial=d.claude.sections.filter(s=>/新手|Windows/.test(s.heading)), procurement=d.claude.sections.filter(s=>!tutorial.includes(s));
  $('claude-content').innerHTML=`<div class="callout"><b>采购与计费</b><span>${e(d.claude.summary)}</span></div>${procurement.map(claudeSection).join('')}<section class="panel" id="tutorial"><p class="eyebrow">独立使用入口</p><h2>Claude Code 新手教程</h2><p class="small-note">先核对官方资格和真实计费方式，再按原研究操作清单阅读。</p></section>${tutorial.map(claudeSection).join('')}${disclosure('Claude官方来源',d.claude.sources.map(s=>`<p>${e(s[0])} · ${urlLink(s[2],s[1])} · ${e(s[3])}</p>`).join(''))}`;
  $('timeline-content').innerHTML=`<section class="panel"><h2>实际证据时间线</h2><div class="timeline">${d.timeline.map(t=>`<article><time>${e(t.time)}</time><h3>${e(t.title)}</h3><p>${e(t.text)}</p><a href="${e(t.url)}">完整记录 →</a></article>`).join('')}</div></section><section class="panel"><h2>待办：一次问齐的书面询证</h2><p class="small-note">研究建议，尚未联系商家。没有自动发出询证或收集资料。</p><ol class="inquiry-list">${d.invoice.written_inquiry_pack.map(t=>`<li>${e(t)}</li>`).join('')}</ol></section>${candidates.filter(c=>c.new_material_evidence?.length).map(c=>disclosure(`${c.merchant} · 第二轮修正`,c.new_material_evidence.map(t=>`<p class="prose">${e(t)}</p>`).join('')+c.urls.map(u=>`<p>${urlLink(u)}</p>`).join(''))).join('')}`;
  function renderSources(){const q=$('source-search').value.trim().toLowerCase(),sources=d.sources.filter(s=>s.toLowerCase().includes(q));$('source-count').textContent=`${sources.length} / ${d.sources.length} 个去重来源URL`;$('source-content').innerHTML=sources.length?sources.map(s=>`<div class="source-row"><span>${String(d.sources.indexOf(s)+1).padStart(3,'0')}</span>${urlLink(s)}</div>`).join(''):'<div class="empty"><h3>没有匹配来源</h3><p>减少域名或关键词，再试一次。</p><button type="button" class="button" id="reset-sources">清空搜索</button></div>';}
  $('source-search').addEventListener('input',renderSources);$('source-content').addEventListener('click',event=>{if(event.target.id==='reset-sources'){$('source-search').value='';renderSources();}});
  function navigate(){const hash=decodeURIComponent(location.hash.slice(1)),page=labels[hash]?hash:hash==='tutorial'?'claude':hash==='troubleshooting'?'phone':hash==='invoice-matrix'||hash==='invoice-evidence'?'quotes':'overview';document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==page);document.querySelectorAll('[data-page]').forEach(a=>{if(a.dataset.page===page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('breadcrumb').textContent=labels[page];closeNav();closeFilters();if(hash!==page&&$(hash))requestAnimationFrame(()=>$(hash).scrollIntoView());else window.scrollTo(0,0);}
  window.addEventListener('hashchange',navigate);
  renderQuotes();renderSources();navigate();
})();
