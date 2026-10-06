"""Static creator runtime, CSP and output boundaries; not a browser test."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from build_creator import CREATOR_FILES, CREATOR_ARTIFACTS
from public_output import assert_output_tree

ROOT = Path(__file__).resolve().parents[1]


class CreatorAudit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.resources = []
        self.hrefs = []
        self.csp = None
        self.in_script = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        assert not any(name.startswith('on') for name in a), 'Inline creator event handler'
        assert 'style' not in a and tag != 'style', 'Inline creator CSS'
        assert tag not in ('iframe', 'object', 'embed', 'base'), 'Unexpected creator embedding'
        if 'id' in a:
            self.ids.append(a['id'])
        if tag == 'script':
            assert a.get('src') in ('appearance-boot.js', 'app.mjs'), 'Unexpected creator entry script'
            self.resources.append(a['src'])
            self.in_script = True
        elif tag == 'link':
            assert a.get('rel') == 'stylesheet' and a.get('href') == 'styles.css', 'Unexpected creator stylesheet'
            self.resources.append(a['href'])
        elif tag in ('img', 'audio', 'video', 'source'):
            assert not a.get('src'), 'Unexpected creator media resource'
        elif tag == 'meta' and a.get('http-equiv', '').lower() == 'content-security-policy':
            self.csp = a.get('content', '')
        elif tag == 'form':
            assert not a.get('action'), 'Creator must not submit remotely'
        if tag == 'a':
            self.hrefs.append(a.get('href', ''))

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False

    def handle_data(self, data):
        if self.in_script:
            assert not data.strip(), 'Inline creator JavaScript'


def validate_creator():
    from validate_archive import scan
    from build import OUTPUT_FILES
    out = ROOT / 'dist'
    assert_output_tree(out, OUTPUT_FILES, complete=True)
    creator = out / 'creator'
    assert_output_tree(creator, CREATOR_FILES, complete=True)
    assert (creator / 'appearance-boot.js').read_bytes() == (ROOT / 'src/appearance-boot.js').read_bytes(), 'Legacy appearance boot changed'
    audit = CreatorAudit()
    audit.feed((creator / 'index.html').read_text())
    assert len(audit.ids) == len(set(audit.ids)), 'Duplicate creator element IDs'
    assert audit.resources == ['appearance-boot.js', 'styles.css', 'app.mjs'], 'Creator appearance must initialize before CSS'
    directives = {}
    for item in (audit.csp or '').split(';'):
        parts = item.strip().split()
        if parts:
            assert parts[0] not in directives, 'Repeated CSP directive'
            directives[parts[0]] = parts[1:]
    for key, values in {'default-src': ["'none'"], 'script-src': ["'self'"], 'style-src': ["'self'"], 'connect-src': ["'none'"], 'object-src': ["'none'"], 'base-uri': ["'none'"], 'form-action': ["'none'"]}.items():
        assert directives.get(key) == values, 'Creator CSP boundary changed: ' + key
    for href in audit.hrefs:
        parsed = urlsplit(href)
        if parsed.scheme:
            assert parsed.scheme in ('https', 'http') and not parsed.username and not parsed.password, 'Unsafe creator link'
        elif parsed.path:
            target = (creator / parsed.path).resolve()
            if target.is_dir():
                target = target / 'index.html'
            assert target.is_relative_to(out.resolve()) and target.is_file(), 'Broken creator local link'
    module_paths = {(creator / name).resolve() for name in CREATOR_FILES if name.endswith(('.mjs', '.js'))}
    module_sources = {name: (creator / name).read_text() for name in CREATOR_FILES if name.endswith(('.mjs', '.js'))}
    # Parse JavaScript without executing it. A regex incorrectly interprets the
    # ordinary string value 'import' as an import statement.
    parser = """import vm from 'node:vm';
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(0,'utf8'));
const output=Object.fromEntries(Object.entries(source).map(([name,text])=>[name,new vm.SourceTextModule(text).dependencySpecifiers]));
process.stdout.write(JSON.stringify(output));"""
    parsed = subprocess.run(['node', '--experimental-vm-modules', '--input-type=module', '-e', parser], input=json.dumps(module_sources), capture_output=True, text=True, check=True)
    imports = json.loads(parsed.stdout)
    for name in CREATOR_FILES:
        assert (creator / name).read_bytes() == (ROOT / 'src/creator' / name).read_bytes(), 'Creator output differs from current source: ' + name
        text = (creator / name).read_text()
        scan(text)
        assert '/workspace/' not in text and 'libfile_' not in text, 'Internal location in creator output'
        assert not re.search(r'__\w+__', text.replace('__proto__', '')), 'Unexpanded creator placeholder'
        if name.endswith(('.js', '.mjs')):
            assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\.sendBeacon\s*\(', text), 'Unexpected creator network API'
            assert not re.search(r'\bimport\s*\(', text), 'Unlisted dynamic creator module'
            for path in imports[name]:
                assert path.startswith(('./', '../')) and (creator / name).parent.joinpath(path).resolve() in module_paths, 'Unlisted creator module dependency'
        elif name.endswith('.css'):
            assert not re.search(r'@import|url\s*\(', text, flags=re.I), 'Unlisted creator CSS resource'
    manifest = json.loads((out / 'release-manifest.json').read_text())
    assert manifest['creator'] == {'schema': 'mydotwork.creator.v1', 'stage': 'stage1-candidate', 'dataMode': 'synthetic', 'privateOriginEnabled': False}
    assert all(not name.endswith('.json') for name in CREATOR_ARTIFACTS), 'Creator browser data must not be a public build input'
    print('PASS: creator explicit runtime, appearance boot, local module graph, no network APIs, CSP and exact public output; browser acceptance remains separate')


if __name__ == '__main__':
    validate_creator()
