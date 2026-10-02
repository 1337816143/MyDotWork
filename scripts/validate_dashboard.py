"""Static checks for a self-contained research dashboard and its release contract."""
import json
from html.parser import HTMLParser
from pathlib import Path
from validate_archive import scan

ROOT = Path(__file__).resolve().parents[1]


def validate_dashboard():
    text = (ROOT / 'dist/dashboard/index.html').read_text(encoding='utf-8')
    d = json.loads((ROOT / 'dist/dashboard/data.json').read_text(encoding='utf-8'))
    scan(text)
    scan(json.dumps(d, ensure_ascii=False))
    assert not any(t in text for t in ['__DATA__', '__SCRIPT__', '__CSS__', '__VERSION__'])
    assert 'href="../index.html"' not in text, 'Mirror cannot resolve old root report through ../index.html'
    assert d['timeline'][0]['url'] == 'https://1337816143.github.io/MyDotWork/'
    class Audit(HTMLParser):
        def __init__(self):
            super().__init__(); self.ids=[]; self.hrefs=[]
        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if 'id' in a: self.ids.append(a['id'])
            if tag == 'a': self.hrefs.append(a.get('href', ''))
            if tag in ['script','iframe','img']: assert not a.get('src')
            assert not any(k.startswith('on') for k in a)
    a = Audit(); a.feed(text)
    assert len(a.ids) == len(set(a.ids))
    for href in a.hrefs:
        if href.startswith(('http:','https:','#')): continue
        assert ((ROOT/'dist/dashboard') / href).exists(), href
    assert len(d['records']) == 45 and len({r['id'] for r in d['records']}) == 45
    assert len(d['invoice']['prior_candidates']) + len(d['invoice']['new_candidates']) == 9
    assert len(d['routes']['routes']) == 11 and d['historyCount'] == 126
    assert all(r['payment_group'] != '人民币预览' for r in d['records'] if 'USDT' in str(r.get('payment_method')).upper())
    assert 'dot-chat' not in (ROOT/'scripts/build_dashboard.py').read_text(encoding='utf-8')
    print('PASS: dashboard standalone resources, local links, IDs, public boundary, counts and release data')


if __name__ == '__main__': validate_dashboard()
