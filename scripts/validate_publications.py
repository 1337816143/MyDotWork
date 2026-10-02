"""Check publication byte preservation, local links, evidence boundaries and catalogue mappings."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from build_publications import PUBLICATIONS
from validate_archive import scan

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = set(); self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, 'Duplicate publication anchor'
            self.ids.add(attrs['id'])
        if tag == 'a': self.links.append(attrs.get('href', ''))
        if tag in {'script', 'iframe', 'img', 'audio', 'video', 'source'}:
            assert not attrs.get('src'), 'Unexpected runtime resource'
        if tag == 'link': assert attrs.get('rel') not in {'stylesheet', 'preload', 'modulepreload'}


def validate_publications():
    for name, digest in PUBLICATIONS:
        source = (ROOT / 'publications' / name).read_bytes()
        output = (ROOT / 'dist' / name).read_bytes()
        assert output == source and hashlib.sha256(output).hexdigest() == digest
        text = output.decode('utf-8'); scan(text)
        assert all(term not in text for term in ('libfile_', '/workspace/', 'file_000000'))
        if name.endswith('.html'):
            doc = Document(); doc.feed(text)
            for href in doc.links:
                url = urlsplit(href)
                assert url.scheme not in {'javascript', 'data'}
                if url.scheme: continue
                target = (((ROOT / 'dist' / name).parent / url.path) if url.path else ROOT / 'dist' / name).resolve()
                assert target.is_relative_to((ROOT / 'dist').resolve()) and target.is_file(), href
                if url.fragment and not url.path: assert url.fragment in doc.ids, href

    upstream = json.loads((ROOT / 'dist/research/round3-7/ai-upstream-public.json').read_bytes())
    assert upstream['current_view']['new_qualified_candidate_ranking'] == []
    assert len(upstream['current_view']['research_leads_not_ranking']) == 8
    history = upstream['price_history']
    assert len(history) == len({item['history_id'] for item in history}) == 30
    assert len(upstream['source_catalog']) == 220
    side = json.loads((ROOT / 'dist/research/ai-side-income/data.json').read_bytes())
    page = (ROOT / 'dist/research/ai-side-income/report.html').read_text(encoding='utf-8')
    embedded = re.search(r'<script[^>]*id="report-data"[^>]*>(.*?)</script>', page, re.S)
    assert embedded and json.loads(embedded.group(1)) == side
    assert side['report_version'] == '1.2' and len(side['options']) == 32 and len(side['sources']) == 150
    assert side['validation']['samples_created'] is False and side['validation']['real_sales_verified'] is False
    catalog = json.loads((ROOT / 'dist/dashboard/catalog.json').read_bytes())
    by_id = {record['id']: record for record in catalog['records']}
    assert by_id['upstream-round3-7']['task'] == 'project-1'
    assert by_id['side-income-report']['task'] == 'project-17'
    assert by_id['side-income-data']['task'] == 'project-17'
    assert catalog['counts'] == {'artifacts': 13, 'websites': 2, 'tasks': 17}
    print('PASS: four exact public publications, download links, evidence boundaries and correct task mappings')


if __name__ == '__main__': validate_publications()
