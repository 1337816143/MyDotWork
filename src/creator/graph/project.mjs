import {COLLECTIONS, deepFreeze, reject} from './snapshot.mjs';

const KINDS = Object.freeze({works: 'Work', references: 'Reference', drafts: 'Draft', tasks: 'Task', publications: 'Publication', metrics: 'MetricObservation', accounts: 'Account', goals: 'Goal', reviews: 'Review', assets: 'AssetReference'});
const RELATION_TYPES = Object.freeze({
  'works.initialDraftId': 'initialDraft', 'works.bodyRevisionId': 'currentDraft',
  'works.parentWorkId': 'derivedFromWork', 'works.reviewId': 'derivedFromReview',
  'references.assetId': 'referencesAsset', 'drafts.parentDraftId': 'previousDraft',
  'publications.accountId': 'publicationAccount', 'publications.finalRevisionId': 'publishedDraft',
  'publications.finalSnapshot.assetIds': 'publicationAsset',
  'metrics.publicationId': 'measuresPublication', 'metrics.accountId': 'measuresAccount',
  'goals.accountId': 'targetsAccount', 'reviews.evidenceMetricIds': 'usesMetricEvidence',
  'reviews.followupWorkIds': 'producedFollowupWork'
});
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
// JSON tuples make namespace boundaries unambiguous even when IDs contain ':' or '.'.
const nodeId = (workspaceId, collection, ...ids) => `node:${JSON.stringify([workspaceId, collection, ...ids])}`;
const edgeId = (type, from, to) => `edge:${JSON.stringify([type, from, to])}`;
function labelFor(collection, record) {
  if (collection === 'publications') return record.finalSnapshot?.title ?? record.id;
  if (collection === 'metrics') return record.metricKey;
  if (collection === 'goals') return `${record.month} ${record.metric}`;
  return record.title ?? record.displayName ?? record.name ?? record.id;
}

/** Internal: called only after the source-specific validator has accepted the snapshot. */
export function projectValidated(state, {host, contract, validationScope, relationsFor, sourceSnapshots}) {
  const nodes = [], edges = new Map(), existing = new Set();
  const idFor = (collection, ...ids) => nodeId(state.id, collection, ...ids);
  const origin = (collection, entity) => ({host, workspaceId: state.id, collection, entityId: entity.id, entityRevision: entity.revision});
  function addNode(node) {
    if (existing.has(node.id)) reject('DUPLICATE_GRAPH_ID', 'Projection produced a duplicate identity');
    existing.add(node.id); nodes.push(node);
  }
  function edge(type, from, to, source) {
    if (!type) reject('UNSUPPORTED_RELATION', 'Source relation has no explicit graph contract', source);
    const id = edgeId(type, from, to);
    edges.set(id, {id, type, from, to, source});
  }
  for (const collection of COLLECTIONS) for (const entity of Object.values(state[collection])) {
    addNode({id: idFor(collection, entity.id), kind: KINDS[collection], label: labelFor(collection, entity), source: origin(collection, entity), record: entity,
      ...(collection === 'metrics' ? {observation: {kind: entity.value === null ? 'unknown' : 'observed', value: entity.value}} : {})});
    for (const relation of relationsFor(collection, entity.id, entity)) {
      const separator = relation.to.indexOf(':');
      const targetCollection = relation.to.slice(0, separator), targetId = relation.to.slice(separator + 1);
      edge(relation.field === 'workId' ? 'belongsToWork' : RELATION_TYPES[`${collection}.${relation.field}`], idFor(collection, entity.id), idFor(targetCollection, targetId), {...origin(collection, entity), field: relation.field});
    }
  }
  if (sourceSnapshots) for (const work of Object.values(state.works)) {
    const snapshot = work.productionSource;
    if (!snapshot) continue; // Legacy state is read as-is; no invented migration snapshot.
    const sourceId = idFor('sourceSnapshots', snapshot.id);
    const provenance = {...origin('works', work), field: 'productionSource', snapshotId: snapshot.id, capturedWorkRevision: snapshot.workRevision};
    addNode({id: sourceId, kind: 'ProductionSourceSnapshot', label: snapshot.title, source: provenance, record: snapshot});
    edge('hasProductionSource', idFor('works', work.id), sourceId, provenance);
    edge('capturesWork', sourceId, idFor('works', work.id), {...provenance, field: 'productionSource.workId'});
    for (const reference of snapshot.references) {
      const referenceId = idFor('snapshotReferences', snapshot.id, reference.id);
      const referenceSource = {...provenance, field: 'productionSource.references', referenceId: reference.id, referenceRevision: reference.revision};
      addNode({id: referenceId, kind: 'SourceReferenceSnapshot', label: reference.title, source: referenceSource, record: reference});
      edge('containsReferenceSnapshot', sourceId, referenceId, referenceSource);
      if (state.references[reference.id]) edge('snapshotOfReference', referenceId, idFor('references', reference.id), referenceSource);
    }
  }
  if (sourceSnapshots) for (const draft of Object.values(state.drafts)) {
    if (draft.sourceSnapshotId) edge('usesProductionSource', idFor('drafts', draft.id), idFor('sourceSnapshots', draft.sourceSnapshotId), {...origin('drafts', draft), field: 'sourceSnapshotId'});
  }
  for (const relation of edges.values()) if (!existing.has(relation.from) || !existing.has(relation.to)) reject('DANGLING_GRAPH_EDGE', 'A graph edge has no validated node', {id: relation.id});
  nodes.sort((a, b) => compare(a.id, b.id));
  const orderedEdges = [...edges.values()].sort((a, b) => compare(a.id, b.id));
  return deepFreeze({
    protocol: 'mydotwork.readonly-graph.v1', schemaVersion: 1, sourceSchemaVersion: state.schemaVersion,
    workspaceId: state.id, revision: state.revision, dataClass: state.dataClass, visibility: state.visibility,
    source: {host, contract, validationScope}, readOnly: true,
    capabilities: {write: false, edit: false, sync: false, methodNotes: {supported: false, externalReadOnlyEntry: 'not-implemented'}},
    nodes, edges: orderedEdges,
    counts: {works: Object.keys(state.works).length, nodes: nodes.length, edges: orderedEdges.length}
  });
}
