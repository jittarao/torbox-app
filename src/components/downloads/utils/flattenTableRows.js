import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { MAX_INLINE_FILE_ROWS } from './tableConstants';

/**
 * @param {object[]} deferredItems
 * @param {Set<string|number>} expandedSet
 * @param {Record<string|number, true>} uncappedFileExpandById
 * @param {(item: object, fileSearch: string) => object[]} getVisibleFiles
 * @param {string} fileSearch
 */
export function buildFlattenedTableRows(
  deferredItems,
  expandedSet,
  uncappedFileExpandById,
  getVisibleFiles,
  fileSearch
) {
  const rows = [];

  deferredItems.forEach((item, itemIndex) => {
    rows.push({
      type: 'item',
      item,
      entityKey: getDownloadSelectionId(item),
      itemIndex,
      virtualIndex: rows.length,
    });

    const visibleFiles = getVisibleFiles(item, fileSearch);
    if (!expandedSet.has(item.id) || visibleFiles.length === 0) {
      return;
    }

    const uncapped = uncappedFileExpandById[item.id];
    const limit = uncapped ? visibleFiles.length : MAX_INLINE_FILE_ROWS;
    const inlineFiles = visibleFiles.slice(0, limit);

    inlineFiles.forEach((file, fileIndex) => {
      rows.push({
        type: 'file',
        item,
        file,
        itemIndex,
        fileIndex,
        virtualIndex: rows.length,
      });
    });

    const overflowCount = visibleFiles.length - inlineFiles.length;
    if (overflowCount > 0) {
      rows.push({
        type: 'fileOverflow',
        item,
        itemIndex,
        overflowCount,
        virtualIndex: rows.length,
      });
    }
  });

  return rows;
}
