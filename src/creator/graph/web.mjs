/* Explicit binding to the existing Web contract; never use the Obsidian validator here. */
import {validId, isoTime} from '../core/core.mjs';
import {exportPackage, validatePackage, relationsFor} from '../core/exchange.mjs';
import {snapshotState, validateCompleteRecordGraph} from './snapshot.mjs';
import {projectValidated} from './project.mjs';

export async function projectWebState(input) {
  const state = snapshotState(input, {validId, isoTime});
  // Exchange validates current entities, their included ancestors, references and metrics.
  // It does not validate full Web storage/audit semantics; the graph never reads those.
  const validated = await validateCompleteRecordGraph(state, {exportPackage, validatePackage});
  return projectValidated(validated, {
    host: 'web', contract: 'web-780-creator-v1',
    validationScope: 'strict-state-envelope+complete-native-exchange-record-graph', relationsFor, sourceSnapshots: false
  });
}
