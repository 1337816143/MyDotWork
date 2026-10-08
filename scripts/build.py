"""Deterministic public report release from reviewed standalone source."""
import hashlib
import json
import os
import runpy
import shutil
import tempfile
from build_archive import build_archive, ARTIFACTS
from build_research import build_research, RESEARCH_ARTIFACTS
from build_dashboard import build_dashboard, DASHBOARD_ARTIFACTS
from build_publications import build_publications, PUBLICATION_ARTIFACTS
from build_creator import build_creator, CREATOR_ARTIFACTS
from public_output import assert_output_tree, install_output
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'
PUBLIC_ARTIFACTS = ['index.html', *ARTIFACTS, *RESEARCH_ARTIFACTS, *DASHBOARD_ARTIFACTS, *PUBLICATION_ARTIFACTS, *CREATOR_ARTIFACTS]
OUTPUT_FILES = [*PUBLIC_ARTIFACTS, '.nojekyll', 'release-manifest.json']


def build():
    assert_output_tree(OUT, OUTPUT_FILES)
    staged = Path(tempfile.mkdtemp(prefix='.build-public-', dir=ROOT))
    try:
        runpy.run_path(str(ROOT / 'src' / 'build.py'))
        payload = (ROOT / 'src/index.html').read_bytes()
        version = (ROOT / 'VERSION').read_text().strip()
        (staged / 'index.html').write_bytes(payload)
        (staged / '.nojekyll').write_text('')
        manifest = {
            'schema': 'mydotwork.release.v1',
            'contentVersion': version,
            'sourceCommit': os.environ.get('GITHUB_SHA', 'local'),
            'reportSha256': hashlib.sha256(payload).hexdigest(),
            'reportPath': 'index.html',
            # Latest bounded research observation; individual offer dates remain authoritative.
            'researchDate': '2026-10-08',
            'baselineResearchDate': '2026-10-01',
            'researchVersion': '1.8.12',
            # Historical dates of research/2026-10-02.html and its round2 supplement.
            'supplementResearchDate': '2026-10-02',
            'creator': {'schema': 'mydotwork.creator.v1', 'stage': 'stage1-candidate', 'dataMode': 'synthetic', 'privateOriginEnabled': False},
        }
        coverage = build_archive(staged, version)
        build_research(staged, version)
        build_dashboard(staged, version)
        build_publications(staged)
        build_creator(staged)
        manifest['archive'] = {'source': 'current-dot-visible-chat', 'messageCount': coverage['messageCount'], 'start': coverage['start'], 'end': coverage['end']}
        manifest['artifacts'] = [{'path': name, 'sha256': hashlib.sha256((staged/name).read_bytes()).hexdigest(), 'bytes': (staged/name).stat().st_size} for name in PUBLIC_ARTIFACTS]
        (staged / 'release-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        install_output(staged, OUT, OUTPUT_FILES)
        print(json.dumps(manifest, ensure_ascii=False))
        return manifest
    finally:
        if staged.exists():
            shutil.rmtree(staged)


if __name__ == '__main__':
    build()
