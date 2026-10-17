// @vitest-environment node

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair, Networks, TransactionBuilder, WebAuth } from '@stellar/stellar-sdk';
import {
  __resetSep10State,
  authenticatedFetch,
  authenticateWithSep10,
  Sep10Error,
  type AuthenticateSep10Options,
} from '../sep10';

const NETWORK = Networks.TESTNET;
let serverKey: Keypair;
let walletKey: Keypair;
let challenge: string;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function jwt(exp: number, subject = walletKey.publicKey()): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp, sub: subject })}.signature`;
}

function response(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validChallenge(homeDomain = 'example.com'): string {
  return WebAuth.buildChallengeTx(
    serverKey,
    walletKey.publicKey(),
    homeDomain,
    300,
    NETWORK,
    'auth.example.com'
  );
}

function createFetchMock(options?: {
  challenge?: string;
  challengeStatus?: number;
  token?: string;
}) {
  const servedChallenge = options?.challenge ?? challenge;
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(input.toString());
    if (url.pathname === '/.well-known/stellar.toml') {
      return new Response(
        `SIGNING_KEY = "${serverKey.publicKey()}"\nWEB_AUTH_ENDPOINT = "https://auth.example.com/auth"`,
        { status: 200 }
      );
    }
    if (init?.method === 'POST') {
      const body = new URLSearchParams(String(init.body));
      const signedXdr = body.get('transaction') ?? '';
      expect(() =>
        WebAuth.verifyChallengeTxSigners(
          signedXdr,
          serverKey.publicKey(),
          NETWORK,
          [walletKey.publicKey()],
          'example.com',
          'auth.example.com'
        )
      ).not.toThrow();
      return response({ token: options?.token ?? jwt(Math.floor(Date.now() / 1_000) + 300) });
    }
    if (options?.challengeStatus) return response({}, options.challengeStatus);
    return response({ transaction: servedChallenge });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function authOptions(overrides: Partial<AuthenticateSep10Options> = {}): AuthenticateSep10Options {
  return {
    address: walletKey.publicKey(),
    homeDomain: 'example.com',
    network: 'TESTNET',
    networkPassphrase: NETWORK,
    signTransaction: async (transactionXdr) => {
      const signed = TransactionBuilder.fromXDR(transactionXdr, NETWORK);
      signed.sign(walletKey);
      return signed.toXDR();
    },
    assertWalletIdentity: async () => {},
    ...overrides,
  };
}

function testSession(token: string, expiresAt: number) {
  return {
    token,
    address: walletKey.publicKey(),
    domain: 'example.com',
    authOrigin: 'https://auth.example.com',
    network: 'TESTNET',
    expiresAt,
  };
}

beforeEach(() => {
  __resetSep10State();
  serverKey = Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(1));
  walletKey = Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(2));
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('authenticateWithSep10', () => {
  it('validates the domain-bound challenge, signs it, and exchanges it for an expiring token', async () => {
    challenge = validChallenge();
    createFetchMock();
    const diagnostics = vi.fn();

    const session = await authenticateWithSep10(authOptions({ onDiagnostics: diagnostics }));

    expect(session.domain).toBe('example.com');
    expect(session.network).toBe('TESTNET');
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(new URL(fetchMock.mock.calls[1][0].toString()).searchParams.get('account')).toBe(
      walletKey.publicKey()
    );
    expect(fetchMock.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    );
    expect(diagnostics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        domain: 'example.com',
        network: 'TESTNET',
        serverHealth: 'available',
      })
    );
  });

  it('deduplicates concurrent authentication attempts for the same wallet and network', async () => {
    challenge = validChallenge();
    createFetchMock();
    const signTransaction = vi.fn(authOptions().signTransaction);
    const options = authOptions({ signTransaction });

    const [first, second] = await Promise.all([
      authenticateWithSep10(options),
      authenticateWithSep10(options),
    ]);

    expect(first).toEqual(second);
    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects a challenge bound to the wrong home domain', async () => {
    challenge = validChallenge('attacker.example.net');
    createFetchMock();

    await expect(authenticateWithSep10(authOptions())).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an expired challenge without asking the wallet to sign', async () => {
    const now = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now - 3_600_000);
    challenge = validChallenge();
    dateSpy.mockRestore();
    createFetchMock();
    const signTransaction = vi.fn(async (transactionXdr: string) => transactionXdr);

    await expect(authenticateWithSep10(authOptions({ signTransaction }))).rejects.toMatchObject({
      code: 'CHALLENGE_EXPIRED',
    });
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it('rejects a challenge transaction replayed by the server', async () => {
    challenge = validChallenge();
    createFetchMock();

    await authenticateWithSep10(authOptions());
    await expect(authenticateWithSep10(authOptions())).rejects.toMatchObject({
      code: 'CHALLENGE_REPLAYED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('exposes wallet cancellation as a recoverable signing rejection', async () => {
    challenge = validChallenge();
    createFetchMock();

    await expect(
      authenticateWithSep10(
        authOptions({
          signTransaction: async () => {
            throw new Error('User declined');
          },
        })
      )
    ).rejects.toMatchObject({ code: 'SIGNING_REJECTED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops before token exchange if wallet identity changes during signing', async () => {
    challenge = validChallenge();
    createFetchMock();
    const assertWalletIdentity = vi
      .fn<AuthenticateSep10Options['assertWalletIdentity']>()
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(
        new Sep10Error('IDENTITY_CHANGED', 'The connected wallet changed during authentication.')
      );

    await expect(
      authenticateWithSep10(authOptions({ assertWalletIdentity }))
    ).rejects.toMatchObject({ code: 'IDENTITY_CHANGED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, 'HTTP_UNAUTHORIZED'],
    [403, 'HTTP_FORBIDDEN'],
  ])('distinguishes backend HTTP %i rejection', async (status, code) => {
    challenge = validChallenge();
    createFetchMock({ challengeStatus: status });

    await expect(authenticateWithSep10(authOptions())).rejects.toMatchObject({ code });
  });

  it('rejects a malformed authentication token response', async () => {
    challenge = validChallenge();
    createFetchMock({ token: 'not-a-jwt' });

    await expect(authenticateWithSep10(authOptions())).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects an expired token response', async () => {
    challenge = validChallenge();
    createFetchMock({ token: jwt(Math.floor(Date.now() / 1_000) - 1) });

    await expect(authenticateWithSep10(authOptions())).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('rejects a token issued for a different wallet', async () => {
    challenge = validChallenge();
    createFetchMock({
      token: jwt(Math.floor(Date.now() / 1_000) + 300, serverKey.publicKey()),
    });

    await expect(authenticateWithSep10(authOptions())).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });
});

describe('authenticatedFetch', () => {
  it('sends the token as a bearer credential', async () => {
    const requestFetch = vi.fn<typeof fetch>().mockResolvedValue(response({ ok: true }));

    await authenticatedFetch(
      'https://auth.example.com/private',
      testSession('valid.jwt.token', Date.now() + 60_000),
      undefined,
      requestFetch
    );

    const sentRequest = requestFetch.mock.calls[0][0] as Request;
    expect(sentRequest.headers.get('Authorization')).toBe('Bearer valid.jwt.token');
  });

  it('preserves request method, body, and headers when adding bearer auth', async () => {
    const requestFetch = vi.fn<typeof fetch>().mockResolvedValue(response({ ok: true }));
    const request = new Request('https://auth.example.com/private', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'request-1' },
      body: JSON.stringify({ action: 'read' }),
    });

    await authenticatedFetch(
      request,
      testSession('valid.jwt.token', Date.now() + 60_000),
      undefined,
      requestFetch
    );

    const sentRequest = requestFetch.mock.calls[0][0] as Request;
    expect(sentRequest.method).toBe('POST');
    expect(sentRequest.headers.get('X-Request-Id')).toBe('request-1');
    expect(await sentRequest.json()).toEqual({ action: 'read' });
  });

  it.each([
    [401, 'HTTP_UNAUTHORIZED'],
    [403, 'HTTP_FORBIDDEN'],
  ])('reports HTTP %i as a distinct recoverable rejection', async (status, code) => {
    const requestFetch = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));

    await expect(
      authenticatedFetch(
        'https://auth.example.com/private',
        testSession('valid.jwt.token', Date.now() + 60_000),
        undefined,
        requestFetch
      )
    ).rejects.toMatchObject({ code });
  });

  it('does not make a request with an expired token', async () => {
    const requestFetch = vi.fn<typeof fetch>();

    await expect(
      authenticatedFetch(
        'https://auth.example.com/private',
        testSession('expired.jwt.token', Date.now() - 1),
        undefined,
        requestFetch
      )
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(requestFetch).not.toHaveBeenCalled();
  });

  it('refuses to send bearer credentials outside the configured domain', async () => {
    const requestFetch = vi.fn<typeof fetch>();

    await expect(
      authenticatedFetch(
        'https://attacker.example.net/private',
        testSession('valid.jwt.token', Date.now() + 60_000),
        undefined,
        requestFetch
      )
    ).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(requestFetch).not.toHaveBeenCalled();
  });
});
