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
    assert catalog['counts']=={'artifacts':29,'websites':6,'tasks':18}
    snapshot=catalog['statusSnapshot'];items=snapshot['items']
    assert [item['number'] for item in items]==list(range(1,10))
    assert items[7]['projectIds']==['project-14','project-15']
    assert [link['url'] for link in items[7]['links']]==['https://1337816143.github.io/Evolution/pages/smartdrop.html','https://1337816143.github.io/Real-Time-Vector-Keyframe/']
    assert items[3]['state']==items[4]['state']==items[5]['state']=='waiting'
    assert items[0]['state']==items[1]['state']=='round_complete'
    assert items[2]['verification']['observedAt']==supplier['as_of_utc']
    assert '实体试验0' in items[7]['publication'] and '合成' in items[7]['publication']
    assert '镜像仍为已验证的5.5.2' in items[5]['currentAction'] and '5.5.3' in items[5]['currentAction']
    assert snapshot['coverage']['messageCount']==567 and snapshot['coverage']['partial'] is True
    records={r['id']:r for r in catalog['records']}
    assert records['smartdrop-site']['task']=='project-14' and records['vector-keyframe-site']['task']=='project-15'
    assert records['vector-validation-20261004']['updatedAt']==vector['verifiedAtUtc']
    assert '九项当前任务' in records['public-project-data']['summary']

def validate_current_updates():
    html=(ROOT/'dist/index.html').read_text()
    assert '<b>v1.8.3 · 2026-10-04：</b>当前dot原文增量73条' in html
    assert '<b>v1.8.5 · 2026-10-04：</b>当前dot原文增量60条' in html
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
    validate_latest_boundaries()
    print('PASS: 12 historical plus latest evidence counterexamples; nine task mappings and exact567 archive')




def latest_boundaries(vector, smart, wet, catalog, integrity):
    assert vector['version']=='0.11.1' and vector['sourceCommit']=='6ed352df3b722409e387cb39a17abb2eca488df1'
    val=vector['validation']
    assert val['deterministicSyntheticTests']==58 and val['runner']=='Ubuntu 24.04 / Linux ARM64'
    assert val['faceLeaks']==0 and val['faceExteriorPixelChecks']==175322
    assert val['positiveLandmarkCount']==478 and val['consecutiveFreshPositiveFrames']==3
    assert val['positiveResultAgeMs']==[166,84.8,87.1]
    assert '容差' in val['recording'] and '不是解码字节精确相等' in val['recording']
    assert '未满足250毫秒' in vector['limitations'][0]
    assert '联合负载' in ''.join(vector['notYetComplete']) and 'SDK可发送' in vector['privacy']
    assert len(vector['publishedFiles'])==5 and all(x['matchesTestedArtifact'] for x in vector['publishedFiles'])
    assert smart['hardwareRevision']=='A5-P0.7' and smart['digitalRevision']=='A5-P0.7-R1'
    assert smart['validation']['physicalResults']==0 and smart['validation']['physicalValidation']=='NOT_RUN'
    assert smart['validation']['softwareTestsPassed']==296
    assert '历史HTML校核器与旧PDF未修改' in smart['boundary'] and '尚未接入在线页面' in smart['boundary']
    assert [a['sha256'] for a in smart['artifacts']]==['2aabb6a4c97e816e995a7638603122282fdc6ccc54358714219a93c0795c1525','797a6be59c36cd54b3e54ed9be4d4e198692ab15cb5f0d118dc6dc28d6a271a0']
    w=wet['validation'];assert w['windowsRuns']==0 and w['nativeEnglishWindowVerified'] is False and w['installerExecuted'] is False
    assert w['productionVersionAllowlist']==[] and w['productionAdapter']=='unavailable'
    assert (w['syntheticTestsPassed'],w['assertionsPassed'],w['analyzerTestsPassed'])==(27,4810,10)
    assert 'Linux / GCC' in w['environment'] and wet['projectId']=='project-18' and wet['taskId']=='task-9'
    assert catalog['statusSnapshot']['items'][8]['projectIds']==['project-18']
    assert integrity['baselineMessageCount']==507 and integrity['incrementMessageCount']==60 and integrity['approvedMessageCount']==567
    # 2026-10-08 privacy correction; historical 507 + 60 message counts stay fixed.
    assert integrity['baselineMessagesSha256']=='3c9fa183e46935fc727d45e748bca712510e7b10139e23cae31fb31e9f898db6'
    assert integrity['approvedMessagesSha256']=='3a41a4f29db97224c9f947ca9a47fb64f3b6a46b48e6a05cd043e213d87be8c2'

