"""Validate exact text rendering, provenance coverage, explicit files and secrets."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
from build_archive import ARTIFACTS
from build_research import RESEARCH_ARTIFACTS

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = [
    r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    r'\bgithub_pat_[A-Za-z0-9_]{20,}\b', r'\bgh[oprsu]_[A-Za-z0-9]{20,}\b',
    r'\b(?:sk|nvapi)-[A-Za-z0-9_-]{24,}\b', r'\bAKIA[0-9A-Z]{16}\b',
    r'(?i)(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["\']?[A-Za-z0-9_\-/.+=]{12,}',
    r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b',
    r'(?<!\d)\d{17}[\dXx](?!\d)',
]

def scan(text):
    for pattern in PATTERNS:
        assert not re.search(pattern, text), 'Secret-pattern check failed (value suppressed)'
    for raw in re.findall(r'https?://[^\s<>"\)\]]+', text):
        url = urlsplit(unquote(raw).replace('\\&', '&').replace('&amp;', '&'))
        keys = {k.lower() for k in parse_qs(url.query)}
        assert not keys.intersection({'sig','signature','token','access_token','x-amz-signature','x-goog-signature','api_key','password'}), 'Signed or credential URL (value suppressed)'
        assert not url.username and not url.password, 'URL credentials (value suppressed)'

class TextAudit(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.ids=[]; self.messages=[]; self.current=None; self.hrefs=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='div' and a.get('class')=='text':self.current=''
        if tag=='a':
            self.hrefs.append(a.get('href',''))
            assert not a.get('href','').lower().startswith(('javascript:','data:')), 'Unsafe URL'
        assert not any(k.lower().startswith('on') for k in a), 'Inline event handler'
        if tag in ['script','iframe','img','audio','video','source']:assert not a.get('src'), 'Unexpected resource'
    def handle_data(self,text):
        if self.current is not None:self.current+=text
    def handle_endtag(self,tag):
        if tag=='div' and self.current is not None:self.messages.append(self.current);self.current=None

def validate():
    source=json.loads((ROOT/'data/dot-chat.json').read_text())
    chat=json.loads((ROOT/'dist/chat/messages.json').read_text())
    assert source['messages']==chat['messages'], 'Archived original text changed'
    assert source['coverage']['start']==chat['coverage']['start']
    assert source['coverage']['end']==chat['coverage']['end']
    assert chat['coverage']['messageCount']==len(chat['messages'])
    assert chat['coverage']['readApiHistoryExhausted'] is True
    assert min(m['time'] for m in chat['messages'])==chat['coverage']['start']
    assert max(m['time'] for m in chat['messages'])==chat['coverage']['end']
    projects=json.loads((ROOT/'dist/projects/status.json').read_text())
    assert projects==json.loads((ROOT/'data/projects.json').read_text())
    for message in chat['messages']:scan(message['text'])
    scan(json.dumps(projects,ensure_ascii=False))
    scan((ROOT/'data/research-2026-10-02.json').read_text())
    newer=(ROOT/'data/research-2026-10-02-round2.json').read_text()
    scan(newer)
    assert '/workspace/' not in newer and 'libfile_' not in newer
    group=projects['projects'][0]
    assert group['name']=='AI上游调研' and group['status']=='进行中'
    assert len(group['children'])==4 and all(c['status']=='进行中' for c in group['children'])
    round2=json.loads(newer)
    assert len(round2['routes']['routes'])==11 and len(round2['routes']['sources'])==55
    html2=(ROOT/'dist/research/2026-10-02-round2.html').read_text()
    assert html2.count('data-eligibility=')==10 and '标准条款禁止转售' in html2 and '同SKU' in html2
    manifest=json.loads((ROOT/'dist/release-manifest.json').read_text())
    entries={x['path']:x for x in manifest['artifacts']}
    assert set(entries)=={'index.html',*ARTIFACTS,*RESEARCH_ARTIFACTS}, 'Unexpected publication file'
    for name,entry in entries.items():
        content=(ROOT/'dist'/name).read_bytes()
        assert hashlib.sha256(content).hexdigest()==entry['sha256'] and len(content)==entry['bytes']
        if name.endswith('.html'):
            audit=TextAudit();audit.feed(content.decode())
            assert len(audit.ids)==len(set(audit.ids))
            if name=='chat/index.html':
                assert audit.messages==[m['text'] for m in chat['messages']], 'Escaped HTML differs from original text'
            for href in audit.hrefs:
                if href.startswith(('#','http:','https:','mailto:')):continue
                dest=(ROOT/'dist'/name).parent/href.split('#')[0].split('?')[0]
                assert dest.exists(), 'Broken local archive link: '+href
    print(f"PASS: {len(chat['messages'])} exact rendered messages; {len(projects['projects'])} projects; coverage, links, hashes and credential scans")

if __name__=='__main__':validate()
