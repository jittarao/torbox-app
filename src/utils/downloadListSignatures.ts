import { fileListSignature } from '@/utils/downloadEntityFiles';

type EntityMap = Record<string, Record<string, unknown> | undefined>;

/** Per-entity signature for list derivation cache (progress, state, files). */
export function buildRowDataSignature(
  key: string,
  entity: Record<string, unknown> | undefined
): string {
  if (!entity) return `${key}:missing`;
  const filesSig = entity.fileListSignature as string | undefined;
  const files = entity.files as unknown[] | undefined;
  const fileSig = filesSig !== undefined ? filesSig : fileListSignature(files);
  return `${key}:${entity.progress ?? 0}:${entity.download_state ?? ''}:${entity.active ? 1 : 0}:${entity.download_finished ? 1 : 0}:${entity.airlocked ? 1 : 0}:${fileSig}:${entity.updated_at ?? ''}`;
}

export function viewIdsOrderUnchanged(
  prevIds: string[] | null | undefined,
  nextIds: string[] | null | undefined
): boolean {
  if (prevIds === nextIds) return true;
  if (!prevIds || !nextIds || prevIds.length !== nextIds.length) return false;
  for (let i = 0; i < nextIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }
  return true;
}

/**
 * Keys whose row data changed since last derivation pass.
 * @returns null means full rebuild (order/length change or cold start)
 */
export function collectDirtyRowKeys(
  viewIds: string[],
  entities: EntityMap,
  prevRowSigs: Map<string, string>,
  prevViewIds: string[] | null | undefined
): string[] | null {
  if (!viewIdsOrderUnchanged(prevViewIds, viewIds)) {
    return null;
  }

  const dirty: string[] = [];
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
