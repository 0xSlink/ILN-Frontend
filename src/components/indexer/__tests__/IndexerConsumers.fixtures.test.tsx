/**
 * Every indexer-backed view × the fixture catalogue: typed errors render an
 * accessible failure (retry only when retrying can help), malformed proxy
 * envelopes are treated as schema errors, and stale data is flagged.
 * No view may fall back to generated data.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityFeed from '@/components/ActivityFeed';
import DefaultRateChart from '@/components/charts/DefaultRateChart';
import FundingChart from '@/components/charts/FundingChart';
import {
  freshnessFixtures,
  malformedProxyEnvelopes,
  proxyErrorEnvelope,
  proxySuccessEnvelope,
} from '@/mocks/fixtures/indexer';
import {
  INDEXER_ERROR_STATUS,
  isRetryableIndexerError,
  type IndexerErrorCode,
} from '@/lib/indexer/errors';
import type { IndexerResourceName } from '@/lib/indexer/types';

const CONSUMERS: Array<{
  name: string;
  resource: IndexerResourceName;
  element: React.ReactElement;
}> = [
  { name: 'ActivityFeed', resource: 'invoice.events', element: <ActivityFeed invoiceId={7n} /> },
  { name: 'FundingChart', resource: 'analytics.funding', element: <FundingChart /> },
  { name: 'DefaultRateChart', resource: 'analytics.defaults', element: <DefaultRateChart /> },
];

const ERROR_CODES = Object.keys(INDEXER_ERROR_STATUS) as IndexerErrorCode[];

const originalFetch = global.fetch;

function respondWith(body: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

let randomSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  randomSpy = vi.spyOn(Math, 'random');
});

afterEach(() => {
  // No consumer may fabricate data with Math.random on any path.
  expect(randomSpy).not.toHaveBeenCalled();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe.each(CONSUMERS)('$name', ({ resource, element }) => {
  it.each(ERROR_CODES)('renders the %s failure accessibly', async (code) => {
    respondWith(
      proxyErrorEnvelope(code, `Fixture message for ${code}.`),
      INDEXER_ERROR_STATUS[code]
    );
    render(element);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveAttribute('data-error-code', code);
    expect(alert).toHaveTextContent(`Fixture message for ${code}.`);

    const retry = screen.queryByRole('button', { name: 'Retry' });
    if (isRetryableIndexerError(code)) expect(retry).toBeInTheDocument();
    else expect(retry).not.toBeInTheDocument();
  });

  it.each(malformedProxyEnvelopes.map((f) => [f.name, f.body] as const))(
    'treats a malformed proxy envelope (%s) as a schema error',
    async (_name, body) => {
      respondWith(body);
      render(element);
      expect(await screen.findByRole('alert')).toHaveAttribute('data-error-code', 'schema');
    }
  );

  it('rejects an envelope for a different resource', async () => {
    const other: IndexerResourceName =
      resource === 'leaderboard' ? 'invoice.events' : 'leaderboard';
    respondWith(proxySuccessEnvelope(other, []));
    render(element);
    expect(await screen.findByRole('alert')).toHaveAttribute('data-error-code', 'schema');
  });

  it('flags stale data', async () => {
    respondWith(proxySuccessEnvelope(resource, [], { freshness: freshnessFixtures.stale }));
    render(element);
    const badge = await screen.findByText(/Data may be out of date/);
    expect(badge.closest('[data-freshness]')).toHaveAttribute('data-freshness', 'stale');
  });

  it('labels unknown freshness rather than implying live data', async () => {
    respondWith(proxySuccessEnvelope(resource, [], { freshness: freshnessFixtures.unknown }));
    render(element);
    expect(await screen.findByText('Indexer freshness unknown')).toBeInTheDocument();
  });

  it('discloses dropped partial records', async () => {
    respondWith(proxySuccessEnvelope(resource, [], { droppedRecords: 3 }));
    render(element);
    expect(
      await screen.findByText(/3 records from the indexer could not be displayed/)
    ).toBeInTheDocument();
  });
});
