import { useState } from 'react';

export function useSelection() {
  const [selectedItems, setSelectedItems] = useState({ 
    torrents: new Set(), 
    files: new Map() 
  });

  const hasSelectedFiles = () => {
    return Array.from(selectedItems.files.values()).some(files => files.size > 0);
  };

  const hasSelectedFilesForTorrent = (torrentId, selectedFiles) => {
    return selectedFiles.has(torrentId) && selectedFiles.get(torrentId).size > 0;
  };

  const handleSelectAll = (torrents, checked) => {
    setSelectedItems(prev => ({
      torrents: checked ? new Set(torrents.map(t => t.id)) : new Set(),
      files: new Map()
    }));
  };

  const handleFileSelect = (torrentId, fileId, checked) => {
    setSelectedItems(prev => {
      const newFiles = new Map(prev.files);
      if (!newFiles.has(torrentId)) {
        newFiles.set(torrentId, new Set());
      }
      
      if (checked) {
        newFiles.get(torrentId).add(fileId);
      } else {
        newFiles.get(torrentId).delete(fileId);
        if (newFiles.get(torrentId).size === 0) {
          newFiles.delete(torrentId);
        }
      }

      return {
        torrents: prev.torrents,
        files: newFiles
      };
    });
  };

  return {
    selectedItems,
    setSelectedItems,
    hasSelectedFiles,
    hasSelectedFilesForTorrent,
    handleSelectAll,
    handleFileSelect
  };
} 