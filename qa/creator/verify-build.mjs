import {readFile, readdir, lstat, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, relative} from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = resolve(root, 'dist');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(resolve(dist,'release-manifest.json'),'utf8'));
assert.match(process.env.GITHUB_SHA || '', /^[a-f0-9]{40}$/);
assert.equal(manifest.sourceCommit, process.env.GITHUB_SHA);
assert.equal(manifest.creator.privateOriginEnabled, false);
assert.equal(manifest.creator.dataMode, 'synthetic');
const assets = [];
async function walk(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path = resolve(dir,entry.name);
    assert.equal((await lstat(path)).isSymbolicLink(),false,'Linked build output is forbidden');
    if (entry.isDirectory()) await walk(path);
    else assets.push({path:relative(dist,path).replaceAll('\\','/'),sha256:hash(await readFile(path)),bytes:(await lstat(path)).size});
  }
}
await walk(dist);
const expected = new Set([...manifest.artifacts.map(a=>a.path),'release-manifest.json','.nojekyll']);
assert.deepEqual(assets.map(a=>a.path).sort(), [...expected].sort());
for (const item of manifest.artifacts) {
  const actual = assets.find(a=>a.path===item.path);
  assert.equal(actual.sha256,item.sha256,`Hash mismatch: ${item.path}`);
  assert.equal(actual.bytes,item.bytes);
}
const app = await readFile(resolve(dist,'creator/app.mjs'),'utf8');
assert.match(app,/approvedPrivateOrigin\s*:\s*false/);
assert.doesNotMatch(app,/approvedPrivateOrigin\s*:\s*true/);
await mkdir(new URL('./evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('./evidence/tested-assets.json',import.meta.url),JSON.stringify({
  schema:'mydotwork.creator-browser-tested-assets.v1', sourceCommit:process.env.GITHUB_SHA,
  candidateRef:process.env.GITHUB_REF, contentVersion:manifest.contentVersion,
  scope:'Exact built dist served read-only on the candidate CI runner',
  privateOriginEnabled:false, assets:assets.sort((a,b)=>a.path.localeCompare(b.path)),
},null,2)+'\n');
console.log(`Verified ${assets.length} build files against source ${process.env.GITHUB_SHA}`);
