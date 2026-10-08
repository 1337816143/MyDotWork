"""Validate exact text rendering, provenance coverage, explicit files and secrets."""
import hashlib
import base64
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
from build_archive import ARTIFACTS
from build_research import RESEARCH_ARTIFACTS
from build_dashboard import DASHBOARD_ARTIFACTS
from build_publications import PUBLICATION_ARTIFACTS
from build_creator import CREATOR_ARTIFACTS
from public_output import assert_no_windows_user_paths, assert_no_archive_email_addresses, assert_no_archive_device_names

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
    try:
        assert_no_windows_user_paths(text)
    except ValueError as error:
        raise AssertionError(str(error)) from None
    for pattern in PATTERNS:
        assert not re.search(pattern, text), 'Secret-pattern check failed (value suppressed)'
    for raw in re.findall(r'https?://[^\s<>"\)\]]+', text):
        url = urlsplit(unquote(raw).replace('\\&', '&').replace('&amp;', '&'))
        keys = {k.lower() for k in parse_qs(url.query)}
        assert not keys.intersection({'sig','signature','token','access_token','x-amz-signature','x-goog-signature','api_key','password'}), 'Signed or credential URL (value suppressed)'
        assert not url.username and not url.password, 'URL credentials (value suppressed)'


def scan_archive_message(text):
    scan(text)
    try:
        assert_no_archive_email_addresses(text)
        assert_no_archive_device_names(text)
    except ValueError as error:
        raise AssertionError(str(error)) from None


class TextAudit(HTMLParser):
    def __init__(self, allow_png_previews=False):
        super().__init__(convert_charrefs=True); self.ids=[]; self.messages=[]; self.current=None; self.hrefs=[]
        self.allow_png_previews=allow_png_previews; self.png_previews=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='div' and a.get('class')=='text':self.current=''
        if tag=='a':
            self.hrefs.append(a.get('href',''))
            assert not a.get('href','').lower().startswith(('javascript:','data:')), 'Unsafe URL'
        assert not any(k.lower().startswith('on') for k in a), 'Inline event handler'
        if tag=='img' and a.get('src') and self.allow_png_previews:
            assert a['src'].startswith('data:image/png;base64,'), 'Unexpected preview resource'
            image=base64.b64decode(a['src'].split(',',1)[1],validate=True)
            assert image.startswith(b'\x89PNG\r\n\x1a\n') and len(image)<1500000
            self.png_previews+=1
        elif tag in ['script','iframe','img','audio','video','source']:assert not a.get('src'), 'Unexpected resource'
    def handle_data(self,text):
        if self.current is not None:self.current+=text
    def handle_endtag(self,tag):
        if tag=='div' and self.current is not None:self.messages.append(self.current);self.current=None

def archive_messages_sha256(messages):
    """Hash the exact four-string message schema, identically to the mirror guard."""
    for message in messages:
        assert isinstance(message, dict) and set(message) == {'id', 'role', 'time', 'text'}, 'Unexpected public message fields'
        assert all(isinstance(value, str) for value in message.values()), 'Invalid public message value'
    canonical = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(canonical).hexdigest()


