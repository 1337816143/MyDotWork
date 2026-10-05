# Creator Stage 1 API contract

Independent dependency-free ESM. All functions work in Node and browser. Core never reads DOM, browser storage, network, or Obsidian.

## Files and imports

- `core.mjs`: `createWorkspace`, `applyCommand`, `readiness`, `selectWorkspace`, `latestMetrics`, `metricDelta`, `resolveSchedule`, `CreatorError`, `COLLECTIONS`
- `store.mjs`: `createMemoryStore`, `createIndexedDBStore`, `storagePolicy`
- `exchange.mjs`: `exportPackage`, `previewImport`, `prepareImport`
- `csv.mjs`: `previewMetricsCsv`, `exportMetricsCsv`
- `fixtures.mjs`: `seedDemo(store)`

## State and transaction contract

`createWorkspace({id?, now?, dataClass?: 'synthetic'|'private'})` returns schema 1 workspace with stable `id`, `revision:0`, default `visibility:'private'`, and ID-keyed normalized maps: `works`, `references`, `drafts`, `tasks`, `publications`, `metrics`, `accounts`, `goals`, `reviews`, `assets`. All views derive from these maps. Each entity has `id`, `schemaVersion:1`, `revision`, `createdAt`, `updatedAt`, `sourceRefs:[]`, `visibility:'private'`. Each dependent entity has `workId`, except account-scoped metric snapshots. Accounts and goals are independent entities.

`await createIndexedDBStore({name?, workspaceId?, initialState?, origin?, approvedPrivateOrigin?:false, indexedDB?})` returns the same store interface as `createMemoryStore({initialState?, failWrite?})`:

- `await store.read()` => cloned workspace
- `await store.dispatch({type, operationId, expectedRevision, payload})` => `{state,result,replayed}`. expectedRevision is **workspace** revision. Operation IDs must be unique random strings; retry uses identical type/payload and same operationId. Successful repeated operation IDs return replay without a second change. Reusing the operationId for different content rejects.
- `store.subscribe(fn)` => unsubscribe. Fires only after transaction completion, with committed state. Cross-tab invalidations use a channel when available; every dispatch still checks committed revision inside the IDB transaction.
- `await store.importPackage(package,{expectedRevision,operationId,choices?})` => committed state, import report and restorePointId. `choices` maps `collection:id` to `local` or `incoming` for every conflict.
- `await store.previewImport(package)` => read-only preview
- `await store.listRestorePoints()` and `await store.restore({restorePointId,expectedRevision,operationId})`. Restore is itself recoverable and checks concurrency.
- `store.policy`: mode, persistence, allowBackupImport, warning. Shared public github.io origins always stay demo-only; backup import is disabled. Other origins are also demo-only unless explicitly approved. Demo is synthetic only. Browser success is not claimed by unit tests.
- `store.close()`.

No UI saved indicator before the awaited write succeeds. Failure throws `CreatorError` with `code`, `message`, optional `details`; editor buffers belong to UI and must remain unchanged on failure. No in-memory success fallback for failed persistent writes.

## Commands and payloads

- `createAccount {displayName,platform,handle?}` => `{accountId}`
- `updateAccount {accountId,displayName?,platform?,handle?}` => `{accountId}`. An account used by publication records cannot change platform; create a separate account instead.
- `addReference {workId,title?,url?,analysis?,excerpt?,author?,rightsNote?}` / `updateReference {referenceId,title?,url?,analysis?,excerpt?,author?,rightsNote?}` => `{referenceId,duplicateReferences}`. Duplicate URLs are reported, not silently removed.
- `setGoal {goalId?,month:'YYYY-MM',timeZone,metric:'worksCompleted'|'publications',target,accountId:null|string}` => `{goalId}`
- `captureIdea {title,summary?,angle?,contentType?:'video'|'text',priority?:1|2|3,tags?:[],references?:[{url?,title?,analysis?,excerpt?,author?,rightsNote?}]}` => `{workId,duplicateReferences:[]}`
- `updateIdea {workId,title?,summary?,angle?,priority?,tags?}` => `{workId}`. A changed angle marks draftNeedsReview and returns ready work to producing.
- `startProduction {workId,contentType?:'video'|'text'}` => `{workId,taskIds}`. Repetition is idempotent even with another operationId.
- `saveDraft {workId,body,title?}` => `{workId,draftId}`. New immutable revision with parentDraftId. Clears draftNeedsReview.
- `setTaskState {workId,taskId,status:'todo'|'doing'|'blocked'|'done'|'na',reason?}` => `{workId,taskId}`. blocked and na need reasons.
- `setReady {workId}` => `{workId}`; requires saved nonempty draft and every required task done or explicit na.
- `setSchedule {workId,accountId,publicationId?,schedule:{date:'YYYY-MM-DD',time?:'HH:mm',timeZone,allDay:boolean,offsetMinutes?:number}}` => `{workId,publicationId,undoOperationId}`. Ambiguous local times require explicit UTC offset; nonexistent times reject. allDay has no invented clock time.
- `cancelSchedule {publicationId}` => `{publicationId,undoOperationId}`. Published facts cannot be cancelled through scheduling.
- `undo {targetOperationId}` => `{undoneOperationId}`. Only the latest reversible workspace change may be undone; otherwise reject visibly.
- `recordPublication {workId,accountId,publicationId?,actualPublishedAt:ISO-with-offset,publicUrl,finalRevisionId?}` => `{workId,publicationId}`. Manual fact only; creates immutable finalSnapshot and never fires from calendar.
- `appendMetrics {snapshots:[{publicationId?:string,accountId?:string,metricKey:'views'|'likes'|'comments'|'saves'|'shares'|'followers',value:null|number,unit?:'count',definition?:string,observedAt:ISO-with-offset,sourceRef?,importRowId?}]}` => `{metricIds,skipped}`. Exactly one target; followers only for accounts. Exact target/key/time/definition duplicates skip, conflicting values reject.
- `saveReview {workId,observation,hypothesis?,nextExperiment,evidenceMetricIds:[]}` => `{workId,reviewId}`
- `deriveFollowupIdea {reviewId,title,angle?}` => `{workId,reviewId}`. Repeated derivation for one review returns existing follow-up.
- `archiveWork {workId}` / `restoreWork {workId}` / `trashWork {workId}` => `{workId,undoOperationId}`. No irreversible delete. restoreWork restores pre-archive/pre-trash phase.
- `addAsset {workId,name,mimeType?,size?,sha256?,url?}` => `{assetId}`. References only; never claims local file bytes survived backup.
- `setAssetAvailability {assetId,availability:'missing'|'unverified',note?}` => `{assetId}`.

