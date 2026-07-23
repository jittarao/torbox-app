import { useState, useRef, useEffect, useMemo, useSyncExternalStore, useCallback } from 'react';
import { VerticalEllipsis } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { createApiClient } from '@/utils/apiClient';
import TagAssignmentModal from './Tags/TagAssignmentModal';
import MoreOptionsMenuItems from './MoreOptionsMenuItems';
import MoreOptionsMenuPanel from './MoreOptionsMenuPanel';
import { useMoreOptionsActions } from './useMoreOptionsActions';

function computeMenuPosition(buttonEl) {
  const rect = buttonEl.getBoundingClientRect();
  const menuWidth = 192;
  const menuHeight = 200;

  const spaceOnRight = window.innerWidth - rect.right;
  const spaceOnLeft = rect.left;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  let left;
  if (spaceOnRight >= menuWidth) {
    left = rect.right;
  } else if (spaceOnLeft >= menuWidth) {
    left = rect.left - menuWidth;
  } else {
    left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.left));
  }

  let top;
  if (spaceBelow >= menuHeight) {
    top = rect.bottom;
  } else if (spaceAbove >= menuHeight) {
    top = rect.top - menuHeight;
  } else {
    top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, rect.bottom));
  }

  return { top, left };
}

export default function MoreOptionsDropdown({
  item,
  apiKey,
  setToast,
  activeType = 'torrents',
  showDownload = false,
  onDownload,
  showDelete = false,
  onDelete,
  isDeleting = false,
  showArchive = false,
  onArchive,
  isArchiving = false,
  showProtection = false,
  isProtected = false,
  onToggleProtection,
  isProtectionUpdating = false,
  showRetry = false,
  onRetry,
  isRetrying = false,
  showAirlock = false,
  airlocked = false,
  onToggleAirlock,
  isAirlockUpdating = false,
  compact = false,
  mobileBar = false,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showTagAssignment, setShowTagAssignment] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const t = useTranslations('MoreOptionsDropdown');
  const actionT = useTranslations('ItemActionButtons');
  const filtersT = useTranslations('DownloadsFilters');
  const apiClient = useMemo(() => createApiClient(apiKey), [apiKey]);

  const {
    isExporting,
    isReannouncing,
    handleCopyId,
    handleCopyHash,
    handleCopyShortMagnet,
    handleCopyFullMagnet,
    handleExportTorrent,
    handleCopySourceUrl,
    handleReannounce,
  } = useMoreOptionsActions({ item, apiKey, activeType, setToast, t, apiClient });

  useEffect(() => {
    if (!mobileBar || !isMenuOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mobileBar, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (mobileBar) return;

    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (isMenuOpen) setIsMenuOpen(false);
    };

    const handleScroll = () => {
      if (isMenuOpen) setIsMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isMenuOpen, mobileBar]);

  const toggleMenu = (e) => {
    e.stopPropagation();

    if (mobileBar) {
      setIsMenuOpen((open) => !open);
      return;
    }

    if (!isMenuOpen && buttonRef.current) {
      setMenuPosition(computeMenuPosition(buttonRef.current));
    }

    setIsMenuOpen((open) => !open);
  };

  const wrapClose = useCallback(
    (handler) => (e) => {
      handler(e);
    },
    []
  );

  const closeAndRun = useCallback(
    (fn) => (e) => {
      e?.stopPropagation?.();
      fn?.(e);
      setIsMenuOpen(false);
    },
    []
  );

  const menuItemsElement = (
    <MoreOptionsMenuItems
      menuVariant={mobileBar ? 'sheet' : 'dropdown'}
      activeType={activeType}
      t={t}
      actionT={actionT}
      isExporting={isExporting}
      isReannouncing={isReannouncing}
      isRetrying={isRetrying}
      isDeleting={isDeleting}
      showDownload={showDownload}
      showRetry={showRetry}
      showDelete={showDelete}
      showArchive={showArchive}
      showAirlock={showAirlock}
      showProtection={showProtection}
      isProtected={isProtected}
      airlocked={airlocked}
      onToggleProtection={onToggleProtection ? closeAndRun(onToggleProtection) : undefined}
      isProtectionUpdating={isProtectionUpdating}
      onArchive={onArchive ? closeAndRun(onArchive) : undefined}
      isArchiving={isArchiving}
      onToggleAirlock={onToggleAirlock ? closeAndRun(onToggleAirlock) : undefined}
      isAirlockUpdating={isAirlockUpdating}
      onDownload={onDownload ? closeAndRun(onDownload) : undefined}
      onDelete={onDelete ? closeAndRun(onDelete) : undefined}
      onCopyId={wrapClose(handleCopyId(setIsMenuOpen))}
      onCopyHash={wrapClose(handleCopyHash(setIsMenuOpen))}
      onCopyShortMagnet={wrapClose(handleCopyShortMagnet(setIsMenuOpen))}
      onCopyFullMagnet={wrapClose(handleCopyFullMagnet(setIsMenuOpen))}
      onReannounce={wrapClose(handleReannounce(setIsMenuOpen))}
      onRetry={onRetry ? closeAndRun(onRetry) : undefined}
      onExportTorrent={wrapClose(handleExportTorrent(setIsMenuOpen))}
      onCopySourceUrl={wrapClose(handleCopySourceUrl(setIsMenuOpen))}
    />
  );

  return (
    <div
      className={mobileBar ? 'ml-auto shrink-0' : 'relative'}
      ref={mobileBar ? undefined : menuRef}
    >
      <button
        type="button"
        ref={buttonRef}
        onClick={toggleMenu}
        className={
          mobileBar
            ? 'ui-header-icon-btn !h-11 !w-11 !min-w-11 shrink-0 touch-manipulation'
            : `${
                compact ? 'p-1 [&_svg]:size-4' : 'p-1.5'
              } rounded-full text-primary-text/70 dark:text-primary-text-dark/70 hover:bg-surface-alt dark:hover:bg-surface-alt-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors`
        }
        title={t('title')}
        aria-label={t('label')}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        <VerticalEllipsis className={mobileBar ? 'size-5' : undefined} />
      </button>

      <MoreOptionsMenuPanel
        isMenuOpen={isMenuOpen}
        isMounted={isMounted}
        mobileBar={mobileBar}
        menuRef={menuRef}
        menuPosition={menuPosition}
        title={t('title')}
        closeLabel={filtersT('close')}
        onClose={() => setIsMenuOpen(false)}
      >
        {menuItemsElement}
      </MoreOptionsMenuPanel>

      <TagAssignmentModal
        isOpen={showTagAssignment}
        onClose={() => setShowTagAssignment(false)}
        downloadIds={[String(item.id)]}
        apiKey={apiKey}
        onSuccess={() => {}}
      />
    </div>
  );
}
