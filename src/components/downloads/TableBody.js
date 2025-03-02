'use client';

import { Fragment, useState, useRef } from 'react';
import ItemRow from './ItemRow';
import FileRow from './FileRow';
import useIsMobile from '@/hooks/useIsMobile';

export default function TableBody({
  items,
  setItems,
  activeColumns,
  columnWidths,
  selectedItems,
  onRowSelect,
  onFileSelect,
  setSelectedItems,
  apiKey,
  onDelete,
  setToast,
  activeType = 'torrents',
  isBlurred = false,
}) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [hoveredItem, setHoveredItem] = useState(null);
  // Shared ref for tracking last clicked item row index
  const lastClickedItemIndexRef = useRef(null);
  const isMobile = useIsMobile();

  const toggleFiles = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  return (
    <tbody className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <ItemRow
            item={item}
            activeColumns={activeColumns}
            columnWidths={columnWidths}
            selectedItems={selectedItems}
            setItems={setItems}
            setSelectedItems={setSelectedItems}
            onRowSelect={onRowSelect}
            hoveredItem={hoveredItem}
            setHoveredItem={setHoveredItem}
            expandedItems={expandedItems}
            toggleFiles={toggleFiles}
            apiKey={apiKey}
            onDelete={onDelete}
            // props for shift+click functionality
            rowIndex={index}
            items={items}
            lastClickedItemIndexRef={lastClickedItemIndexRef}
            setToast={setToast}
            activeType={activeType}
            isMobile={isMobile}
            isBlurred={isBlurred}
          />
          {expandedItems.has(item.id) && item.files && (
            <FileRow
              item={item}
              selectedItems={selectedItems}
              onFileSelect={onFileSelect}
              apiKey={apiKey}
              activeColumns={activeColumns}
              activeType={activeType}
              isMobile={isMobile}
              isBlurred={isBlurred}
            />
          )}
        </Fragment>
      ))}
    </tbody>
  );
}
