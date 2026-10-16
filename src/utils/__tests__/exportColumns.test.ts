import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveExportColumns,
  getStorageKey,
  humanizeColumnKey,
  loadStoredColumnSelection,
  pickDataColumns,
  saveStoredColumnSelection,
} from '@/utils/exportColumns';

describe('exportColumns utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('humanizes column keys', () => {
    expect(humanizeColumnKey('due_date')).toBe('Due Date');
    expect(humanizeColumnKey('discountRate')).toBe('Discount Rate');
  });

  it('derives columns from data keys', () => {
    const columns = deriveExportColumns([{ id: '1', amount: 100, status: 'Pending' }]);

    expect(columns).toEqual([
      { key: 'id', label: 'Id' },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status' },
    ]);
  });

  it('persists and restores column selection', () => {
    const prefix = 'iln-lp-export';
    saveStoredColumnSelection(prefix, ['id', 'amount']);

    expect(localStorage.getItem(getStorageKey(prefix))).toBe(JSON.stringify(['id', 'amount']));
    expect(loadStoredColumnSelection(prefix, ['id', 'amount', 'status'])).toEqual(['id', 'amount']);
  });

  it('returns null when stored selection is invalid', () => {
    const prefix = 'iln-lp-export';
    localStorage.setItem(getStorageKey(prefix), JSON.stringify(['missing']));

    expect(loadStoredColumnSelection(prefix, ['id', 'amount'])).toBeNull();
  });

  it('picks only selected columns from rows', () => {
    const rows = pickDataColumns(
      [
        { id: '1', amount: 100, status: 'Pending' },
        { id: '2', amount: 200, status: 'Funded' },
      ],
      ['id', 'status']
    );

    expect(rows).toEqual([
      { id: '1', status: 'Pending' },
      { id: '2', status: 'Funded' },
    ]);
  });
});
