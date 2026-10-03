"""Publish an explicit reviewed catalogue, never discover local or private material."""
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TYPES = {'report', 'dataset', 'tutorial', 'guide', 'archive', 'website', 'progress'}
STATES = {'running', 'waiting', 'blocked', 'round_complete'}


def approved_url(value):
    assert isinstance(value, str) and value and not any(c in value for c in '\r\n\\'), 'Invalid catalogue URL'
    u = urlsplit(value)
    assert not u.username and not u.password and not u.query, 'Credentials and query URLs cannot be published'
    if u.scheme:
        assert u.scheme == 'https' and u.hostname, 'Only HTTPS external sources'
        assert u.hostname not in {'chatgpt.com', 'chat.openai.com'}, 'Keep Library links out of the public manifest'
    else:
        assert not u.netloc and (value.startswith('#') or value.startswith('../')), 'Expected dashboard-relative source'
    return value


def timestamp(value):
    assert value is None or isinstance(value, str)
    if value is not None:
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?', value), 'Use an ISO date or an explicitly zoned timestamp'
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    return value


def load_catalog(manifest=None, projects=None):
    m = manifest if manifest is not None else json.loads((ROOT/'data/workbench-catalog.json').read_text(encoding='utf-8'))
    p = projects if projects is not None else json.loads((ROOT/'data/projects.json').read_text(encoding='utf-8'))
    assert m['schemaVersion'] == 3
    assert set(m) == {'schemaVersion', 'scope', 'artifacts', 'websites', 'tasks', 'statusSnapshot'}
    tasks = []
    for ref in m['tasks']:
        assert set(ref) == {'id', 'projectIndex', 'expectedTitle', 'metadataApproved', 'access'}
        assert ref['metadataApproved'] is True and ref['access'] in {'public', 'login'}, 'Metadata must be explicitly approved'
        i = ref['projectIndex']
        assert isinstance(i, int) and 1 <= i <= len(p['projects'])
        source = p['projects'][i-1]
        assert source['name'] == ref['expectedTitle'], 'Project order or title changed: review task mapping'
        children = []
        for child in source.get('children', []):
            assert set(child) == {'name', 'status', 'progress', 'gaps'}, 'Review new subtask metadata fields before publication'
            children.append({k: child[k] for k in ('name', 'status', 'progress', 'gaps')})
        tasks.append(dict(id=ref['id'], title=source['name'], status=source['status'],
                          progress=source['progress'], gaps=source['gaps'], updatedAt=timestamp(source['asOf']),
                          evidence=source['evidenceLevel'], children=children,
                          access=ref['access'], metadataApproved=True,
                          url=f'../projects/index.html#project-{i}', source='../projects/status.json'))
    ids = [t['id'] for t in tasks]
    assert len(ids) == len(set(ids))
    records = []
    for category in ('artifacts', 'websites'):
        for record in m[category]:
            assert set(record) == {'id', 'title', 'type', 'task', 'url', 'updatedAt', 'summary', 'access', 'metadataApproved'}
            assert record['metadataApproved'] is True and record['access'] in {'public', 'login'}, 'No implicit metadata publication'
            assert record['task'] in ids and record['type'] in TYPES
            assert (category == 'websites') == (record['type'] == 'website')
            assert all(isinstance(record[k], str) and record[k] for k in ('id', 'title', 'summary'))
            assert re.fullmatch(r'[a-z0-9-]+', record['id'])
            approved_url(record['url']); timestamp(record['updatedAt'])
            records.append(dict(record, category=category, source=record['url']))
    for t in tasks:
        records.append(dict(id='progress-'+t['id'], title=t['title']+' · 公开进度快照', type='progress',
                            task=t['id'], url=t['url'], source=t['source'], updatedAt=t['updatedAt'],
                            summary=t['progress'], access=t['access'], metadataApproved=True, category='tasks'))
    assert len({r['id'] for r in records}) == len(records)
    snapshot = m['statusSnapshot']
    validate_status_snapshot(snapshot, set(ids))
    return dict(schemaVersion=3, scope=m['scope'], records=records, tasks=tasks,
                counts=dict(artifacts=len(m['artifacts']), websites=len(m['websites']), tasks=len(tasks)),
                projectSnapshotUpdatedAt=p['updatedAt'], statusSnapshot=snapshot)


