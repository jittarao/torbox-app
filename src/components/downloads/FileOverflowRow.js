'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { tableRowSeparator } from './utils/responsiveLayout';

function FileOverflowRow({ item, overflowCount, activeColumns, tableWidth }) {
  const t = useTranslations('TableBody');
  const uncapFilesForItem = useDownloadsUiStore((s) => s.uncapFilesForItem);
  const selectionId = getDownloadSelectionId(item);

  return (
    <tr className="bg-surface-alt/50 dark:bg-surface-alt-dark/50">
      <td colSpan={2} className="py-2 pl-3 md:pl-4 lg:pl-6" />
      <td
        colSpan={activeColumns.length}
        className={`py-2 pl-3 md:pl-4 lg:pl-6 ${tableRowSeparator}`}
      >
        <button
          type="button"
          className="text-sm text-accent dark:text-accent-dark hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            uncapFilesForItem(item.id);
          }}
          aria-controls={`files-${selectionId}`}
        >
          {t('showMoreFiles', { count: overflowCount })}
        </button>
      </td>
    </tr>
  );
}

export default memo(FileOverflowRow);
