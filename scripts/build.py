"""Deterministic public report release from reviewed standalone source."""
import hashlib
import json
import os
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
runpy.run_path(str(ROOT / 'src' / 'build.py'))
source = ROOT / 'src' / 'index.html'
payload = source.read_bytes()
version = (ROOT / 'VERSION').read_text().strip()
(OUT / 'index.html').write_bytes(payload)
(OUT / '.nojekyll').write_text('')
manifest = {
    'schema': 'mydotwork.release.v1',
    'contentVersion': version,
    'sourceCommit': os.environ.get('GITHUB_SHA', 'local'),
    'reportSha256': hashlib.sha256(payload).hexdigest(),
    'reportPath': 'index.html',
    'researchDate': '2026-10-01',
}
(OUT / 'release-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False))
