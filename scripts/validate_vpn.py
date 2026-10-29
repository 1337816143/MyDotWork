"""Exact reviewed VPN publication and negative public-boundary tests."""
import copy
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

def check_data(data):
    assert data['schemaVersion'] == 1 and data['version'] == 'v6'
    assert data['researchCutoff'].startswith('2026-10-29T') and data['researchCutoff'].endswith('Z')
    providers = data['providers']
    assert len(providers) == 22 and len({p['id'] for p in providers}) == 22
    for p in providers:
        for field in ['name','displayLink','displayLinkLabel','websiteIdentityStatus','checkedAt','sourceDates','publicPrice','expiryAndInactivity','actualCheckoutTotal','evidenceStrength']:
            assert isinstance(p[field], str) and p[field].strip(), 'Missing provider evidence field: '+field
        assert urlsplit(p['displayLink']).scheme == 'https'
        assert p['checkedAt'].endswith('Z') and p['checkedAt'] <= data['researchCutoff']
        assert p['sources'] and all(urlsplit(u).scheme == 'https' for u in p['sources'])
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
    for mutate in [lambda d:d['providers'].pop(),lambda d:d['providers'][0].update(displayLink=''),lambda d:d['providers'][0].update(websiteIdentityStatus=''),lambda d:d['providers'][0].update(checkedAt='2099-01-01T00:00:00Z'),lambda d:d['providers'][0].update(note='libfile_private'),lambda d:d['providers'][0].update(sources=[])]:
        d=copy.deepcopy(data);mutate(d)
        try:check_data(d)
        except AssertionError:pass
        else:raise AssertionError('VPN invalid evidence accepted')
    print('PASS: VPN 22 provider websites, identity/date/fee evidence, private-marker boundary, return links and six negative cases')

if __name__=='__main__': validate_vpn()
