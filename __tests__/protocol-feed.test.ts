import { describe, it, expect } from 'vitest';
import type { ParsedContractEvent } from '@/lib/contract-events';
import type { Invoice } from '@/utils/soroban';
import {
  buildProtocolFeedItems,
  deduplicateProtocolFeedEvents,
  formatFeedAmountValue,
  isProtocolFeedEventType,
  mergeProtocolFeedEvents,
  protocolFeedEventKey,
} from '@/utils/protocol-feed';

function makeInvoice(id: bigint, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    status: 'Funded',
    freelancer: 'GAAAA',
    payer: 'GBBBB',
    amount: 100_000_000n,
    due_date: 1n,
    discount_rate: 300,
    token: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    ...overrides,
  };
}

describe('isProtocolFeedEventType', () => {
  it('includes feed event types only', () => {
    expect(isProtocolFeedEventType('InvoiceSubmitted')).toBe(true);
    expect(isProtocolFeedEventType('InvoiceFunded')).toBe(true);
    expect(isProtocolFeedEventType('InvoicePaid')).toBe(true);
    expect(isProtocolFeedEventType('InvoiceDisputed')).toBe(true);
    expect(isProtocolFeedEventType('InvoiceCancelled')).toBe(false);
  });
});

describe('protocolFeedEventKey & replay/reorg deduplication (#1282)', () => {
  it('computes canonical keys and ignores non-feed or missing-id events', () => {
    expect(
      protocolFeedEventKey({ type: 'InvoiceFunded', invoiceId: 42n, ledger: 10 })
    ).toBe('InvoiceFunded:42');
    expect(protocolFeedEventKey({ type: 'InvoiceCancelled', invoiceId: 42n })).toBeNull();
    expect(protocolFeedEventKey({ type: 'InvoiceFunded' })).toBeNull();
  });

  it('deduplicates exact replayed events across repeated poll batches', () => {
    const batch1: ParsedContractEvent[] = [
      { type: 'InvoiceFunded', invoiceId: 42n, createdAt: '2025-06-15T10:00:00.000Z', ledger: 100 },
      { type: 'InvoiceFunded', invoiceId: 42n, createdAt: '2025-06-15T10:00:00.000Z', ledger: 100 },
    ];
    const batch2: ParsedContractEvent[] = [
      { type: 'InvoiceFunded', invoiceId: 42n, createdAt: '2025-06-15T10:00:00.000Z', ledger: 100 },
    ];

    const merged = mergeProtocolFeedEvents(batch1, batch2);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.ledger).toBe(100);
  });

  it('replaces an orphaned or corrected event when a higher ledger arrives (reorg)', () => {
    const events: ParsedContractEvent[] = [
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:00:00.000Z', ledger: 200 },
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:00:10.000Z', ledger: 205 },
    ];

    const deduped = deduplicateProtocolFeedEvents(events);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.ledger).toBe(205);
    expect(deduped[0]?.createdAt).toBe('2025-06-15T11:00:10.000Z');
  });

  it('ignores stale out-of-order replays with lower ledger or older timestamp', () => {
    const current: ParsedContractEvent[] = [
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:00:10.000Z', ledger: 205 },
    ];
    const staleReplay: ParsedContractEvent[] = [
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:05:00.000Z', ledger: 200 },
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T10:59:00.000Z', ledger: 205 },
    ];

    const merged = mergeProtocolFeedEvents(current, staleReplay);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.ledger).toBe(205);
    expect(merged[0]?.createdAt).toBe('2025-06-15T11:00:10.000Z');
  });

  it('replaces missing timestamp metadata on same ledger when corrected timestamp arrives', () => {
    const merged = mergeProtocolFeedEvents(
      [{ type: 'InvoiceSubmitted', invoiceId: 9n, ledger: 50 }],
      [{ type: 'InvoiceSubmitted', invoiceId: 9n, ledger: 50, createdAt: '2025-06-15T12:00:00.000Z' }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.createdAt).toBe('2025-06-15T12:00:00.000Z');
  });
});

describe('buildProtocolFeedItems', () => {
  const invoices = new Map<string, Invoice>([
    ['42', makeInvoice(42n)],
    ['7', makeInvoice(7n, { amount: 50_000_000n })],
  ]);

  const events: ParsedContractEvent[] = [
    { type: 'InvoiceFunded', invoiceId: 42n, createdAt: '2025-06-15T10:00:00.000Z', ledger: 1 },
    { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:00:00.000Z', ledger: 2 },
    { type: 'InvoiceCancelled', invoiceId: 99n, createdAt: '2025-06-15T12:00:00.000Z', ledger: 3 },
    { type: 'InvoiceSubmitted', invoiceId: 42n, createdAt: '2025-06-14T09:00:00.000Z', ledger: 4 },
  ];

  it('returns at most 10 items sorted newest first', () => {
    const items = buildProtocolFeedItems(events, invoices, 10);
    expect(items).toHaveLength(3);
    expect(items[0]?.eventType).toBe('InvoicePaid');
    expect(items[1]?.eventType).toBe('InvoiceFunded');
    expect(items[2]?.eventType).toBe('InvoiceSubmitted');
  });

  it('does not produce duplicate feed items or exhaust limit on replayed events', () => {
    const replayed: ParsedContractEvent[] = [
      ...events,
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:00:00.000Z', ledger: 2 },
      { type: 'InvoicePaid', invoiceId: 7n, createdAt: '2025-06-15T11:00:05.000Z', ledger: 5 },
      { type: 'InvoiceFunded', invoiceId: 42n, createdAt: '2025-06-15T10:00:00.000Z', ledger: 1 },
    ];
    const items = buildProtocolFeedItems(replayed, invoices, 3);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((i) => i.id)).size).toBe(3);
    expect(items[0]?.eventType).toBe('InvoicePaid');
    expect(items[0]?.id).toContain('-5');
  });

  it('maps event labels and invoice fields', () => {
    const items = buildProtocolFeedItems(events, invoices, 10);
    const funded = items.find((item) => item.eventType === 'InvoiceFunded');
    expect(funded?.label).toBe('Invoice Funded');
    expect(funded?.icon).toBe('payments');
    expect(funded?.amount).toBe('100');
    expect(funded?.token).toBe('USDC');
    expect(funded?.invoiceId).toBe('42');
  });

  it('labels settled events as Invoice Settled', () => {
    const items = buildProtocolFeedItems(events, invoices, 10);
    expect(items[0]?.label).toBe('Invoice Settled');
  });
});

describe('formatFeedAmountValue', () => {
  it('formats token amounts without symbol suffix', () => {
    expect(formatFeedAmountValue(100_000_000n, 6)).toBe('100');
  });
});
