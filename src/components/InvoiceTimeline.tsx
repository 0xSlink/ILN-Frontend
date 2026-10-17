'use client';

import { useMemo, useState, useCallback } from 'react';
import { Invoice } from '@/utils/soroban';
import { formatAddress, formatDate, formatUSDC } from '@/utils/format';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import Link from 'next/link';

interface InvoiceTimelineProps {
  invoices: Invoice[];
  loading: boolean;
  explorerBaseUrl?: string;
}

type DateMarker = 'Today' | 'Yesterday' | 'This week' | 'Last month' | 'Older';

const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer/testnet/tx/';

function getStatusIcon(status: string): string {
  switch (status) {
    case 'Paid':
      return 'check_circle';
    case 'Funded':
      return 'payments';
    case 'Defaulted':
      return 'warning';
    case 'Disputed':
      return 'gavel';
    default:
      return 'description';
  }
}

function getStatusLabel(invoice: Invoice): string {
  switch (invoice.status) {
    case 'Pending':
      return 'Submitted for funding';
    case 'Funded':
      return invoice.funded_at ? `Funded on ${formatDate(invoice.funded_at)}` : 'Funded recently';
    case 'Paid':
      return 'Settled in full';
    case 'Defaulted':
      return 'Defaulted — escalated';
    case 'Disputed':
      return 'Under dispute';
    default:
      return invoice.status;
  }
}

interface DetailPanelProps {
  invoice: Invoice;
  explorerBaseUrl: string;
  onClose: () => void;
}