def validate_archive_integrity(messages, increment, integrity):
    """Recover preserved and added records by reviewed IDs, including early backfills."""
    ids = [message['id'] for message in messages]
    assert all(isinstance(value, str) and re.fullmatch(r'Sentinel_[a-z0-9]+', value) for value in ids), 'Invalid public message ID'
    assert len(ids) == len(set(ids)), 'Duplicate public message ID'
    assert all(message['role'] in ('user', 'assistant') for message in messages), 'Invalid public message role'
    for field in ('baselineMessageCount', 'returnedRecordCount', 'uniqueCandidateCount', 'pageOverlapDuplicateCount', 'overlapByIdCount', 'newMessageCount', 'newNonemptyTextCount', 'newEmptyTextCount', 'controlExcludedCount', 'partialPageCount', 'newSecretRedactionCount'):
        assert type(increment[field]) is int and 0 <= increment[field] <= 2**53 - 1, 'Invalid archive increment ' + field
    assert type(integrity['schemaVersion']) is int and integrity['schemaVersion'] == 2, 'Archive integrity requires schema 2'
    for field in ('baselineMessageCount', 'approvedMessageCount', 'incrementMessageCount'):
        assert type(integrity[field]) is int and 0 <= integrity[field] <= 2**53 - 1, 'Invalid integrity ' + field
    for field in ('baselineMessagesSha256', 'approvedMessagesSha256'):
        assert isinstance(integrity[field], str) and re.fullmatch(r'[a-f0-9]{64}', integrity[field]), 'Invalid integrity ' + field
    assert increment['baselineMessagesSha256'] == integrity['baselineMessagesSha256'], 'Baseline approval hashes differ'
    assert increment['baselineMessageCount'] == integrity['baselineMessageCount'], 'Baseline approval counts differ'
    assert increment['newMessageCount'] == integrity['incrementMessageCount'], 'Increment approval counts differ'
    for record in (increment, integrity):
        new_ids = record.get('newMessageIds')
        assert isinstance(new_ids, list) and all(isinstance(value, str) and re.fullmatch(r'Sentinel_[a-z0-9]+', value) for value in new_ids), 'Missing or invalid new message IDs'
        assert len(new_ids) == len(set(new_ids)), 'Duplicate new message ID'
        assert len(new_ids) == increment['newMessageCount'], 'New message ID count differs'
        assert set(new_ids).issubset(ids), 'Unknown new message ID'
    new_ids = set(increment['newMessageIds'])
    assert new_ids == set(integrity['newMessageIds']), 'Approved new message ID sets differ'
    baseline = [message for message in messages if message['id'] not in new_ids]
    added = [message for message in messages if message['id'] in new_ids]
    assert len(baseline) == increment['baselineMessageCount'], 'Baseline message count differs'
    assert increment['baselineMessageCount'] + increment['newMessageCount'] == len(messages), 'Archive increment does not add up'
    assert increment['returnedRecordCount'] == increment['uniqueCandidateCount'] + increment['pageOverlapDuplicateCount'], 'Returned archive records do not reconcile'
    assert increment['uniqueCandidateCount'] == increment['overlapByIdCount'] + increment['newMessageCount'] + increment['controlExcludedCount'], 'Unique archive candidates do not reconcile'
    assert increment['overlapByIdCount'] <= increment['baselineMessageCount'] and increment['newSecretRedactionCount'] <= increment['newMessageCount'], 'Archive increment exceeds its source scope'
    assert increment['newNonemptyTextCount'] == sum(bool(message['text']) for message in added), 'New nonempty message count differs'
    assert increment['newEmptyTextCount'] == sum(not message['text'] for message in added), 'New empty message count differs'
    assert type(increment['allPagesPartial']) is bool and type(integrity['partialPages']) is bool, 'Missing partial-page boundary'
    assert not increment['allPagesPartial'] or increment['partialPageCount'] > 0, 'Partial increment must identify partial pages'
    assert integrity['partialPages'] == (increment['partialPageCount'] > 0), 'Approved partial-page boundaries differ'
    assert archive_messages_sha256(baseline) == integrity['baselineMessagesSha256'], 'Previously published original messages changed'
    assert len(messages) == integrity['approvedMessageCount'], 'Approved message count differs'
    assert archive_messages_sha256(messages) == integrity['approvedMessagesSha256'], 'Reviewed messages changed'


def validate_no_platform_control_cards(messages):
    assert not any(message['role'] == 'assistant' and (
        re.fullmatch(r'Allow GitHub to create a Git blob\?\s*', message['text'])
        or message['text'].startswith(('Update custom rule?\n', 'Save custom rule?\n'))
    ) for message in messages), 'Platform control card is not chat original text'


