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
  http.get('/api/leaderboard', () => {
    return HttpResponse.json([]);
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

  // ActivityFeed fetches this on mount (defaults to https://api.iln.example.com
  // when NEXT_PUBLIC_INDEXER_API_URL is unset). Without a handler the request
  // escapes to a real network call that resolves after the test's jsdom
  // environment has already been torn down, crashing with "window is not
  // defined" from the resulting setState call.
  http.get('https://api.iln.example.com/invoice/:invoiceId/events', () => {
    return HttpResponse.json([]);
  }),
];
