import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from '../ExportButton';
import * as exportData from '@/utils/exportData';

vi.mock('@/utils/exportData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/exportData')>();
  return {
    ...actual,
    exportToCSV: vi.fn(),
    exportToJSON: vi.fn(),
  };
});

const sampleData = [
  { id: '1', amount: 100, status: 'Pending', payer: 'GABC' },
  { id: '2', amount: 200, status: 'Funded', payer: 'GDEF' },
];

describe('ExportButton', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults to all columns selected', () => {
    render(<ExportButton data={sampleData} filenamePrefix="iln-lp-export" />);

    expect(
      screen.getByRole('button', { name: /select export columns, 4 of 4 selected/i })
    ).toBeInTheDocument();
  });

  it('exports only selected columns to CSV', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={sampleData} filenamePrefix="iln-lp-export" />);

    await user.click(screen.getByRole('button', { name: /select export columns/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Amount' }));
    await user.click(screen.getByRole('button', { name: 'CSV' }));

    expect(exportData.exportToCSV).toHaveBeenCalledWith(
      [
        { id: '1', status: 'Pending', payer: 'GABC' },
        { id: '2', status: 'Funded', payer: 'GDEF' },
      ],
      expect.stringMatching(/iln-lp-export-\d{4}-\d{2}-\d{2}\.csv/),
      ['id', 'status', 'payer']
    );
  });

  it('supports select all and deselect all', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={sampleData} filenamePrefix="iln-lp-export" />);

    await user.click(screen.getByRole('button', { name: /select export columns/i }));
    await user.click(screen.getByRole('button', { name: 'Deselect all' }));
    expect(
      screen.getByRole('button', { name: /select export columns, 0 of 4 selected/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(
      screen.getByRole('button', { name: /select export columns, 4 of 4 selected/i })
    ).toBeInTheDocument();
  });

  it('restores last column selection from localStorage', () => {
    localStorage.setItem('iln_export_columns_iln-lp-export', JSON.stringify(['id', 'status']));

    render(<ExportButton data={sampleData} filenamePrefix="iln-lp-export" />);

    expect(
      screen.getByRole('button', { name: /select export columns, 2 of 4 selected/i })
    ).toBeInTheDocument();
  });

  it('persists column selection changes', async () => {
    const user = userEvent.setup();
    render(<ExportButton data={sampleData} filenamePrefix="iln-lp-export" />);

    await user.click(screen.getByRole('button', { name: /select export columns/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Amount' }));

    expect(localStorage.getItem('iln_export_columns_iln-lp-export')).toBe(
      JSON.stringify(['id', 'status', 'payer'])
    );
  });
});
