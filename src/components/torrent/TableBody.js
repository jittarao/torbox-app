'use client';

import { Fragment, useState, useRef, useEffect } from 'react';
import ItemRow from './ItemRow';
import FileRow from './FileRow';

export default function TableBody({
  items,
  setItems,
  activeColumns,
  selectedItems,
  onRowSelect,
  onFileSelect,
  setSelectedItems,
  apiKey,
  onDelete,
  setToast,
  activeType = 'torrents',
}) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [hoveredItem, setHoveredItem] = useState(null);
  // Shared ref for tracking last clicked item row index
  const lastClickedItemIndexRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on a mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const toggleFiles = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <tbody className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <ItemRow
            item={item}
            activeColumns={activeColumns}
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
            // Pass new props for shift+click functionality
            rowIndex={index}
            items={items}
            lastClickedItemIndexRef={lastClickedItemIndexRef}
            setToast={setToast}
            activeType={activeType}
            isMobile={isMobile}
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
            />
          )}
        </Fragment>
      ))}
    </tbody>
  );
}
