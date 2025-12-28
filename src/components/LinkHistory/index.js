'use client';

import { timeAgo } from '@/components/downloads/utils/formatters';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import useIsMobile from '@/hooks/useIsMobile';

const LinkHistory = ({ history, onDelete }) => {
  const t = useTranslations('Common');
  const linkHistoryT = useTranslations('LinkHistory');
  const isMobile = useIsMobile();

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getExpirationDate = (generatedAt) => {
    const expirationDate = new Date(
      new Date(generatedAt).getTime() + 4 * 60 * 60 * 1000,
    );
    if (expirationDate < new Date()) {
      return linkHistoryT('expired');
    }
    return timeAgo(expirationDate, t);
  };

  return (
    <>
      <h1 className="text-md lg:text-xl mb-4 font-medium text-primary-text dark:text-primary-text-dark">
        {linkHistoryT('title')}
      </h1>
      {history.length === 0 ? (
        <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-8 md:p-12">
          <div className="text-center">
            <Icons.History className="w-16 h-16 mx-auto mb-4 text-primary-text/40 dark:text-primary-text-dark/40" />
            <h2 className="text-lg font-medium text-primary-text dark:text-primary-text-dark mb-2">
              {linkHistoryT('emptyState.title')}
            </h2>
            <p className="text-md text-primary-text/70 dark:text-primary-text-dark/70 max-w-xl mx-auto mb-4">
              {linkHistoryT('emptyState.description')}
            </p>
            <div className="mt-6 p-4 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark">
              <p className="text-md text-primary-text/60 dark:text-primary-text-dark/60 mb-2">
                <strong className="text-primary-text dark:text-primary-text-dark">
                  {linkHistoryT('emptyState.important')}
                </strong>
              </p>
              <ul className="text-sm text-primary-text/60 dark:text-primary-text-dark/60 text-left space-y-1 max-w-md mx-auto">
                <li>• {linkHistoryT('emptyState.step1')}</li>
                <li>• {linkHistoryT('emptyState.step2')}</li>
                <li>• {linkHistoryT('emptyState.step3')}</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border dark:border-border-dark">
          <table className="min-w-full table-fixed divide-y divide-border dark:divide-border-dark relative">
            <thead className="bg-surface-alt dark:bg-surface-alt-dark">
              <tr className="table-rowbg-surface-alt dark:bg-surface-alt-dark">
                <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors w-[120px] min-w-[120px] max-w-[150px]">
                  {linkHistoryT('columns.itemId')}
                </th>
                <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors">
                  {linkHistoryT('columns.itemName')}
                </th>
                <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors">
                  {linkHistoryT('columns.fileName')}
                </th>
                <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors w-[200px] min-w-[200px] max-w-[200px]">
                  {linkHistoryT('columns.expiresAt')}
                </th>
                <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase sticky right-0 bg-surface-alt dark:bg-surface-alt-dark w-[100px] min-w-[100px] max-w-[150px]">
                  {linkHistoryT('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark">
              {history.map((item, index) => {
                const metadata = item.metadata;
                return (
                  <tr
                    key={index}
                    className="bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark"
                  >
                    <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                      {metadata.item.id}
                    </td>
                    <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
                      {metadata.item.name}
                    </td>
                    <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
                      {metadata.item.files?.find(
                        (file) => file.id === item.fileId,
                      )?.short_name || '-'}
                    </td>
                    <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                      {getExpirationDate(item.generatedAt)}
                    </td>
                    <td
                      className={`px-3 md:px-4 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-inherit dark:bg-inherit flex ${isMobile ? 'flex-col' : 'flex-row'} items-center justify-end gap-2`}
                    >
                      <button
                        onClick={() => copyToClipboard(item.url)}
                        className={`p-1.5 rounded-full text-accent dark:text-accent-dark 
                          hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
                          ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
                        title={linkHistoryT('actions.copy')}
                      >
                        {isMobile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Icons.Copy /> {linkHistoryT('actions.copy')}
                          </div>
                        ) : (
                          <Icons.Copy />
                        )}
                      </button>
                      <button
                        onClick={() => window.open(item.url, '_blank')}
                        className={`p-1.5 rounded-full text-accent dark:text-accent-dark 
                          hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
                          ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
                        title={linkHistoryT('actions.download')}
                      >
                        {isMobile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Icons.Download /> {linkHistoryT('actions.download')}
                          </div>
                        ) : (
                          <Icons.Download />
                        )}
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className={`p-1.5 rounded-full text-red-500 dark:text-red-400 
                          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200
                          disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
                        title={linkHistoryT('actions.remove')}
                      >
                        {isMobile ? (
                          <div className="flex items-center justify-center gap-2">
                            <Icons.Times /> {linkHistoryT('actions.remove')}
                          </div>
                        ) : (
                          <Icons.Times />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default LinkHistory;
