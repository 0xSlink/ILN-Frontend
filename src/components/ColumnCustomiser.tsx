'use client';

import React, { useState, useRef } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  isMandatory?: boolean;
}

interface ColumnCustomiserProps {
  allColumns: ColumnConfig[];
  visibleColumns: string[];
  columnOrder: string[];
  onVisibilityChange: (columnId: string, visible: boolean) => void;
  onOrderChange: (newOrder: string[]) => void;
  onReset: () => void;
}

export default function ColumnCustomiser({
  allColumns,
  visibleColumns,
  columnOrder,
  onVisibilityChange,
  onOrderChange,
  onReset,
}: ColumnCustomiserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Create a ghost image or just let default happen
  };

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === overId) return;

    const dragIdx = columnOrder.indexOf(draggedItemId);
    const overIdx = columnOrder.indexOf(overId);

    const newOrder = [...columnOrder];
    newOrder.splice(dragIdx, 1);
    newOrder.splice(overIdx, 0, draggedItemId);
    onOrderChange(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant transition-all duration-200 border border-outline-variant/10 shadow-sm"
      >
        <span className="material-symbols-outlined text-[18px]">view_column</span>
        <span className="text-sm font-bold uppercase tracking-wider">Columns</span>
        <span
          className={`material-symbols-outlined text-[18px] transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 origin-top-right rounded-2xl bg-surface-bright/95 backdrop-blur-xl shadow-2xl border border-outline-variant/20 z-[60] overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/50">
            <h4 className="text-sm font-bold uppercase tracking-[0.1em] text-on-surface-variant">
              Table Columns
            </h4>
            <button
              onClick={onReset}
              className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
            >
              Reset to Default
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            <div className="space-y-1">
              {columnOrder.map((id) => {
                const column = allColumns.find((c) => c.id === id);
                if (!column) return null;

                const isVisible = visibleColumns.includes(id);
                const isDragging = draggedItemId === id;

                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, id)}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all group ${
                      isDragging ? 'opacity-30 scale-95' : 'hover:bg-surface-container-low'
                    } cursor-grab active:cursor-grabbing`}
                  >
                    <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors text-[18px] select-none">
                      drag_indicator
                    </span>

                    <label className="flex-1 flex items-center gap-3 cursor-pointer select-none">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          disabled={column.isMandatory}
                          onChange={(e) => onVisibilityChange(id, e.target.checked)}
                          className={`w-5 h-5 rounded border-2 transition-all appearance-none cursor-pointer ${
                            column.isMandatory
                              ? 'bg-surface-dim border-outline-variant cursor-not-allowed'
                              : isVisible
                                ? 'bg-primary border-primary checked:bg-primary'
                                : 'bg-surface-container-lowest border-outline-variant hover:border-primary/50'
                          }`}
                        />
                        {isVisible && (
                          <span className="material-symbols-outlined absolute inset-0 text-white text-[16px] flex items-center justify-center pointer-events-none">
                            check
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          column.isMandatory ? 'text-on-surface-variant/60' : 'text-on-surface'
                        }`}
                      >
                        {column.label}
                      </span>
                    </label>

                    {column.isMandatory && (
                      <span
                        className="material-symbols-outlined text-[14px] text-outline-variant"
                        title="Required column"
                      >
                        lock
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-surface-container-low/30 text-[10px] text-on-surface-variant italic text-center">
            Drag items to reorder the table view
          </div>
        </div>
      )}
    </div>
  );
}
