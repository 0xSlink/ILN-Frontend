import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FundingChart from '../FundingChart';
import DefaultRateChart from '../DefaultRateChart';
import { proxySuccessEnvelope } from '@/mocks/fixtures/indexer';

const originalFetch = global.fetch;

function envelope(resource: string, data: unknown[]) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      resource,
      data,
      meta: {
        apiVersion: '1.0.0',
        droppedRecords: 0,
        freshness: { lastIndexedLedger: null, lastIndexedAt: null, staleAfterMs: 300_000 },
      },
    }),
  };
}

function errorEnvelope(code: string, message: string, status = 502) {
  return { ok: false, status, json: async () => ({ ok: false, error: { code, message } }) };
}

const fundingBucket = {
  date: '2026-11-01',
  label: 'Nov 1',
  total_usdc_equiv: 1000,
  invoices_funded: 1,
  tokens: [{ symbol: 'USDC', amount: 1000, color: '#008080' }],
};

const fetchMock = () => global.fetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('FundingChart', () => {
  it('requests funding through the proxy and refetches when the range changes', async () => {
    fetchMock().mockResolvedValue(envelope('analytics.funding', []));
    render(<FundingChart />);

    await screen.findByText('No funding activity in this period');
    expect(fetchMock().mock.calls[0][0]).toBe('/api/indexer/analytics/funding?period=30d');

    fireEvent.click(screen.getByRole('button', { name: '7D' }));
    await waitFor(() =>
      expect(fetchMock().mock.calls.at(-1)?.[0]).toBe('/api/indexer/analytics/funding?period=7d')
    );
  });

  it('shows a typed failure instead of generated funding data', async () => {
    fetchMock().mockResolvedValue(
      errorEnvelope('unauthorized', 'The indexer rejected the server credentials.')
    );
    render(<FundingChart />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'indexer-notice-unauthorized');
    expect(alert).toHaveTextContent('The indexer rejected the server credentials.');
    // Credential failures are never retried automatically.
    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('No funding activity in this period')).not.toBeInTheDocument();
    expect(screen.queryByText(/Total Funding/)).not.toBeInTheDocument();
  });

  it('ignores an aborted funding request instead of showing an outage', async () => {
    const aborted = new Error('The operation was aborted');
    aborted.name = 'AbortError';
    fetchMock().mockRejectedValue(aborted);
    const { container } = render(<FundingChart />);

    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('No funding activity in this period')).toBeInTheDocument();
  });

  it('rejects a malformed funding bucket instead of rendering estimated volume', async () => {
    fetchMock().mockResolvedValue(
      envelope('analytics.funding', [{ date: 42, label: 'Bad bucket', tokens: 'USDC' }])
    );
    render(<FundingChart />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'indexer-notice-malformed');
    expect(screen.queryByText(/Total Funding/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('funding-sample-data')).not.toBeInTheDocument();
    expect(fetchMock().mock.calls[0][0]).toBe('/api/indexer/analytics/funding?period=30d');
  });

  it('labels stale indexer history with the last indexed ledger and time', async () => {
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () =>
        proxySuccessEnvelope('analytics.funding', [fundingBucket], {
          freshness: {
            lastIndexedLedger: 51200000,
            lastIndexedAt: '2025-01-01T00:00:00.000Z',
            staleAfterMs: 300_000,
          },
        }),
    });
    render(<FundingChart />);

    const notice = await screen.findByTestId('funding-stale-history');
    expect(notice).toHaveTextContent('last indexed ledger 51200000');
    expect(notice).toHaveTextContent('2025-01-01T00:00:00.000Z');
    expect(screen.getByTestId('data-source-caption')).toHaveTextContent('Provenance: Indexer');
  });

  it('does not flag fresh indexer history as stale', async () => {
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () =>
        proxySuccessEnvelope('analytics.funding', [fundingBucket], {
          freshness: {
            lastIndexedLedger: 51234567,
            lastIndexedAt: new Date().toISOString(),
            staleAfterMs: 300_000,
          },
        }),
    });
    const { container } = render(<FundingChart />);

    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeInTheDocument());
    expect(screen.queryByTestId('funding-stale-history')).not.toBeInTheDocument();
  });

  it('explains an indexer API version mismatch without retrying it', async () => {
    fetchMock().mockResolvedValue(
      errorEnvelope(
        'version_mismatch',
        'The indexer API version 2.0.0 is not supported. This app requires 1.x (>= 1.0).'
      )
    );
    render(<FundingChart />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'indexer-notice-malformed');
    expect(alert).toHaveTextContent('The indexer API version 2.0.0 is not supported.');
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
});

describe('DefaultRateChart', () => {
  it('renders summary tiles from indexer data', async () => {
    fetchMock().mockResolvedValue(
      envelope('analytics.defaults', [
        { date: '2026-08', label: 'Aug 2026', defaulted: 1, funded: 10, defaultRate: 10 },
        { date: '2026-09', label: 'Sep 2026', defaulted: 1, funded: 20, defaultRate: 5 },
      ])
    );
    render(<DefaultRateChart />);

    expect(await screen.findByText('5.00%')).toBeInTheDocument();
    expect(screen.getByText('6.67%')).toBeInTheDocument();
    expect(screen.getByText('↓')).toBeInTheDocument();
    expect(fetchMock().mock.calls[0][0]).toBe('/api/indexer/analytics/defaults?period=12m');
  });

  it('shows placeholders, not zero rates or mock data, when the indexer times out', async () => {
    fetchMock().mockResolvedValue(
      errorEnvelope('timeout', 'The indexer took too long to respond.', 504)
    );
    render(<DefaultRateChart />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-testid', 'indexer-notice-unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('0.00%')).not.toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(2);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
