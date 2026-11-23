export type DateRange = 'all' | '90' | '365' | 'custom';

/**
 * Standard metadata included with protocol exports to maintain provenance,
 * auditability, and data freshness visibility.
 */
export interface ExportMetadata {
  /**
   * Originating data source (e.g. 'ILN Protocol', 'on-chain', 'indexer').
   */
  source?: string;
  /**
   * As-of timestamp or ISO date representing freshness point.
   */
  asOf?: string;
  /**
   * Generation timestamp of this export file.
   */
  generatedAt?: string;
  [key: string]: unknown;
}

export interface ExportOptions {
  /**
   * Custom metadata fields to attach to the export.
   */
  metadata?: ExportMetadata;
  /**
   * Whether to include source/as-of metadata headers. Defaults to true when metadata is provided.
   */
  includeMetadata?: boolean;
}

export function buildDefaultExportMetadata(custom?: ExportMetadata): ExportMetadata {
  const now = new Date().toISOString();
  return {
    source: custom?.source ?? 'ILN Protocol',
    asOf: custom?.asOf ?? now,
    generatedAt: custom?.generatedAt ?? now,
    ...custom,
  };
}

/**
 * Validates and sanitizes a cell value for export.
 *
 * Protocol correctness rule:
 * Masked values (e.g. '[MASKED]', '***') and unavailable values (null, undefined, NaN)
 * must NEVER be converted to 0 or '0', which would falsify financial accounting records.
 */
export function sanitizeExportValue(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    return val;
  }
  return val;
}

export function filterByDateRange<
  T extends { submittedDate?: string; fundedDate?: string; settledDate?: string },
>(data: T[], dateRange: DateRange, customStart?: Date, customEnd?: Date): T[] {
  if (dateRange === 'all') return data;

  const now = new Date();
  const msInDay = 24 * 60 * 60 * 1000;

  return data.filter((item) => {
    // Determine the relevant date field for this record type
    const dateStr = item.submittedDate || item.fundedDate || item.settledDate;
    if (!dateStr) return true; // If no date, keep it

    const recordDate = new Date(dateStr);

    if (dateRange === '90') {
      return now.getTime() - recordDate.getTime() <= 90 * msInDay;
    }

    if (dateRange === '365') {
      return now.getTime() - recordDate.getTime() <= 365 * msInDay;
    }

    if (dateRange === 'custom' && customStart && customEnd) {
      return recordDate >= customStart && recordDate <= customEnd;
    }

    return true;
  });
}

/**
 * Formats structured tabular data as CSV with optional provenance metadata.
 *
 * Rules:
 * - Empty/null/undefined/NaN values are rendered as empty quoted strings (""), NEVER 0.
 * - Masked strings are preserved verbatim.
 * - When metadata is requested, standard comment headers (# Source: ..., # As-Of: ...) precede the table.
 */
export function formatAsCSV<T extends Record<string, any>>(
  data: T[],
  columns?: string[],
  options?: ExportOptions
): string {
  const shouldIncludeMetadata = options?.includeMetadata ?? Boolean(options?.metadata);
  const metadataLines: string[] = [];

  if (shouldIncludeMetadata) {
    const meta = buildDefaultExportMetadata(options?.metadata);
    if (meta.source) metadataLines.push(`# Source: ${meta.source}`);
    if (meta.asOf) metadataLines.push(`# As-Of: ${meta.asOf}`);
    if (meta.generatedAt && meta.generatedAt !== meta.asOf) {
      metadataLines.push(`# Generated-At: ${meta.generatedAt}`);
    }
  }

  if (!data || data.length === 0) {
    return metadataLines.join('\n');
  }

  const headers = columns ?? Object.keys(data[0]);
  const csvRows = data.map((row) => {
    return headers
      .map((header) => {
        const rawVal = row[header];
        const val = sanitizeExportValue(rawVal);
        if (val === null || val === undefined) return '""';
        const strVal = String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  const table = [headers.join(','), ...csvRows].join('\n');
  return metadataLines.length > 0 ? `${metadataLines.join('\n')}\n${table}` : table;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: string[],
  options?: ExportOptions
) {
  const csvContent = formatAsCSV(data, columns, options);
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: string[],
  options?: ExportOptions
) {
  const shouldIncludeMetadata = options?.includeMetadata ?? Boolean(options?.metadata);

  const rows = data.map((row) => {
    const targetKeys = columns ?? Object.keys(row);
    return targetKeys.reduce<Record<string, unknown>>((acc, key) => {
      if (key in row) {
        acc[key] = sanitizeExportValue(row[key]);
      }
      return acc;
    }, {});
  });

  const payload = shouldIncludeMetadata
    ? {
        metadata: buildDefaultExportMetadata(options?.metadata),
        data: rows,
      }
    : rows;

  const jsonContent = JSON.stringify(payload, null, 2);
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
}