function DetailPanel({ invoice, explorerBaseUrl, onClose }: DetailPanelProps) {
  const txHash = (invoice as Invoice & { tx_hash?: string }).tx_hash;

  return (
    <div
      className="mt-2 rounded-2xl border border-primary/20 bg-surface-container-low p-5 shadow-md"
      role="region"
      aria-label={`Details for invoice #${invoice.id.toString()}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-bold text-foreground">Invoice #{invoice.id.toString()} — Details</h4>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Amount
          </dt>
          <dd className="font-bold text-foreground">{formatUSDC(invoice.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Discount Rate
          </dt>
          <dd className="font-bold text-foreground">{(invoice.discount_rate / 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Payer
          </dt>
          <dd>
            <Link
              href={`/profile/${invoice.payer}`}
              className="font-mono text-primary hover:underline"
            >
              {formatAddress(invoice.payer)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Due Date
          </dt>
          <dd className="text-on-surface">{formatDate(invoice.due_date)}</dd>
        </div>
        {invoice.funded_at && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Funded At
            </dt>
            <dd className="text-on-surface">{formatDate(invoice.funded_at)}</dd>
          </div>
        )}
        {invoice.funder && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Funder
            </dt>
            <dd>
              <Link
                href={`/profile/${invoice.funder}`}
                className="font-mono text-primary hover:underline"
              >
                {formatAddress(invoice.funder)}
              </Link>
            </dd>
          </div>
        )}
      </dl>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant/10 pt-4">
        <Link
          href={`/i/${invoice.id.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-surface-container-lowest transition-colors hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-xs" aria-hidden="true">
            open_in_new
          </span>
          View Invoice
        </Link>

        {txHash && (
          <a
            href={`${explorerBaseUrl}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-xs" aria-hidden="true">
              travel_explore
            </span>
            Explorer
          </a>
        )}

        {invoice.status === 'Funded' && (
          <Link
            href={`/pay/${invoice.id.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-xs" aria-hidden="true">
              paid
            </span>
            Mark as Paid
          </Link>
        )}

        {invoice.status === 'Funded' && (
          <button
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent('iln:open-dispute', {
                  detail: { invoiceId: invoice.id.toString() },
                })
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-xs" aria-hidden="true">
              gavel
            </span>
            Dispute
          </button>
        )}
      </div>
    </div>
  );
}

export default function InvoiceTimeline({
  invoices,
  loading,
  explorerBaseUrl = STELLAR_EXPERT_BASE,
}: InvoiceTimelineProps) {
  const [pageSize, setPageSize] = useState(20);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const groupedInvoices = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => Number(b.id - a.id));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const thisWeek = today - 86400000 * 7;
    const lastMonth = today - 86400000 * 30;

    const groups: Record<DateMarker, Invoice[]> = {
      Today: [],
      Yesterday: [],
      'This week': [],
      'Last month': [],
      Older: [],
    };

    sorted.forEach((invoice) => {
      const date = Number(invoice.funded_at ?? invoice.due_date - 2592000n) * 1000;

      if (date >= today) groups.Today.push(invoice);
      else if (date >= yesterday) groups.Yesterday.push(invoice);
      else if (date >= thisWeek) groups['This week'].push(invoice);
      else if (date >= lastMonth) groups['Last month'].push(invoice);
      else groups.Older.push(invoice);
    });

    return (Object.entries(groups) as [DateMarker, Invoice[]][])
      .filter(([, invs]) => invs.length > 0)
      .map(([marker, invs]) => ({ marker, invoices: invs }));
  }, [invoices]);

  const flattenedEvents = useMemo(
    () =>
      groupedInvoices.flatMap((g) => g.invoices.map((inv) => ({ marker: g.marker, invoice: inv }))),
    [groupedInvoices]
  );

  const displayedEvents = flattenedEvents.slice(0, pageSize);
  const hasMore = flattenedEvents.length > pageSize;

  if (loading && invoices.length === 0) {
    return <div className="py-14 text-center text-on-surface-variant">Loading timeline...</div>;
  }

  if (invoices.length === 0) {
    return (
      <div className="py-14 text-center text-on-surface-variant">No invoice activity found.</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant/30 before:to-transparent md:before:mx-auto md:before:translate-x-0">
        {displayedEvents.map((event, index) => {
          const isFirstInMarker = index === 0 || displayedEvents[index - 1].marker !== event.marker;
          const { invoice } = event;
          const idStr = invoice.id.toString();
          const isExpanded = expandedId === idStr;

          return (
            <div
              key={idStr}
              className="group relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse"
            >
              {/* Dot */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary shadow md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {getStatusIcon(invoice.status)}
                </span>
              </div>

              {/* Card */}
              <div className="w-[calc(100%-4rem)] md:w-[45%]">
                <button
                  onClick={() => toggleExpand(idStr)}
                  aria-expanded={isExpanded}
                  aria-controls={`timeline-detail-${idStr}`}
                  className="w-full rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 text-left shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <time className="font-headline text-xs font-bold uppercase tracking-wider text-primary">
                      {isFirstInMarker ? event.marker : formatDate(invoice.due_date)}
                    </time>
                    <div className="flex items-center gap-2">
                      <InvoiceStatusBadge status={invoice.status} />
                      <span
                        className={`material-symbols-outlined text-sm text-on-surface-variant transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  <div className="mb-1 text-lg font-bold text-on-surface">
                    {formatUSDC(invoice.amount)}
                  </div>

                  <div className="mb-2 text-sm text-on-surface-variant">
                    Payer:{' '}
                    <span className="font-mono text-primary">{formatAddress(invoice.payer)}</span>
                  </div>

                  <div className="flex items-center gap-2 border-t border-outline-variant/10 pt-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      event
                    </span>
                    <span>{getStatusLabel(invoice)}</span>
                  </div>
                </button>

                {/* Expandable detail panel */}
                {isExpanded && (
                  <div id={`timeline-detail-${idStr}`}>
                    <DetailPanel
                      invoice={invoice}
                      explorerBaseUrl={explorerBaseUrl}
                      onClose={() => setExpandedId(null)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-12 text-center">
          <button
            onClick={() => setPageSize((prev) => prev + 20)}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-6 py-3 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
