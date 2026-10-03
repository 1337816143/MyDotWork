/* Read-only public deployment evidence, separate from the dated task snapshot. */
const PublicationModel=(()=>{
  const isSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
  const isVersion=value=>typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value);
  const time=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('Invalid publication time');const parsed=Date.parse(value);if(!Number.isFinite(parsed))throw Error('Invalid publication time');return parsed;};
  function runFor(payload,commit){
    if(!Array.isArray(payload?.workflow_runs))throw Error('Missing workflow records');
    return payload.workflow_runs.filter(r=>r.head_sha===commit&&r.head_branch==='main'&&r.path==='.github/workflows/pages.yml'&&r.status==='completed'&&r.conclusion==='success'&&Number.isSafeInteger(r.id)&&r.id>0&&typeof r.updated_at==='string'&&Number.isFinite(Date.parse(r.updated_at))).sort((a,b)=>time(b.updated_at)-time(a.updated_at))[0]||null;
  }
  function manifestsMatch(source,mirror){
    if(source?.schema!=='mydotwork.release.v1'||!isSha(source.sourceCommit)||!isVersion(source.contentVersion)||!Array.isArray(source.artifacts))throw Error('Invalid main release manifest');
    const dot=mirror?.dotArchive,report=mirror?.chatgptSupply;
    if(!isSha(mirror?.sourceCommit)||dot?.repository!=='1337816143/MyDotWork'||report?.repository!=='1337816143/MyDotWork'||!isVersion(dot.contentVersion)||!isSha(dot.sourceCommit)||!Array.isArray(dot.artifacts))throw Error('Invalid mirror release manifest');
    const seen=new Set();for(const a of source.artifacts){if(typeof a.path!=='string'||seen.has(a.path)||!Number.isInteger(a.bytes)||a.bytes<1||!/^\w[\w./-]*$/.test(a.path)||a.path.includes('..')||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Invalid source artifact');seen.add(a.path);}
    const root=source.artifacts.find(a=>a.path==='index.html');if(!root||root.sha256!==source.reportSha256)throw Error('Root report manifest differs');
    const imports=new Map();for(const a of dot.artifacts){if(imports.has(a.path))throw Error('Duplicate mirror artifact');imports.set(a.path,a);}
    return dot.sourceCommit===source.sourceCommit&&report.sourceCommit===source.sourceCommit&&dot.contentVersion===source.contentVersion&&report.contentVersion===source.contentVersion&&report.reportSha256===root.sha256&&imports.size===source.artifacts.length-1&&source.artifacts.filter(a=>a.path!=='index.html').every(a=>imports.get(a.path)?.sha256===a.sha256&&imports.get(a.path)?.bytes===a.bytes);
  }
  function assemble(source,mirror,sourceRuns,head,commit,mirrorRuns,checkedAt,sourceHead){
    const checked=time(checkedAt),same=manifestsMatch(source,mirror),headSha=head?.object?.sha;
    if(!isSha(sourceHead?.object?.sha))throw Error('Missing current main source reference');
    const sourceCurrent=sourceHead.object.sha===source.sourceCommit;
    if(!isSha(headSha)||commit?.sha!==headSha)throw Error('Mirror commit does not match reference');
    const sourceRun=runFor(sourceRuns,source.sourceCommit),mirrorRun=runFor(mirrorRuns,headSha);
    const commitMatches=commit.message===`deploy: release-${mirror.sourceCommit.slice(0,12)} complete website from ${mirror.sourceCommit}`;
    const syncedAt=commitMatches?commit.committer?.date:null;
    if(commitMatches)time(syncedAt);
    for(const stamp of [sourceRun?.updated_at,mirrorRun?.updated_at,syncedAt].filter(Boolean))if(time(stamp)>checked+120000)throw Error('Publication clock is in the future');
    return {checkedAt,sourceHead:sourceHead.object.sha,status:sourceCurrent&&same&&sourceRun&&mirrorRun&&commitMatches?'consistent':'different',reason:!sourceCurrent?'主站分支已有更新，在线部署仍未对应最新提交。':!same?'两站在线产物清单不同。':!sourceRun||!mirrorRun?'尚未取得两站对应的成功部署记录。':!commitMatches?'镜像提交与在线清单尚未对应。':'',source:{version:source.contentVersion,commit:source.sourceCommit,deployedAt:sourceRun?.updated_at||null,runId:sourceRun?.id||null,runUrl:sourceRun?`https://github.com/1337816143/MyDotWork/actions/runs/${sourceRun.id}`:null},mirror:{version:mirror.dotArchive.contentVersion,upstreamCommit:mirror.dotArchive.sourceCommit,sourceCommit:mirror.sourceCommit,commit:headSha,syncedAt,deployedAt:mirrorRun?.updated_at||null,runId:mirrorRun?.id||null,runUrl:mirrorRun?`https://github.com/1337816143/Evolution/actions/runs/${mirrorRun.id}`:null}};
  }
  function validProof(value,now=Date.now()){
    try{
      if(value?.status!=='consistent'||time(value.checkedAt)>now+120000)return false;
      const a=value.source,b=value.mirror;
      if(!isVersion(a.version)||a.version!==b.version||!isSha(a.commit)||a.commit!==b.upstreamCommit||a.commit!==value.sourceHead||!isSha(b.commit)||!isSha(b.sourceCommit))return false;
      for(const [record,repository] of [[a,'MyDotWork'],[b,'Evolution']]){
        if(!Number.isSafeInteger(record.runId)||record.runId<1||record.runUrl!==`https://github.com/1337816143/${repository}/actions/runs/${record.runId}`||time(record.deployedAt)>time(value.checkedAt)+120000)return false;
      }
      return time(b.syncedAt)<=time(b.deployedAt)&&time(b.syncedAt)<=time(value.checkedAt)+120000;
    }catch{return false;}
  }
  return {isSha,isVersion,runFor,manifestsMatch,assemble,validProof};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PublicationModel;
if(typeof document!=='undefined')(()=>{
  const snapshot=JSON.parse(document.getElementById('catalog-data').textContent).statusSnapshot,context=JSON.parse(document.getElementById('release-context').textContent),boards=[...document.querySelectorAll('[data-publication-board]')],esc=ResearchModel.esc;
  const date=value=>value?new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Shanghai'}).format(new Date(value))+' 北京时间':'尚未核验';
  const sourceUrl='https://1337816143.github.io/MyDotWork/release-manifest.json',mirrorUrl='https://1337816143.github.io/Evolution/data/release-manifest.json',api='https://api.github.com/repos/1337816143/';
  const canCheck=location.protocol==='https:'&&location.hostname==='1337816143.github.io';
  const key='mydotwork-publication-evidence-v1';let current=snapshot.publicationChecks,mode='snapshot',inFlight=null,attempted=false;
  const times=snapshot.items.map(item=>item.verifiedAt).sort((a,b)=>Date.parse(a)-Date.parse(b));
  function render(message=''){
    const active=document.activeElement,focusBoard=boards.find(board=>board.contains(active)&&active.matches?.('.publication-check'));
    const behind=current.source.version!==context.version||(PublicationModel.isSha(context.sourceCommit)&&current.source.commit!==context.sourceCommit);
    const label=mode==='live'?'公开部署核验记录':mode==='cache'?'已缓存的公开部署核验':'上次已核验的发布快照';
    for(const board of boards){
      const source=current.source,mirror=current.mirror;
      board.innerHTML=`<dl class="publication-times"><div><dt>1 · 原文覆盖截止</dt><dd>${date(snapshot.coverage.end)}<br>部分分页，不代表完整历史。</dd></div><div><dt>2 · 任务最近核验</dt><dd>最早：${date(times[0])}<br>最近：${date(times.at(-1))}<br>各任务按自己的核验时间判断是否过期。</dd></div><div><dt>3 · 主站部署流程完成</dt><dd>v${esc(source.version)} · ${date(source.deployedAt)}</dd></div><div><dt>4 · 镜像同步提交</dt><dd>v${esc(mirror.version)} · ${date(mirror.syncedAt)}<br>镜像Pages完成：${date(mirror.deployedAt)}</dd></div></dl><p class="publication-notice">${label} · 核验于 ${date(current.checkedAt)}。${current.status==='consistent'?(mode==='live'?'本次核验的两站公开产物清单一致。':'截至这份记录的两站清单一致；当前分支与部署尚未重新核验。'):'两站部署记录尚未核对一致，不能当作已同步。'}${behind?' 当前界面版本与这份核验记录不同，请核验最新部署；这不代表任务状态已更新。':''}</p><button type="button" class="publication-check"${!canCheck?' disabled':''}>核验最新公开部署</button><p class="publication-message" aria-live="polite">${esc(message||(!canCheck?'离线预览仅显示上次核验记录；最新部署未在此核验。':''))}</p><p class="publication-sources">${source.runUrl?`<a href="${esc(source.runUrl)}" target="_blank" rel="noopener noreferrer">主站部署记录</a>`:''}${mirror.runUrl?` · <a href="${esc(mirror.runUrl)}" target="_blank" rel="noopener noreferrer">镜像部署记录</a>`:''}</p><p class="publication-notice">任务状态是独立快照。检查部署不会刷新原文覆盖或研究观察日期，也不会把排队改成运行。完整需求完成情况仍见每项任务。</p>`;
      board.querySelector('.publication-check').addEventListener('click',()=>check(true));
    }
    if(focusBoard?.getClientRects().length)focusBoard.querySelector('.publication-check').focus({preventScroll:true});
  }
  async function get(url){const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Public deployment information unavailable');return response.json();}
  function cached(){try{const value=JSON.parse(localStorage.getItem(key)||'null'),age=Date.now()-Date.parse(value?.checkedAt);if(PublicationModel.validProof(value)&&value.source.version===context.version&&(!PublicationModel.isSha(context.sourceCommit)||value.source.commit===context.sourceCommit)&&age>=0&&age<600000)return value;}catch{}return null;}
  async function check(force=false){
    if(!canCheck||inFlight)return;if(!force){const value=cached();if(value){current=value;mode='cache';render();return;}}
    for(const board of boards){board.querySelector('.publication-check').disabled=true;board.querySelector('.publication-message').textContent='正在核验公开部署记录；任务快照保持原时间。';}
    inFlight=(async()=>{
      const [source,mirror]=await Promise.all([get(sourceUrl),get(mirrorUrl)]);PublicationModel.manifestsMatch(source,mirror);
      const [sourceRuns,head,sourceHead]=await Promise.all([get(api+'MyDotWork/actions/runs?head_sha='+source.sourceCommit+'&per_page=20'),get(api+'Evolution/git/ref/heads/main'),get(api+'MyDotWork/git/ref/heads/main')]);
      if(!PublicationModel.isSha(head?.object?.sha))throw Error('Invalid public mirror reference');
      const [commit,mirrorRuns]=await Promise.all([get(api+'Evolution/git/commits/'+head.object.sha),get(api+'Evolution/actions/runs?head_sha='+head.object.sha+'&per_page=20')]);
      current=PublicationModel.assemble(source,mirror,sourceRuns,head,commit,mirrorRuns,new Date().toISOString(),sourceHead);mode='live';
      if(current.status==='consistent')try{localStorage.setItem(key,JSON.stringify(current));}catch{}
      render(current.status==='consistent'?'核验完成：当前主站提交、两站部署清单与成功CI相互对应。':current.reason+' 保留各自版本，不把等待写成已同步。');
    })().catch(()=>{if(mode==='live')mode='snapshot';render('本次未核验成功：未能取得完整公开部署证据，仅保留上次记录，不代表当前仍一致。请稍后再试。');}).finally(()=>{inFlight=null;for(const board of boards)board.querySelector('.publication-check').disabled=!canCheck;});
    await inFlight;
  }
  render();
  for(const board of boards)board.closest('details').addEventListener('toggle',event=>{if(event.target.open&&!attempted){attempted=true;check();}});
})();
