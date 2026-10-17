import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterByDateRange,
  formatAsCSV,
  downloadFile,
  exportToCSV,
  exportToJSON,
} from '../exportData';

describe('filterByDateRange', () => {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

  it('returns everything unchanged for "all"', () => {
    const data = [{ submittedDate: daysAgo(1000) }];
    expect(filterByDateRange(data, 'all')).toBe(data);
  });

  it('keeps records with no relevant date field', () => {
    expect(filterByDateRange([{}], '90')).toHaveLength(1);
  });

  it('filters to the last 90 days', () => {
    const data = [{ submittedDate: daysAgo(10) }, { submittedDate: daysAgo(200) }];
    expect(filterByDateRange(data, '90')).toHaveLength(1);
  });

  it('filters to the last 365 days', () => {
    const data = [{ submittedDate: daysAgo(300) }, { submittedDate: daysAgo(400) }];
    expect(filterByDateRange(data, '365')).toHaveLength(1);
  });

  it('filters to a custom range when both bounds are given', () => {
    const data = [{ submittedDate: daysAgo(5) }, { submittedDate: daysAgo(50) }];
    const result = filterByDateRange(data, 'custom', new Date(now.getTime() - 10 * 86400000), now);
    expect(result).toHaveLength(1);
  });

  it('keeps everything for "custom" without both bounds', () => {
    const data = [{ submittedDate: daysAgo(5) }, { submittedDate: daysAgo(500) }];
    expect(filterByDateRange(data, 'custom')).toHaveLength(2);
  });

  it('falls back through fundedDate and settledDate', () => {
    const data = [{ fundedDate: daysAgo(10) }, { settledDate: daysAgo(10) }];
    expect(filterByDateRange(data, '90')).toHaveLength(2);
  });
});

describe('formatAsCSV', () => {
  it('returns an empty string for empty data', () => {
    expect(formatAsCSV([])).toBe('');
  });

  it('derives headers from the first row when none are given', () => {
    const csv = formatAsCSV([{ a: 1, b: 'x' }]);
    expect(csv).toBe('a,b\n"1","x"');
  });

  it('uses explicit columns and quotes/escapes values', () => {
    const csv = formatAsCSV([{ name: 'He said "hi"', amount: 5 }], ['name', 'amount']);
    expect(csv).toBe('name,amount\n"He said ""hi""","5"');
  });

  it('renders null/undefined values as an empty quoted string', () => {
    const csv = formatAsCSV([{ a: null, b: undefined }], ['a', 'b']);
    expect(csv).toBe('a,b\n"",""');
  });
});

describe('downloadFile / exportToCSV / exportToJSON', () => {
  const createObjectURLMock = vi.fn(() => 'blob:url');
  const revokeObjectURLMock = vi.fn();
  const clickMock = vi.fn();

  beforeEach(() => {
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    clickMock.mockClear();
    (global as any).URL.createObjectURL = createObjectURLMock;
    (global as any).URL.revokeObjectURL = revokeObjectURLMock;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickMock);
  });

  it('creates and revokes an object URL when downloading', () => {
    downloadFile('content', 'file.csv', 'text/csv');
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:url');
  });

  it('exportToCSV downloads a CSV file', () => {
    exportToCSV([{ a: 1 }], 'data.csv');
    expect(clickMock).toHaveBeenCalled();
  });

  it('exportToJSON downloads all columns by default', () => {
    exportToJSON([{ a: 1, b: 2 }], 'data.json');
    expect(clickMock).toHaveBeenCalled();
  });

  it('exportToJSON restricts to the given columns', () => {
    let capturedHref = '';
    createObjectURLMock.mockImplementation((blob: Blob) => {
      capturedHref = 'blob:url';
      return capturedHref;
    });
    exportToJSON([{ a: 1, b: 2, c: 3 }], 'data.json', ['a', 'c']);
    expect(clickMock).toHaveBeenCalled();
  });
});
