import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const here=fileURLToPath(new URL('./',import.meta.url));
const root=fileURLToPath(new URL('../../',import.meta.url));
const config=await readFile(resolve(here,'playwright.config.mjs'),'utf8');
const workflow=await readFile(resolve(root,'.github/workflows/creator-candidate-qa.yml'),'utf8');
const pkg=JSON.parse(await readFile(resolve(here,'package.json'),'utf8'));
assert.deepEqual(pkg.devDependencies,{'@playwright/test':'1.63.0'});
const lock=JSON.parse(await readFile(resolve(here,'package-lock.json'),'utf8'));
assert.deepEqual(lock.packages[''].devDependencies,pkg.devDependencies);
for(const [name,entry]of Object.entries(lock.packages)){
  if(!name)continue;
  assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/'));
  assert.match(entry.integrity,/^sha512-/);
  if(/(?:playwright|playwright-core|@playwright\/test)$/.test(name))assert.equal(entry.version,'1.63.0');
}
assert.match(config,/chromiumSandbox\s*:\s*true/);
assert.match(config,/channel\s*:\s*'chrome'/);
assert.match(config,/retries\s*:\s*0/);
assert.match(workflow,/branches: \[qa\/six-module-stage1-20261005\]/);
assert.match(workflow,/contents: read/);
assert.match(workflow,/persist-credentials: false/);
assert.match(workflow,/ref: \$\{\{ github.sha \}\}/);
assert.match(workflow,/timeout-minutes: 20/);
assert.match(workflow,/id: evidence\s+if: always\(\)/);
assert.match(workflow,/uses: actions\/upload-artifact@v4\s+if: always\(\) && steps\.evidence\.outcome == 'success'/);
assert.doesNotMatch(workflow,/pull_request|workflow_dispatch|pull_request_target|pages:|id-token:|secrets\.|contents: write|deploy-pages|upload-pages/);
const forbidden=[/connectOverCDP\s*\(/,/newCDPSession\s*\(/,/chromiumSandbox\s*:\s*false/,/bypassCSP\s*:\s*true/,/ignoreHTTPSErrors\s*:\s*true/,/--no-sandbox/,/--disable-web-security/,/ignoreDefaultArgs\s*:/,/executablePath\s*:/];
let checked=0;
async function walk(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(['node_modules','evidence','test-results'].includes(item.name))continue;
    const file=resolve(dir,item.name);
    if(item.isDirectory()){await walk(file);continue;}
    if(!item.name.endsWith('.mjs'))continue;
    const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(syntax.status,0,syntax.stderr);
    const source=await readFile(file,'utf8');
    if(item.name!=='check-harness.mjs')for(const rule of forbidden)assert.doesNotMatch(source,rule,`Forbidden browser route in ${item.name}`);
    if(['playwright.config.mjs','sandbox-smoke.mjs'].includes(item.name))assert.doesNotMatch(source,/\bargs\s*:/,'Custom browser launch arguments are forbidden');
    if(item.name==='profile-reopen.spec.mjs'){
      assert.doesNotMatch(source,/\bargs\s*:/,'Custom persistent browser launch arguments are forbidden');
      assert.equal((source.match(/launchPersistentContext\(/g)||[]).length,2);
      assert.equal((source.match(/launchPersistentContext\(profile,\{channel:'chrome',chromiumSandbox:true/g)||[]).length,2,'Each persistent launch must explicitly retain Chrome sandboxing');
    }
    checked++;
  }
}
await walk(here);
const python=spawnSync('python3',['-c','import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())',resolve(here,'serve_dist.py')],{encoding:'utf8'});
assert.equal(python.status,0,python.stderr);
console.log(`Static safety and syntax checks passed for ${checked} JavaScript files plus the read-only server; no browser launched`);
