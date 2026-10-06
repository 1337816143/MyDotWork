"""Focused offline Stage1 checks; never starts a browser or calls a network API."""
from pathlib import Path
import os
import subprocess
import sys
from build_creator import CREATOR_FILES

ROOT = Path(__file__).resolve().parents[1]
env = dict(os.environ)
env['CREATOR_UI_DIR'] = str(ROOT / 'src/creator')
env['CREATOR_CORE_DIR'] = str(ROOT / 'src/creator/core')
env['CREATOR_CORE_PATH'] = str(ROOT / 'src/creator/core/core.mjs')

for script in ('test_public_output.py', 'test_creator_build.py'):
    subprocess.run([sys.executable, str(ROOT / 'scripts' / script)], cwd=ROOT, env=env, check=True)
for name in CREATOR_FILES:
    if name.endswith(('.mjs', '.js')):
        subprocess.run(['node', '--check', str(ROOT / 'src/creator' / name)], cwd=ROOT, env=env, check=True)
tests = [
    *[str(p.relative_to(ROOT)) for p in sorted((ROOT / 'tests/creator/graph').glob('*.test.mjs'))],
    'tests/creator/core/creator.test.mjs',
    'tests/creator/ui/controller.test.mjs',
    'tests/creator/ui/dom-contract.test.mjs',
    'tests/creator/ui/static.test.mjs',
    'tests/creator/ui/performance.test.mjs',
    'tests/creator/ui/studio-orb.test.mjs',
    'tests/creator/review/review-core.test.mjs',
    'tests/creator/review/review-exchange.test.mjs',
    'tests/creator/review/review-controller.test.mjs',
]
subprocess.run(['node', '--test', *tests], cwd=ROOT, env=env, check=True)
print('PASS: focused offline Stage1 rules, controller, DOM fixture and build boundaries. Real browser acceptance is separate.')