Work: title, summary, angle, contentType, priority, tags, phase, bodyRevisionId, draftNeedsReview, completedAt, trashedAt, parentWorkId, reviewId. Task: workId, stage, title, required, status, reason, completedAt. Draft: workId, title, body, parentDraftId. Publication: workId, accountId, status, schedule, actualPublishedAt, publicUrl, finalRevisionId, finalSnapshot. Schedule cancellation sets status draft and schedule null, preserving the publication identity. Metrics and drafts are append-only.

## Queries

`readiness(state,workId)` => `{ready,completed,total,missing:[{taskId?,label}]}`.

`selectWorkspace(state,{month?,timeZone?:'UTC',accountId?,platform?,asOf?})` => `{works,ideas,production,calendar,library,publications,unscheduled,reviews,accounts,goals,nextActions,totals,metricGroups}`. Work rows include `progress`. Calendar/publication rows include `work`, `account`, `progress`, `needsVerification`. Counts differentiate work count and publication count. Scoped account work lists derive only from matching publications (unassigned ideas remain visible with no account filter).

`latestMetrics(state,{publicationId?,accountId?,asOf?,platform?})` returns latest snapshots per target/key/unit/definition; null stays null. `metricDelta(state,{publicationId|accountId,metricKey,definition?,asOf?})` returns `{value:null|number,previous,current}`. Cumulative snapshots are not summed over time. Aggregates are separated by platform, unit, metric and definition.

`totals` has `works, activeWorks, ideas, producing, ready, publications, publishedWorks, overdue`. `nextActions` entries have `workId, taskId, publicationId, label, blocked, reason, due, priority`. `metricGroups` entries have `platform, metricKey, unit, definition, value, knownCount, unknownCount, snapshotIds`; unknownCount includes publications with no snapshot for that group. Account-wide goals are hidden by a narrower platform filter rather than misrepresented as platform-specific targets.

## Exchange

`await exportPackage(state,{packageId?,generatedAt?,workIds?})` returns `mydotwork.creator.v1` JSON with workspace identity, entity identities/revisions/SHA-256 hashes, ancestry/common baselines, explicit relations and asset manifest. It is a private backup, not approved public content. Asset bytes are not included in Stage 1.

Omitting workIds exports all business records including independent accounts/goals. An explicit workIds selection includes its connected parent/follow-up family and used accounts with their account-specific goals/metrics; it excludes unrelated accounts and workspace-wide goals. The UI should show the resulting counts before download.

`await previewImport(state,pkg)` => `{packageId,sourceWorkspaceId,new:[],same:[],older:[],conflicts:[],missingAssets:[],summary}`. Conflicts include local/incoming/commonBase or explicit `noCommonBase:true`. Unsafe URLs, unsupported schema, bad hashes, duplicate IDs, prototype keys, missing relationships and path traversal reject before mutation.

`await prepareImport(state,pkg,{expectedRevision,operationId,choices})` prepares a complete next workspace and restore metadata without modifying the store. Store commits next workspace and actual prior workspace recovery point atomically. Repeated identical package imports skip; changed same-package content rejects. No last-timestamp-wins.

Incoming records preserve business identities and revisions. Target workspace identity stays independent and records source workspace provenance. Local operation receipts and local restore-point snapshots are not replayed as another workspace's operations. Draft and metric identities and existing published facts cannot be overwritten even with an incoming conflict choice; retain local and create an explicit new revision/observation instead. Workspace revision remains monotonic across local restoration. Public export is not implemented in Stage 1; this protocol is a private backup only.

## Metrics CSV

`previewMetricsCsv(state,text,{mapping?})` => `{snapshots,errors,duplicates,columns,valid}`. Header names follow metric payload names; unknown columns reject rather than mutate another entity. `exportMetricsCsv(state)` yields formula-safe RFC4180 CSV. Import uses appendMetrics after explicit user review; failed rows are never silently applied.

CSV mapping is `{targetField: sourceHeader}`. Allowed fields are publicationId, accountId, metricKey, value, unit, definition, observedAt, sourceRef and importRowId. Empty numeric cells become null, not zero. Use `preview.valid` before dispatching any snapshots. Formula escaping in an exported text/source cell is intentional and may leave a leading apostrophe when reimported.
