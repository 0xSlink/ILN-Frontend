import { describe, expect, it, vi } from 'vitest';
import {
  REDACTED_INVOICE,
  REDACTED_PII,
  REDACTED_SECRET,
  REDACTED_TX,
  REDACTED_WALLET,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubSensitiveString,
  scrubSensitiveValue,
} from '@/lib/sentry-scrubbing';

const mockInit = vi.fn();
const mockBrowserTracingIntegration = vi.fn(() => ({ name: 'BrowserTracing' }));
const mockBrowserApiErrorsIntegration = vi.fn(() => ({ name: 'BrowserApiErrors' }));

vi.mock('@sentry/nextjs', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  browserTracingIntegration: () => mockBrowserTracingIntegration(),
  browserApiErrorsIntegration: () => mockBrowserApiErrorsIntegration(),
}));

const { sentryClientConfig } = await import('../../sentry.client.config');

const SAMPLE_WALLET = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const SAMPLE_CONTRACT = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const SAMPLE_SECRET_SEED = 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const SAMPLE_XDR = 'AAAAAgAAAABfY2VydGlmaWNhdGVfdHhfcGF5bG9hZF9leGFtcGxlX2Jhc2U2NA==';
const SAMPLE_TX_HASH = 'a3f4e2b910c84d56f7e8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0';

