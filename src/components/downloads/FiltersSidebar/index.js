'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useTags } from '@/components/shared/hooks/useTags';
import TagManager from '../Tags/TagManager';
import SidebarListItem from './SidebarListItem';
import { countActiveConditions, countDownloadsPerTag, filtersFromView } from '../filters/filterHelpers';

function SidebarSection({ title, children, emptyMessage, emptyAction }) {
  return (
    <div className="flex flex-col min-h-0">
      <h3 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-text/50 dark:text-primary-text-dark/50">
        {title}
      </h3>
      <div className="flex-1 overflow-y-auto space-y-0.5 px-1 pb-2 min-h-[60px] max-h-[200px]">
        {children}
        {emptyMessage && (
          <p className="px-2 py-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
            {emptyMessage}
          </p>
        )}
      </div>
      {emptyAction}
    </div>
  );
}

export default function FiltersSidebar({
  apiKey,
  views,
  activeView,
  tags,
  itemsWithTags,
  activeTagIds,
  onApplyView,
  onClearView,
  onApplyTag,
  onEditView,
  onRenameView,
  onRenameTag,
  onDeleteTag,
  onNewFilter,
  className = '',
}) {
  const t = useTranslations('DownloadsFilters');
  const { deleteView } = useCustomViews(apiKey);
  const { deleteTag } = useTags(apiKey);
  const [showTagManager, setShowTagManager] = useState(false);

  const tagCounts = useMemo(() => countDownloadsPerTag(itemsWithTags), [itemsWithTags]);

  const activeTagSet = useMemo(
    () => new Set((activeTagIds || []).map((id) => Number(id))),
    [activeTagIds]
  );

  const handleDeleteView = async (viewId, viewName) => {
    if (!window.confirm(t('confirmDeleteView', { name: viewName }))) return;
    try {
      await deleteView(viewId);
      if (activeView?.id === viewId) onClearView();
    } catch (error) {
      alert(t('deleteViewFailed', { error: error.message }));
    }
  };

  const handleDeleteTagItem = async (tagId, tagName) => {
    if (!window.confirm(t('confirmDeleteTag', { name: tagName }))) return;
    try {
      await deleteTag(tagId);
      onDeleteTag?.(tagId);
    } catch (error) {
      alert(t('deleteTagFailed', { error: error.message }));
    }
  };

  return (
    <aside
      className={`flex flex-col w-[var(--downloads-sidebar-width,14rem)] shrink-0 border border-border dark:border-border-dark rounded-lg bg-surface/50 dark:bg-surface-dark/50 overflow-hidden ${className}`}
      aria-label={t('sidebarLabel')}
    >
      <div className="flex-1 overflow-y-auto divide-y divide-border/60 dark:divide-border-dark/60">
        <SidebarSection
          title={t('viewsSection')}
          emptyMessage={views.length === 0 ? t('noViews') : null}
        >
          {views.map((view) => {
            const filterCount = view.filters?.groups
              ? view.filters.groups.reduce((sum, g) => sum + (g.filters?.length || 0), 0)
              : Array.isArray(view.filters)
                ? view.filters.length
                : countActiveConditions(view.filters);

            return (
              <SidebarListItem
                key={view.id}
                label={view.name}
                count={filterCount || undefined}
                isActive={activeView?.id === view.id}
                onClick={() => onApplyView(view)}
                menuItems={[
                  {
                    id: 'apply',
                    label: t('menuApply'),
                    onClick: () => onApplyView(view),
                  },
                  {
                    id: 'edit',
                    label: t('menuEdit'),
                    onClick: () => onEditView(view),
                  },
                  {
                    id: 'rename',
                    label: t('menuRename'),
                    onClick: () => onRenameView(view),
                  },
                  {
                    id: 'delete',
                    label: t('menuDelete'),
                    destructive: true,
                    onClick: () => handleDeleteView(view.id, view.name),
                  },
                ]}
              />
            );
          })}
        </SidebarSection>

        <SidebarSection
          title={t('tagsSection')}
          emptyMessage={tags.length === 0 ? t('noTags') : null}
        >
          {tags.map((tag) => (
            <SidebarListItem
              key={tag.id}
              label={tag.name}
              count={tagCounts[tag.id]}
              isActive={activeTagSet.has(Number(tag.id)) && !activeView}
              onClick={() => onApplyTag(tag.id)}
              menuItems={[
                {
                  id: 'apply',
                  label: t('menuApply'),
                  onClick: () => onApplyTag(tag.id),
                },
                {
                  id: 'rename',
                  label: t('menuRename'),
                  onClick: () => onRenameTag(tag),
                },
                {
                  id: 'delete',
                  label: t('menuDelete'),
                  destructive: true,
                  onClick: () => handleDeleteTagItem(tag.id, tag.name),
                },
              ]}
            />
          ))}
        </SidebarSection>
      </div>

      <div className="shrink-0 p-2 space-y-1.5 border-t border-border dark:border-border-dark bg-surface dark:bg-surface-dark">
        <button
          type="button"
          onClick={onNewFilter}
          className="w-full px-2 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 transition-opacity"
        >
          {t('newFilter')}
        </button>
        <button
          type="button"
          onClick={() => setShowTagManager(true)}
          className="w-full px-2 py-1.5 text-xs font-medium text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
        >
          {t('manageTags')}
        </button>
      </div>

      <TagManager isOpen={showTagManager} onClose={() => setShowTagManager(false)} apiKey={apiKey} />
    </aside>
  );
}

export { filtersFromView };
