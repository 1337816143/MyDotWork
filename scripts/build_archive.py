"""Explicit, escaped public artifacts from user-authorized, pre-redacted text."""
import json
from html import escape
from pathlib import Path
from public_output import assert_no_archive_email_addresses, assert_no_archive_device_names

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ['chat/index.html', 'chat/messages.json', 'chat/coverage.json', 'projects/index.html', 'projects/status.json']
CSS = '''*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#162c3d;font:16px/1.75 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}a{color:#126e79;overflow-wrap:anywhere}header{background:#142e40;color:white;padding:48px max(22px,calc((100% - 1100px)/2))}header p{max-width:850px;color:#d1e2e8}h1{font-size:clamp(28px,5vw,42px);line-height:1.3;margin:12px 0}h2{font-size:23px}nav{display:flex;gap:20px;flex-wrap:wrap;background:white;padding:14px max(22px,calc((100% - 1100px)/2));border-bottom:1px solid #d3e1e6}nav a{text-decoration:none}main{max-width:1144px;margin:auto;padding:24px 22px}.panel,.record{background:white;border:1px solid #d9e3e8;border-radius:12px;padding:22px;margin:0 0 18px}.notice{border-left:4px solid #d99632;background:#fffbef}.meta{font-size:13px;color:#5e7382;overflow-wrap:anywhere}.record{scroll-margin-top:16px}.record.anchor-target{scroll-margin-top:170px;outline:3px solid #137c8b;outline-offset:3px;background:#effbfc}.anchor-context{position:sticky;top:0;z-index:5;padding:12px 16px;border:1px solid #73a7b2;background:#e9f8fb;border-radius:9px;box-shadow:0 4px 12px #163b4a18}.anchor-context button{font:inherit;margin-left:12px;min-height:40px;border:1px solid #126e79;border-radius:6px;background:#fff;color:#126e79;cursor:pointer}.record header{padding:0;background:none;color:inherit;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.record .text{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:14px}.badge{display:inline-block;border-radius:20px;padding:2px 11px;background:#e9f4f1;color:#196250;font-size:13px}.assistant{border-left:3px solid #478b94}.user{border-left:3px solid #b58b47}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.controls label{display:flex;gap:8px;align-items:center}.controls input,.controls select,.controls button{font:inherit;padding:9px;border:1px solid #b3c9d1;border-radius:7px;background:#fff}.controls input{min-width:210px;flex:1}.stats{display:flex;gap:24px;flex-wrap:wrap}.stat b{font-size:28px;display:block}.stat small{color:#547180}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.grid .record{margin:0}.record h2{margin-top:8px}.record p{overflow-wrap:anywhere}.muted{color:#657984}footer{text-align:center;color:#657984;padding:30px;font-size:13px}[hidden]{display:none!important}@media(max-width:700px){.anchor-context{font-size:14px;line-height:1.5}.anchor-context button{display:block;margin:8px 0 0}header{padding:32px 20px}main{padding:18px 12px}.panel,.record{padding:17px}.grid{grid-template-columns:1fr}.controls label{flex-wrap:wrap}.controls input{width:100%}nav{padding:12px 20px}}@media print{nav,.controls{display:none}.record{break-inside:avoid}body{background:white}}'''

