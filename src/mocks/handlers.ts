import { http, HttpResponse } from 'msw';
import { contractReadFixtures } from './fixtures/contract';

const horizonAccount = {
  id: 'GTESTACCOUNT',
  account_id: 'GTESTACCOUNT',
  balances: [
    {
      asset_type: 'native',
      balance: '25.0000000',
    },
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      balance: '1000.0000000',
    },
  ],
};

function indexerEnvelope(resource: string, data: unknown[]) {
  return {
    ok: true,
    resource,
    data,
    meta: {
      apiVersion: '1.0.0',
      droppedRecords: 0,
      freshness: { lastIndexedLedger: null, lastIndexedAt: null, staleAfterMs: 300_000 },
    },
  };
}

function stellarRpcResponse(method: string) {
  if (method === 'getHealth') {
    return { status: 'healthy' };
  }

  if (method === 'getAccount') {
    return {
      accountId: 'GTESTACCOUNT',
      sequenceNumber: '1',
    };
  }

  if (method === 'sendTransaction') {
    return {
      status: 'PENDING',
      hash: 'mocked-transaction-hash',
    };
  }

  if (method === 'simulateTransaction') {
    return {
      transactionData: 'AAAA',
      minResourceFee: '100',
      events: [],
      results: [
        {
          auth: [],
          xdr: 'AAAA',
        },
      ],
      fixture: contractReadFixtures,
    };
  }

  return { ok: true };
}

export const handlers = [
  http.get('/api/indexer/leaderboard', () => {
    return HttpResponse.json(indexerEnvelope('leaderboard', []));
  }),

  http.get('/api/indexer/analytics/defaults', () => {
    return HttpResponse.json(indexerEnvelope('analytics.defaults', []));
  }),

  http.get('/api/indexer/analytics/funding', () => {
    return HttpResponse.json(indexerEnvelope('analytics.funding', []));
  }),

  http.get('/api/indexer/invoices/:invoiceId/events', () => {
    return HttpResponse.json(indexerEnvelope('invoice.events', []));
  }),

  http.get('/api/notifications/:address', () => {
    return HttpResponse.json([]);
  }),

  http.get('https://horizon-testnet.stellar.org/accounts/:accountId', () => {
    return HttpResponse.json(horizonAccount);
  }),

  http.get('https://horizon.stellar.org/accounts/:accountId', () => {
    return HttpResponse.json(horizonAccount);
  }),

  http.get('https://horizon-testnet.stellar.org/transactions', () => {
    return HttpResponse.json({
      _embedded: { records: [] },
    });
  }),

  http.post('https://horizon-testnet.stellar.org/transactions', () => {
    return HttpResponse.json({
      successful: true,
      hash: 'mocked-horizon-transaction',
      ledger: 123456,
    });
  }),

  http.get('https://friendbot.stellar.org', () => {
    return HttpResponse.json({
      successful: true,
      hash: 'mocked-friendbot-transaction',
    });
  }),

  http.get('https://api.coingecko.com/api/v3/simple/price', ({ request }) => {
    const ids = new URL(request.url).searchParams.get('ids') ?? 'usd-coin';
    const prices = ids.split(',').reduce<Record<string, { usd: number }>>((acc, id) => {
      acc[id] = { usd: id === 'stellar' ? 0.12 : id === 'euro-coin' ? 1.08 : 1 };
      return acc;
    }, {});

    return HttpResponse.json(prices);
  }),

  http.post('https://soroban-testnet.stellar.org', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const method = typeof body.method === 'string' ? body.method : 'unknown';

    return HttpResponse.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: stellarRpcResponse(method),
    });
  }),
];
