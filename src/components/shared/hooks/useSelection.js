import { useState } from 'react';

export function useSelection() {
  const [selectedItems, setSelectedItems] = useState({
    items: new Set(),
    files: new Map(),
  });

  const hasSelectedFiles = () => {
    return Array.from(selectedItems.files.values()).some(
      (files) => files.size > 0,
    );
  };

  const handleRowSelect = (itemId, selectedFiles) => {
    return selectedFiles.has(itemId) && selectedFiles.get(itemId).size > 0;
  };

  const handleSelectAll = (items, checked) => {
    setSelectedItems((prev) => ({
      items: checked ? new Set(items.map((t) => t.id)) : new Set(),
      files: new Map(),
    }));
  };

  const handleFileSelect = (itemId, fileId, checked) => {
    setSelectedItems((prev) => {
      const newFiles = new Map(prev.files);
      if (!newFiles.has(itemId)) {
        newFiles.set(itemId, new Set());
      }

      if (checked) {
        newFiles.get(itemId).add(fileId);
      } else {
        newFiles.get(itemId).delete(fileId);
        if (newFiles.get(itemId).size === 0) {
          newFiles.delete(itemId);
        }
      }

      return {
        items: prev.items,
        files: newFiles,
      };
    });
  };

  return {
    selectedItems,
    setSelectedItems,
    hasSelectedFiles,
    handleRowSelect,
    handleFileSelect,
    handleSelectAll,
  };
}
