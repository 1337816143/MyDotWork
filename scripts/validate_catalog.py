"""Catalogue approval, sources and standalone build checks; no private discovery."""
import copy
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from build_catalog import load_catalog
from validate_archive import scan

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'data/workbench-catalog.json').read_text(encoding='utf-8'))
projects=json.loads((ROOT/'data/projects.json').read_text(encoding='utf-8'))
expected=load_catalog(manifest,projects)
actual=json.loads((ROOT/'dist/dashboard/catalog.json').read_text(encoding='utf-8'))
assert actual==expected
scan(json.dumps(actual,ensure_ascii=False))
assert len(actual['tasks'])==len(manifest['tasks'])
assert actual['counts']['artifacts']==len(manifest['artifacts'])
assert actual['counts']['websites']==len(manifest['websites'])

class IDs(HTMLParser):
    def __init__(self):super().__init__();self.ids=set()
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:self.ids.add(attrs['id'])

for r in actual['records']:
    url=urlsplit(r['url'])
    if url.scheme:continue
    target=((ROOT/'dist/dashboard')/url.path).resolve() if url.path else (ROOT/'dist/dashboard/index.html').resolve()
    assert target.is_relative_to((ROOT/'dist').resolve()) and target.is_file(),r['url']
    if url.fragment:
        parser=IDs();parser.feed(target.read_text(encoding='utf-8'));assert url.fragment in parser.ids or (url.fragment=='tutorial' and 'id="tutorial"' in target.read_text(encoding='utf-8')),r['url']

for mutate in [lambda m:m['artifacts'][0].update(metadataApproved=False),lambda m:m['artifacts'][0].update(access='private'),lambda m:m['artifacts'][0].update(url='https://chatgpt.com/library/private-test'),lambda m:m['artifacts'][0].update(url='https://example.org/?token=test'),lambda m:m['tasks'][0].update(metadataApproved=False),lambda m:m['tasks'][0].update(expectedTitle='Unreviewed task mapping'),lambda m:m['artifacts'][0].update(internalNotes='Not a public field'),lambda m:m['artifacts'][0].update(updatedAt='2026-10-02T06:18:00')]:
    bad=copy.deepcopy(manifest);mutate(bad)
    try:load_catalog(bad,projects)
    except AssertionError:pass
    else:raise AssertionError('Invalid approval or URL accepted')
bad_projects=copy.deepcopy(projects);bad_projects['projects'][0]['children'][0]['internalNotes']='Unapproved field'
try:load_catalog(manifest,bad_projects)
except AssertionError:pass
else:raise AssertionError('Unapproved subtask metadata accepted')
text=(ROOT/'dist/dashboard/index.html').read_text(encoding='utf-8')
assert '__CATALOG_' not in text
assert 'localStorage' not in (ROOT/'src/catalog.js').read_text(encoding='utf-8')
assert all(term not in (ROOT/'scripts/build_catalog.py').read_text(encoding='utf-8') for term in ('dot-chat','rglob(','os.walk(','glob('))
print('PASS: explicit catalogue approvals, public-only sources, valid local targets/deep links, no private discovery, build parity and rejected unsafe metadata/URLs')
