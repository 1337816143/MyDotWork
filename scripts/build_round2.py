"""Dated corrections and explicit commercial eligibility, separate from price."""
import json
from html import escape
from pathlib import Path
from build_archive import page

def build_round2(root, out, version, linked):
    source=root/'data/research-2026-10-02-round2.json'
    d=json.loads(source.read_text())
    folder=out/'research';folder.mkdir(exist_ok=True)
    (folder/'2026-10-02-round2.json').write_bytes(source.read_bytes())
    body='''<section class="panel notice"><h2>仍在进行中：先区分经营资格，再比较价格</h2><p>AI上游调研包括四个子任务：ChatGPT低价与发票、真正源头与自主供货、成品号与手机验证、Claude Code。找到资料或完成一轮核查不代表研究结束。</p><p>本轮没有供应商达到“大陆正规发票已验真且个人会员转售授权已核实”的标准。未注册、联系、付款、提交身份或账号资料。</p><p><a href="2026-10-02-round2.json" download>下载第二轮结构化资料</a> · <a href="2026-10-02.html">保留的06:18首轮快照</a></p></section><section class="panel" id="corrections"><h2>两项重要修正</h2><p><b>贝果：</b>06:35:46读取其2026-10-01版标准条款，第5节禁止转售倒卖。143.10元仍只是商家规则计算的自用购入含票支出，不能列作已授权分销的上游成本；分销需要独立书面授权。</p><p><b>麦门Pro200：</b>06:32:48新正文不再出现首轮“过去30天有20x”条件，并宣称新老号可充；同页20x与200美元10x又相矛盾。不能继续把旧条件当现行确定限制，也不能保证新20x额度。卡充1250含普票与iOS1550是不同SKU。</p><p class="meta">首次快照原文和来源时间保留；以上是后来发现的修正，不倒改历史记录。</p></section><section class="panel"><h2>票据候选：经营资格独立筛选</h2><p>只在同SKU组内按已知商称含票金额排序，未知后置。计算值、界面报价和真实已验发票分别标明；价格低不能覆盖禁止转售或授权未知。</p><div class="controls"><label for="eligibility">经营资格</label><select id="eligibility"><option value="all">全部候选</option><option value="authorized">转售授权已核实</option><option value="restricted">标准条款禁止转售</option><option value="unknown">未取得转售授权证据</option></select><label for="cost-order">价格顺序</label><select id="cost-order"><option value="asc">同SKU已知含票金额升序</option><option value="desc">同SKU已知含票金额降序</option></select><span id="eligibility-count" role="status"></span></div><div style="overflow:auto"><table style="border-collapse:collapse;width:100%;min-width:850px"><thead><tr>'''
    for h in ['渠道 / SKU','商称含票支出','数值证据','经营资格','当前边界']:
        body+='<th style="padding:12px;border:1px solid #cfdae0;text-align:left">'+h+'</th>'
    body+='</tr></thead><tbody id="invoice-rows">'
    records=d['invoice']['prior_candidates']+d['invoice']['new_candidates']
    rows=[]
    for item in records:
        merchant=item['merchant'];total=item.get('invoice_total_merchant_claim_cny')
        if isinstance(total,dict):
            for key,cost in total.items():rows.append((merchant,'Pro100' if key=='pro100' else 'Pro200',cost,'含普票SKU自述；非发票验真',item['decision']))
            continue
        cost=item.get('invoice_total_calculated_cny',item.get('invoice_total_prior_ui_cny',total))
        kind='商家费率计算；非实际结算' if 'invoice_total_calculated_cny' in item else ('勾选票后的界面192；非192.24' if merchant=='ProPlus.CV' else ('商称已含票；未验真' if cost is not None else '票费/含票条件未知，不填0'))
        rows.append((merchant,'Plus',cost,kind,item['decision']))
    for merchant,sku,cost,kind,decision in rows:
        eligibility='restricted' if merchant=='贝果科技' else 'unknown'
        label='标准条款禁止转售，需独立书面授权' if eligibility=='restricted' else '未取得转售授权证据'
        value=f'¥{cost:.2f}' if cost is not None else '未知'
        body+=f'<tr data-sku="{sku}" data-cost="{cost if cost is not None else ""}" data-eligibility="{eligibility}">'+''.join('<td style="padding:12px;border:1px solid #cfdae0;vertical-align:top">'+escape(t)+'</td>' for t in [merchant+' / '+sku,value,kind,label,decision])+'</tr>'
    body+='</tbody></table></div><p class="meta">“转售授权已核实”目前没有结果是实际证据状态，不是筛选故障。麦门两档与Plus分组，不跨档抢“最低”。</p></section>'
    for key,title in [('invoiceText','第二轮发票、主体与售后全文'),('bigolabTermsText','贝果条款核查'),('routesText','11条上游路线与55个来源'),('giftcardText','OpenAI品牌礼卡商业分销补充')]:
        body+='<section class="panel"><h2>'+title+'</h2><div style="white-space:pre-wrap;overflow-wrap:anywhere">'+linked(d[key])+'</div></section>'
    script='''<script>(()=>{const body=document.getElementById('invoice-rows'),rows=[...body.querySelectorAll('tr')],purpose=document.getElementById('eligibility'),order=document.getElementById('cost-order'),status=document.getElementById('eligibility-count'),rank={Plus:0,Pro100:1,Pro200:2};function render(){let n=0;rows.sort((a,b)=>{const group=rank[a.dataset.sku]-rank[b.dataset.sku];if(group)return group;const ac=a.dataset.cost,bc=b.dataset.cost;if(ac==='')return bc===''?0:1;if(bc==='')return -1;return (Number(ac)-Number(bc))*(order.value==='desc'?-1:1)});rows.forEach(row=>{row.hidden=purpose.value!=='all'&&purpose.value!==row.dataset.eligibility;body.appendChild(row);if(!row.hidden)n++});status.textContent=n+' / '+rows.length+' 条'}purpose.addEventListener('change',render);order.addEventListener('change',render);render()})();</script>'''
    (folder/'2026-10-02-round2.html').write_text(page('AI上游调研 · 第二轮','票据主体与转售限制、真正源头的11条路线，以及明确保留时间的修正',body,version,script))
