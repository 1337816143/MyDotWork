"""Copy explicitly approved research and sample artifacts without rewriting bytes."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLICATIONS = (
    ('research/round3-7/report.html', '429df06b58d1219e3097697bc45025003a1360a9eb026e3e67cd1f588e7d3598'),
    ('research/round3-7/ai-upstream-public.json', '8ba73d0aa0b5ba8605972801bd6cf3a3b243786c40037f2c0bd82adf6c02c0fa'),
    ('research/ai-side-income/report.html', 'd93d3eb7fc859a7b194c873d201da1372bfdeab41cb8ce853043edc8bb1bb80a'),
    ('research/ai-side-income/data.json', 'dab93d2587a26acc8e1899b2b784c65ec993f0a8aa21e752c64d728a9d9fd9d5'),
    ('research/ai-side-income/sample-v0.1.zip', 'e2f225782e4413a8f55624346f63f1ffd17a9208469ea7d1a82f79701299facc'),
    ('research/ai-side-income/sample-v0.2-candidate.zip', 'a0516f0cb3b6674451464651aef46769906788a56ebe382b1dc388b51eaa688b'),
)
PUBLICATION_ARTIFACTS = [name for name, _ in PUBLICATIONS]


def build_publications(out):
    for name, expected in PUBLICATIONS:
        content = (ROOT / 'publications' / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, 'Reviewed publication changed: ' + name
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
