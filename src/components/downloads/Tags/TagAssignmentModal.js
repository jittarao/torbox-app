'use client';

import { useState, useEffect, useMemo } from 'react';
import TagSelector from './TagSelector';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';

/**
 * TagAssignmentModal - Modal for assigning or removing tags from downloads
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Array} props.downloadIds - Array of download IDs to assign tags to
 * @param {string} props.apiKey - API key for authentication
 * @param {Function} props.onSuccess - Callback when tags are assigned successfully
 */
export default function TagAssignmentModal({
  isOpen,
  onClose,
  downloadIds = [],
  apiKey,
  onSuccess,
}) {
  const { assignTags, getDownloadTags, fetchDownloadTags } = useDownloadTags(apiKey);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [mode, setMode] = useState('add'); // 'add' or 'remove'

  // Get existing tags for all downloads
  const existingTagIds = useMemo(() => {
    if (!isOpen || downloadIds.length === 0) return new Set();

    const allTagIds = new Set();
    downloadIds.forEach((downloadId) => {
      const tags = getDownloadTags(downloadId);
      tags.forEach((tag) => allTagIds.add(tag.id));
    });
    return allTagIds;
  }, [isOpen, downloadIds, getDownloadTags]);

  // Reset selection and mode when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedTagIds([]);
      setMode('add');
      // Fetch latest tags when modal opens
      fetchDownloadTags();
    } else {
      setSelectedTagIds([]);
      setMode('add');
    }
  }, [isOpen, fetchDownloadTags]);

  const handleSubmit = async () => {
    if (!downloadIds.length || !selectedTagIds.length) return;

    setIsAssigning(true);
    try {
      await assignTags(downloadIds, selectedTagIds, mode);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error(`Error ${mode === 'add' ? 'assigning' : 'removing'} tags:`, error);
      // Error is handled by useDownloadTags hook
    } finally {
      setIsAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
          bg-surface dark:bg-surface-dark
          border border-border dark:border-border-dark
          rounded-lg shadow-xl
          w-[calc(100vw-2rem)] sm:w-full max-w-md
          overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
          <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
            Manage Tags
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-alt dark:hover:bg-surface-alt-dark
              text-primary-text dark:text-primary-text-dark
              transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 border-b border-border dark:border-border-dark">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('add');
                setSelectedTagIds([]);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'add'
                  ? 'bg-accent dark:bg-accent-dark text-white'
                  : 'bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark hover:bg-surface-alt/80 dark:hover:bg-surface-alt-dark/80'
              }`}
            >
              Add Tags
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('remove');
                setSelectedTagIds([]);
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'remove'
                  ? 'bg-accent dark:bg-accent-dark text-white'
                  : 'bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark hover:bg-surface-alt/80 dark:hover:bg-surface-alt-dark/80'
              }`}
            >
              Remove Tags
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 mb-4">
            {mode === 'add'
              ? downloadIds.length === 1
                ? 'Select tags to add to this download (existing tags will be kept):'
                : `Select tags to add to ${downloadIds.length} downloads (existing tags will be kept):`
              : downloadIds.length === 1
                ? 'Select tags to remove from this download:'
                : `Select tags to remove from ${downloadIds.length} downloads:`}
          </p>

          {mode === 'remove' && existingTagIds.size === 0 && (
            <p className="text-sm text-warning dark:text-warning-dark mb-4">
              No tags are currently assigned to the selected{' '}
              {downloadIds.length === 1 ? 'download' : 'downloads'}.
            </p>
          )}

          <TagSelector
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            apiKey={apiKey}
            allowCreate={mode === 'add'}
          />

          {mode === 'remove' && existingTagIds.size > 0 && (
            <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60 mt-2">
              Note: Only tags that are assigned to all selected downloads can be removed.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border dark:border-border-dark flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-md
              border border-border dark:border-border-dark
              text-primary-text dark:text-primary-text-dark
              hover:bg-surface-alt dark:hover:bg-surface-alt-dark
              transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isAssigning || selectedTagIds.length === 0}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-md
              bg-accent dark:bg-accent-dark
              text-white hover:bg-accent/90 dark:hover:bg-accent-dark/90
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {isAssigning
              ? mode === 'add'
                ? 'Adding...'
                : 'Removing...'
              : mode === 'add'
                ? 'Add Tags'
                : 'Remove Tags'}
          </button>
        </div>
      </div>
    </>
  );
}
