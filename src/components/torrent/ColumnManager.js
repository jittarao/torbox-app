'use client';
import { useState, useRef, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

function SortableItem({ id, label }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 bg-surface-alt dark:bg-surface-alt-dark rounded 
        flex items-center justify-between cursor-move group"
    >
      <span className="text-sm text-primary-text dark:text-primary-text-dark">
        {label}
      </span>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-4 w-4 text-primary-text/30 dark:text-primary-text-dark/30
          group-hover:text-primary-text/70 dark:group-hover:text-primary-text-dark/70 
          transition-colors" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h8M8 15h8" />
      </svg>
    </div>
  );
}

export default function ColumnManager({ columns, activeColumns, onColumnChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen && 
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = activeColumns.indexOf(active.id);
      const newIndex = activeColumns.indexOf(over.id);
      const newOrder = [...activeColumns];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id);
      onColumnChange(newOrder);
    }
  };

  const toggleColumn = (columnId) => {
    if (activeColumns.includes(columnId)) {
      onColumnChange(activeColumns.filter(id => id !== columnId));
    } else {
      onColumnChange([...activeColumns, columnId]);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 text-sm border border-border dark:border-border-dark rounded-md 
          hover:border-accent/50 dark:hover:border-accent-dark/50 
          bg-transparent text-primary-text dark:text-primary-text-dark
          flex items-center gap-2 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
        </svg>
        Columns
      </button>

      {isOpen && (
        <div 
          ref={menuRef}
          className="absolute right-0 mt-2 w-64 bg-surface dark:bg-surface-dark 
            border border-border dark:border-border-dark rounded-lg z-50"
        >
          <div className="p-4">
            <h3 className="text-sm font-medium mb-2 text-primary-text dark:text-primary-text-dark">
              Manage Columns
            </h3>
            <div className="space-y-2 mb-4">
              {Object.entries(columns).map(([id, { label }]) => (
                <label key={id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={activeColumns.includes(id)}
                    onChange={() => toggleColumn(id)}
                    className="rounded border-border dark:border-border-dark 
                      text-accent dark:text-accent-dark focus:ring-accent/20 
                      dark:focus:ring-accent-dark/20"
                  />
                  <span className="text-sm text-primary-text dark:text-primary-text-dark">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            
            <h3 className="text-sm font-medium mb-2 text-primary-text dark:text-primary-text-dark">
              Reorder Columns
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={activeColumns}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {activeColumns.map((columnId) => (
                    <SortableItem 
                      key={columnId} 
                      id={columnId} 
                      label={columns[columnId].label} 
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  );
}