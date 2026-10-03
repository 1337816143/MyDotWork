"""Public-boundary and standalone-artifact smoke checks (stdlib only)."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'dist/index.html').read_text()
manifest = json.loads((ROOT / 'dist/release-manifest.json').read_text())
assert manifest['reportSha256'] == hashlib.sha256((ROOT / 'dist/index.html').read_bytes()).hexdigest()
assert 'v' + manifest['contentVersion'] in html
assert '__OFFERS__' not in html
for pattern in [r'libfile_[A-Za-z0-9]+', r'/workspace/', r'(?i)https?://[^\s<>\"]*[?&](?:token|sig|X-Amz-Signature)=', r'gh[pousr]_[A-Za-z0-9]{20,}', r'github_pat_[A-Za-z0-9_]{20,}', r'-----BEGIN [A-Z ]*PRIVATE KEY-----']:
    assert not re.search(pattern, html), 'Public boundary violation: ' + pattern
class Audit(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = []; self.anchors = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag in ['script','iframe','img','audio','video','source']: assert not attrs.get('src'), 'External resource'
        if tag == 'link': assert attrs.get('rel') not in ['stylesheet','preload','modulepreload'], 'External dependency'
        if tag == 'a' and attrs.get('href','').startswith('#'): self.anchors.append(attrs['href'][1:])
audit = Audit(); audit.feed(html)
assert len(audit.ids) == len(set(audit.ids)), 'Duplicate IDs'
assert all(x in audit.ids for x in audit.anchors), 'Broken section anchor'
data = json.loads((ROOT / 'src/data.json').read_text())
assert len(data) >= 100
assert len({x['id'] for x in data}) == len(data)
print(f'PASS: standalone HTML, {len(data)} records, anchors, version, hash, and credential-pattern scan')

from validate_archive import validate
validate()

from validate_dashboard import validate_dashboard
validate_dashboard()

# Reviewed workbench catalogue is part of every public release validation.
import validate_catalog

from validate_publications import validate_publications
validate_publications()

from test_publication_archive import run_tests
run_tests()
