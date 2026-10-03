"""Check publication byte preservation, local links, evidence boundaries and catalogue mappings."""
import hashlib
import base64
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from build_publications import PUBLICATIONS
from validate_archive import scan
from validate_publication_archive import validate_publication_archive

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = set(); self.links = []; self.images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, 'Duplicate publication anchor'
            self.ids.add(attrs['id'])
        if tag == 'a': self.links.append(attrs.get('href', ''))
        if tag == 'img' and attrs.get('src'):
            src = attrs['src']
            assert src.startswith('data:image/png;base64,'), 'Only reviewed embedded PNG previews'
            payload = base64.b64decode(src.split(',', 1)[1], validate=True)
            assert payload.startswith(b'\x89PNG\r\n\x1a\n') and len(payload) < 1500000
            self.images.append(hashlib.sha256(payload).hexdigest())
        elif tag in {'script', 'iframe', 'img', 'audio', 'video', 'source'}:
            assert not attrs.get('src'), 'Unexpected runtime resource'
        if tag == 'link': assert attrs.get('rel') not in {'stylesheet', 'preload', 'modulepreload'}


def validate_publications():
    for name, digest in PUBLICATIONS:
        source = (ROOT / 'publications' / name).read_bytes()
        output = (ROOT / 'dist' / name).read_bytes()
        assert output == source and hashlib.sha256(output).hexdigest() == digest
        if name.endswith('.zip'):
            validate_publication_archive(output, name)
            continue
        text = output.decode('utf-8'); scan(text)
        assert all(term not in text for term in ('libfile_', '/workspace/', 'file_000000'))
        if name.endswith('.html'):
            doc = Document(); doc.feed(text)
            assert '../../dashboard/index.html' in doc.links, 'Publication has no workbench return'
            assert len(doc.images) == (3 if name == 'research/ai-side-income/report.html' else 0)
            for href in doc.links:
                url = urlsplit(href)
                assert url.scheme not in {'javascript', 'data'}
                if url.scheme: continue
                target = (((ROOT / 'dist' / name).parent / url.path) if url.path else ROOT / 'dist' / name).resolve()
                assert target.is_relative_to((ROOT / 'dist').resolve()) and target.is_file(), href
                if url.fragment:
                    target_doc = doc
                    if url.path:
                        assert target.suffix == '.html', href
                        target_doc = Document(); target_doc.feed(target.read_text(encoding='utf-8'))
                    assert url.fragment in target_doc.ids, href

    upstream = json.loads((ROOT / 'dist/research/round3-7/ai-upstream-public.json').read_bytes())
    assert upstream['current_view']['new_qualified_candidate_ranking'] == []
    assert len(upstream['current_view']['research_leads_not_ranking']) == 8
    history = upstream['price_history']
    assert len(history) == len({item['history_id'] for item in history}) == 30
    assert len(upstream['source_catalog']) == 273
    assert len(upstream['evidence_chapters']) == 9
    prior_chapters = {key: upstream['evidence_chapters'][key] for key in ['r3_invoice', 'r3_claude', 'r3_entry', 'r4', 'r5', 'r6', 'r7']}
    assert len(upstream['correction_log']) == 32
    canonical = lambda value: json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    old_chapters = {key: value for key, value in upstream['evidence_chapters'].items() if key != 'invoice_authority_20261003'}
    assert hashlib.sha256(canonical(old_chapters)).hexdigest() == '402b2d2d76fa7dbdc34f2e3a5e0f446117306ff91ad92612859b9a987d9d82b3', 'Prior eight chapters changed'
    invoice = upstream['evidence_chapters']['invoice_authority_20261003']
    assert len(invoice['supplier_matrix']) == 7 and len(invoice['sources']) == 32
    assert all(row[key] is False for row in invoice['supplier_matrix'] for key in ['actual_invoice_verified', 'invoice_transaction_match_verified', 'upstream_qualified'])
    assert upstream['invoice_evidence_delta']['url_index_additions'] == 16
    assert upstream['invoice_evidence_delta']['actual_invoices_verified'] == upstream['invoice_evidence_delta']['new_qualified_upstreams'] == 0
    assert hashlib.sha256(canonical(prior_chapters)).hexdigest() == 'e98c37596997828c3d62599915f456fec285d63d4a081f5954673a64a11b17ea'
    for key, expected in [('price_history', '77f5c9a04e1749cc39adb710713b65cfa455fe4ef33b41e878cb22df2b240a12'), ('current_view', 'befaa5f8bdeec7cac8b5df62cbc815c29f37cee3239d67db1c511ef123ed83d9')]:
        assert hashlib.sha256(canonical(upstream[key])).hexdigest() == expected, 'Prior research meaning changed'
    assert hashlib.sha256(canonical(upstream['correction_log'][:23])).hexdigest() == '9e02241cea1020d5b84dd62b0023ee16b4cd570f305ed69cd29d43b5dd6c397b'
    side = json.loads((ROOT / 'dist/research/ai-side-income/data.json').read_bytes())
    page = (ROOT / 'dist/research/ai-side-income/report.html').read_text(encoding='utf-8')
    embedded = re.search(r'<script[^>]*id="report-data"[^>]*>(.*?)</script>', page, re.S)
    assert embedded and json.loads(embedded.group(1)) == side
    assert side['report_version'] == '1.4' and len(side['options']) == 32 and len(side['sources']) == 153
    for key, digest in [('options', 'ad2c390b4189bd4137b4d8e2e547bf1366fc1103ef0005904daeee2c2749a83b'), ('sources', 'd8b1e5dfc87e45fa35d4b0da758c49098726f78e405512154532bf5b59442fa5'), ('workflow_sample', '8ced36ccef10d3f5f7ac0a799ad1a59d08821ff9f7d853ff62dfc5b67b1b197c')]:
        assert hashlib.sha256(canonical(side[key])).hexdigest() == digest, 'Existing side-income evidence changed'
    status = side['validation']
    assert status['samples_created'] is True and status['created_sample_count'] == 1
    assert status['created_sample_family_ids'] == ['C10'] and status['other_product_samples_created'] is False
    assert status['real_sales_verified'] is False and status['real_account_payout_verified'] is False
    assert status['sample_independent_user_tested'] is False and status['sample_paid_orders_observed'] == 0
    assert status['sample_native_excel_tested'] is False and status['sample_native_calc_xlsx_recalculation'] is False
    sample = side['workflow_sample']
    assert sample['sample_created'] is True and sample['sample_is_formal_product'] is False
    target = sample['website_integration']['download_target']
    zip_bytes = (ROOT / 'dist/research/ai-side-income/sample-v0.1.zip').read_bytes()
    assert target['bytes'] == len(zip_bytes) == 66163
    assert target['sha256'] == hashlib.sha256(zip_bytes).hexdigest()
    candidate = side['workflow_sample_v02']
    assert candidate['family_id'] == 'C10' and candidate['new_product_family'] is False
    assert candidate['sample_is_formal_product'] is False and candidate['paid_orders_observed'] == 0
    assert all(candidate[key] is False for key in ['native_excel_tested', 'native_calc_xlsx_recalculation_passed', 'independent_user_tested', 'real_sales_verified'])
    candidate_bytes = (ROOT / 'dist/research/ai-side-income/sample-v0.2-candidate.zip').read_bytes()
    assert candidate['download']['href'] == 'sample-v0.2-candidate.zip'
    assert candidate['download']['bytes'] == len(candidate_bytes) == 60354
    assert candidate['download']['sha256'] == hashlib.sha256(candidate_bytes).hexdigest()
    assert candidate['download']['recursive_member_count'] == 40 and len(candidate['program_tests']) == 21
    catalog = json.loads((ROOT / 'dist/dashboard/catalog.json').read_bytes())
    by_id = {record['id']: record for record in catalog['records']}
    assert by_id['upstream-round3-7']['task'] == 'project-1'
    assert by_id['side-income-report']['task'] == 'project-17'
    assert by_id['side-income-data']['task'] == 'project-17'
    assert by_id['side-income-sample-v01']['task'] == 'project-17'
    assert by_id['side-income-sample-v01']['url'] == '../research/ai-side-income/sample-v0.1.zip'
    assert by_id['side-income-sample-v02-candidate']['task'] == 'project-17'
    assert by_id['side-income-sample-v02-candidate']['url'] == '../research/ai-side-income/sample-v0.2-candidate.zip'
    assert catalog['counts'] == {'artifacts': 15, 'websites': 4, 'tasks': 17}
    assert by_id['paper-learning-site']['task'] == 'project-6' and by_id['paper-learning-site']['url'] == 'https://1337816143.github.io/Paper/'
    assert by_id['farm-system-site']['task'] == 'project-5' and by_id['farm-system-site']['url'] == 'https://1337816143.github.io/FarmSystemDesign/#research'
    projects = {p['name']: p for p in json.loads((ROOT / 'data/projects.json').read_bytes())['projects']}
    assert 'v0.3.10' in projects['FarmSystemDesign农业系统平台']['progress'] and '未完成' in projects['FarmSystemDesign农业系统平台']['gaps']
    assert '练习题、错题和知识自测' in projects['Paper论文学习平台']['gaps']
    print('PASS: six exact public artifacts, preserved historical evidence, two pinned archives, return/download links and evidence boundaries')


if __name__ == '__main__': validate_publications()
