import {readFile,readdir,lstat,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('./',import.meta.url));
const source=resolve(root,'evidence'),output=resolve(root,'artifact-groups');
const CAP=24*1024*1024;
const hash=data=>createHash('sha256').update(data).digest('hex');
assert.match(process.env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);
const sourceInfo=await lstat(source);
assert.ok(sourceInfo.isDirectory()&&!sourceInfo.isSymbolicLink(),'Evidence root must be an ordinary directory');
const manifestBytes=await readFile(resolve(source,'artifact-manifest.json'));
const manifest=JSON.parse(manifestBytes);
assert.equal(manifest.schema,'mydotwork.creator-browser-artifact-manifest.v1');
assert.equal(manifest.sourceCommit,process.env.GITHUB_SHA);
const modes=['B-dark','B-light','A-light'];
// Representative is output-only; source entries may never replace originals
// with the deliberately small duplicate review sample assembled below.
const allowedGroups=new Set(['metadata','functional','functional-failures',...[320,390,768,1280].flatMap(width=>modes.flatMap(mode=>['text100','text200','failures'].map(kind=>`visual-${width}-${mode}-${kind}`)))]);
const fallbackGroup=name=>{
  const regular=/(320|390|768|1280)-([AB])-(dark|light)-text(100|200)\.png$/.exec(name);
  if(regular)return `visual-${regular[1]}-${regular[2]}-${regular[3]}-text${regular[4]}`;
  const reduced=/reduced-motion-(320|390|768|1280)-([AB])-(dark|light)\.png$/.exec(name);
  if(reduced)return `visual-${reduced[1]}-${reduced[2]}-${reduced[3]}-text100`;
  return name.endsWith('.json')?'metadata':name.endsWith('-failure-synthetic-creator.png')?'functional-failures':'functional';
};
const entries=[...manifest.artifacts,{path:'artifact-manifest.json',sha256:hash(manifestBytes),bytes:manifestBytes.length,group:'metadata'}];
assert.deepEqual((await readdir(source)).sort(),entries.map(entry=>entry.path).sort(),'Every collected file must be represented exactly');
await mkdir(output,{recursive:false});
const groups=new Map();
for(const entry of entries){
  assert.match(entry.path,/^[a-zA-Z0-9._-]+\.(?:json|png)$/);
  assert.ok((await lstat(resolve(source,entry.path))).isFile(),'Only ordinary evidence files may be partitioned');
  const data=await readFile(resolve(source,entry.path));
  assert.equal(data.length,entry.bytes);
  assert.equal(hash(data),entry.sha256);
  const group=entry.group||fallbackGroup(entry.path);
  assert.ok(allowedGroups.has(group),'Unknown artifact group');
  assert.equal(entry.path.endsWith('.json'),group==='metadata','Only metadata JSON belongs to metadata groups');
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push({...entry,group});
}

// Compact failure status is additional evidence; original results JSON remains.
const resultsEntry=entries.find(entry=>entry.path==='results.json');
const results=resultsEntry?JSON.parse(await readFile(resolve(source,'results.json'),'utf8')):null;
const summary={schema:'mydotwork.creator-browser-compact-status.v1',sourceCommit:process.env.GITHUB_SHA,status:results?.status||'NOT_RUN',counts:results?.tests?.reduce((counts,test)=>({...counts,[test.status]:(counts[test.status]||0)+1}),{})||{},failures:(results?.tests||[]).filter(test=>test.status!==test.expectedStatus).map(test=>({title:test.title,file:test.file,status:test.status,errors:test.errors})),errors:results?.errors||[],limitations:results?.limitations||[]};
const summaryBytes=Buffer.from(JSON.stringify(summary)+'\n');
const metadata=groups.get('metadata')||[];
metadata.push({path:'compact-status.json',sha256:hash(summaryBytes),bytes:summaryBytes.length,group:'metadata',generated:summaryBytes});
groups.set('metadata',metadata);

// Small, explicitly duplicated review sample. Every original image remains in
// its complete group; copying never resizes or recompresses the PNG bytes.
const imageEntries=entries.filter(entry=>entry.path.endsWith('.png'));
const representatives=[];
for(const wanted of [/desk-1280-B-dark-text100\.png$/, /calendar-390-B-light-text200\.png$/, /ui-flow-synthetic-final\.png$/, /failure-synthetic-creator\.png$/]){
  const entry=imageEntries.find(item=>wanted.test(item.path)&&!representatives.some(selected=>selected.path===item.path));
  if(entry&&representatives.length<3&&representatives.reduce((sum,item)=>sum+item.bytes,0)+entry.bytes<CAP-65536)representatives.push({...entry,group:'representative'});
}
if(representatives.length)groups.set('representative',representatives);

const index=[];
for(const [group,items]of groups){
  const dir=resolve(output,group);
  assert.ok(items.length<=256&&items.every(item=>item.path.length<=200),'Keep archive framing comfortably within the 1 MiB size margin');
  const contentBytes=items.reduce((sum,item)=>sum+item.bytes,0);
  const groupManifest={schema:'mydotwork.creator-browser-artifact-group.v1',sourceCommit:process.env.GITHUB_SHA,group,maxUncompressedBytes:CAP,contentBytes,files:items.map(({path,sha256,bytes})=>({path,sha256,bytes})),imageBytesChanged:false,duplicateReviewSample:group==='representative'};
  const groupBytes=Buffer.from(JSON.stringify(groupManifest,null,2)+'\n');
  const total=contentBytes+groupBytes.length;
  assert.ok(total<=CAP,`Artifact group ${group} exceeds 24 MiB (${total} bytes); split it further without dropping or changing image bytes`);
  await mkdir(dir);
  for(const item of items){
    if(item.generated)await writeFile(resolve(dir,item.path),item.generated);
    else await copyFile(resolve(source,item.path),resolve(dir,item.path));
    assert.equal(hash(await readFile(resolve(dir,item.path))),item.sha256);
  }
  await writeFile(resolve(dir,'group-manifest.json'),groupBytes);
  index.push({group,files:items.length,uncompressedBytes:total,maxUncompressedBytes:CAP});
}
console.log(JSON.stringify({groups:index.length,originalFiles:entries.length,originalPngs:imageEntries.length,largestUncompressedBytes:Math.max(...index.map(item=>item.uncompressedBytes)),maximumBytes:CAP}));
