import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterByDateRange,
  formatAsCSV,
  downloadFile,
  exportToCSV,
  exportToJSON,
  sanitizeExportValue,
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

  // ─── Metadata & Masked/Unavailable value tests ─────────────────────────────

  it('includes source and as-of metadata headers when requested', () => {
    const csv = formatAsCSV([{ id: 'inv-1', amount: 500 }], ['id', 'amount'], {
      metadata: {
        source: 'Stellar Soroban Mainnet',
        asOf: '2026-11-19T00:00:00.000Z',
      },
    });

    expect(csv).toContain('# Source: Stellar Soroban Mainnet');
    expect(csv).toContain('# As-Of: 2026-11-19T00:00:00.000Z');
    expect(csv).toContain('id,amount\n"inv-1","500"');
  });

  it('never exports masked or unavailable values as zero in CSV', () => {
    const testRecords = [
      {
        id: '1',
        balance: null,
        fee: undefined,
        discountRate: Number.NaN,
        privateKey: '[MASKED]',
        secretToken: '***',
        status: 'Unavailable',
        realZeroAmount: 0,
        realZeroString: '0',
      },
    ];

    const csv = formatAsCSV(testRecords);

    // null, undefined, and NaN must export as empty string, NOT "0" or 0
    expect(csv).toContain('"","","","[MASKED]","***","Unavailable","0","0"');

    // Make sure genuine zeroes are preserved as "0"
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,balance,fee,discountRate,privateKey,secretToken,status,realZeroAmount,realZeroString'
    );
    expect(lines[1]).toBe('"1","","","","[MASKED]","***","Unavailable","0","0"');

    // Assert that balance, fee, and discountRate are not exported as 0
    const values = lines[1].split(',');
    expect(values[1]).toBe('""'); // balance (null) -> ""
    expect(values[2]).toBe('""'); // fee (undefined) -> ""
    expect(values[3]).toBe('""'); // discountRate (NaN) -> ""
    expect(values[4]).toBe('"[MASKED]"'); // privateKey ([MASKED]) -> "[MASKED]"
    expect(values[7]).toBe('"0"'); // realZeroAmount (0) -> "0"
  });
});

describe('sanitizeExportValue', () => {
  it('preserves null and undefined as null without converting to zero', () => {
    expect(sanitizeExportValue(null)).toBeNull();
    expect(sanitizeExportValue(undefined)).toBeNull();
    expect(sanitizeExportValue(Number.NaN)).toBeNull();
    expect(sanitizeExportValue(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('preserves masked and unavailable string representations without converting to zero', () => {
    expect(sanitizeExportValue('[MASKED]')).toBe('[MASKED]');
    expect(sanitizeExportValue('***')).toBe('***');
    expect(sanitizeExportValue('Unavailable')).toBe('Unavailable');
    expect(sanitizeExportValue('N/A')).toBe('N/A');
  });

  it('preserves actual zero values accurately', () => {
    expect(sanitizeExportValue(0)).toBe(0);
    expect(sanitizeExportValue('0')).toBe('0');
  });
});

describe('downloadFile / exportToCSV / exportToJSON', () => {
  let capturedBlob: Blob | null = null;
  const createObjectURLMock = vi.fn((blob: Blob) => {
    capturedBlob = blob;
    return 'blob:url';
  });
  const revokeObjectURLMock = vi.fn();
  const clickMock = vi.fn();

  beforeEach(() => {
    capturedBlob = null;
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

  it('exportToCSV downloads a CSV file with metadata when specified', async () => {
    exportToCSV([{ id: 1, amount: null, masked: '[MASKED]' }], 'data.csv', undefined, {
      metadata: { source: 'ILN Soroban Contract', asOf: '2026-11-19T00:00:00.000Z' },
    });
    expect(clickMock).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();
    const text = await capturedBlob!.text();
    expect(text).toContain('# Source: ILN Soroban Contract');
    expect(text).toContain('# As-Of: 2026-11-19T00:00:00.000Z');
    expect(text).toContain('"1","","[MASKED]"');
  });

  it('exportToJSON downloads all columns by default without clobbering unavailable values', async () => {
    exportToJSON([{ a: 1, b: null, c: Number.NaN, d: '[MASKED]' }], 'data.json');
    expect(clickMock).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();
    const text = await capturedBlob!.text();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual([{ a: 1, b: null, c: null, d: '[MASKED]' }]);
    expect(parsed[0].b).not.toBe(0);
    expect(parsed[0].c).not.toBe(0);
  });

  it('exportToJSON wraps payload with source and as-of metadata envelope when requested', async () => {
    exportToJSON([{ id: 10, value: 50 }], 'data.json', ['id', 'value'], {
      metadata: { source: 'ILN Subgraph Indexer', asOf: '2026-11-19T12:00:00.000Z' },
    });
    expect(clickMock).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();
    const text = await capturedBlob!.text();
    const parsed = JSON.parse(text);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.source).toBe('ILN Subgraph Indexer');
    expect(parsed.metadata.asOf).toBe('2026-11-19T12:00:00.000Z');
    expect(parsed.data).toEqual([{ id: 10, value: 50 }]);
  });
});
