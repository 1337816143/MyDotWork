"""Evidence boundaries for the dated supplier and two engineering website entries."""
import copy
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PINS={
    'research/2026-10-04/supplier-delta.json':'806985c63c7fea9226cf46cca52f4e06e39c4970d14adfdaba6e582bd8328873',
    'projects/vector-2026-10-04.json':'744daf41fcf3f955e980815d16fba2858b95b95599a0148ae73de1f956a0b480',
}

def boundaries(supplier,vector,catalog):
    assert supplier['as_of_utc']=='2026-10-04T02:46:00Z'
    assert len(supplier['supplier_prices'])==5 and len(supplier['sources'])==25
    assert set(supplier['qualification_totals'].values())=={0}
    assert all(row['invoice_extra_cny'] is None and row['all_in_mainland_invoice_cny'] is None and row['qualified'] is False for row in supplier['supplier_prices'])
    chatshare=next(row for row in supplier['supplier_prices'] if row['id']=='chatshare')
    assert (chatshare['display_cny'],chatshare['payment_fee_cny'],chatshare['payment_preview_cny'])==(160,6.4,166.4)
    assert all(source['observed_at_utc']<=supplier['as_of_utc'] for source in supplier['sources'])
    assert vector['sourceCommit']=='9c6b8b62ec0602bb28db143b3c9040667660645c' and vector['version']=='0.10.1'
    assert vector['verifiedAtUtc']=='2026-10-04T05:05:52Z'
    val=vector['validation']
    assert (val['deterministicSyntheticTests'],val['quadWebglPixelSamples'],val['quadWebglPixelMismatches'])==(32,5968,0)
    assert '不含真实摄像头' in val['inputBoundary'] and '合成' in val['inputBoundary']
    assert '容差' in val['recording'] and '像素一致' not in val['recording']
    assert '蜘蛛侠面部替换' in vector['notYetComplete']
    assert catalog['counts']=={'artifacts':23,'websites':6,'tasks':17}
    snapshot=catalog['statusSnapshot'];items=snapshot['items']
    assert [item['number'] for item in items]==list(range(1,9))
    assert items[7]['projectIds']==['project-14','project-15']
    assert [link['url'] for link in items[7]['links']]==['https://1337816143.github.io/Evolution/pages/smartdrop.html','https://1337816143.github.io/Real-Time-Vector-Keyframe/']
    assert items[3]['state']==items[4]['state']==items[5]['state']=='waiting'
    assert items[0]['state']==items[1]['state']=='round_complete'
    assert items[2]['verification']['observedAt']==supplier['as_of_utc']
    assert '实体试验0' in items[7]['publication'] and '合成' in items[7]['publication']
    assert '等待修后自然运行' in items[5]['currentAction']
    assert snapshot['coverage']['messageCount']==507 and snapshot['coverage']['partial'] is True
    records={r['id']:r for r in catalog['records']}
    assert records['smartdrop-site']['task']=='project-14' and records['vector-keyframe-site']['task']=='project-15'
    assert records['vector-validation-20261004']['updatedAt']==vector['verifiedAtUtc']
    assert '八项当前任务' in records['public-project-data']['summary']

def validate_current_updates():
    html=(ROOT/'dist/index.html').read_text()
    assert '<b>v1.8.3 · 2026-10-04：</b>当前dot原文增量73条' in html
    assert '<b>v1.8.4 · 2026-10-04：</b>增加第八项SmartDrop' in html
    for name,digest in PINS.items():assert hashlib.sha256((ROOT/'dist'/name).read_bytes()).hexdigest()==digest
    supplier=json.loads((ROOT/'dist/research/2026-10-04/supplier-delta.json').read_bytes())
    vector=json.loads((ROOT/'dist/projects/vector-2026-10-04.json').read_bytes())
    catalog=json.loads((ROOT/'dist/dashboard/catalog.json').read_bytes())
    boundaries(supplier,vector,catalog)
    mutations=[
        lambda s,v,c:s['supplier_prices'][0].update(invoice_extra_cny=0),
        lambda s,v,c:s['supplier_prices'][0].update(qualified=True),
        lambda s,v,c:s['qualification_totals'].update(new_verified_qualified_suppliers=1),
        lambda s,v,c:s.update(as_of_utc='2026-10-04T05:16:29Z'),
        lambda s,v,c:v['validation'].update(inputBoundary='真实硬件验证完成'),
        lambda s,v,c:v['validation'].update(recording='中段像素一致'),
        lambda s,v,c:v['notYetComplete'].remove('蜘蛛侠面部替换'),
        lambda s,v,c:c['statusSnapshot']['items'].pop(),
        lambda s,v,c:c['statusSnapshot']['items'][7].update(projectIds=['project-14']),
        lambda s,v,c:c['statusSnapshot']['items'][7]['links'].reverse(),
        lambda s,v,c:c['statusSnapshot']['coverage'].update(partial=False),
        lambda s,v,c:c['statusSnapshot']['items'][5].update(currentAction='自然运行已验证'),
    ]
    for mutate in mutations:
        s,v,c=copy.deepcopy((supplier,vector,catalog));mutate(s,v,c)
        try:boundaries(s,v,c)
        except AssertionError:pass
        else:raise AssertionError('Unreviewed evidence inflation was accepted')
    print('PASS: 12 current-update counterexamples; eight task mappings, dated observations, unknown invoice costs, synthetic-only evidence and unchanged507 coverage')

if __name__=='__main__':validate_current_updates()
