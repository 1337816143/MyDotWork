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
    ('research/2026-10-04/task5-business-validation-20261004.html', 'dc4bf1e2a3142bc4b5c5d67d18c3cb48c8eae19db6730e5f3e8bfba991064486'),
    ('research/2026-10-04/task5-business-validation-20261004.txt', '9d84054f8d51479a03b7796049d4abdcf4c6f774de303112e942088d439f0aa7'),
    ('research/2026-10-04/task5-business-validation-20261004-evidence.json', '2554cbcc5aea6e38bf29f87cf8cccfba77748fc99ce085bc8bbfec3c6e2b5db2'),
    ('projects/vector-0.11.1-2026-10-04.json', '6052415a81a2b54228ad7123b7d0e4d685afdab9b7f0160e43fef09afa7f151b'),
    ('projects/smartdrop-r1-2026-10-04.json', '13f5846221ab08a83cfd4b43a1aa94461c32af5c22a64740166020e964782751'),
    ('projects/wetype-2026-10-04.json', '5b5fbf09d7cb8fd8974690f7a57ab51b9cdb433072af1cef6514734dbfffa274'),
)
PUBLICATION_ARTIFACTS = [name for name, _ in PUBLICATIONS]


def build_publications(out):
    for name, expected in PUBLICATIONS:
        content = (ROOT / 'publications' / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, 'Reviewed publication changed: ' + name
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
