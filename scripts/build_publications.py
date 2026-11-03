"""Copy explicitly approved research and sample artifacts without rewriting bytes."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLICATIONS = (
    ('research/vpn/index.html', 'fc5787bbba50443336e09ad2a735cc0af6d2c9a2baafb46cb367be4677feb05f'),
    ('research/vpn/evidence.json', 'b7e5f0eabdfeb4ecb760f1fafb07f8a68525a76cdae46cb3953de73972ded2b8'),
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
    ('research/2026-11-03/index.html', '1971b0095bff3a0e5d8a8eeec63b5f27a35823cf58ffd3210793181f5959e53c'),
    ('research/2026-11-03/phone-subscription-evidence.json', 'd8ea34f19a941db91d8344cef8df763be1e778b3f1fe973c79ebee533be85abb'),
    ('research/2026-11-03/supplier-followup-20261103.html', 'cafae56ae1aa7252262142499adb068e61f969cef38db82ed66a1a3c4dc1e120'),
    ('research/2026-11-03/supplier-followup-20261103-evidence.json', '5a752b17573d0873a18a4686abc25afe54b844881e1628e60e4c784c80c7bad8'),
    ('research/2026-11-03/supplier-followup-20261103-r2.html', '97084700c4bb123074f055b8b4ea5330cb431066c2a593a9147d9480660a12a7'),
    ('research/2026-11-03/supplier-followup-20261103-r2-evidence.json', '2e340253a2c647d617a1c29ace427fa7d108fe2ad5132113d2a25084107e5b1b'),
    ('research/2026-11-03/supplier-followup-20261103-r3.html', '69ed8c9dfbc6a36f1cd884e214d017323173438833252cd9dcf2fe329050bbc7'),
    ('research/2026-11-03/supplier-followup-20261103-r3-evidence.json', 'd15118a9d946083855e3ae0b576b5bcd521ca7327eed42e5f6a7f878c4035c8b'),
    ('research/2026-11-03/supplier-followup-20261103-r4.html', 'a097e18b37433a50a42eef9736bd47f1b592a483f9217152f33466f7beadaf4f'),
    ('research/2026-11-03/supplier-followup-20261103-r4-evidence.json', '296b39bd53b962e6d90de4c42ee53ba6c754722285c7c31f1a0e6ab91f6d3c50'),
    ('research/2026-11-03/supplier-followup-20261103-r5.html', '4c4c9dce5a2935e0cc191c66b66775cf947fd0b517d95d28b690ea997eb5357e'),
    ('research/2026-11-03/supplier-followup-20261103-r5-evidence.json', '344be08ab09e32b91341166835eaec04bf76ea4f1e97377125d750e4b7da7ae3'),
    ('research/2026-11-03/supplier-followup-20261103-r6.html', '2f41e65a487339323fbd301fa332ff87669f36750ef5b70fab35cd7bf574a172'),
    ('research/2026-11-03/supplier-followup-20261103-r6-evidence.json', '0dcc821a1dec09931f9f171997199d9c8dd8308d9f28a9b5250d53a611aff3db'),
    ('research/2026-11-03/supplier-followup-20261103-r7.html', '9e22561e116b1097487cad6b10241823e74f39c320c1a405ea4deda36714f819'),
    ('research/2026-11-03/supplier-followup-20261103-r7-evidence.json', '09534464893c94364cca99bccea2c9e6edff1cd870d8b163c29fde7b170eb4a2'),
    ('research/2026-11-03/supplier-followup-20261103-r8.html', '80323dd2394d04889266890808a5d86a51eebff421b020da7ebf1e1bbfe5ca65'),
    ('research/2026-11-03/supplier-followup-20261103-r8-evidence.json', '2bc202a78f3db789b1ac7ec032d09d1a1756175ee88f31c88a198e50d2a694a9'),
    ('research/2026-11-03/supplier-followup-20261103-r9.html', '0cfa10cbcb15e584e7a65bf54825fdff0a72ce08d393572f9c94d939540f91c4'),
    ('research/2026-11-03/supplier-followup-20261103-r9-evidence.json', 'b7bdb60f90fb998a64d49278de38e26b4729c7504298c67f2e9aaf593496ed18'),
    ('research/2026-11-03/supplier-followup-20261103-r10.html', 'c714c31425f7b99adc94c4b2f9dd9376428b5de1d6048cdda4a434019cfdd7ac'),
    ('research/2026-11-03/supplier-followup-20261103-r10-evidence.json', '7285e17b118201830218f8bf033656c255977f9d99b48b010cd58a4e79ebf5e9'),
    ('research/2026-11-03/supplier-followup-20261103-r11.html', '3dc5aad176c1de18efa1387c87a05203ffca8975cf2c86648bc55c904fcd50c3'),
    ('research/2026-11-03/supplier-followup-20261103-r11-evidence.json', '9bf3659a9a13dd0e066a1899c490b568d2b0a8ebd8f0b100f98bd80d1f5c1d7d'),
    ('research/2026-11-03/supplier-followup-20261103-r12.html', '30047cbec2606431d53020451dad5eb546ad709f2f9fc9ec1415aa1b7092cdd3'),
    ('research/2026-11-03/supplier-followup-20261103-r12-evidence.json', 'c8912e74a14d76122deaaf4a7056d8c77035504299c64c6a9da958a375ccd52e'),
    ('research/2026-11-03/supplier-followup-20261103-r13.html', 'a854bc96a83cdccf2e3942c10ddbb729572d872617702e98e68007197013aec4'),
    ('research/2026-11-03/supplier-followup-20261103-r13-evidence.json', '67d3b9d3411f00c49deddca382f24704ea5be58829f13fe6a31b6467f6bbc4ed'),
    ('research/2026-11-03/supplier-followup-20261103-r14.html', '13d9b5da952d2a98bea1a2984bf8e12fa2d540ee85d303b17503e2c0e7948343'),
    ('research/2026-11-03/supplier-followup-20261103-r14-evidence.json', '2e71c7aebfbabbafc88f1b227ec54b8f1c05ea4fe08eda3bc2bf54c74b1c0a91'),
    ('research/2026-11-04/supplier-followup-20261104.html', '1a027008932de85288b934c8f4f63f0eb839ba04ea250181b12e362a6e0f20a7'),
    ('research/2026-11-04/supplier-followup-20261104-evidence.json', '63637c5265c1b5a6314e739d740ea20fba518def50db41ab87fd34d0e46d1cb7'),
)
PUBLICATION_ARTIFACTS = [name for name, _ in PUBLICATIONS]


def build_publications(out):
    for name, expected in PUBLICATIONS:
        content = (ROOT / 'publications' / name).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected, 'Reviewed publication changed: ' + name
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
