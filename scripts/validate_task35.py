"""Evidence distinctions for the explicitly approved research appendix."""
import copy
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'dist/research/2026-10-03'


def check_records(data):
    assert data['editorial_review_at_utc'] == '2026-10-03T19:14:00Z'
    supplier, h3 = data['records']
    assert supplier['source_observations_as_of_utc'] == '2026-10-03T13:20:00Z'
    assert supplier['counts'] == dict(suppliers=5, source_access_records=19,
        unique_source_urls=18, successful_observation_records=18,
        successful_unique_urls=17, failed_exact_sku_access_records=1,
        new_suppliers=0, new_qualified_suppliers=0, verified_mainland_invoices=0,
        complete_authorized_resale_paths=0)
    assert supplier['purchase_cost_cap_cny'] == 170
    assert '不是售价、利润、收入' in supplier['cost_cap_meaning']
    assert len(supplier['suppliers']) == 5
    assert all(row['invoice_extra_cny'] is None and row['all_in_cny'] is None for row in supplier['suppliers'])
    assert supplier['suppliers'][-1]['name'] == 'ChatShare'
    assert supplier['suppliers'][-1]['price_evidence_date'] == '2026-10-02（历史，未刷新）'
    assert h3['existing_sample']['generation_attempts_for_this_sample'] == 1
    assert '音轨未试听' in h3['existing_sample']['acceptance']
    assert '不是项目全部历史生成次数' in h3['existing_sample']['scope_note']
    business = h3['business_evidence']
    assert all(business[key] == 0 for key in ['recorded_specific_demand_interviews','verified_customer_orders','verified_settlements','net_profit_evidence_records'])
    assert business['actual_net_profit_cny'] is None and business['low_maintenance_income_validated'] is False
    assert len(h3['paused_history']) == 2
    assert h3['validation_order'] == ['真实需求','授权与素材许可','按预定规格样品验收','首笔真实结算订单','可重复且低维护的交付记录']
    license = h3['license']
    assert license['official_page_checked_at_utc'] == '2026-10-03T19:12:30Z'
    assert license['excluded_territories'] == ['欧盟','英国','韩国','美国']
    assert license['relevant_sections'] == ['I.5','V.4','Exhibit A.1']
    assert '输出的使用、分发与展示' in license['summary'] and '当前均未完成' in license['clearance']
    assert all(term in h3['media_publication'] for term in ['抽帧','接触表','缩略图','继续私有'])
    assert '仅是建议观察门槛' in h3['repeatability_observation']


def validate_task35():
    records = json.loads((P/'evidence-gates.json').read_bytes()); check_records(records)
    original = (P/'supplier-review-original.html').read_bytes().decode('utf-8')
    page = (P/'index.html').read_bytes().decode('utf-8')
    main = re.search(r'<main[^>]*>(.*?)</main>', original, re.S).group(1)
    assert main in page, 'The complete historical report must remain byte-exact in the reading page'
    text = (P/'task35-current-plan.txt').read_bytes().decode('utf-8')
    pre = re.search(r'<pre\b[^>]*class="plan-text"[^>]*>(.*?)</pre>', page, re.S)
    assert pre and html.unescape(pre.group(1)) == text, 'Full plan text was shortened'
    fragment = re.search(r'(<section id="task35-evidence-gates-20261003-r6".*?</section>)', page, re.S).group(1)
    assert hashlib.sha256((fragment+'\n').encode()).hexdigest() == '207c485e6207a5090e370028d5ad7cb8fdf0d9852cd0bd210e0163870dcf682b'
    assert all(f'id="S{i:02}"' in page for i in range(1,20))
    for term in ['<video','<audio','<img','<iframe','<script','libfile_','/workspace/','file_000000']:
        assert term not in page, 'Unexpected media or private material: '+term
    assert 'supplier-review-original.html' in page and 'download' in page
    assert '历史快照' in page and '未修改或发布网站' in page
    source = json.loads((P/'supplier-review.json').read_bytes())
    assert len(source['sources']) == 19
    print('PASS: complete task3/5 text, immutable downloads, dates, failed source count, unknown costs/profit, one-sample and license boundaries')


def negative_tests():
    original = json.loads((P/'evidence-gates.json').read_bytes())
    mutations = [
        lambda d: d['records'][0]['counts'].update(unique_source_urls=19),
        lambda d: d['records'][0]['counts'].update(successful_observation_records=19),
        lambda d: d['records'][0]['suppliers'][0].update(all_in_cny=0),
        lambda d: d['records'][0]['suppliers'][0].update(invoice_extra_cny=0),
        lambda d: d['records'][0]['suppliers'][-1].update(price_evidence_date='2026-10-03'),
        lambda d: d['records'][0].update(source_observations_as_of_utc=d['editorial_review_at_utc']),
        lambda d: d['records'][1]['business_evidence'].update(actual_net_profit_cny=0),
        lambda d: d['records'][1]['business_evidence'].update(verified_customer_orders=3),
        lambda d: d['records'][1]['license'].update(excluded_territories=[]),
        lambda d: d['records'][1].update(media_publication='可公开所有样片'),
    ]
    for mutate in mutations:
        bad = copy.deepcopy(original); mutate(bad)
        try: check_records(bad)
        except AssertionError: pass
        else: raise AssertionError('Misleading research claim passed')
    print('PASS: ten counterexamples rejected; failed sources, costs, dates, orders, profit and media cannot be inflated')


if __name__ == '__main__': validate_task35(); negative_tests()