def validate_status_snapshot(snapshot, project_ids):
    assert set(snapshot) == {'mode', 'asOf', 'notice', 'items', 'coverage', 'decisions', 'staleAfterMinutes', 'publicationChecks'}
    assert snapshot['mode'] == 'snapshot', 'Static data cannot claim real-time monitoring'
    assert snapshot['staleAfterMinutes'] == 30
    timestamp(snapshot['asOf'])
    assert 'T' in snapshot['asOf'] and '不是实时' in snapshot['notice']
    assert len(snapshot['items']) == 7
    assert [item['number'] for item in snapshot['items']] == list(range(1, 8))
    for item in snapshot['items']:
        assert set(item) == {'id', 'number', 'title', 'state', 'currentAction', 'waitingFor', 'verifiedAt', 'publication', 'completion', 'links', 'projectIds', 'contextMessageIds', 'verification', 'access', 'metadataApproved'}
        assert item['id'] == 'task-' + str(item['number']) and item['state'] in STATES
        assert item['access'] == 'public' and item['metadataApproved'] is True
        assert all(isinstance(item[key], str) and item[key].strip() for key in ['title', 'currentAction', 'waitingFor', 'publication', 'completion'])
        timestamp(item['verifiedAt'])
        assert 'T' in item['verifiedAt'] and datetime.fromisoformat(item['verifiedAt'].replace('Z', '+00:00')) <= datetime.fromisoformat(snapshot['asOf'].replace('Z', '+00:00'))
        assert 1 <= len(item['links']) <= 3
        for link in item['links']:
            assert set(link) == {'label', 'url'} and isinstance(link['label'], str) and link['label'].strip()
            approved_url(link['url'])
        assert item['projectIds'] and set(item['projectIds']) <= project_ids
        assert item['contextMessageIds'] and all(re.fullmatch(r'Sentinel_[a-z0-9]+', value) for value in item['contextMessageIds'])
        proof = item['verification']
        assert set(proof) == {'kind', 'summary', 'observedAt', 'links'}
        assert proof['kind'] in {'project_check', 'public_release'} and isinstance(proof['summary'], str) and proof['summary'].strip()
        timestamp(proof['observedAt'])
        if proof['observedAt'] is not None:
            assert 'T' in proof['observedAt'] and datetime.fromisoformat(proof['observedAt'].replace('Z', '+00:00')) <= datetime.fromisoformat(item['verifiedAt'].replace('Z', '+00:00'))
        assert isinstance(proof['links'], list) and len(proof['links']) <= 3
        if proof['kind'] == 'public_release': assert proof['links'], 'Public-release verification needs a public source'
        for link in proof['links']:
            assert set(link) == {'label', 'url'} and isinstance(link['label'], str) and link['label'].strip()
            approved_url(link['url'])
    coverage = snapshot['coverage']
    assert set(coverage) == {'messageCount', 'nonemptyCount', 'end', 'partial', 'summary'}
    assert type(coverage['partial']) is bool and 0 <= coverage['nonemptyCount'] <= coverage['messageCount']
    timestamp(coverage['end'])
    publication = snapshot['publicationChecks']
    assert set(publication) == {'checkedAt', 'source', 'mirror', 'status'} and publication['status'] == 'consistent'
    timestamp(publication['checkedAt'])
    check_time = datetime.fromisoformat(publication['checkedAt'].replace('Z', '+00:00'))
    assert check_time <= datetime.fromisoformat(snapshot['asOf'].replace('Z', '+00:00'))
    for kind, repository, fields in [('source', 'MyDotWork', {'version','commit','deployedAt','runId','runUrl'}), ('mirror', 'Evolution', {'version','upstreamCommit','sourceCommit','commit','syncedAt','deployedAt','runId','runUrl'})]:
        record = publication[kind]
        assert set(record) == fields and re.fullmatch(r'\d+\.\d+\.\d+', record['version'])
        assert type(record['runId']) is int and record['runId'] > 0
        assert record['runUrl'] == f'https://github.com/1337816143/{repository}/actions/runs/{record["runId"]}'
        for key in fields & {'commit','sourceCommit','upstreamCommit'}: assert re.fullmatch(r'[a-f0-9]{40}', record[key])
        for key in fields & {'deployedAt','syncedAt'}:
            timestamp(record[key]); assert 'T' in record[key] and datetime.fromisoformat(record[key].replace('Z', '+00:00')) <= check_time
    assert publication['source']['commit'] == publication['mirror']['upstreamCommit']
    assert publication['source']['version'] == publication['mirror']['version']
    for note in snapshot['decisions']:
        assert set(note) == {'title', 'summary', 'messageId', 'supersedes'}
        assert all(isinstance(note[key], str) and note[key] for key in ['title', 'summary', 'messageId'])
        assert note['messageId'] not in note['supersedes']
