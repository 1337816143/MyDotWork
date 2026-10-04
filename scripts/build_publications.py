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
    ('research/2026-10-03/index.html', '46ff24ec67200a9723885b945135e666d2f60bfd90bafa76b2b8661e70739aac'),
    ('research/2026-10-03/supplier-review-original.html', 'cf41c5bbeae9987c7c73d50c874aa29847d1ac0252e18a15ce3d375181554054'),
    ('research/2026-10-03/supplier-review.json', '7dfa19cfb02a407f2acba4856c9356269f487fc3ace26d9e8b5c25b8fb061ec3'),
    ('research/2026-10-03/task35-current-plan.txt', 'cf378ea4231a53b329e616da956eef7e4c9fda53e16869cfea0bc6887ca7b241'),
    ('research/2026-10-03/evidence-gates.json', 'e826cbbc16f861a6ff9a4810943c89955ec7bab49652daa46412a0b3e9cc490c'),
    ('research/2026-10-04/index.html', '5667340997a912b9c40bf2c8d445764f83cf4c00df7bb2df979dd73a8ec1d8d5'),
    ('research/2026-10-04/supplier-delta.json', '806985c63c7fea9226cf46cca52f4e06e39c4970d14adfdaba6e582bd8328873'),
    ('projects/vector-2026-10-04.json', '744daf41fcf3f955e980815d16fba2858b95b95599a0148ae73de1f956a0b480'),
)
PUBLICATION_ARTIFACTS = [name for name, _ in PUBLICATIONS]


def build_publications(out):
    for name, expected in PUBLICATIONS:
        content = (ROOT / 'publications' / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, 'Reviewed publication changed: ' + name
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
