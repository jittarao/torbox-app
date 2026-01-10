'use client';

import { useState, useEffect } from 'react';
import { useTags } from '@/components/shared/hooks/useTags';

/**
 * TagManager component - modal for managing tags (create, edit, delete)
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {string} props.apiKey - API key for authentication
 */
export default function TagManager({ isOpen, onClose, apiKey }) {
  const { tags, loading, createTag, updateTag, deleteTag, loadTags } = useTags(apiKey);

  // Load tags when modal opens
  useEffect(() => {
    if (isOpen && apiKey) {
      loadTags();
    }
  }, [isOpen, apiKey, loadTags]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleStartEdit = (tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (tagId) => {
    try {
      await updateTag(tagId, editName);
      setEditingId(null);
      setEditName('');
    } catch (error) {
      // Error is handled by useTags hook
    }
  };

  const handleDelete = async (tagId) => {
    if (window.confirm('Are you sure you want to delete this tag? It will be removed from all downloads.')) {
      try {
        await deleteTag(tagId);
      } catch (error) {
        // Error is handled by useTags hook
      }
    }
  };

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTag(newTagName.trim());
      setNewTagName('');
      setIsCreating(false);
    } catch (error) {
      // Error is handled by useTags hook
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
          bg-surface dark:bg-surface-dark
          border border-border dark:border-border-dark
          rounded-lg shadow-xl
          w-[calc(100vw-2rem)] sm:w-full max-w-md max-h-[80vh]
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
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Create new tag */}
          <div className="mb-4">
            {!isCreating ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full px-3 py-2 text-sm font-medium rounded-md
                  border border-border dark:border-border-dark
                  text-primary-text dark:text-primary-text-dark
                  hover:bg-surface-alt dark:hover:bg-surface-alt-dark
                  transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Tag
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    } else if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewTagName('');
                    }
                  }}
                  placeholder="Tag name..."
                  className="flex-1 px-3 py-2 text-sm rounded border border-border dark:border-border-dark
                    bg-surface dark:bg-surface-dark
                    text-primary-text dark:text-primary-text-dark
                    focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!newTagName.trim() || loading}
                  className="px-3 py-2 text-sm font-medium rounded bg-accent dark:bg-accent-dark
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
                  className="px-3 py-2 text-sm rounded border border-border dark:border-border-dark
                    text-primary-text dark:text-primary-text-dark
                    hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Tags list */}
          {loading && tags.length === 0 ? (
            <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
              Loading tags...
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
              No tags yet. Create your first tag above.
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded border border-border dark:border-border-dark
                    hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
                >
                  {editingId === tag.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(tag.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm rounded border border-border dark:border-border-dark
                          bg-surface dark:bg-surface-dark
                          text-primary-text dark:text-primary-text-dark
                          focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(tag.id)}
                        disabled={loading || !editName.trim()}
                        className="px-2 py-1 text-xs font-medium rounded bg-accent dark:bg-accent-dark
                          text-white hover:bg-accent/90 dark:hover:bg-accent-dark/90
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-2 py-1 text-xs rounded border border-border dark:border-border-dark
                          text-primary-text dark:text-primary-text-dark
                          hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-primary-text dark:text-primary-text-dark">
                        {tag.name}
                      </span>
                      {tag.usage_count !== undefined && (
                        <span className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                          {tag.usage_count} {tag.usage_count === 1 ? 'download' : 'downloads'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tag)}
                        className="p-1 rounded hover:bg-surface-alt dark:hover:bg-surface-alt-dark
                          text-primary-text dark:text-primary-text-dark
                          transition-colors"
                        title="Edit tag"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tag.id)}
                        className="p-1 rounded hover:bg-red-500/10 dark:hover:bg-red-500/20
                          text-red-500 dark:text-red-400
                          transition-colors"
                        title="Delete tag"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border dark:border-border-dark">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium rounded-md
              bg-accent dark:bg-accent-dark
              text-white hover:bg-accent/90 dark:hover:bg-accent-dark/90
              transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
