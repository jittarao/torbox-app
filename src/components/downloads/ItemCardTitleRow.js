'use client';

import Tooltip from '@/components/shared/Tooltip';
import Private from '@/components/icons/Private';
import Lock from '@/components/icons/Lock';
import Shield from '@/components/icons/Shield';

export default function ItemCardTitleRow({
  item,
  display,
  selection,
  badges,
  commonT,
  selectionId,
  index,
  onItemSelection,
}) {
  const { blurred: isBlurred, mobile: isMobile } = display;
  const { selected: isSelected, hasFiles: hasSelectedFiles } = selection;
  const { airlocked: isAirlocked, protected: isProtected } = badges;

  return (
    <div className={isMobile ? 'flex items-start gap-2' : 'flex items-center gap-2 md:gap-2.5'}>
      <input
        type="checkbox"
        checked={isSelected}
        aria-label={commonT('selectRow', { name: item.name || item.id })}
        onChange={(e) => onItemSelection(selectionId, e.target.checked, index, e.shiftKey)}
        onClick={(e) => e.stopPropagation()}
        disabled={hasSelectedFiles}
        className="accent-accent dark:accent-accent-dark flex-shrink-0 mt-0.5 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
      />
      <h3
        className={`text-sm md:text-base lg:text-[18px] font-medium text-primary-text dark:text-primary-text-dark flex-1 min-w-0 ${
          isBlurred ? 'blur-[6px] select-none' : ''
        }`}
      >
        <div
          className={
            isMobile
              ? 'grid w-full min-w-0 grid-cols-[auto_1fr] items-start gap-x-2'
              : 'flex items-center gap-2'
          }
        >
          <div className={`flex shrink-0 gap-2 ${isMobile ? 'items-start' : 'items-center'}`}>
            <Tooltip content={item.cached ? 'Cached' : 'Not cached'}>
              <span
                className={`inline-block size-2 rounded-full shrink-0 mt-1.5 ${
                  item.cached
                    ? 'bg-label-success-text-dark dark:bg-label-success-text-dark'
                    : 'bg-label-danger-text-dark dark:bg-label-danger-text-dark'
                }`}
              ></span>
            </Tooltip>
            {item.private && (
              <Tooltip content="Private Tracker">
                <Private className="size-4 shrink-0 text-accent dark:text-accent-dark mt-0.5" />
              </Tooltip>
            )}
            {isAirlocked && (
              <Tooltip content={commonT('airlocked')}>
                <Lock className="size-4 shrink-0 text-accent dark:text-accent-dark mt-0.5" />
              </Tooltip>
            )}
            {isProtected && (
              <Tooltip content={commonT('protected')}>
                <Shield className="size-4 shrink-0 text-accent dark:text-accent-dark mt-0.5" />
              </Tooltip>
            )}
          </div>
          {item.name && (
            <div className="min-w-0">
              <Tooltip content={!isBlurred ? item.name : ''}>
                <span
                  className={
                    isMobile
                      ? 'inline-block max-w-full min-w-0 break-words'
                      : 'inline-block max-w-full min-w-0 truncate'
                  }
                >
                  {item.name || 'Unnamed Item'}
                </span>
              </Tooltip>
            </div>
          )}
        </div>
      </h3>
    </div>
  );
}
