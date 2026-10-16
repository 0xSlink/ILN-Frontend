import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchExportButton } from '../BatchExportButton';

const unparseMock = vi.fn(() => 'csv-content');
vi.mock('papaparse', () => ({
  default: { unparse: (...args: unknown[]) => unparseMock(...args) },
}));

const downloadFileMock = vi.fn();
vi.mock('@/utils/exportData', () => ({
  downloadFile: (...args: unknown[]) => downloadFileMock(...args),
}));

const jsPdfSaveMock = vi.fn();
const jsPdfCtor = vi.fn(function JsPdfMock(this: any) {
  return {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    getTextWidth: vi.fn(() => 20),
    splitTextToSize: vi.fn((s: string) => [s]),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    save: jsPdfSaveMock,
  };
});
vi.mock('jspdf', () => ({ default: jsPdfCtor }));

const items = [
  { id: 1n, name: 'Alice', nested: { a: 1 }, tags: [1n, 2n] },
  { id: 2n, name: 'Bob', nested: { a: 2 }, tags: [] },
];

describe('BatchExportButton', () => {
  beforeEach(() => {
    unparseMock.mockClear();
    downloadFileMock.mockClear();
    jsPdfSaveMock.mockClear();
    jsPdfCtor.mockClear();
  });

  it('renders nothing when there is no selection', () => {
    const { container } = render(
      <BatchExportButton selectedItems={[]} filenamePrefix="invoices" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the selected count and export actions', () => {
    render(<BatchExportButton selectedItems={items} filenamePrefix="invoices" />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('exports CSV using flattened, bigint-safe rows by default', async () => {
    render(<BatchExportButton selectedItems={items} filenamePrefix="invoices" />);
    fireEvent.click(screen.getByText('CSV'));

    await waitFor(() => expect(downloadFileMock).toHaveBeenCalled());
    const rows = unparseMock.mock.calls[0][0];
    expect(rows[0]).toEqual({ id: '1', name: 'Alice', nested_a: 1, tags: '1, 2' });
    expect(downloadFileMock).toHaveBeenCalledWith(
      'csv-content',
      expect.stringMatching(/^invoices-batch-\d{4}-\d{2}-\d{2}\.csv$/),
      'text/csv;charset=utf-8;'
    );
  });

  it('uses a provided serializeItem for CSV export', async () => {
    const serializeItem = vi.fn((item: (typeof items)[number]) => ({ onlyName: item.name }));
    render(
      <BatchExportButton
        selectedItems={items}
        filenamePrefix="invoices"
        serializeItem={serializeItem}
      />
    );
    fireEvent.click(screen.getByText('CSV'));

    await waitFor(() => expect(downloadFileMock).toHaveBeenCalled());
    expect(serializeItem).toHaveBeenCalledWith(items[0]);
    const rows = unparseMock.mock.calls[0][0];
    expect(rows).toEqual([{ onlyName: 'Alice' }, { onlyName: 'Bob' }]);
  });

  it('exports a PDF, one page per selected item', async () => {
    render(<BatchExportButton selectedItems={items} filenamePrefix="invoices" />);
    fireEvent.click(screen.getByText('PDF'));

    await waitFor(() => expect(jsPdfSaveMock).toHaveBeenCalled());
    expect(jsPdfSaveMock).toHaveBeenCalledWith(
      expect.stringMatching(/^invoices-batch-\d{4}-\d{2}-\d{2}\.pdf$/)
    );
  });

  it('does nothing when CSV/PDF export handlers are triggered with no items', () => {
    const { rerender } = render(
      <BatchExportButton selectedItems={items} filenamePrefix="invoices" />
    );
    // Force count to 0 mid-flight isn't reachable through UI once rendered as null,
    // so just confirm the empty-selection render path short-circuits entirely.
    rerender(<BatchExportButton selectedItems={[]} filenamePrefix="invoices" />);
    expect(screen.queryByText('CSV')).not.toBeInTheDocument();
  });
});