def validate_latest_boundaries():
    for path, digest in {'data/dot-chat.json':'c2529cf0b26eda4b33dc8ce37d60e462cdde8caababb3bc4cddff68a5d90223e','data/chat-integrity.json':'6b8a08c59a0bb7e25ba6f4aa1e8c72ed5c1a56d5859e4a4fae566ca16c0ec0bd'}.items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,'Reviewed archive ID set/body/coverage changed'
    values=tuple(json.loads((ROOT/path).read_bytes()) for path in ['dist/projects/vector-0.11.1-2026-10-04.json','dist/projects/smartdrop-r1-2026-10-04.json','dist/projects/wetype-2026-10-04.json','dist/dashboard/catalog.json','data/chat-integrity.json'])
    latest_boundaries(*values)
    correction=json.loads((ROOT/'data/dot-chat.json').read_bytes())['coverage']['privacyCorrections'][-1]
    assert correction['addedMessageCount']==0 and correction['messageCount']==3 and correction['occurrenceCount']==5
    assert correction['appliedAt']=='2026-10-08T03:30:00Z'
    assert correction['previousMessagesSha256']=='96529d5864ba34d2c45f166058fd3661f05eaeed010c5f5f22709cde94bc2e06'
    assert correction['previousBaselineMessagesSha256']=='fb40dad941642796939b1848439fe0317128f0a17efecabc818f4055f0de1598'
    assert correction['messagesSha256']==values[-1]['approvedMessagesSha256']
    assert correction['baselineMessagesSha256']==values[-1]['baselineMessagesSha256']
    mutations=[
        lambda v,s,w,c,i:v['validation'].update(recording='像素字节精确相等'),
        lambda v,s,w,c,i:v['validation'].update(runner='Windows x64'),
        lambda v,s,w,c,i:v['validation'].update(positiveResultAgeMs=[0,0,0]),
        lambda v,s,w,c,i:v.update(limitations=['全部平台验证通过']),
        lambda v,s,w,c,i:v.update(privacy='零网络'),
        lambda v,s,w,c,i:s['validation'].update(physicalResults=1),
        lambda v,s,w,c,i:s.update(boundary='旧HTML已修复'),
        lambda v,s,w,c,i:s.update(hardwareRevision='A5-P0.8'),
        lambda v,s,w,c,i:w['validation'].update(windowsRuns=1),
        lambda v,s,w,c,i:w['validation'].update(nativeEnglishWindowVerified=True),
        lambda v,s,w,c,i:w['validation'].update(installerExecuted=True),
        lambda v,s,w,c,i:w['validation'].update(productionVersionAllowlist=['3.0.0.17']),
        lambda v,s,w,c,i:c['statusSnapshot']['items'][8].update(projectIds=['project-13']),
        lambda v,s,w,c,i:i.update(baselineMessageCount=506),
        lambda v,s,w,c,i:i.update(approvedMessagesSha256='0'*64),
    ]
    for mutate in mutations:
        sample=copy.deepcopy(values);mutate(*sample)
        try:latest_boundaries(*sample)
        except AssertionError:pass
        else:raise AssertionError('Latest public evidence inflation accepted')
    business=json.loads((ROOT/'dist/research/2026-10-04/task5-business-validation-20261004-evidence.json').read_bytes())
    actual=business['cost_model']['actual'];runtime=business['cost_model']['historic_runtime']
    assert actual['orders']==actual['settlements']==actual['new_generations']==0
    assert actual['all_in_cost_cny'] is None and actual['net_profit_cny'] is None and actual['active_hours'] is None
    assert runtime['three_runs_same_rate_minutes'] is None and runtime['linear_30_min_output_hours'] is None
    assert runtime['used_as_model_input'] is False and runtime['independently_reverified_for_this_public_copy'] is False
    assert len(business['sources'])==15 and business['as_of_utc']=='2026-10-04T12:26:00Z'
    text=(ROOT/'dist/research/2026-10-04/task5-business-validation-20261004.txt').read_text()
    assert '证明有人采购' not in text and '41.119' not in text and '79.58' not in text
    assert 'supplier-delta.json' in text and '02:46' in text
    for row in business['cost_model']['sensitivity']['rows']:
        assert round(row['gross']*.8,2)==row['after_commission_before_other_costs']
        assert round(row['gross']*.8/30*60,2)==row['max_total_active_minutes_if_other_costs_zero']
        assert round(row['gross']*.8-37.5,2)==row['margin_for_all_other_costs_at_75min']
    print('PASS: 15 latest boundary mutations, exact reviewed60-ID increment, R1/Vector/WeType limitations')

if __name__=='__main__':validate_current_updates()