describe('Sentry client configuration and data scrubbing', () => {
  it('initializes Sentry with sendDefaultPii disabled and scrubbing hooks registered', () => {
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(sentryClientConfig.sendDefaultPii).toBe(false);
    expect(typeof sentryClientConfig.beforeSend).toBe('function');
    expect(typeof sentryClientConfig.beforeBreadcrumb).toBe('function');
  });

  it('scrubs wallet addresses, invoice IDs, tx payloads, secrets, and PII', () => {
    const rawEvent = {
      message: [
        `Signing failed for invoice #INV-9021 from ${SAMPLE_WALLET}`,
        `(alice@example.com) tx ${SAMPLE_TX_HASH}`,
      ].join(' '),
      transaction: '/pay/9021',
      user: {
        id: SAMPLE_WALLET,
        email: 'alice@example.com',
        ip_address: '192.168.1.42',
        username: 'alice_freelancer',
      },
      request: {
        url: [
          `https://iln.app/pay/9021?wallet=${SAMPLE_WALLET}`,
          '&invoiceId=9021&email=alice@example.com',
        ].join(''),
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123',
          Cookie: 'session=secret-cookie-value',
          'Content-Type': 'application/json',
        },
        data: {
          signedTxXdr: SAMPLE_XDR,
          payerAddress: SAMPLE_WALLET,
          contractAddress: SAMPLE_CONTRACT,
          invoice_id: '9021',
          phoneNumber: '+1 (555) 234-5678',
        },
      },
      tags: {
        deployment_url: 'https://iln.vercel.app',
        walletAddress: SAMPLE_WALLET,
        invoiceId: 'INV-9021',
      },
      extra: {
        transactionPayload: SAMPLE_XDR,
        secretSeed: SAMPLE_SECRET_SEED,
        notes: `Contact alice@example.com or +1 555-867-5309 for ${SAMPLE_CONTRACT}`,
        httpStatus: 502,
      },
      exception: {
        values: [
          {
            type: 'TransactionSigningError',
            value: `Rejected XDR ${SAMPLE_XDR} for /i/4412`,
          },
        ],
      },
      breadcrumbs: [
        {
          category: 'fetch',
          message: `POST /api/notifications/${SAMPLE_WALLET}`,
          data: {
            url: `https://iln.app/i/4412?xdr=${SAMPLE_XDR}`,
            invoiceId: '4412',
          },
        },
      ],
    };

    const scrubbed = sentryClientConfig.beforeSend!(rawEvent as any, {} as any) as any;
    const serialized = JSON.stringify(scrubbed);

    expect(serialized).not.toContain(SAMPLE_WALLET);
    expect(serialized).not.toContain(SAMPLE_CONTRACT);
    expect(serialized).not.toContain(SAMPLE_SECRET_SEED);
    expect(serialized).not.toContain(SAMPLE_XDR);
    expect(serialized).not.toContain(SAMPLE_TX_HASH);
    expect(serialized).not.toContain('alice@example.com');
    expect(serialized).not.toContain('192.168.1.42');
    expect(serialized).not.toContain('alice_freelancer');
    expect(serialized).not.toContain('secret-cookie-value');
    expect(serialized).not.toContain('555-867-5309');
    expect(serialized).not.toContain('INV-9021');
    expect(serialized).not.toContain('/pay/9021');
    expect(serialized).not.toContain('/i/4412');

    expect(scrubbed.user.email).toBe(REDACTED_PII);
    expect(scrubbed.user.ip_address).toBe(REDACTED_PII);
    expect(scrubbed.request.headers.Authorization).toBe(REDACTED_SECRET);
    expect(scrubbed.request.headers.Cookie).toBe(REDACTED_SECRET);
    expect(scrubbed.request.data.signedTxXdr).toBe(REDACTED_TX);
    expect(scrubbed.request.data.payerAddress).toBe(REDACTED_WALLET);
    expect(scrubbed.request.data.invoice_id).toBe(REDACTED_INVOICE);
    expect(scrubbed.tags.walletAddress).toBe(REDACTED_WALLET);
    expect(scrubbed.tags.invoiceId).toBe(REDACTED_INVOICE);

    // Non-sensitive diagnostic context remains intact for incident triage.
    expect(scrubbed.tags.deployment_url).toBe('https://iln.vercel.app');
    expect(scrubbed.extra.httpStatus).toBe(502);
    expect(scrubbed.exception.values[0].type).toBe('TransactionSigningError');
  });

  it('preserves static non-ID routes while redacting dynamic invoice paths', () => {
    expect(scrubSensitiveString('Navigated to /invoices/batch')).toBe(
      'Navigated to /invoices/batch'
    );
    expect(scrubSensitiveString('Navigated to /invoices/inv_88')).toBe(
      `Navigated to /invoices/${REDACTED_INVOICE}`
    );
    expect(scrubSensitiveString('Navigated to /pay/77')).toBe(
      `Navigated to /pay/${REDACTED_INVOICE}`
    );
  });

  it('scrubs sensitive breadcrumb URLs and payloads via beforeBreadcrumb', () => {
    const crumb = {
      category: 'xhr',
      message: `GET /i/555 for ${SAMPLE_WALLET}`,
      data: {
        url: `https://iln.app/pay/555?token=secret123`,
        txHash: SAMPLE_TX_HASH,
      },
    };

    const scrubbed = sentryClientConfig.beforeBreadcrumb!(crumb as any, {} as any) as any;
    expect(scrubbed.message).toBe(`GET /i/${REDACTED_INVOICE} for ${REDACTED_WALLET}`);
    expect(scrubbed.data.url).toBe(
      `https://iln.app/pay/${REDACTED_INVOICE}?token=${REDACTED_SECRET}`
    );
    expect(scrubbed.data.txHash).toBe(REDACTED_TX);
  });

  it('handles circular references, deep nesting, and null fields safely without throwing', () => {
    const circular: Record<string, unknown> = { wallet: SAMPLE_WALLET };
    circular.self = circular;

    const scrubbedCircular = scrubSensitiveValue(circular) as Record<string, unknown>;
    expect(scrubbedCircular.wallet).toBe(REDACTED_WALLET);
    expect(scrubbedCircular.self).toBe('[Circular]');

    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 15; i += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => scrubSensitiveValue(deep)).not.toThrow();

    expect(() =>
      scrubSentryEvent({ message: undefined, extra: null, breadcrumbs: [null] })
    ).not.toThrow();
    expect(() => scrubSentryBreadcrumb({ message: undefined, data: null })).not.toThrow();
  });
});
