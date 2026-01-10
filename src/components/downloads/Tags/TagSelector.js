'use client';

import { useState } from 'react';
import MultiSelect from '@/components/shared/MultiSelect';
import { useTags } from '@/components/shared/hooks/useTags';

/**
 * TagSelector component - multi-select dropdown for assigning tags
 * @param {Object} props
 * @param {Array} props.value - Array of selected tag IDs
 * @param {Function} props.onChange - Callback when selection changes (receives array of tag IDs)
 * @param {string} props.apiKey - API key for authentication
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Whether select is disabled
 * @param {boolean} props.allowCreate - Whether to allow creating new tags inline
 */
export default function TagSelector({
  value = [],
  onChange,
  apiKey,
  className = '',
  disabled = false,
  allowCreate = false,
}) {
  const { tags, loading, createTag } = useTags(apiKey);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const tagOptions = tags.map(tag => ({
    label: tag.name,
    value: tag.id,
  }));

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = await createTag(newTagName.trim());
      setNewTagName('');
      setIsCreating(false);
      // Add the new tag to selection
      onChange([...value, newTag.id]);
    } catch (error) {
      console.error('Failed to create tag:', error);
      // Error is handled by useTags hook
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateTag();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewTagName('');
    }
  };

  return (
    <div className={className}>
      <MultiSelect
        value={value}
        onChange={onChange}
        options={tagOptions}
        placeholder="Select tags..."
        disabled={disabled || loading}
        className="w-full"
      />
      
      {allowCreate && !disabled && (
        <div className="mt-2">
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="text-xs text-accent dark:text-accent-dark hover:underline"
            >
              + Create new tag
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tag name..."
                className="flex-1 px-2 py-1 text-xs rounded border border-border dark:border-border-dark
                  bg-surface dark:bg-surface-dark
                  text-primary-text dark:text-primary-text-dark
                  focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreating}
                className="px-2 py-1 text-xs font-medium rounded bg-accent dark:bg-accent-dark
                  text-white hover:bg-accent/90 dark:hover:bg-accent-dark/90
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTagName('');
                }}
                className="px-2 py-1 text-xs rounded border border-border dark:border-border-dark
                  text-primary-text dark:text-primary-text-dark
                  hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
