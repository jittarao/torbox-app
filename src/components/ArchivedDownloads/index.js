'use client';

import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { useArchive } from '@/hooks/useArchive';
import { timeAgo } from '@/components/downloads/utils/formatters';
import useIsMobile from '@/hooks/useIsMobile';

export default function ArchivedDownloads({ apiKey }) {
  const t = useTranslations('Common');
  const archivedT = useTranslations('ArchivedDownloads');
  const isMobile = useIsMobile();
  const { getArchivedDownloads, removeFromArchive, restoreFromArchive } =
    useArchive(apiKey);
  const archivedItems = getArchivedDownloads();

  const handleRemove = (id) => {
    removeFromArchive(id);
  };

  const handleRestore = (download) => {
    restoreFromArchive(download);
  };

  const handleCopyMagnet = async (download) => {
    const encodedName = encodeURIComponent(download.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${download.hash}&dn=${encodedName}`;
    await navigator.clipboard.writeText(magnetLink);
    setToast({
      message: t('toast.magnetCopied'),
      type: 'success',
    });
  };

  return (
    <>
      <h1 className="text-md lg:text-xl mb-4 font-medium text-primary-text dark:text-primary-text-dark">
        {archivedT('title')}
      </h1>
      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border dark:border-border-dark">
        <table className="min-w-full table-fixed divide-y divide-border dark:divide-border-dark relative">
          <thead className="bg-surface-alt dark:bg-surface-alt-dark">
            <tr className="table-rowbg-surface-alt dark:bg-surface-alt-dark">
              <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors w-[120px] min-w-[120px] max-w-[150px]">
                {archivedT('columns.itemId')}
              </th>
              <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors">
                {archivedT('columns.itemName')}
              </th>
              <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors w-[200px] min-w-[200px] max-w-[200px]">
                {archivedT('columns.archivedAt')}
              </th>
              <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase sticky right-0 bg-surface-alt dark:bg-surface-alt-dark w-[100px] min-w-[100px] max-w-[150px]">
                {archivedT('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark">
            {archivedItems.map((item) => (
              <tr
                key={item.id}
                className="bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark"
              >
                <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                  {item.id}
                </td>
                <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
                  {item.name}
                </td>
                <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                  {timeAgo(item.archivedAt, t)}
                </td>
                <td
                  className={`px-3 md:px-4 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-inherit dark:bg-inherit flex ${isMobile ? 'flex-col' : 'flex-row'} items-center justify-end gap-2`}
                >
                  {/* Add to TorBox Button */}
                  <button
                    onClick={() => handleRestore(item)}
                    className={`p-1.5 rounded-full text-green-500 dark:text-green-400 
                      hover:bg-green-500/5 dark:hover:bg-green-400/5 transition-all duration-200
                      disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
                    title={archivedT('actions.add_to_torbox')}
                  >
                    {isMobile ? (
                      <div className="flex items-center justify-center gap-2">
                        <Icons.Restore /> {archivedT('actions.add_to_torbox')}
                      </div>
                    ) : (
                      <Icons.Restore />
                    )}
                  </button>

                  {/* Copy Magnet Button */}
                  <button
                    onClick={() => handleCopyMagnet(item)}
                    className={`p-1.5 rounded-full text-blue-500 dark:text-blue-400 
                      hover:bg-blue-500/5 dark:hover:bg-blue-400/5 transition-all duration-200
                      disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
                    title={archivedT('actions.copyMagnet')}
                  >
                    {isMobile ? (
                      <div className="flex items-center justify-center gap-2">
                        <Icons.Copy /> {archivedT('actions.copyMagnet')}
                      </div>
                    ) : (
                      <Icons.Copy className="w-4 h-4" />
                    )}
                  </button>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className={`p-1.5 rounded-full text-red-500 dark:text-red-400 
                      hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200
                      disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
                    title={archivedT('actions.remove')}
                  >
                    {isMobile ? (
                      <div className="flex items-center justify-center gap-2">
                        <Icons.Times /> {archivedT('actions.remove')}
                      </div>
                    ) : (
                      <Icons.Times />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
