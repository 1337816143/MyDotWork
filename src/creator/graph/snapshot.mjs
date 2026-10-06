/* Independent input boundary. Data only: no storage, DOM, clock, network or writes. */
export class GraphAdapterError extends Error {
  constructor(code, message, details = null) {
    super(message); this.name = 'GraphAdapterError'; this.code = code; this.details = details;
  }
}
export const reject = (code, message, details) => { throw new GraphAdapterError(code, message, details); };
export const COLLECTIONS = Object.freeze(['works', 'references', 'drafts', 'tasks', 'publications', 'metrics', 'accounts', 'goals', 'reviews', 'assets']);
const ROOT_FIELDS = ['schemaVersion', 'id', 'revision', 'createdAt', 'updatedAt', 'visibility', 'dataClass', ...COLLECTIONS, 'history', 'operations', 'changes', 'imports', 'sourceWorkspaces'];
const MAX_BYTES = 16 * 1024 * 1024;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function fields(record, names, label) {
  if (!isRecord(record)) reject('INVALID_SCHEMA', `${label} must be an object`);
  const unknown = Object.keys(record).find(key => !names.includes(key));
  if (unknown !== undefined) reject('UNKNOWN_FIELD', `${label} contains an unsupported field`, {field: unknown});
  if (names.some(key => !Object.hasOwn(record, key))) reject('MISSING_FIELD', `${label} is incomplete`);
}

/** Copy only JSON data with incremental limits; never execute getters or toJSON. */
function copyJson(value, depth = 0, budget = {bytes: 0, values: 0, path: new WeakSet()}) {
  if (depth > 64) reject('INVALID_DATA', 'Input is too deeply nested');
  if (++budget.values > 1000000) reject('STATE_TOO_LARGE', 'Input exceeds one million JSON values');
  const charge = bytes => { budget.bytes += bytes; if (budget.bytes > MAX_BYTES) reject('STATE_TOO_LARGE', 'Input exceeds 16 MiB'); };
  const jsonBytes = scalar => {
    if (typeof scalar === 'string' && scalar.length > MAX_BYTES - budget.bytes) reject('STATE_TOO_LARGE', 'Input exceeds 16 MiB');
    return new TextEncoder().encode(JSON.stringify(scalar)).length;
  };
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) {
    charge(jsonBytes(value)); return value;
  }
  if (typeof value !== 'object' || !value) reject('INVALID_DATA', 'Input must contain only JSON values');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject('INVALID_DATA', 'Input must contain plain objects');
  if (budget.path.has(value)) reject('INVALID_DATA', 'Input contains a cycle');
  budget.path.add(value); charge(2);
  const output = Array.isArray(value) ? [] : {};
  let count = 0;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') reject('INVALID_DATA', 'Symbol properties are unsupported');
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (['__proto__', 'prototype', 'constructor'].includes(key)) reject('UNSAFE_KEY', 'Unsafe object key');
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) reject('INVALID_DATA', 'Accessors and hidden properties are unsupported');
    if (Array.isArray(value) && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) reject('INVALID_DATA', 'Array properties are unsupported');
    if (count++) charge(1);
    if (!Array.isArray(value)) charge(jsonBytes(key) + 1);
    output[key] = copyJson(descriptor.value, depth + 1, budget);
  }
  if (Array.isArray(value) && count !== value.length) reject('INVALID_DATA', 'Sparse arrays are unsupported');
  budget.path.delete(value);
  return output;
}

export function snapshotState(input, {validId, isoTime}) {
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > MAX_BYTES) reject('STATE_TOO_LARGE', 'Input exceeds 16 MiB');
    try { input = JSON.parse(input); } catch { reject('INVALID_JSON', 'State must be valid JSON'); }
  }
  const state = copyJson(input);
  if (new TextEncoder().encode(JSON.stringify(state)).length > MAX_BYTES) reject('STATE_TOO_LARGE', 'Input exceeds 16 MiB');
  fields(state, ROOT_FIELDS, 'Workspace');
  if (state.schemaVersion !== 1) reject('UNSUPPORTED_SCHEMA', 'Only workspace schemaVersion 1 is supported');
  if (!validId(state.id) || !integer(state.revision) || state.visibility !== 'private') reject('INVALID_SCHEMA', 'Invalid workspace identity, revision or visibility');
  if (state.dataClass !== 'synthetic') reject('SYNTHETIC_ONLY', 'This checkpoint accepts explicitly synthetic data only');
  isoTime(state.createdAt); isoTime(state.updatedAt);
  const ids = new Set();
  for (const collection of COLLECTIONS) {
    if (!isRecord(state[collection])) reject('INVALID_SCHEMA', 'Collections must be identity maps', {collection});
    for (const [id, entity] of Object.entries(state[collection])) {
      if (!validId(id) || !isRecord(entity) || entity.id !== id || ids.has(id)) reject('INVALID_IDENTITY', 'Map keys must equal globally unique entity IDs', {collection, id});
      ids.add(id);
    }
  }
  for (const key of ['history', 'operations', 'imports']) if (!isRecord(state[key])) reject('INVALID_SCHEMA', 'Audit maps must be objects', {field: key});
  if (!Array.isArray(state.changes) || !Array.isArray(state.sourceWorkspaces)) reject('INVALID_SCHEMA', 'Audit lists must be arrays');
  for (const source of state.sourceWorkspaces) {
    fields(source, ['id', 'revision', 'createdAt', 'updatedAt', 'dataClass', 'visibility'], 'Source workspace');
    if (!validId(source.id) || !integer(source.revision) || source.visibility !== 'private' || source.dataClass !== 'synthetic') reject('SYNTHETIC_ONLY', 'Invalid or private source provenance is not supported');
    isoTime(source.createdAt); isoTime(source.updatedAt);
  }
  for (const [key, versions] of Object.entries(state.history)) {
    const colon = key.indexOf(':'), collection = key.slice(0, colon), id = key.slice(colon + 1);
    if (!COLLECTIONS.includes(collection) || !validId(id) || !Array.isArray(versions)) reject('INVALID_HISTORY', 'Invalid history identity');
    for (const entity of versions) if (!isRecord(entity) || entity.id !== id) reject('INVALID_HISTORY', 'History cannot change identity');
  }
  return state;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Native exporters may omit orphan records. Every projected record must be validated. */
export async function validateCompleteRecordGraph(state, {exportPackage, validatePackage}) {
  const {records} = await validatePackage(await exportPackage(state, {packageId: 'graph-validation', generatedAt: state.updatedAt}));
  const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  for (const collection of COLLECTIONS) {
    const expectedIds = Object.keys(state[collection]).sort(), validatedIds = Object.keys(records[collection]).sort();
    if (JSON.stringify(expectedIds) !== JSON.stringify(validatedIds)) reject('UNVALIDATED_RECORD', 'Native validation did not include every source record', {collection});
    for (const id of expectedIds) if (canonical(state[collection][id]) !== canonical(records[collection][id])) reject('VALIDATION_RECORD_MISMATCH', 'Native validation returned changed record data', {collection, id});
  }
  return {...state, ...records};
}
