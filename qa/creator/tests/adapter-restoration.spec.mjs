import {test,expect,boot,guardNetwork,writeEvidence,ORIGIN} from './helpers.mjs';

test('real-browser IndexedDB adapter: independent context import, identity, conflicts, recovery',async({browser},testInfo)=>{
  test.setTimeout(120000);
  const sourceContext=await browser.newContext({baseURL:ORIGIN,serviceWorkers:'block'});
  const sourceGuard=await guardNetwork(sourceContext);
  const sourcePage=await sourceContext.newPage();
  await boot(sourcePage);
  const source=await sourcePage.evaluate(async()=>{
    const {createIndexedDBStore}=await import('/creator/core/store.mjs');
    const {createWorkspace}=await import('/creator/core/core.mjs');
    const {exportPackage}=await import('/creator/core/exchange.mjs');
    const {seedDemo}=await import('/creator/core/fixtures.mjs');
    // Test-only adapter opt-in, in a new synthetic database. The production
    // app always boots with false and no UI import switch is changed.
    const store=await createIndexedDBStore({name:'synthetic-adapter-source',origin:location.origin,approvedPrivateOrigin:true,initialState:createWorkspace({id:'synthetic-source',dataClass:'synthetic'})});
    try{
      const ids=await seedDemo(store);
      const state=await store.read();
      const pkg=await exportPackage(state,{packageId:'synthetic-package-one'});
      return {state,pkg,workId:ids.workId,publicationId:ids.publicationId};
    }finally{store.close();}
  });
  sourceGuard();
  await sourceContext.close();

  // Fresh context receives only the synthetic exchange package, never a copy
  // of browser storageState or another context's IndexedDB database.
  const targetContext=await browser.newContext({baseURL:ORIGIN,serviceWorkers:'block'});
  const targetGuard=await guardNetwork(targetContext);
  const targetPage=await targetContext.newPage();
  try{
    await boot(targetPage);
    const restored=await targetPage.evaluate(async({pkg})=>{
      const {createIndexedDBStore}=await import('/creator/core/store.mjs');
      const {createWorkspace,COLLECTIONS,metricDelta,latestMetrics}=await import('/creator/core/core.mjs');
      const options={name:'synthetic-adapter-target',origin:location.origin,approvedPrivateOrigin:true};
      let store=await createIndexedDBStore({...options,initialState:createWorkspace({id:'synthetic-target',dataClass:'synthetic'})});
      const before=await store.read();
      const preview=await store.previewImport(pkg);
      const imported=await store.importPackage(pkg,{expectedRevision:before.revision,operationId:'synthetic-import-one'});
      const state=await store.read();
      const pointsBefore=await store.listRestorePoints();
      const repeated=await store.importPackage(pkg,{expectedRevision:state.revision,operationId:'synthetic-import-repeat'});
      const afterRepeat=await store.read(),pointsAfter=await store.listRestorePoints();
      store.close();
      store=await createIndexedDBStore(options);
      const reopened=await store.read();
      const metric=Object.values(state.metrics).find(m=>m.metricKey==='views');
      const delta=metricDelta(state,{publicationId:metric.publicationId,metricKey:'views'});
      const latest=latestMetrics(state,{publicationId:metric.publicationId}).find(m=>m.metricKey==='views');
      await store.restore({restorePointId:imported.result.restorePointId,expectedRevision:reopened.revision,operationId:'synthetic-restore-empty'});
      const recovered=await store.read(),recoveryPoints=await store.listRestorePoints();
      // The restore itself is recoverable: restore the automatically saved
      // pre-restore snapshot to recover the imported records.
      const recoveryPoint=recoveryPoints.find(point=>point.id!==imported.result.restorePointId);
      await store.restore({restorePointId:recoveryPoint.id,expectedRevision:recovered.revision,operationId:'synthetic-undo-restore'});
      const recoveredImport=await store.read();
      store.close();
      return {before,preview,state,pointsBefore,repeated:{replayed:repeated.replayed,imported:repeated.result.imported},afterRepeat,pointsAfter,reopened,delta:delta.value,latest:latest.value,recovered,recoveryPoints,recoveredImport,collections:COLLECTIONS};
    },{pkg:source.pkg});
    expect(Object.keys(restored.before.works)).toHaveLength(0);
    expect(restored.before.id).toBe('synthetic-target');
    expect(restored.preview.conflicts).toEqual([]);
    expect(restored.preview.missingAssets).toHaveLength(1);
    for(const collection of restored.collections)expect(restored.state[collection],`${collection} identities and records`).toEqual(source.state[collection]);
    expect(restored.state.id).toBe('synthetic-target');
    expect(restored.state.sourceWorkspaces.some(w=>w.id===source.state.id)).toBe(true);
    expect(restored.repeated).toEqual({replayed:true,imported:0});
    expect(restored.afterRepeat.revision).toBe(restored.state.revision);
    expect(restored.pointsAfter).toEqual(restored.pointsBefore);
    expect(restored.reopened).toEqual(restored.afterRepeat);
    expect(restored.latest).toBe(160);
    expect(restored.delta).toBe(60);
    expect(Object.values(restored.state.metrics).find(m=>m.metricKey==='comments').value).toBeNull();
    expect(Object.values(restored.state.assets)[0].availability).toMatch(/missing|unverified/);
    expect(Object.keys(restored.recovered.works)).toHaveLength(0);
    expect(restored.recoveryPoints).toHaveLength(2);
    expect(restored.recovered.revision).toBeGreaterThan(restored.state.revision);
    for(const collection of restored.collections)expect(restored.recoveredImport[collection]).toEqual(source.state[collection]);

    const conflict=await targetPage.evaluate(async({baseline,workId})=>{
      const {createIndexedDBStore}=await import('/creator/core/store.mjs');
      const {exportPackage,sha256,relationsFor}=await import('/creator/core/exchange.mjs');
      const {canonical}=await import('/creator/core/core.mjs');
      const options={origin:location.origin,approvedPrivateOrigin:true};
      const local=await createIndexedDBStore({...options,name:'synthetic-conflict-local',initialState:structuredClone(baseline)});
      const incoming=await createIndexedDBStore({...options,name:'synthetic-conflict-incoming',initialState:structuredClone(baseline)});
      const command=async(store,title,operationId)=>{const s=await store.read();return store.dispatch({type:'updateIdea',payload:{workId,title},expectedRevision:s.revision,operationId});};
      await command(local,'虚构本地修改','synthetic-local-change');
      await command(incoming,'虚构导入修改','synthetic-incoming-change');
      const pkg=await exportPackage(await incoming.read(),{packageId:'synthetic-conflict-package'});
      const preview=await local.previewImport(pkg);
      const before=await local.read();
      let code=null;
      try{await local.importPackage(pkg,{expectedRevision:before.revision,operationId:'synthetic-unresolved-import'});}catch(error){code=error.code;}
      const afterRejected=await local.read();
      const unresolvedPoints=await local.listRestorePoints();
      const chosen=Object.fromEntries(preview.conflicts.map(c=>[c.key,'incoming']));
      await local.importPackage(pkg,{expectedRevision:before.revision,operationId:'synthetic-resolved-import',choices:chosen});
      const afterAccepted=await local.read();
      const noHistory=structuredClone(before);noHistory.history={};
      const noBase=await createIndexedDBStore({...options,name:'synthetic-conflict-no-base',initialState:noHistory});
      const withoutAncestors=structuredClone(pkg);
      withoutAncestors.packageId='synthetic-no-base-package';
      for(const record of withoutAncestors.records)record.ancestors=[];
      withoutAncestors.relations=withoutAncestors.records.flatMap(r=>relationsFor(r.collection,r.id,r.entity));
      delete withoutAncestors.packageHash;
      withoutAncestors.packageHash=await sha256(canonical(withoutAncestors));
      const noBasePreview=await noBase.previewImport(withoutAncestors);
      const noBaseBefore=await noBase.read();
      let noBaseCode=null;
      try{await noBase.importPackage(withoutAncestors,{expectedRevision:noBaseBefore.revision,operationId:'synthetic-no-base-unresolved'});}catch(error){noBaseCode=error.code;}
      const noBaseAfter=await noBase.read();
      const keepLocal=Object.fromEntries(noBasePreview.conflicts.map(c=>[c.key,'local']));
      await noBase.importPackage(withoutAncestors,{expectedRevision:noBaseAfter.revision,operationId:'synthetic-no-base-keep-local',choices:keepLocal});
      const noBaseRetained=await noBase.read();
      local.close();incoming.close();noBase.close();
      return {preview,code,before,afterRejected,unresolvedPoints,afterAccepted,noBasePreview,noBaseCode,noBaseBefore,noBaseAfter,noBaseRetained};
    },{baseline:source.state,workId:source.workId});
    const item=conflict.preview.conflicts.find(c=>c.id===source.workId);
    expect(item.noCommonBase).toBe(false);
    expect(item.commonBase.title).toBe(source.state.works[source.workId].title);
    expect(conflict.code).toBe('IMPORT_CONFLICT');
    expect(conflict.afterRejected).toEqual(conflict.before);
    expect(conflict.unresolvedPoints).toEqual([]);
    expect(conflict.afterAccepted.works[source.workId].title).toBe('虚构导入修改');
    expect(conflict.noBasePreview.conflicts.find(c=>c.id===source.workId).noCommonBase).toBe(true);
    expect(conflict.noBaseCode).toBe('IMPORT_CONFLICT');
    expect(conflict.noBaseAfter).toEqual(conflict.noBaseBefore);
    expect(conflict.noBaseRetained.works[source.workId].title).toBe('虚构本地修改');
    await writeEvidence(testInfo,'adapter-restoration',{
      scope:'Actual IndexedDB adapter and exchange API inside independent browser contexts; not UI private-import acceptance',
      syntheticOnly:true,productionAppUnmodified:true,independentContext:true,
      entityCollectionsVerified:restored.collections,workId:source.workId,publicationId:source.publicationId,
      latestViews:restored.latest,deltaViews:restored.delta,unknownComments:null,
      missingAssetCount:restored.preview.missingAssets.length,repeatImportAddedRecords:0,
      recoveryPointCount:restored.recoveryPoints.length,commonBaseConflict:true,noCommonBaseConflict:true,
      explicitIncomingAndLocalChoices:true,failedImportUnchanged:true,
    });
  }finally{targetGuard();await targetContext.close();}
});
