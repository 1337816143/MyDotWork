"""Exact reviewed VPN publication and negative public-boundary tests."""
import copy
import json
import re
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

def check_data(data):
    assert data['schemaVersion'] == 2 and data['version'] == 'v7'
    assert data['researchCutoff'].startswith('2026-10-29T') and data['researchCutoff'].endswith('Z')
    providers = data['providers']
    assert len(providers) == 25 and len({p['id'] for p in providers}) == 25
    for p in providers:
        for field in ['name','displayLink','displayLinkLabel','websiteIdentityStatus','checkedAt','sourceDates','publicPrice','expiryAndInactivity','actualCheckoutTotal','evidenceStrength','ranking','emergencyPrepared','emergencyColdStart','gptWeb','gptConversation','gptLongSession']:
            assert isinstance(p[field], str) and p[field].strip(), 'Missing provider evidence field: '+field
        assert urlsplit(p['displayLink']).scheme == 'https'
        assert p['checkedAt'].endswith('Z') and p['checkedAt'] <= data['researchCutoff']
        assert p['sources'] and all(urlsplit(u).scheme == 'https' for u in p['sources'])
    assert len(data['tiers']) == 4 and len(data['comparisonRows']) == 8
    assert '先按可靠性证据分组' in data['rankingPolicy']
    assert '参考标价不是实际全费' in data['rankingPolicy'] and '年付按一次首付全额另列' in data['rankingPolicy']
    expected = ['第一梯队｜Windscribe Pro','第二梯队｜SS-ID','第二梯队｜Nexitally（现价待核，另列）','第三层｜Mullvad','第三层｜Just My Socks','第三层｜TAG','第三层｜Astrill（不优先新购）','第三层｜Proton（价格与套餐匹配待核，另列）']
    assert [row['name'] for row in data['comparisonRows']] == expected, 'Reviewed reliability tiers/order changed'
    for row in data['comparisonRows']:
        for field in ['payment','prepared','coldStart','gpt']:
            assert isinstance(row[field],str) and row[field].strip()
    by_name={p['name']:p for p in providers}
    assert '撤出首推' in by_name['魔戒']['ranking']
    assert '11/11' in data['comparisonRows'][0]['prepared']
    assert '首登未测' in data['comparisonRows'][0]['coldStart']
    assert '实际发问' in data['comparisonRows'][0]['gpt']
    assert '117.78' in data['comparisonRows'][5]['payment']
    assert len(data['fxChecks']) == 8
    for row in data['fxChecks']:
        assert str((Decimal(row['amount'])*Decimal(row['rate'])).quantize(Decimal('0.01'),rounding=ROUND_HALF_UP)) == row['cny'], 'FX arithmetic mismatch'
    text=json.dumps(data, ensure_ascii=False)
    assert not re.search(r'libfile_|Sentinel_|/workspace/|file_000000|github_pat_|-----BEGIN .*PRIVATE KEY|[?&](?:sig|token|X-Amz-Signature)=',text,re.I)


def validate_vpn():
    data=json.loads((ROOT/'dist/research/vpn/evidence.json').read_text())
    check_data(data)
    html=(ROOT/'dist/research/vpn/index.html').read_text()
    assert '../../dashboard/index.html' in html
    assert not re.search(r'<(?:script|iframe|form|img|audio|video)\b',html,re.I)
    assert not re.search(r'libfile_|Sentinel_|/workspace/|file_000000|github_pat_|-----BEGIN .*PRIVATE KEY',html,re.I)
    for p in data['providers']:
        assert p['name'] in html
    catalog=json.loads((ROOT/'dist/dashboard/catalog.json').read_text())
    by_id={r['id']:r for r in catalog['records']}
    assert by_id['vpn-report']['url']=='../research/vpn/index.html'
    assert by_id['vpn-evidence']['url']=='../research/vpn/evidence.json'
    for mutate in [lambda d:d['providers'].pop(),lambda d:d['providers'][0].update(displayLink=''),lambda d:d['providers'][0].update(websiteIdentityStatus=''),lambda d:d['providers'][0].update(checkedAt='2099-01-01T00:00:00Z'),lambda d:d['providers'][0].update(note='libfile_private'),lambda d:d['providers'][0].update(sources=[]),lambda d:d.update(rankingPolicy='价格越低越好'),lambda d:d['comparisonRows'].reverse(),lambda d:d['providers'][0].update(ranking='首推'),lambda d:d['providers'][0].update(emergencyColdStart=''),lambda d:d['comparisonRows'][0].update(coldStart='随时保证连接'),lambda d:d['comparisonRows'][5].update(payment='117.95'),lambda d:d['fxChecks'][0].update(cny='117.95')]:
        d=copy.deepcopy(data);mutate(d)
        try:check_data(d)
        except AssertionError:pass
        else:raise AssertionError('VPN invalid evidence accepted')
    print('PASS: VPN 25 provider websites, identity/date/fee evidence, private-marker boundary, return links reliability-first tiers and thirteen negative cases')

if __name__=='__main__': validate_vpn()