def validate():
    source=json.loads((ROOT/'data/dot-chat.json').read_text())
    chat=json.loads((ROOT/'dist/chat/messages.json').read_text())
    assert source['messages']==chat['messages'], 'Archived original text changed'
    assert source['coverage']['start']==chat['coverage']['start']
    assert source['coverage']['end']==chat['coverage']['end']
    assert chat['coverage']['messageCount']==len(chat['messages'])
    assert type(chat['coverage']['readApiHistoryExhausted']) is bool
    increment = chat['coverage']['latestIncrement']
    assert increment['allPagesPartial'] is True and increment['partialPageCount'] == 5
    assert chat['coverage']['readApiHistoryExhausted'] is False, 'Partial pages cannot prove exhaustive coverage'
    integrity = json.loads((ROOT/'data/chat-integrity.json').read_bytes())
    validate_archive_integrity(chat['messages'], increment, integrity)
    validate_no_platform_control_cards(chat['messages'])
    assert min(m['time'] for m in chat['messages'])==chat['coverage']['start']
    assert max(m['time'] for m in chat['messages'])==chat['coverage']['end']
    projects=json.loads((ROOT/'dist/projects/status.json').read_text())
    assert projects==json.loads((ROOT/'data/projects.json').read_text())
    for message in chat['messages']:scan_archive_message(message['text'])
    scan(json.dumps(projects,ensure_ascii=False))
    scan((ROOT/'data/research-2026-10-02.json').read_text())
    newer=(ROOT/'data/research-2026-10-02-round2.json').read_text()
    scan(newer)
    assert '/workspace/' not in newer and 'libfile_' not in newer
    group=projects['projects'][0]
    assert group['name']=='AI上游调研' and isinstance(group['status'],str) and group['status'].strip()
    assert len(group['children'])==4 and all(isinstance(c['status'],str) and c['status'].strip() for c in group['children'])
    round2=json.loads(newer)
    assert len(round2['routes']['routes'])==11 and len(round2['routes']['sources'])==55
    html2=(ROOT/'dist/research/2026-10-02-round2.html').read_text()
    assert html2.count('data-eligibility=')==10 and '标准条款禁止转售' in html2 and '同SKU' in html2
    manifest=json.loads((ROOT/'dist/release-manifest.json').read_text())
    entries={x['path']:x for x in manifest['artifacts']}
    assert set(entries)=={'index.html',*ARTIFACTS,*RESEARCH_ARTIFACTS,*DASHBOARD_ARTIFACTS,*PUBLICATION_ARTIFACTS,*CREATOR_ARTIFACTS}, 'Unexpected publication file'
    for name,entry in entries.items():
        content=(ROOT/'dist'/name).read_bytes()
        assert hashlib.sha256(content).hexdigest()==entry['sha256'] and len(content)==entry['bytes']
        if name in CREATOR_ARTIFACTS:
            # Creator has reviewed local ES modules; its own audit rejects all
            # resources outside that exact runtime allowlist.
            continue
        if name.endswith('.html'):
            audit=TextAudit(allow_png_previews=name=='research/ai-side-income/report.html');audit.feed(content.decode())
            assert audit.png_previews==(3 if name=='research/ai-side-income/report.html' else 0)
            assert len(audit.ids)==len(set(audit.ids))
            if name=='chat/index.html':
                assert audit.messages==[m['text'] for m in chat['messages']], 'Escaped HTML differs from original text'
                header = content.decode().split('<article', 1)[0]
                assert '本次为部分分页返回' in header and '已分页读取到工具可见历史末尾' not in header
            for href in audit.hrefs:
                if href.startswith(('#','http:','https:','mailto:')):continue
                dest=(ROOT/'dist'/name).parent/href.split('#')[0].split('?')[0]
                assert dest.exists(), 'Broken local archive link: '+href
    print(f"PASS: {len(chat['messages'])} exact rendered messages; {len(projects['projects'])} projects; coverage, links, hashes and credential scans")

if __name__=='__main__':validate()
