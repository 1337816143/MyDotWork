"""Copy four explicitly approved standalone research artifacts without rewriting bytes."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLICATIONS = (
    ('research/round3-7/report.html', '0a9d47f80295bf5dad7c9d01896c7c5848a0917f8b7c2b7cee0a4bb55e7efd18'),
    ('research/round3-7/ai-upstream-public.json', '3756213461b52e42e5ffde0df67e53093f9ff4d530a41efcb7a6e68dc95024e4'),
    ('research/ai-side-income/report.html', '8424d2180ba2e6fd4a2da158690959d73c0ec2b39191cbd0d91014522d8617d0'),
    ('research/ai-side-income/data.json', 'b1d21cdc9afb54c470ababaeedb3bffa25d556300e98745a028bec9eea0c1170'),
)
PUBLICATION_ARTIFACTS = [name for name, _ in PUBLICATIONS]


def build_publications(out):
    for name, expected in PUBLICATIONS:
        content = (ROOT / 'publications' / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, 'Reviewed publication changed: ' + name
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
