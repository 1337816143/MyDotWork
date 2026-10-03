"""Audit one explicitly reviewed ZIP, including nested ZIP and OOXML members."""
import hashlib
import io
import json
import re
import stat
import zipfile
from pathlib import Path
from validate_archive import scan

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {'.txt', '.json', '.csv', '.xml', '.rels'}
ARCHIVE_SUFFIXES = {'.zip', '.xlsx', '.docx'}


def inspect_archive(content, prefix='', depth=0, budget=None):
    assert depth <= 3, 'Archive nesting exceeds reviewed scope'
    budget = budget if budget is not None else [0, 0]
    records = []
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert not archive.comment, 'Unexpected archive comment'
        names = set()
        for info in archive.infolist():
            name = info.filename
            assert name and not name.startswith('/') and '\\' not in name and ':' not in name
            assert all(part and part not in {'.', '..'} for part in name.split('/')), 'Unsafe archive path'
            assert name not in names and not info.is_dir(), 'Duplicate or directory member'
            names.add(name)
            assert not info.flag_bits & 1 and info.compress_type in {0, 8}, 'Encrypted or unsupported archive'
            assert not info.extra and not info.comment, 'Unexpected archive metadata'
            mode = info.external_attr >> 16
            assert not stat.S_ISLNK(mode) and (stat.S_IFMT(mode) in {0, stat.S_IFREG}), 'Unsupported member type'
            assert 0 <= info.file_size <= 3000000, 'Oversized archive member'
            budget[0] += info.file_size; budget[1] += 1
            assert budget[0] <= 10000000 and budget[1] <= 100, 'Archive expansion exceeds reviewed scope'
            assert info.file_size <= max(info.compress_size * 200, 1000000), 'Unexpected compression ratio'
            data = archive.read(info)  # ZipFile verifies CRC before returning bytes.
            assert len(data) == info.file_size
            member = prefix + name
            records.append(dict(path=member, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))
            suffix = '.rels' if Path(name).name == '.rels' else Path(name).suffix.lower()
            if suffix in ARCHIVE_SUFFIXES:
                records.extend(inspect_archive(data, member + '!/', depth + 1, budget))
            elif suffix in TEXT_SUFFIXES:
                text = data.decode('utf-8-sig')
                scan(text)
                assert not re.search(r'libfile_[a-z0-9]+|file_000000|/(?:workspace|Users)/', text.replace('\\', '/')), 'Private archive marker'
                if suffix in {'.xml', '.rels'}:
                    assert not re.search(r'TargetMode\s*=\s*[\"\']External[\"\']|vbaProject|oleObject|externalLink|WEBSERVICE\(|HYPERLINK\(', text, re.I), 'External or active OOXML content'
                if suffix == '.csv':
                    import csv
                    assert all(not value.startswith(('=', '+', '-', '@', '\t', '\r')) for row in csv.reader(io.StringIO(text)) for value in row), 'Unexpected CSV formula'
            else:
                assert suffix in {'.png', '.jpeg', '.jpg'}, 'Unreviewed archive member format'
                assert (suffix == '.png' and data.startswith(b'\x89PNG\r\n\x1a\n')) or (suffix in {'.jpeg', '.jpg'} and data.startswith(b'\xff\xd8\xff'))
                for marker in (b'libfile_', b'file_000000', b'/workspace/', b'-----BEGIN', b'github_pat_'):
                    assert marker not in data, 'Private marker in archive image'
    return records


def validate_publication_archive(content, name):
    manifest = json.loads((ROOT / 'data/publication-archives.json').read_bytes())
    assert manifest['schemaVersion'] == 1 and set(manifest['archives']) == {'research/ai-side-income/sample-v0.1.zip'}
    expected = manifest['archives'][name]
    assert len(content) == expected['bytes'] and hashlib.sha256(content).hexdigest() == expected['sha256'], 'Reviewed archive bytes changed'
    actual = inspect_archive(content)
    assert sorted(actual, key=lambda row: row['path']) == sorted(expected['members'], key=lambda row: row['path']), 'Reviewed archive members changed'
    return actual
