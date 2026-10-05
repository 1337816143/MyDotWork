import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const result=spawnSync('fc-match',['-f','%{family}\n%{lang}\n','sans:lang=zh-cn'],{encoding:'utf8'});
const [family='',languages='']=(result.stdout||'').trim().split('\n');
const supported=result.status===0&&languages.split('|').some(lang=>/^zh(?:-|$)/.test(lang));
await mkdir(new URL('./evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('./evidence/font-environment.json',import.meta.url),JSON.stringify({
  schema:'mydotwork.creator-browser-font-environment.v1',sourceCommit:process.env.GITHUB_SHA,
  status:supported?'PASSED':'FAILED',family,languages,
  method:'Read-only fontconfig CJK language coverage check; screenshots still need glyph review',
  error:supported?null:(result.error?.message||result.stderr||'No matched font advertises Chinese language coverage'),
},null,2)+'\n');
if(!supported)throw new Error('Runner has no verified Chinese font coverage; stop before interpreting screenshots as visual evidence');
console.log(`Verified CJK font coverage: ${family}`);
