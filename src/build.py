import json,pathlib
p=pathlib.Path(__file__).parent
s=(p/'template.html').read_text()
d=json.loads((p/'data.json').read_text())
(p/'index.html').write_text(s.replace('__OFFERS__',json.dumps(d,ensure_ascii=False).replace('</','<\\/')))
