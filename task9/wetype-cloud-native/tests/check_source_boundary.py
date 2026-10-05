"""Static safety boundary checks, not Windows integration tests."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
sources = '\n'.join(p.read_text(encoding='utf-8-sig') for d in ('probe', 'scripts', 'core') for p in (root/d).rglob('*') if p.is_file() and p.suffix in ('.cs','.cpp','.hpp','.h','.ps1','.cmd'))
for token in ('WriteProcessMemory(', 'VirtualAllocEx(', 'CreateRemoteThread(', 'SetWindowsHookEx(', 'RegisterHotKey(', 'Set-ExecutionPolicy', 'ExecutionPolicy Bypass', 'ReadProcessMemory(', 'SendKeys.SendWait(', 'png_base64'):
    assert token not in sources, f'Forbidden stage capability: {token}'
workflow=(root/'.github/workflows/task9-windows-native-probe.yml').read_text()
for expected in ('runs-on: windows-2022','timeout-minutes: 10','contents: read','persist-credentials: false'):
    assert expected in workflow
for forbidden in ('upload-artifact@', 'actions/cache@', 'pull_request_target:', 'secrets.', 'pages: write', 'id-token: write'):
    assert forbidden not in workflow
script=(root/'scripts/run-windows-probes.ps1').read_text()
assert 'Start-Process' not in script and '2C16D2BC39E4315817DE7CD6C10D30C1A9D3B5A57EA6373638C2FDEFB86F63AD' in script
print(json.dumps({'static_boundary':'passed','native_WeType_validation':False}))
