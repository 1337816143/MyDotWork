"""Render reviewed, dated additions without rewriting historical offer ranking."""
import json
import re
from html import escape
from pathlib import Path
from build_archive import page
from build_round2 import build_round2

ROOT = Path(__file__).resolve().parents[1]
RESEARCH_ARTIFACTS = ['research/2026-10-02.html', 'research/2026-10-02.json', 'research/2026-10-02-round2.html', 'research/2026-10-02-round2.json']

def linked(text):
    parts=re.split(r'(https?://[^\s<>]+)', str(text))
    return ''.join(f'<a href="{escape(p,quote=True)}" target="_blank" rel="noopener noreferrer">{escape(p)}</a>' if p.startswith(('https://','http://')) else escape(p) for p in parts)

def build_research(out, version):
    source=ROOT/'data/research-2026-10-02.json'
    d=json.loads(source.read_text())
    root=out/'research';root.mkdir(exist_ok=True)
    (root/'2026-10-02.json').write_bytes(source.read_bytes())
    body='<section class="panel notice"><h2>历史快照与后来修正</h2><p>本页保留06:18:10 UTC首轮快照。后来查明：贝果标准条款禁止转售；麦门Pro200旧资格文字已消失，20x/10x仍存在矛盾。现状请看<a href="2026-10-02-round2.html">第二轮修正与新增证据</a>，本页不倒改历史原文。</p><h2>阅读边界</h2><p>以下是2026年10月2日新增的公开资料核查，与既有研究历史并列保留。商家标价、宣传和票据承诺不等于实付、授权、可交付或资金来源已核验。没有付款、注册、提交凭据或开展封号规避实验。</p><p><a href="2026-10-02.json" download>下载本次研究JSON</a></p><p><a href="#supply">供货价格与源头</a> · <a href="#phone">成品号与手机验证</a> · <a href="#claude">Claude Code采购与上手</a></p></section>'
    body+='<section class="panel" id="supply"><h2>供货价格与源头核查</h2><div class="text" style="white-space:pre-wrap">'+linked(d['supply'])+'</div></section>'
    body+='<section class="panel" id="phone"><h2>成品号与手机验证</h2><div class="text" style="white-space:pre-wrap">'+linked(d['phone'])+'</div></section>'
    claude=d['claude'];body+=f'<section class="panel" id="claude"><h2>{escape(claude["title"])}</h2><p class="meta">{escape(claude["subtitle"])}</p><p>{escape(claude["summary"])}</p></section>'
    for section in claude['sections']:
        body+=f'<section class="panel"><h2>{escape(section["heading"])}</h2>'
        for paragraph in section.get('paragraphs',[]):body+='<p>'+linked(paragraph)+'</p>'
        if 'table' in section:
            table=section['table'];body+='<div style="overflow:auto"><table style="border-collapse:collapse;width:100%;min-width:600px"><thead><tr>'+''.join('<th style="border:1px solid #c8d8df;padding:12px;text-align:left">'+escape(h)+'</th>' for h in table['headers'])+'</tr></thead><tbody>'
            for row in table['rows']:body+='<tr>'+''.join('<td style="border:1px solid #c8d8df;padding:12px;vertical-align:top;white-space:pre-line">'+linked(v)+'</td>' for v in row)+'</tr>'
            body+='</tbody></table></div>'
        if section.get('note'):body+='<p class="meta">'+linked(section['note'])+'</p>'
        body+='</section>'
    body+='<section class="panel"><h2>Claude来源与核查日期</h2><ol>'
    for source in claude['sources']:body+='<li id="'+escape(source[0],quote=True)+'">'+escape(source[0])+' · <a href="'+escape(source[2],quote=True)+'" target="_blank" rel="noopener noreferrer">'+escape(source[1])+'</a> · '+escape(source[3])+'</li>'
    body+='</ol></section>'
    (root/'2026-10-02.html').write_text(page('10月2日研究补充','ChatGPT低价供货、成品号与手机验证，以及Claude Code采购和上手',body,version))
    build_round2(ROOT, out, version, linked)
