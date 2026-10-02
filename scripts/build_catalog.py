"""Publish an explicit reviewed catalogue, never discover local or private material."""
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
TYPES = {'report', 'dataset', 'tutorial', 'guide', 'archive', 'website', 'progress'}


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
    assert m['schemaVersion'] == 1
    assert set(m) == {'schemaVersion', 'scope', 'artifacts', 'websites', 'tasks'}
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
    return dict(schemaVersion=1, scope=m['scope'], records=records, tasks=tasks,
                counts=dict(artifacts=len(m['artifacts']), websites=len(m['websites']), tasks=len(tasks)),
                projectSnapshotUpdatedAt=p['updatedAt'])
