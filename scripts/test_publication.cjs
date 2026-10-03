const assert=require('node:assert/strict');
const P=require('../src/publication.js');
const s='a'.repeat(40),m='b'.repeat(40),privateSource='c'.repeat(40),hash='d'.repeat(64),other='e'.repeat(64),now='2026-10-03T17:00:00Z';
const source={schema:'mydotwork.release.v1',sourceCommit:s,contentVersion:'1.8.1',reportSha256:hash,artifacts:[{path:'index.html',sha256:hash,bytes:50},{path:'chat/index.html',sha256:other,bytes:60}]};
const mirror={sourceCommit:privateSource,chatgptSupply:{repository:'1337816143/MyDotWork',sourceCommit:s,contentVersion:'1.8.1',reportSha256:hash},dotArchive:{repository:'1337816143/MyDotWork',sourceCommit:s,contentVersion:'1.8.1',artifacts:[{path:'chat/index.html',sha256:other,bytes:60}]}};
const run=(head,id)=>({id,head_sha:head,head_branch:'main',path:'.github/workflows/pages.yml',status:'completed',conclusion:'success',updated_at:'2026-10-03T16:50:00Z'});
const sourceRuns={workflow_runs:[run(s,101)]},mirrorRuns={workflow_runs:[run(m,102)]},head={object:{sha:m}},commit={sha:m,message:`deploy: release-${privateSource.slice(0,12)} complete website from ${privateSource}`,committer:{date:'2026-10-03T16:49:00Z'}};
const copy=value=>JSON.parse(JSON.stringify(value));
const assemble=(a=source,b=mirror,c=sourceRuns,d=head,e=commit,f=mirrorRuns)=>P.assemble(a,b,c,d,e,f,now,{object:{sha:s}});
const proof=assemble();assert.equal(proof.status,'consistent');assert(P.validProof(proof,Date.parse(now)));
for(const mutate of [x=>x.dotArchive.sourceCommit='f'.repeat(40),x=>x.dotArchive.artifacts[0].sha256='0'.repeat(64),x=>x.dotArchive.artifacts[0].bytes++,x=>x.dotArchive.artifacts.push({path:'extra.json',sha256:hash,bytes:3})]){const b=copy(mirror);mutate(b);assert.equal(P.manifestsMatch(source,b),false);assert.equal(assemble(source,b).status,'different');}
const duplicate=copy(mirror);duplicate.dotArchive.artifacts.push(duplicate.dotArchive.artifacts[0]);assert.throws(()=>P.manifestsMatch(source,duplicate),/Duplicate/);
for(const mutate of [r=>r.conclusion='failure',r=>r.status='in_progress',r=>r.head_sha=m,r=>r.head_branch='qa/preview',r=>r.path='.github/workflows/test.yml',r=>delete r.updated_at]){const payload=copy(sourceRuns);mutate(payload.workflow_runs[0]);assert.equal(assemble(source,mirror,payload).status,'different','Only a completed matching Pages run can prove deployment');}
const wrongCommit=copy(commit);wrongCommit.message='unrelated commit';assert.equal(assemble(source,mirror,sourceRuns,head,wrongCommit).status,'different');
const noTime=copy(commit);delete noTime.committer.date;assert.throws(()=>assemble(source,mirror,sourceRuns,head,noTime),/Invalid publication time/);
const future=copy(sourceRuns);future.workflow_runs[0].updated_at='2099-01-01T00:00:00Z';assert.throws(()=>assemble(source,mirror,future),/future/);
for(const mutate of [v=>v.source.runUrl='javascript:alert(1)',v=>v.mirror.runUrl='https://example.org/collect',v=>v.mirror.syncedAt='invalid',v=>v.source.commit='bad',v=>v.checkedAt='2099-01-01T00:00:00Z',v=>v.mirror.version='1.0.0']){const bad=copy(proof);mutate(bad);assert.equal(P.validProof(bad,Date.parse(now)),false,'Corrupt or unsafe browser cache must be ignored');}
assert.equal(proof.source.deployedAt,'2026-10-03T16:50:00Z');assert.equal(proof.mirror.syncedAt,'2026-10-03T16:49:00Z');assert.equal(proof.checkedAt,now);assert.notEqual(proof.mirror.syncedAt,proof.checkedAt,'Checking publication cannot fabricate its timestamp');
console.log('PASS: public deployment identity, artifact drift, wrong/unfinished CI, missing/future timestamps, mirror propagation mismatch and unsafe cache rejection');

const pendingSource=P.assemble(source,mirror,sourceRuns,head,commit,mirrorRuns,now,{object:{sha:'f'.repeat(40)}});assert.equal(pendingSource.status,'different');assert(pendingSource.reason.includes('主站分支已有更新'));

// Exercise the real browser controller after success followed by a failed check.
(async()=>{
  const vm=require('node:vm'),fs=require('node:fs');let fail=false;
  const button={disabled:false,addEventListener(type,fn){this[type]=fn;}},message={textContent:''};
  const board={innerHTML:'',contains:()=>false,closest:()=>({addEventListener(){}}),querySelector:selector=>selector==='.publication-check'?button:message};
  const snapshot={coverage:{end:now},items:[{verifiedAt:now}],publicationChecks:proof};
  const document={activeElement:null,querySelectorAll:()=>[board],getElementById:id=>({textContent:JSON.stringify(id==='catalog-data'?{statusSnapshot:snapshot}:{version:'1.8.1',sourceCommit:s})})};
  const values=new Map();
  const context={document,ResearchModel:{esc:String},location:{protocol:'https:',hostname:'1337816143.github.io'},Date,Intl,AbortSignal,console,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},fetch:async url=>{
    if(fail)throw Error('simulated network failure');
    let value;if(url.endsWith('/MyDotWork/release-manifest.json'))value=source;else if(url.endsWith('/Evolution/data/release-manifest.json'))value=mirror;else if(url.includes('MyDotWork/actions/runs'))value=sourceRuns;else if(url.includes('Evolution/actions/runs'))value=mirrorRuns;else if(url.includes('MyDotWork/git/ref'))value={object:{sha:s}};else if(url.includes('Evolution/git/ref'))value=head;else if(url.includes('Evolution/git/commits'))value=commit;else throw Error('unexpected URL');
    return {ok:true,json:async()=>value};
  }};
  vm.runInNewContext(fs.readFileSync('src/publication.js','utf8'),context);
  await button.click();assert(board.innerHTML.includes('本次核验的两站公开产物清单一致'));
  fail=true;await button.click();
  assert(board.innerHTML.includes('本次未核验成功'));
  assert(!board.innerHTML.includes('本次核验的两站公开产物清单一致'),'A failed repeat check must not retain a successful current-check claim');
  assert(board.innerHTML.includes('截至这份记录的两站清单一致'));
  assert.equal(snapshot.items[0].verifiedAt,now);assert.equal(snapshot.coverage.end,now);
  console.log('PASS: repeat network failure downgrades prior live proof to historical evidence without advancing task or archive dates');
})().catch(error=>{console.error(error);process.exitCode=1;});
