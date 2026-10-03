"""Catalogue approval, sources and standalone build checks; no private discovery."""
import copy
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime
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

# These catalogue entries describe explicit public outputs. Keep their visible
# counts and timestamps tied to that same release, without reading other chats.
archive=json.loads((ROOT/'dist/chat/messages.json').read_bytes())
coverage=json.loads((ROOT/'dist/chat/coverage.json').read_bytes())
project_output=json.loads((ROOT/'dist/projects/status.json').read_bytes())

def validate_archive_catalog(catalog, public_archive, public_coverage, public_projects):
    records={record['id']:record for record in catalog['records']}
    chat=records['public-chat-archive'];project=records['public-project-data']
    messages=public_archive['messages']
    count=len(messages);nonempty=sum(bool(message['text']) for message in messages)
    assert len({message['id'] for message in messages})==count
    assert public_archive['coverage']==public_coverage
    assert public_coverage['messageCount']==count
    assert public_coverage['userCount']==sum(message['role']=='user' for message in messages)
    assert public_coverage['assistantCount']==sum(message['role']=='assistant' for message in messages)
    assert chat['summary'].startswith(f'{count}条已授权公开记录，其中{nonempty}条有文字；'), 'Stale chat catalogue count'
    parse=lambda value:datetime.fromisoformat(value.replace('Z','+00:00'))
    assert parse(chat['updatedAt'])==parse(public_coverage['end']), 'Stale chat catalogue timestamp'
    assert parse(project['updatedAt'])==parse(public_projects['updatedAt']), 'Stale project catalogue timestamp'
    assert chat['url']=='../chat/index.html' and chat['task']=='project-4'
    assert project['url']=='../projects/status.json' and project['task']=='project-4'
    assert catalog['counts']['tasks']==len(public_projects['projects'])

validate_archive_catalog(actual,archive,coverage,project_output)
snapshot=actual['statusSnapshot']
assert snapshot['coverage']['messageCount']==len(archive['messages'])
assert snapshot['coverage']['nonemptyCount']==sum(bool(m['text']) for m in archive['messages'])
assert snapshot['coverage']['end']==coverage['end']
assert snapshot['coverage']['partial']==(not coverage['readApiHistoryExhausted'])
message_ids={m['id'] for m in archive['messages']}
for item in snapshot['items']:
    assert set(item['evidenceMessageIds'])<=message_ids, 'Task has no public original evidence'
    assert '完成' not in item['state']  # State values are the four reviewed enum keys.
for note in snapshot['decisions']:
    assert note['messageId'] in message_ids and set(note['supersedes'])<=message_ids
for mutate in [lambda m:m['statusSnapshot'].update(mode='realtime'),lambda m:m['statusSnapshot']['items'][0].update(state='complete'),lambda m:m['statusSnapshot']['items'][0].update(waitingFor=''),lambda m:m['statusSnapshot']['items'][0].update(metadataApproved=False),lambda m:m['statusSnapshot']['items'][0]['links'][0].update(url='https://chatgpt.com/private'),lambda m:m['statusSnapshot']['items'][0].update(verifiedAt='2099-01-01T00:00:00Z')]:
    bad=copy.deepcopy(manifest);mutate(bad)
    try:load_catalog(bad,projects)
    except AssertionError:pass
    else:raise AssertionError('Unverified state metadata accepted')
for record_id, field, stale in [('public-chat-archive','summary','229条已授权公开记录，其中224条有文字；'),('public-chat-archive','updatedAt','2026-10-02T05:58:03.520076Z'),('public-chat-archive','url','../projects/index.html'),('public-project-data','updatedAt','2026-10-02T14:20:00Z')]:
    bad=copy.deepcopy(actual)
    next(record for record in bad['records'] if record['id']==record_id)[field]=stale
    try:validate_archive_catalog(bad,archive,coverage,project_output)
    except AssertionError:pass
    else:raise AssertionError('Stale catalogue metadata accepted')
bad_coverage=copy.deepcopy(coverage);bad_coverage['messageCount']-=1
try:validate_archive_catalog(actual,archive,bad_coverage,project_output)
except AssertionError:pass
else:raise AssertionError('Inconsistent public archive count accepted')
print('PASS: catalogue counts, nonempty text, roles, timestamps and targets match public archive/project outputs; stale metadata rejected')

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

for item in snapshot['items']:
    for link in item['links']:
        url=urlsplit(link['url'])
        if url.scheme:continue
        target=((ROOT/'dist/dashboard')/url.path).resolve() if url.path else (ROOT/'dist/dashboard/index.html').resolve()
        assert target.is_relative_to((ROOT/'dist').resolve()) and target.is_file(),link['url']
        if url.fragment:
            parser=IDs();parser.feed(target.read_text(encoding='utf-8'));assert url.fragment in parser.ids,link['url']
print('PASS: seven dated task states, current actions, waiting objects, completion boundaries and direct outcome/evidence links')

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
