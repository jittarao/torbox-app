import { fileListSignature } from '@/utils/downloadListMerge';

/** Per-entity signature for list derivation cache (progress, state, files). */
export function buildRowDataSignature(key, entity) {
  if (!entity) return `${key}:missing`;
  return `${key}:${entity.progress ?? 0}:${entity.download_state ?? ''}:${entity.active ? 1 : 0}:${entity.download_finished ? 1 : 0}:${fileListSignature(entity.files)}:${entity.updated_at ?? ''}`;
}

export function viewIdsOrderUnchanged(prevIds, nextIds) {
  if (prevIds === nextIds) return true;
  if (!prevIds || !nextIds || prevIds.length !== nextIds.length) return false;
  for (let i = 0; i < nextIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }
  return true;
}

/**
 * Keys whose row data changed since last derivation pass.
 * @returns {string[]|null} null means full rebuild (order/length change or cold start)
 */
export function collectDirtyRowKeys(viewIds, entities, prevRowSigs, prevViewIds) {
  if (!viewIdsOrderUnchanged(prevViewIds, viewIds)) {
    return null;
  }

  const dirty = [];
  for (let i = 0; i < viewIds.length; i++) {
    const key = viewIds[i];
    const sig = buildRowDataSignature(key, entities[key]);
    if (prevRowSigs.get(key) !== sig) {
      dirty.push(key);
    }
  }

  if (prevRowSigs.size !== viewIds.length) {
    return null;
  }

  return dirty;
}
