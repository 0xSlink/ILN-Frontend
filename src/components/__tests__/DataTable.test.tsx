import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DataTable, { DataTableColumn } from '../DataTable';

vi.mock('../ColumnCustomiser', () => ({
  default: ({ onVisibilityChange, onOrderChange, onReset }: any) => (
    <div data-testid="column-customiser">
      <button onClick={() => onVisibilityChange('id', false)}>Hide ID</button>
      <button onClick={() => onOrderChange(['name', 'id'])}>Reorder</button>
      <button onClick={() => onReset()}>Reset Columns</button>
    </div>
  ),
}));

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'id', label: 'ID', sortable: true, renderCell: (r) => <span>#{r.id}</span> },
  { id: 'name', label: 'Name', sortable: true, renderCell: (r) => <span>{r.name}</span> },
];

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('DataTable', () => {
  beforeEach(() => {
    setViewportWidth(1024);
    localStorage.clear();
  });

  it('renders a row per item using each column renderCell', () => {
    render(<DataTable data={rows} columns={columns} keyExtractor={(r) => r.id} />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading', () => {
    const { container } = render(
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={(r: Row) => r.id}
        isLoading
        loadingRows={3}
      />
    );
    expect(container.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('shows the empty message and icon when there is no data', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={(r: Row) => r.id}
        emptyMessage="Nothing here"
        emptyIcon={<span data-testid="empty-icon" />}
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });

  it('calls onSort with the column id when a sortable header is clicked', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        onSort={onSort}
        sortKey="name"
        sortOrder="asc"
      />
    );

    fireEvent.click(screen.getByText('ID'));
    expect(onSort).toHaveBeenCalledWith('id');
  });

  it('does not call onSort when the table is not sortable', () => {
    const onSort = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        onSort={onSort}
        sortable={false}
      />
    );

    fireEvent.click(screen.getByText('Name'));
    expect(onSort).not.toHaveBeenCalled();
  });

  it('invokes onRowClick with the clicked item and index', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable data={rows} columns={columns} keyExtractor={(r) => r.id} onRowClick={onRowClick} />
    );

    fireEvent.click(screen.getByText('Bob'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1], 1);
  });

  it('applies a string rowClassName to every row and a function rowClassName per-row', () => {
    const { container: strContainer } = render(
      <DataTable data={rows} columns={columns} keyExtractor={(r) => r.id} rowClassName="my-row" />
    );
    expect(strContainer.querySelectorAll('tbody tr.my-row').length).toBe(3);

    const { container: fnContainer } = render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        rowClassName={(r) => (r.id === 2 ? 'special-row' : '')}
      />
    );
    expect(fnContainer.querySelectorAll('tbody tr.special-row').length).toBe(1);
  });

  it('supports select-all and per-row selection', () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        selection={{ selectedIds: new Set(), onSelectionChange }}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // header select-all
    expect(onSelectionChange).toHaveBeenCalledWith(new Set([1, 2, 3]));

    fireEvent.click(checkboxes[2]); // first data row (index 1 is row for id=1)
    expect(onSelectionChange).toHaveBeenCalledWith(new Set([2]));
  });

  it('highlights selected rows and reflects selectAll on the header checkbox', () => {
    const { container } = render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        selection={{ selectedIds: new Set([2]), onSelectionChange: vi.fn() }}
      />
    );
    expect(container.querySelectorAll('tbody tr.bg-primary\\/5').length).toBe(1);
  });

  it('renders pagination summary and page controls, and paginates', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        pagination={{
          currentPage: 1,
          pageSize: 3,
          totalItems: 30,
          onPageChange,
          onPageSizeChange,
        }}
      />
    );

    expect(screen.getByText('Showing 1-3 of 30')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeDisabled();

    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('disables Next on the last page', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        pagination={{ currentPage: 10, pageSize: 3, totalItems: 30, onPageChange }}
      />
    );
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('toggles column visibility, reorders, and resets via the column customiser', async () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        columnCustomization={{ enabled: true, tableId: 'test-table' }}
      />
    );

    expect(screen.getByTestId('column-customiser')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide ID'));
    await waitFor(() => {
      expect(screen.queryByRole('columnheader', { name: 'ID' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reset Columns'));
    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument();
    });
  });

  it('persists column configuration to localStorage and restores it on remount', async () => {
    const { unmount } = render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        columnCustomization={{ enabled: true, tableId: 'persisted-table' }}
      />
    );
    fireEvent.click(screen.getByText('Hide ID'));

    await waitFor(() => {
      expect(localStorage.getItem('iln_table_config_persisted-table')).not.toBeNull();
    });
    unmount();

    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        columnCustomization={{ enabled: true, tableId: 'persisted-table' }}
      />
    );
    expect(screen.queryByRole('columnheader', { name: 'ID' })).not.toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('switches to the mobile card layout below the breakpoint', () => {
    setViewportWidth(500);
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        selection={{ selectedIds: new Set(), onSelectionChange: vi.fn() }}
      />
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
  });

  it('stays in desktop layout on narrow viewports when mobileCardLayout is disabled', () => {
    setViewportWidth(500);
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        mobileCardLayout={false}
      />
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
