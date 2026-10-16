'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ColumnCustomiser, { ColumnConfig } from './ColumnCustomiser';
import { RowActionsMenu, type RowAction } from './RowActionsMenu';
import useMediaQuery, { MOBILE_QUERY } from '@/hooks/useMediaQuery';
import ProgressiveDisclosureCards from './ProgressiveDisclosureCards';

export interface ColumnDefinition<T> extends ColumnConfig {
  renderCell: (item: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  sortable?: boolean;
  /** Show this column in the collapsed mobile (progressive disclosure) summary. */
  isKeyColumn?: boolean;
}

interface InvoiceTableProps<T> {
  tableId: string;
  data: T[];
  columns: ColumnDefinition<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyStateNode?: React.ReactNode;
  onSort?: (key: keyof T | string) => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  keyExtractor: (item: T) => string;
  // Selection
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  // Stable sort
  sortedData?: T[];
  // Row actions
  onRowAction?: (action: string, item: T) => void;
  rowActions?: (item: T) => RowAction[];
}

export default function InvoiceTable<T>({
  tableId,
  data,
  columns,
  isLoading,
  emptyMessage = 'No data found.',
  emptyStateNode,
  onSort,
  sortKey,
  sortOrder,
  keyExtractor,
  selectedKeys,
  onSelectionChange,
  sortedData,
  onRowAction,
  rowActions,
}: InvoiceTableProps<T>) {
  const router = useRouter();
  const storageKey = `iln_table_config_${tableId}`;
  const selectable = selectedKeys !== undefined && onSelectionChange !== undefined;
  const isMobile = useMediaQuery(MOBILE_QUERY);

  // State for order and visibility — lazily initialised from localStorage
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultOrder = columns.map((c) => c.id);
    return defaultOrder;
  });
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    return columns.filter((c) => c.isMandatory !== false).map((c) => c.id);
  });
  const [isInitialised, setIsInitialised] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const defaultOrder = columns.map((c) => c.id);
    const defaultVisible = columns.filter((c) => c.isMandatory !== false).map((c) => c.id);

    if (saved) {
      try {
        const config = JSON.parse(saved);
        const validOrder = config.order.filter((id: string) => columns.some((c) => c.id === id));
        const missingFromOrder = defaultOrder.filter((id) => !validOrder.includes(id));

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setColumnOrder([...validOrder, ...missingFromOrder]);

        setVisibleColumns(config.visibility || defaultVisible);
      } catch (e) {
        console.error('Failed to load table config', e);
      }
    }

    setIsInitialised(true);
  }, [tableId, columns]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isInitialised) return;
    const config = {
      order: columnOrder,
      visibility: visibleColumns,
    };
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [columnOrder, visibleColumns, isInitialised, storageKey]);

  const handleVisibilityChange = (id: string, visible: boolean) => {
    if (visible) {
      setVisibleColumns((prev) => [...prev, id]);
    } else {
      setVisibleColumns((prev) => prev.filter((v) => v !== id));
    }
  };

  const handleReset = () => {
    const defaultOrder = columns.map((c) => c.id);
    const defaultVisible = columns.map((c) => c.id);
    setColumnOrder(defaultOrder);
    setVisibleColumns(defaultVisible);
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: T, _index: number) => {
    if (e.key === 'Enter') {
      router.push(`/i/${keyExtractor(item)}`);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = e.currentTarget.nextSibling as HTMLElement;
      nextRow?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = e.currentTarget.previousSibling as HTMLElement;
      prevRow?.focus();
    }
  };

  const activeColumns = useMemo(() => {
    return columnOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is ColumnDefinition<T> => !!c && visibleColumns.includes(c.id));
  }, [columnOrder, visibleColumns, columns]);

  // Selection helpers
  const displayData = sortedData || data;
  const allKeys = useMemo(() => displayData.map(keyExtractor), [displayData, keyExtractor]);
  const allSelected =
    selectable && allKeys.length > 0 && allKeys.every((k) => selectedKeys!.has(k));
  const someSelected = selectable && allKeys.some((k) => selectedKeys!.has(k));

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedKeys);
      allKeys.forEach((k) => next.delete(k));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedKeys);
      allKeys.forEach((k) => next.add(k));
      onSelectionChange(next);
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  if (!isInitialised) return null;

  // Mobile: progressive disclosure — show key columns, expand a row for the rest.
  if (isMobile) {
    const flaggedKeyIds = activeColumns.filter((c) => c.isKeyColumn).map((c) => c.id);
    const keyColumnIds =
      flaggedKeyIds.length > 0
        ? flaggedKeyIds
        : activeColumns
            .filter((c) => c.label !== '')
            .slice(0, 3)
            .map((c) => c.id);

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end px-2">
          <ColumnCustomiser
            allColumns={columns}
            visibleColumns={visibleColumns}
            columnOrder={columnOrder}
            onVisibilityChange={handleVisibilityChange}
            onOrderChange={setColumnOrder}
            onReset={handleReset}
          />
        </div>

        {isLoading ? (
          <p className="px-4 py-12 text-center text-on-surface-variant italic">Loading assets...</p>
        ) : displayData.length === 0 ? (
          <div className="px-4 py-8 text-center text-on-surface-variant">
            {emptyStateNode ?? emptyMessage}
          </div>
        ) : (
          <ProgressiveDisclosureCards
            data={displayData}
            columns={activeColumns.map((col) => ({
              id: col.id,
              label: col.label || 'Actions',
              renderCell: col.renderCell,
            }))}
            keyExtractor={keyExtractor}
            keyColumnIds={keyColumnIds}
            className="px-2"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end px-6">
        <ColumnCustomiser
          allColumns={columns}
          visibleColumns={visibleColumns}
          columnOrder={columnOrder}
          onVisibilityChange={handleVisibilityChange}
          onOrderChange={setColumnOrder}
          onReset={handleReset}
        />
      </div>

      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={handleSelectAll}
                    className="h-4 w-4 cursor-pointer rounded accent-primary"
                  />
                </th>
              )}
              {activeColumns.map((col, idx) => (
                <th
                  key={col.id}
                  onClick={() => col.sortable && onSort?.(col.id)}
                  className={`px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider ${
                    col.sortable ? 'cursor-pointer select-none group' : ''
                  } ${col.headerClassName || ''}`}
                  aria-sort={
                    col.sortable && sortKey === col.id
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : col.sortable
                        ? 'none'
                        : undefined
                  }
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {idx === 0 && !selectable && (
                      <div className="group/tooltip relative inline-block ml-1">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40 cursor-help">
                          keyboard
                        </span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-surface-container-highest text-on-surface text-[10px] p-2 rounded shadow-xl w-max z-20 normal-case font-normal border border-outline-variant/20">
                          <div className="font-bold mb-1 border-b border-outline-variant/20 pb-1">
                            Shortcuts
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <kbd className="bg-surface-dim px-1.5 py-0.5 rounded border border-outline-variant/30 min-w-[20px] text-center">
                              ↑↓
                            </kbd>
                            <span>Navigate rows</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <kbd className="bg-surface-dim px-1.5 py-0.5 rounded border border-outline-variant/30 min-w-[20px] text-center">
                              ↵
                            </kbd>
                            <span>Open detail</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {col.sortable && (
                      <span
                        className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-hidden="true"
                      >
                        {sortKey === col.id
                          ? sortOrder === 'asc'
                            ? 'arrow_upward'
                            : 'arrow_downward'
                          : 'unfold_more'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {rowActions && (
                <th className="px-4 py-4 w-10">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-dim bg-surface-container-lowest/50">
            {isLoading ? (
              <tr>
                <td
                  colSpan={activeColumns.length + (selectable ? 1 : 0)}
                  className="px-6 py-12 text-center text-on-surface-variant italic"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></span>
                    Loading assets...
                  </div>
                </td>
              </tr>
            ) : displayData.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length + (selectable ? 1 : 0)}
                  className="px-6 py-12 text-center text-on-surface-variant italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayData.map((item, index) => {
                const key = keyExtractor(item);
                const isSelected = selectable && selectedKeys!.has(key);
                return (
                  <tr
                    key={key}
                    tabIndex={0}
                    role="row"
                    aria-selected={selectable ? isSelected : undefined}
                    onKeyDown={(e) => handleKeyDown(e, item, index)}
                    className={`hover:bg-surface-variant/10 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset focus:bg-primary/5 ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {selectable && (
                      <td className="w-10 px-4 py-5">
                        <input
                          type="checkbox"
                          aria-label={`Select row ${key}`}
                          checked={isSelected}
                          onChange={() => handleSelectRow(key)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer rounded accent-primary"
                        />
                      </td>
                    )}
                    {activeColumns.map((col) => (
                      <td key={col.id} className={`px-6 py-5 ${col.cellClassName || ''}`}>
                        {col.renderCell(item)}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-4 py-5">
                        <RowActionsMenu
                          actions={rowActions(item).map((action) => ({
                            ...action,
                            onClick: () => {
                              action.onClick();
                              onRowAction?.(action.label, item);
                            },
                          }))}
                          ariaLabel={`Row actions for ${keyExtractor(item)}`}
                        />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
