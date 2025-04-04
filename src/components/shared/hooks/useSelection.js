import { useState, useEffect } from 'react';

const STORAGE_KEY = 'torboxSelectedItems';

export function useSelection(items) {
  const loadStoredSelections = (currentItems) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { items: new Set(), files: new Map() };

      const { items: storedItems, files: storedFiles } = JSON.parse(stored);

      // If no items available yet, just convert to Set/Map without validation
      if (!currentItems?.length) {
        return {
          items: new Set(storedItems),
          files: new Map(
            Object.entries(storedFiles).map(([key, value]) => [
              parseInt(key),
              new Set(value),
            ]),
          ),
        };
      }

      // Validate items and files separately
      const validItems = new Set(
        storedItems.filter((id) => currentItems.some((item) => item.id === id)),
      );

      const validFiles = new Map();
      Object.entries(storedFiles).forEach(([itemId, fileIds]) => {
        // Check if item exists in the current items (not just selected items)
        const numericItemId = parseInt(itemId);
        const item = currentItems.find((i) => i.id === numericItemId);

        // If item exists but files aren't loaded yet, keep all files
        if (item && (!item.files || !item.files.length)) {
          validFiles.set(numericItemId, new Set(fileIds));
          return;
        }

        if (!item) return;

        const validFileIds = new Set(
          fileIds.filter((fileId) => {
            const isValid = item.files?.some((file) => file.id === fileId);
            return isValid;
          }),
        );

        if (validFileIds.size > 0) {
          validFiles.set(numericItemId, validFileIds);
        }
      });

      const result = {
        items: validItems,
        files: validFiles,
      };
      return result;
    } catch (error) {
      console.error('Error loading selections from localStorage:', error);
      return { items: new Set(), files: new Map() };
    }
  };

  // Initial load without validation
  const [selectedItems, setSelectedItems] = useState(() =>
    loadStoredSelections(),
  );

  // Validate when items become available
  useEffect(() => {
    if (items?.length) {
      setSelectedItems(loadStoredSelections(items));
    }
  }, [items]);

  // Save to localStorage when selections change
  useEffect(() => {
    if (!selectedItems) return;

    try {
      const serialized = JSON.stringify({
        items: Array.from(selectedItems.items),
        files: Object.fromEntries(
          Array.from(selectedItems.files).map(([key, value]) => [
            key,
            Array.from(value),
          ]),
        ),
      });
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      console.error('Error saving selections to localStorage:', error);
    }
  }, [selectedItems]);

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