def json_text(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'

def page(title, subtitle, body, version, script=''):
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>{escape(title)} · MyDotWork v{escape(version)}</title><style>{CSS}</style></head><body><header><small>MYDOTWORK / PUBLIC RECORDS · v{escape(version)}</small><h1>{escape(title)}</h1><p>{escape(subtitle)}</p></header><nav aria-label="栏目"><a href="../dashboard/index.html">AI研究工作台</a><a href="../research/2026-10-02-round2.html">AI上游调研</a><a href="https://1337816143.github.io/MyDotWork/">供货与源头研究</a><a href="../chat/index.html">聊天原文</a><a href="../projects/index.html">项目进度</a><a href="https://1337816143.github.io/Evolution/">个人进化网站</a></nav><main>{body}</main><footer>公开归档 · 按真实记录保留来源时间与范围 · v{escape(version)}</footer>{script}</body></html>'''

def build_archive(out, version):
    chat = json.loads((ROOT / 'data/dot-chat.json').read_text())
    projects = json.loads((ROOT / 'data/projects.json').read_text())
    messages = chat['messages']; coverage = chat['coverage']
    assert messages and len({m['id'] for m in messages}) == len(messages)
    for m in messages:
        assert set(m) == {'id','role','time','text'}
        assert m['role'] in ['user','assistant'] and isinstance(m['text'], str)
        assert m['id'] and m['time']
        assert_no_archive_email_addresses(m['text'])
        assert_no_archive_device_names(m['text'])
    assert messages == sorted(messages, key=lambda m: m['time'])
    coverage = {**coverage, 'messageCount': len(messages), 'userCount': sum(m['role'] == 'user' for m in messages), 'assistantCount': sum(m['role'] == 'assistant' for m in messages), 'textCharacters': sum(len(m['text']) for m in messages), 'contentVersion': version}
    chat = {**chat, 'coverage': coverage}
    for directory in ['chat','projects']: (out / directory).mkdir(parents=True, exist_ok=True)
    (out / 'chat/messages.json').write_text(json_text(chat), encoding='utf-8', newline='\n')
    (out / 'chat/coverage.json').write_text(json_text(coverage), encoding='utf-8', newline='\n')
    (out / 'projects/status.json').write_text(json_text(projects), encoding='utf-8', newline='\n')
    decisions = json.loads((ROOT / 'data/workbench-catalog.json').read_bytes())['statusSnapshot']['decisions']
    coverage_note = '本次为部分分页返回，尚不能确认可见区间已连续读完；分页缺口数量未知。' if coverage['readApiHistoryExhausted'] is False else '本次可见分页已读至工具返回末尾；仍不能证明服务端全部历史或附件齐全。'
    limits = ''.join(f'<li>{escape(s)}</li>' for s in coverage['limitations'])
    body = f'''<section class="panel"><div class="stats"><div class="stat"><b>{len(messages)}</b><small>可见消息</small></div><div class="stat"><b>{coverage['userCount']}</b><small>用户消息</small></div><div class="stat"><b>{coverage['assistantCount']}</b><small>dot消息</small></div></div><p class="meta">覆盖起点：{escape(coverage['start'])}<br>覆盖终点：{escape(coverage['end'])} · 时间保留原始UTC偏移</p><a href="messages.json" download>下载脱敏原文 JSON</a> · <a href="coverage.json">覆盖说明 JSON</a></section><section class="panel notice"><h2>公开范围与完整性</h2><p>用户明确同意公开当前对话原文及项目进度，包括私人关系、未公开项目与Git历史。密码、Token、身份证号、银行卡号、签名链接等秘密移除并保留标记，其余可见文字不改写。下方是历史原话，后续修正以时间更晚的消息为准。</p><p>{coverage_note}</p><ul>{limits}</ul><p>本页只归档用户与dot可见对话文字，不含内部提示、工具报告、内部记忆原件或其他Codex/GPT会话全文。空文字消息保留真实ID和时间；附件本体未收录。</p></section><section class="controls" aria-label="筛选聊天"><label for="query">搜索原文</label><input type="search" id="query" placeholder="关键词、项目或消息ID"><label for="role">角色</label><select id="role"><option value="">全部</option><option value="user">用户</option><option value="assistant">dot</option></select><label for="from">起始日期（UTC）</label><input type="date" id="from"><label for="to">结束日期（UTC）</label><input type="date" id="to"><label for="project">项目关键词</label><select id="project"><option value="">全部</option><option value="archive">聊天与项目归档</option><option value="workbench">AI工作台</option><option value="upstream">AI上游研究</option><option value="takeover">Codex/GPT接管</option><option value="income">AI副业</option><option value="paper">论文与方法</option><option value="farm">Farm与海南</option></select><button id="reset" type="button">重置</button><span id="count" role="status">{len(messages)} 条</span><p class="meta">日期按UTC筛选；项目按可见原文关键词匹配，不代表完整人工分类。消息原文和时间不改写。</p><p id="date-error" role="alert"></p></section><section id="anchor-context" class="anchor-context" aria-label="原文定位" hidden><span id="anchor-message" aria-live="polite"></span><button id="anchor-return" type="button" hidden>返回原筛选结果</button></section><section id="empty" class="panel" hidden><h2>没有符合条件的记录</h2><p>可减少关键词或日期范围；未匹配不等于不存在。</p><button id="empty-reset" type="button">重置筛选</button></section>'''
    for m in messages:
        role = '用户' if m['role'] == 'user' else 'dot'
        empty = '<p class="meta">此消息没有可见文字，附件本体未纳入。</p>' if not m['text'] else ''
        annotations = []
        for note in decisions:
            if m['id'] == note['messageId']:
                annotations.append('<p class="notice meta">当前澄清：' + escape(note['title']) + '。' + escape(note['summary']) + '</p>')
            if m['id'] in note['supersedes']:
                annotations.append('<p class="notice meta">这条原文的部分范围或建议已有后续澄清：<a href="#' + escape(note['messageId'], quote=True) + '">' + escape(note['title']) + '</a>。历史原文保留。</p>')
        context_notes = ''.join(annotations)
        body += f'''<article class="record {m['role']}" id="{escape(m['id'], quote=True)}" data-role="{m['role']}" data-time="{escape(m['time'], quote=True)}"><header><b>{role}</b><time class="meta">{escape(m['time'])}</time></header><a class="meta" href="#{escape(m['id'], quote=True)}">{escape(m['id'])}</a>{context_notes}<div class="text">{escape(m['text'])}</div>{empty}</article>'''
    script = '<script>' + (ROOT / 'src/archive.js').read_text(encoding='utf-8').replace('</script', '<\\/script') + '</script>'
    (out / 'chat/index.html').write_text(page('与 dot 的聊天原文','按时间顺序保留已取得的可见原话；秘密已移除，覆盖缺口明确记录',body,version,script), encoding='utf-8', newline='\n')
    body = f'''<section class="panel notice"><p>{escape(projects['notice'])}</p><p class="meta">整理时间：{escape(projects['updatedAt'])} · {len(projects['projects'])} 个项目</p><a href="status.json" download>下载项目进度 JSON</a></section><div class="grid">'''
    for i,p in enumerate(projects['projects']):
        body += f'''<article class="record" id="project-{i+1}"><span class="badge">{escape(p['status'])}</span><h2>{escape(p['name'])}</h2><p>{escape(p['progress'])}</p><h3>未完成与边界</h3><p>{escape(p['gaps'])}</p><p class="meta">截至 {escape(p['asOf'])}<br>{escape(p['evidenceLevel'])}</p>'''
        for child in p.get('children', []):
            body += f'''<section class="panel"><span class="badge">{escape(child['status'])}</span><h3>{escape(child['name'])}</h3><p>{escape(child['progress'])}</p><p class="meta">未完成：{escape(child['gaps'])}</p></section>'''
        body += '</article>'
    body += '</div>'
    (out / 'projects/index.html').write_text(page('项目进度总览','把当前状态、已有结果、未完成事项与验收范围分开记录',body,version), encoding='utf-8', newline='\n')
    return coverage
