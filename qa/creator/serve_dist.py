"""Read-only server for the exact manifest-verified build, on the CI runner only."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib
import json
import mimetypes
import os

if os.environ.get('CI') != 'true' or os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('This server is restricted to the approved GitHub candidate runner')

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist'
manifest = json.loads((DIST / 'release-manifest.json').read_text())
if manifest['sourceCommit'] != os.environ['GITHUB_SHA']:
    raise SystemExit('Build source SHA does not match checked-out candidate')
allowed = {item['path']: item['sha256'] for item in manifest['artifacts']}
allowed['release-manifest.json'] = hashlib.sha256((DIST / 'release-manifest.json').read_bytes()).hexdigest()
allowed['.nojekyll'] = hashlib.sha256(b'').hexdigest()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.serve(head=False)

    def do_HEAD(self):
        self.serve(head=True)

    def serve(self, head):
        raw = urlsplit(self.path)
        path = unquote(raw.path)
        if '\x00' in path or '\\' in path or '..' in path.split('/'):
            return self.send_error(400)
        name = path.lstrip('/')
        if not name or name.endswith('/'):
            name += 'index.html'
        if name not in allowed:
            return self.send_error(404)
        file = DIST / name
        if file.is_symlink() or not file.is_file() or not file.resolve().is_relative_to(DIST.resolve()):
            return self.send_error(403)
        payload = file.read_bytes()
        if hashlib.sha256(payload).hexdigest() != allowed[name]:
            return self.send_error(409, 'Build changed after manifest verification')
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript' if file.suffix == '.mjs' else (mimetypes.guess_type(name)[0] or 'application/octet-stream'))
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if not head:
            self.wfile.write(payload)

    def log_message(self, *_):
        pass

ThreadingHTTPServer(('127.0.0.1', 4173), Handler).serve_forever()
