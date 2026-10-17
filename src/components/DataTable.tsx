'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ColumnCustomiser, { ColumnConfig } from './ColumnCustomiser';

export interface DataTableColumn<T> extends ColumnConfig {
  renderCell: (item: T, index: number) => React.ReactNode;
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  width?: string;
}

interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface SelectionConfig {
  selectedIds: Set<string | number>;
  onSelectionChange: (selectedIds: Set<string | number>) => void;
  selectAll?: boolean;
  onSelectAllChange?: (selectAll: boolean) => void;
}

interface ColumnCustomizationConfig {
  enabled: boolean;
  tableId: string;
  onVisibilityChange?: (columnId: string, visible: boolean) => void;
  onOrderChange?: (newOrder: string[]) => void;
  onReset?: () => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  loadingRows?: number;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  sortable?: boolean;
  onSort?: (columnId: string) => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  pagination?: PaginationConfig;
  selection?: SelectionConfig;
  columnCustomization?: ColumnCustomizationConfig;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: string | ((item: T, index: number) => string);
  mobileBreakpoint?: number;
  mobileCardLayout?: boolean;
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  ariaLabel?: string;
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  loadingRows = 5,
  emptyMessage = 'No data found.',
  emptyIcon,
  sortable = true,
  onSort,
  sortKey,
  sortOrder,
  pagination,
  selection,
  columnCustomization,
  onRowClick,
  rowClassName,
  mobileBreakpoint = 768,
  mobileCardLayout = true,
  className,
  tableClassName,
  headerClassName,
  bodyClassName,
  ariaLabel,
}: DataTableProps<T>) {
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const storageKey = columnCustomization?.tableId
    ? `iln_table_config_${columnCustomization.tableId}`
    : null;

  // Responsive detection
  useEffect(() => {
    if (!mobileCardLayout) return;

    const checkMobile = () => setIsMobile(window.innerWidth < mobileBreakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint, mobileCardLayout]);

  // Load column config from localStorage
  useEffect(() => {
    if (!columnCustomization?.enabled) {
      setColumnOrder(columns.map((c) => c.id));
      setVisibleColumns(columns.map((c) => c.id));
      setIsInitialized(true);
      return;
    }

    const defaultOrder = columns.map((c) => c.id);
    const defaultVisible = columns.filter((c) => c.isMandatory !== false).map((c) => c.id);

    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const config = JSON.parse(saved);
          const validOrder = config.order.filter((id: string) => columns.some((c) => c.id === id));
          const missingFromOrder = defaultOrder.filter((id) => !validOrder.includes(id));
          setColumnOrder([...validOrder, ...missingFromOrder]);
          setVisibleColumns(config.visibility || defaultVisible);
        } catch {
          setColumnOrder(defaultOrder);
          setVisibleColumns(defaultVisible);
        }
      } else {
        setColumnOrder(defaultOrder);
        setVisibleColumns(defaultVisible);
      }
    } else {
      setColumnOrder(defaultOrder);
      setVisibleColumns(defaultVisible);
    }
    setIsInitialized(true);
  }, [columnCustomization?.enabled, columnCustomization?.tableId, columns]);

  // Save column config to localStorage
  useEffect(() => {
    if (!isInitialized || !storageKey) return;
    const config = { order: columnOrder, visibility: visibleColumns };
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [columnOrder, visibleColumns, isInitialized, storageKey]);

  const handleVisibilityChange = (id: string, visible: boolean) => {
    const newVisible = visible ? [...visibleColumns, id] : visibleColumns.filter((v) => v !== id);
    setVisibleColumns(newVisible);
    columnCustomization?.onVisibilityChange?.(id, visible);
  };

  const handleOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    columnCustomization?.onOrderChange?.(newOrder);
  };

  const handleReset = () => {
    const defaultOrder = columns.map((c) => c.id);
    const defaultVisible = columns.map((c) => c.id);
    setColumnOrder(defaultOrder);
    setVisibleColumns(defaultVisible);
    columnCustomization?.onReset?.();
  };

  const activeColumns = useMemo(() => {
    return columnOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is DataTableColumn<T> => !!c && visibleColumns.includes(c.id));
  }, [columnOrder, visibleColumns, columns]);

  const handleSelectAll = (checked: boolean) => {
    if (!selection) return;
    if (checked) {
      const allIds = new Set(data.map(keyExtractor));
      selection.onSelectionChange(allIds);
    } else {
      selection.onSelectionChange(new Set());
    }
    selection.onSelectAllChange?.(checked);
  };

  const handleSelectRow = (id: string | number, checked: boolean) => {
    if (!selection) return;
    const newSelected = new Set(selection.selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    selection.onSelectionChange(newSelected);
  };

  const totalPages = pagination ? Math.ceil(pagination.totalItems / pagination.pageSize) : 1;
  const startItem = pagination ? (pagination.currentPage - 1) * pagination.pageSize + 1 : 1;
  const endItem = pagination
    ? Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)
    : data.length;

  if (!isInitialized) return null;

  // Mobile card layout
  if (isMobile && mobileCardLayout) {
    return (
      <div className={className}>
        {columnCustomization?.enabled && (
          <div className="flex justify-end px-4 mb-4">
            <ColumnCustomiser
              allColumns={columns}
              visibleColumns={visibleColumns}
              columnOrder={columnOrder}
              onVisibilityChange={handleVisibilityChange}
              onOrderChange={handleOrderChange}
              onReset={handleReset}
            />
          </div>
        )}

        <div className="space-y-4 px-4">
          {isLoading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-surface-variant/30 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-surface-variant/20 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-surface-variant/20 rounded w-2/3"></div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant">
              {emptyIcon}
              <p className="mt-2">{emptyMessage}</p>
            </div>
          ) : (
            data.map((item, index) => {
              const key = keyExtractor(item);
              const isSelected = selection?.selectedIds.has(key);
              return (
                <div
                  key={key}
                  onClick={() => onRowClick?.(item, index)}
                  className={`bg-surface-container-lowest rounded-lg p-4 border border-outline-variant/10 ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-variant/10' : ''
                  } ${isSelected ? 'ring-2 ring-primary' : ''} ${
                    typeof rowClassName === 'function'
                      ? rowClassName(item, index)
                      : rowClassName || ''
                  }`}
                >
                  {selection && (
                    <div className="mb-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(key, e.target.checked)}
                        className="w-4 h-4"
                      />
                    </div>
                  )}
                  {activeColumns.map((col) => (
                    <div key={col.id} className="mb-2 last:mb-0">
                      <span className="text-xs text-on-surface-variant font-bold uppercase">
                        {col.label}:{' '}
                      </span>
                      <span className="text-sm">{col.renderCell(item, index)}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {pagination && (
          <div className="mt-4 px-4">
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={totalPages}
              onPageChange={pagination.onPageChange}
              startItem={startItem}
              endItem={endItem}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.onPageSizeChange}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </div>
        )}
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className={className}>
      {columnCustomization?.enabled && (
        <div className="flex justify-end px-6 mb-4">
          <ColumnCustomiser
            allColumns={columns}
            visibleColumns={visibleColumns}
            columnOrder={columnOrder}
            onVisibilityChange={handleVisibilityChange}
            onOrderChange={handleOrderChange}
            onReset={handleReset}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl">
        <table className={`w-full text-left ${tableClassName || ''}`} aria-label={ariaLabel}>
          <thead className={`bg-surface-container-low ${headerClassName || ''}`}>
            <tr>
              {selection && (
                <th className="px-6 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={selection.selectAll || selection.selectedIds.size === data.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4"
                  />
                </th>
              )}
              {activeColumns.map((col) => (
                <th
                  key={col.id}
                  onClick={() => sortable && col.sortable && onSort?.(col.id)}
                  className={`px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider ${
                    sortable && col.sortable ? 'cursor-pointer select-none group' : ''
                  } ${col.headerClassName || ''}`}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortable && col.sortable && (
                      <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">
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
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-surface-dim bg-surface-container-lowest/50 ${
              bodyClassName || ''
            }`}
          >
            {isLoading ? (
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={i}>
                  {selection && (
                    <td className="px-6 py-5">
                      <div className="w-4 h-4 bg-surface-variant/30 rounded animate-pulse"></div>
                    </td>
                  )}
                  {activeColumns.map((col) => (
                    <td key={col.id} className="px-6 py-5">
                      <div className="h-4 bg-surface-variant/30 rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={activeColumns.length + (selection ? 1 : 0)}
                  className="px-6 py-12 text-center text-on-surface-variant"
                >
                  {emptyIcon}
                  <p className="mt-2">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const key = keyExtractor(item);
                const isSelected = selection?.selectedIds.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item, index)}
                    className={`hover:bg-surface-variant/10 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${isSelected ? 'bg-primary/5' : ''} ${
                      typeof rowClassName === 'function'
                        ? rowClassName(item, index)
                        : rowClassName || ''
                    }`}
                  >
                    {selection && (
                      <td className="px-6 py-5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectRow(key, e.target.checked);
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                    )}
                    {activeColumns.map((col) => (
                      <td key={col.id} className={`px-6 py-5 ${col.cellClassName || ''}`}>
                        {col.renderCell(item, index)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="mt-4 px-6">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={totalPages}
            onPageChange={pagination.onPageChange}
            startItem={startItem}
            endItem={endItem}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageSizeChange={pagination.onPageSizeChange}
            pageSizeOptions={pagination.pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  startItem,
  endItem,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  startItem: number;
  endItem: number;
  totalItems: number;
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  const pages = useMemo(() => {
    const delta = 2;
    const range = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }
    if (currentPage - delta > 2) range.unshift('...');
    if (currentPage + delta < totalPages - 1) range.push('...');
    range.unshift(1);
    if (totalPages > 1) range.push(totalPages);
    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="text-sm text-on-surface-variant">
        Showing {startItem}-{endItem} of {totalItems}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded border border-outline-variant disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-variant/10"
        >
          Previous
        </button>

        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 rounded border ${
                currentPage === page
                  ? 'bg-primary text-surface-container-lowest border-primary'
                  : 'border-outline-variant hover:bg-surface-variant/10'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded border border-outline-variant disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-variant/10"
        >
          Next
        </button>
      </div>

      {onPageSizeChange && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-on-surface-variant">Show:</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 rounded border border-outline-variant bg-surface-container-lowest"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
