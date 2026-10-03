"""Copy explicitly approved research and sample artifacts without rewriting bytes."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLICATIONS = (
    ('research/round3-7/report.html', '946bb08b6a5641a04f9b3711e75d47e3c1af2c86a4fdbcca0cc5eb0a14901d78'),
    ('research/round3-7/ai-upstream-public.json', '4988275387722e3ba94f0b5c2e64d87b0164cba6eaa730e027a4d7fb421a3442'),
    ('research/ai-side-income/report.html', '95dbdd4535bc3d82c5188c55914fd0f27a2e2cd55ddbf2bb7f2244aa24e13052'),
    ('research/ai-side-income/data.json', 'c66b165efe957227cf3773e652e0d695dc90447ece19a47f3213320a8c519253'),
    ('research/ai-side-income/sample-v0.1.zip', 'e2f225782e4413a8f55624346f63f1ffd17a9208469ea7d1a82f79701299facc'),
)
PUBLICATION_ARTIFACTS = [name for name, _ in PUBLICATIONS]


def build_publications(out):
    for name, expected in PUBLICATIONS:
        content = (ROOT / 'publications' / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, 'Reviewed publication changed: ' + name
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
