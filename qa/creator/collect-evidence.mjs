import {readFile,readdir,stat,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,basename,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('./',import.meta.url));
const evidence=resolve(root,'evidence');
await mkdir(evidence,{recursive:true});
const jsonNames=new Set(['ui-flow.json','native-interaction.json','adapter-restoration.json','visual-matrix.json','legacy-regression.json','ui-failure-download.json','ui-two-tab-conflict.json','profile-reopen.json']);
const png=/^(failure-synthetic-creator|ui-flow-synthetic-final|ui-private-import-disabled|ui-injected-quota-preserves-buffer|ui-two-tab-conflict|ui-persistent-profile-reopened|(?:desk|ideas|production|calendar|library|database|error|dialog)-(?:320|390|768|1280)-[AB]-(?:dark|light)-text(?:100|200)|reduced-motion-(?:320|390|768|1280)-[AB]-(?:dark|light))\.png$/;
const exists=async path=>{try{await stat(path);return true;}catch{return false;}};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const collectedGroups=new Map();
function screenshotGroup(name,file){
  const visual=/(320|390|768|1280)-([AB])-(dark|light)-text(100|200)\.png$/.exec(name);
  if(visual)return `visual-${visual[1]}-${visual[2]}-${visual[3]}-text${visual[4]}`;
  const reduced=/^reduced-motion-(320|390|768|1280)-([AB])-(dark|light)\.png$/.exec(name);
  if(reduced)return `visual-${reduced[1]}-${reduced[2]}-${reduced[3]}-text100`;
  if(name==='failure-synthetic-creator.png'){
    const project=/visual-(320|390|768|1280)-(B-dark|B-light|A-light)(?:[\/\\]|$)/.exec(relative(root,file));
    return project?`visual-${project[1]}-${project[2]}-failures`:'functional-failures';
  }
  return 'functional';
}
async function copyReviewed(dir){
  if(!await exists(dir))return;
  for(const item of await readdir(dir,{withFileTypes:true})){
    assert.equal(item.isSymbolicLink(),false,'Linked result files are forbidden');
    const file=resolve(dir,item.name);
    if(item.isDirectory()){await copyReviewed(file);continue;}
    if(!jsonNames.has(item.name)&&!png.test(item.name))continue;
    const bytes=await readFile(file);
    assert.ok(bytes.length<=20*1024*1024,'Oversized evidence file');
    if(jsonNames.has(item.name)){
      const data=JSON.parse(bytes);
      assert.equal(data.schema,'mydotwork.creator-browser-evidence.v1');
      assert.equal(data.sourceCommit,process.env.GITHUB_SHA);
    }else assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const prefix=hash(Buffer.from(relative(root,file))).slice(0,10);
    const target=`${prefix}-${basename(file)}`;
    await copyFile(file,resolve(evidence,target));
    collectedGroups.set(target,item.name.endsWith('.png')?screenshotGroup(item.name,file):'metadata');
  }
}
await copyReviewed(resolve(root,'test-results'));
if(!await exists(resolve(evidence,'results.json')))await writeFile(resolve(evidence,'execution-status.json'),JSON.stringify({schema:'mydotwork.creator-browser-execution-status.v1',sourceCommit:process.env.GITHUB_SHA,status:'NOT_RUN',reason:'No browser test report was created. Inspect failed build, dependency, or sandbox launch step; this is not a pass.'},null,2)+'\n');
const topLevel={
  'tested-assets.json':'mydotwork.creator-browser-tested-assets.v1',
  'results.json':'mydotwork.creator-browser-results.v1',
  'browser-environment.json':'mydotwork.creator-browser-environment.v1',
  'font-environment.json':'mydotwork.creator-browser-font-environment.v1',
  'execution-status.json':'mydotwork.creator-browser-execution-status.v1',
};
const artifacts=[];
for(const file of await readdir(evidence,{withFileTypes:true})){
  assert.ok(file.isFile()&&!file.isSymbolicLink(),'Evidence must contain ordinary files only');
  const controlled=Object.hasOwn(topLevel,file.name);
  const prefixed=/^[a-f0-9]{10}-(.+)$/.exec(file.name);
  const reviewedName=prefixed?.[1];
  assert.ok(controlled||(prefixed&&(jsonNames.has(reviewedName)||png.test(reviewedName))),'Unreviewed artifact name');
  assert.ok(/\.(json|png)$/.test(file.name),'Unreviewed artifact extension');
  const bytes=await readFile(resolve(evidence,file.name));
  assert.ok(bytes.length<=20*1024*1024,'Oversized evidence file');
  if(file.name.endsWith('.json')){
    const data=JSON.parse(bytes);
    assert.equal(data.schema,controlled?topLevel[file.name]:'mydotwork.creator-browser-evidence.v1');
    assert.equal(data.sourceCommit,process.env.GITHUB_SHA);
  }else assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  artifacts.push({path:file.name,sha256:hash(bytes),bytes:bytes.length,group:collectedGroups.get(file.name)||(file.name.endsWith('.png')?screenshotGroup(reviewedName,file.name):'metadata')});
}
await writeFile(resolve(evidence,'artifact-manifest.json'),JSON.stringify({schema:'mydotwork.creator-browser-artifact-manifest.v1',sourceCommit:process.env.GITHUB_SHA,policy:'Only controlled synthetic screenshots, summarized results, and hash manifests. No source tree, backup packages, browser profiles, traces, videos or archive chat content.',artifacts:artifacts.sort((a,b)=>a.path.localeCompare(b.path))},null,2)+'\n');
console.log(`Collected ${artifacts.length} reviewed evidence files`);
