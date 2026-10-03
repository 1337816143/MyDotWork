"""Build an offline workbench from reviewed research snapshots and an explicit public catalogue."""
import copy
import json
import re
from pathlib import Path
from build_catalog import load_catalog

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD_ARTIFACTS = ['dashboard/index.html', 'dashboard/data.json', 'dashboard/catalog.json']


def dataset():
    first = json.loads((ROOT / 'data/research-2026-10-02.json').read_text(encoding='utf-8'))
    second = json.loads((ROOT / 'data/research-2026-10-02-round2.json').read_text(encoding='utf-8'))
    records = copy.deepcopy(first['supplyRecords']['records'])
    candidates = second['invoice']['prior_candidates'] + second['invoice']['new_candidates']
    for r in records:
        r['snapshot'] = '第一轮 06:18 UTC'
        r['agency'] = '未见代理费前置' if r.get('minimum_quantity') == 1 else '未知'
        r['agency_verified'] = False
        r['resale'] = '未取得书面分销授权'
        r['corrections'] = []
        match = next((c for c in candidates if c['merchant'] in r['merchant']), None)
        if match and match['merchant'] == '麦门商店' and r['id'] not in ['maimen-pro100-invoice', 'maimen-pro200-invoice']:
            match = None
        if match and match['merchant'] == 'ProPlus.CV' and r['id'] != 'proplus-plus':
            match = None
        if match and match['merchant'] == '贝果科技' and r['id'] != 'bigo-plus':
            match = dict(merchant=match['merchant'],
                         legal_entity_merchant_claim=match['legal_entity_merchant_claim'],
                         urls=['https://bigolab.com/terms'],
                         decision='标准条款禁止转售；其他SKU价格仍为第一轮快照，第二轮没有逐项复核。',
                         new_material_evidence=['第二轮标准条款明确禁止转售倒卖；工商与实际票证未验真。'])
        if match:
            r['diligence'] = match
            r['resale'] = '标准条款禁止转售' if match['merchant'] == '贝果科技' else r['resale']
            r['snapshot'] = '第一轮报价 / 第二轮专项证据，非全面复核'
            r['corrections'] = match.get('new_material_evidence', [])
        # These corrections affect the exact SKU, not every product of a merchant.
        if r['id'] == 'maimen-pro200-invoice':
            r['tier'] = 'Pro 200 / 商称20x与10x矛盾'
            r['stock'] = 49
            r['notes'] = '第二轮当前无Plus/Go/Pro前提仍在；旧过去30天20x限制已不在当前正文。新号/老号恢复20x与同页10x说法冲突，权益未获官方保证。卡充含普票1250；iOS含票1550为不同SKU。'
        if r['id'] == 'bigo-plus-ios':
            r['stock'] = '补货中（第二轮）'
    for r in records:
        r['sku_group'] = r['tier'].split(' / ')[0] + (' · 续费资格' if 'renew' in r['id'] else ' · 资格待核' if r['tier'].startswith('Pro 200') else '')
        r['payment_group'] = 'USDT成本未闭合' if 'USDT' in str(r.get('payment_method', '')).upper() else ('人民币预览' if isinstance(r.get('payable_preview'), (int, float)) else '人民币通道 · 总额待核') if r.get('display_currency') == 'CNY' and 'Alipay' in str(r.get('payment_method')) else '通道或费用待核'
        r['price_evidence'] = '计算值 / 商家宣称' if r.get('invoice_total_claim') is not None else '展示价 / 总成本未知'
    # Index source URLs from research only. Chat records never feed dashboard metrics.
    sources = sorted(set(re.findall(r'https?://[^\s<>"\\]+', json.dumps([first, second], ensure_ascii=False))))
    sources = [s.rstrip('。，；：）)]}') for s in sources]
    sources = sorted(set(sources))
    phone_sections = []
    for segment in re.split(r'(?=^[一二三四五]、)', first['phone'], flags=re.M):
        lines = segment.strip().splitlines()
        if lines:
            phone_sections.append({'heading': lines[0], 'text': '\n'.join(lines[1:])})
    return dict(schema='mydotwork.dashboard.v1', date=first['researchDate'], records=records,
                invoice=second['invoice'], routes=second['routes'], claude=first['claude'],
                phone=phone_sections, sources=sources, historyCount=len(json.loads((ROOT/'src/data.json').read_text(encoding='utf-8'))),
                sourceFiles=['../research/2026-10-02.json', '../research/2026-10-02-round2.json'],
                timeline=[{'time': '2026-10-01', 'title': '历史供货基线', 'text': '旧126条完整保留，单独入口；不覆盖当前两轮证据。', 'url': 'https://1337816143.github.io/MyDotWork/'},
                          {'time': '2026-10-02 06:18 UTC', 'title': '第一轮公开核查', 'text': '45条原号SKU记录；区分展示价、付款预览与未知费用。', 'url': '../research/2026-10-02.html'},
                          {'time': '2026-10-02 06:26–06:38 UTC', 'title': '经营资格与发票修正', 'text': '扩围5家；贝果禁止转售；麦门Pro200资格和权益描述修正；工商与发票仍未验真。', 'url': '../research/2026-10-02-round2.html'}])


def build_dashboard(out, version):
    d = dataset()
    target = out / 'dashboard'
    target.mkdir(exist_ok=True)
    raw = json.dumps(d, ensure_ascii=False, indent=2)
    (target / 'data.json').write_text(raw + '\n', encoding='utf-8')
    catalog = json.dumps(load_catalog(), ensure_ascii=False, indent=2)
    (target / 'catalog.json').write_text(catalog + '\n', encoding='utf-8')
    template = (ROOT / 'src/dashboard.html').read_text(encoding='utf-8')
    css = '\n'.join((ROOT / 'src' / name).read_text(encoding='utf-8') for name in ('dashboard.css', 'glass.css', 'compact.css', 'navigation.css', 'status.css'))
    js = (ROOT / 'src/dashboard.js').read_text(encoding='utf-8')
    html = template.replace('__CSS__', css).replace('__SCRIPT__', js).replace('__DATA__', raw.replace('<', '\\u003c')).replace('__VERSION__', version).replace('__BOOT_SCRIPT__', (ROOT/'src/appearance-boot.js').read_text(encoding='utf-8')).replace('__CATALOG_DATA__', catalog.replace('<', '\\u003c')).replace('__CATALOG_SCRIPT__', (ROOT/'src/catalog.js').read_text(encoding='utf-8')).replace('__STATUS_SCRIPT__', (ROOT/'src/status.js').read_text(encoding='utf-8'))
    (target / 'index.html').write_text(html, encoding='utf-8')
    return d


if __name__ == '__main__':
    build_dashboard(ROOT / 'dist', (ROOT / 'VERSION').read_text().strip())
