import {
  Archive,
  Copy,
  Delete,
  Download,
  FileDown,
  Lock,
  Refresh,
  Shield,
  Unlock,
} from '@/components/icons';
import Spinner from '@/components/shared/Spinner';

function menuButtonClass(menuVariant, tone = 'neutral') {
  if (menuVariant === 'sheet') {
    if (tone === 'accent') {
      return 'ui-mobile-more-link text-accent dark:text-accent-dark disabled:opacity-50';
    }
    if (tone === 'danger') {
      return 'ui-mobile-more-link text-red-600 dark:text-red-400 disabled:opacity-50';
    }
    return 'ui-mobile-more-link disabled:opacity-50';
  }
  if (tone === 'accent') {
    return 'flex items-center w-full px-4 py-2 text-sm text-left text-accent dark:text-accent-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark';
  }
  if (tone === 'danger') {
    return 'flex items-center w-full px-4 py-2 text-sm text-left text-red-500 dark:text-red-400 hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50';
  }
  return 'flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50';
}

function menuDividerClass(menuVariant) {
  return menuVariant === 'sheet'
    ? 'my-2 mx-3 border-t border-border/50 dark:border-border-dark/50'
    : 'my-1 border-t border-border dark:border-border-dark';
}

function MenuItemButton({ menuVariant, tone, onClick, disabled, icon, children }) {
  const labelClass = menuVariant === 'sheet' ? 'min-w-0 flex-1 text-left' : 'ml-2';
  const iconWrapClass =
    menuVariant === 'sheet'
      ? 'flex size-5 shrink-0 items-center justify-center [&_svg]:size-5'
      : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={menuButtonClass(menuVariant, tone)}
    >
      {menuVariant === 'sheet' ? <span className={iconWrapClass}>{icon}</span> : icon}
      <span className={labelClass}>{children}</span>
    </button>
  );
}

export default function MoreOptionsMenuItems({
  menuVariant = 'dropdown',
  activeType,
  t,
  actionT,
  actionProgress,
  actionVisibility,
  itemFlags,
  onDownload,
  onDelete,
  onArchive,
  onToggleProtection,
  onToggleAirlock,
  onCopyId,
  onCopyHash,
  onCopyShortMagnet,
  onCopyFullMagnet,
  onReannounce,
  onRetry,
  onExportTorrent,
  onCopySourceUrl,
}) {
  const {
    exporting: isExporting,
    reannouncing: isReannouncing,
    retrying: isRetrying,
    deleting: isDeleting,
    archiving: isArchiving,
    protectionUpdating: isProtectionUpdating,
    airlockUpdating: isAirlockUpdating,
  } = actionProgress;
  const {
    download: showDownload,
    retry: showRetry,
    delete: showDelete,
    archive: showArchive,
    airlock: showAirlock,
    protection: showProtection,
  } = actionVisibility;
  const { protected: isProtected, airlocked } = itemFlags;

  const items = [];

  if (showRetry && onRetry) {
    items.push(
      <MenuItemButton
        key="retry"
        menuVariant={menuVariant}
        tone="accent"
        onClick={onRetry}
        disabled={isRetrying}
        icon={isRetrying ? <Spinner size="xs" /> : <Refresh />}
      >
        {actionT('retry.label')}
      </MenuItemButton>
    );
  }

  if (showDownload && onDownload) {
    items.push(
      <MenuItemButton
        key="download"
        menuVariant={menuVariant}
        tone="accent"
        onClick={onDownload}
        icon={<Download />}
      >
        {actionT('download.label')}
      </MenuItemButton>
    );
  }

  if (showProtection && onToggleProtection) {
    items.push(
      <MenuItemButton
        key="protection"
        menuVariant={menuVariant}
        tone="accent"
        onClick={onToggleProtection}
        disabled={isProtectionUpdating}
        icon={isProtectionUpdating ? <Spinner size="xs" /> : <Shield />}
      >
        {isProtected ? t('unprotectDownload') : t('protectDownload')}
      </MenuItemButton>
    );
  }

  if (showDelete && onDelete) {
    items.push(
      <MenuItemButton
        key="delete"
        menuVariant={menuVariant}
        tone="danger"
        onClick={onDelete}
        disabled={isDeleting || isProtected}
        icon={isDeleting ? <Spinner size="xs" /> : <Delete />}
      >
        {actionT('delete.label')}
      </MenuItemButton>
    );
  }

  if (showArchive && onArchive) {
    items.push(
      <MenuItemButton
        key="archive"
        menuVariant={menuVariant}
        onClick={onArchive}
        disabled={isArchiving || isProtected}
        icon={isArchiving ? <Spinner size="xs" /> : <Archive />}
      >
        {t('archive')}
      </MenuItemButton>
    );
  }

  if (showAirlock && onToggleAirlock) {
    items.push(
      <MenuItemButton
        key="airlock"
        menuVariant={menuVariant}
        onClick={onToggleAirlock}
        disabled={isAirlockUpdating}
        icon={isAirlockUpdating ? <Spinner size="xs" /> : airlocked ? <Unlock /> : <Lock />}
      >
        {airlocked ? t('unlockDownload') : t('lockDownload')}
      </MenuItemButton>
    );
  }

  if (items.length > 0) {
    items.push(
      <div key="primary-divider" className={menuDividerClass(menuVariant)} role="separator" />
    );
  }

  items.push(
    <MenuItemButton key="copy-id" menuVariant={menuVariant} onClick={onCopyId} icon={<Copy />}>
      {t('copyId')}
    </MenuItemButton>
  );

  items.push(
    <MenuItemButton key="copy-hash" menuVariant={menuVariant} onClick={onCopyHash} icon={<Copy />}>
      {t('copyHash')}
    </MenuItemButton>
  );

  if (activeType === 'torrents') {
    items.push(
      <MenuItemButton
        key="copy-short-magnet"
        menuVariant={menuVariant}
        onClick={onCopyShortMagnet}
        icon={<Copy />}
      >
        {t('copyShortMagnet')}
      </MenuItemButton>
    );

    items.push(
      <MenuItemButton
        key="copy-full-magnet"
        menuVariant={menuVariant}
        onClick={onCopyFullMagnet}
        disabled={isExporting}
        icon={isExporting ? <Spinner size="xs" /> : <Copy />}
      >
        {t('copyFullMagnet')}
      </MenuItemButton>
    );

    items.push(
      <MenuItemButton
        key="reannounce"
        menuVariant={menuVariant}
        onClick={onReannounce}
        disabled={isReannouncing}
        icon={isReannouncing ? <Spinner size="xs" /> : <Refresh />}
      >
        {t('reannounce')}
      </MenuItemButton>
    );

    items.push(
      <MenuItemButton
        key="export-torrent"
        menuVariant={menuVariant}
        onClick={onExportTorrent}
        disabled={isExporting}
        icon={isExporting ? <Spinner size="xs" /> : <FileDown />}
      >
        {t('exportTorrent')}
      </MenuItemButton>
    );
  }

  if (activeType === 'webdl') {
    items.push(
      <MenuItemButton
        key="copy-source-url"
        menuVariant={menuVariant}
        onClick={onCopySourceUrl}
        icon={<Copy />}
      >
        {t('copySourceUrl')}
      </MenuItemButton>
    );
  }

  if (menuVariant === 'sheet') {
    return (
      <ul className="w-full space-y-0.5 px-2 py-1">
        {items.map((node) => (
          <li key={node.key} className="w-full">
            {node}
          </li>
        ))}
      </ul>
    );
  }

  return items;
}
