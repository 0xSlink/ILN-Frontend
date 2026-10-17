import { WebAuth } from '@stellar/stellar-sdk';

export type Sep10ErrorCode =
  | 'AUTH_REQUIRED'
  | 'CONFIGURATION'
  | 'CHALLENGE_INVALID'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_REPLAYED'
  | 'CHALLENGE_LIMIT'
  | 'SIGNING_REJECTED'
  | 'IDENTITY_CHANGED'
  | 'NETWORK_MISMATCH'
  | 'INVALID_TOKEN'
  | 'HTTP_UNAUTHORIZED'
  | 'HTTP_FORBIDDEN'
  | 'HTTP_FAILURE'
  | 'SERVER_UNAVAILABLE';

export type Sep10ServerHealth = 'unknown' | 'available' | 'unavailable';

export interface Sep10Diagnostics {
  domain: string | null;
  network: string;
  expiresAt: number | null;
  serverHealth: Sep10ServerHealth;
}

export interface Sep10Session {
  token: string;
  address: string;
  domain: string;
  authOrigin: string;
  network: string;
  expiresAt: number;
}

export interface Sep10ErrorOptions {
  diagnostics?: Sep10Diagnostics;
  cause?: unknown;
}

export class Sep10Error extends Error {
  readonly code: Sep10ErrorCode;
  readonly diagnostics?: Sep10Diagnostics;

  constructor(code: Sep10ErrorCode, message: string, options: Sep10ErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'Sep10Error';
    this.code = code;
    this.diagnostics = options.diagnostics;
  }
}

export interface AuthenticateSep10Options {
  address: string;
  homeDomain: string;
  network: string;
  networkPassphrase: string;
  signTransaction: (transactionXdr: string) => Promise<string>;
  assertWalletIdentity: () => Promise<void>;
  fetcher?: typeof fetch;
  onDiagnostics?: (diagnostics: Sep10Diagnostics) => void;
}

type StellarToml = {
  signingKey: string;
  webAuthEndpoint: URL;
  webAuthDomain: string;
};

const inFlight = new Map<string, Promise<Sep10Session>>();
const usedChallenges = new Map<string, number>();
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_USED_CHALLENGES = 1_024;
const MAX_CHALLENGE_LIFETIME_SECONDS = 5 * 60;
const HOME_DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function parseTomlValue(toml: string, key: string): string | null {
  const match = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']\\s*(?:#.*)?$`, 'm'));
  return match?.[1]?.trim() || null;
}

function parseStellarToml(toml: string, diagnostics: Sep10Diagnostics): StellarToml {
  const signingKey = parseTomlValue(toml, 'SIGNING_KEY');
  const endpoint = parseTomlValue(toml, 'WEB_AUTH_ENDPOINT');

  if (!signingKey || !endpoint) {
    throw new Sep10Error(
      'CONFIGURATION',
      'The Stellar domain must publish SIGNING_KEY and WEB_AUTH_ENDPOINT.',
      { diagnostics }
    );
  }

  let webAuthEndpoint: URL;
  try {
    webAuthEndpoint = new URL(endpoint);
  } catch (cause) {
    throw new Sep10Error('CONFIGURATION', 'The SEP-10 endpoint URL is invalid.', {
      diagnostics,
      cause,
    });
  }

  if (
    webAuthEndpoint.protocol !== 'https:' ||
    webAuthEndpoint.username ||
    webAuthEndpoint.password
  ) {
    throw new Sep10Error(
      'CONFIGURATION',
      'The SEP-10 endpoint must use HTTPS and cannot contain credentials.',
      { diagnostics }
    );
  }

  return {
    signingKey,
    webAuthEndpoint,
    webAuthDomain: webAuthEndpoint.hostname.toLowerCase().replace(/\.$/, ''),
  };
}

function pruneUsedChallenges(now: number): void {
  for (const [challenge, expiresAt] of usedChallenges) {
    if (expiresAt <= now) usedChallenges.delete(challenge);
  }
}

function errorForHttpStatus(
  status: number,
  diagnostics: Sep10Diagnostics,
  service = 'authentication server'
): Sep10Error {
  if (status === 401) {
    return new Sep10Error('HTTP_UNAUTHORIZED', `The ${service} rejected the credentials.`, {
      diagnostics,
    });
  }
  if (status === 403) {
    const resource = service === 'authentication server' ? 'resource' : `${service} resource`;
    return new Sep10Error(
      'HTTP_FORBIDDEN',
      `The authenticated wallet is not permitted to access the ${resource}.`,
      {
        diagnostics,
      }
    );
  }
  return new Sep10Error('HTTP_FAILURE', `The ${service} returned HTTP ${status}.`, { diagnostics });
}

function parseJwtExpiry(token: string, address: string, diagnostics: Sep10Diagnostics): number {
  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new Sep10Error('INVALID_TOKEN', 'The authentication server returned a malformed token.', {
      diagnostics,
    });
  }

  try {
    const encodedPayload = segments[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(segments[1].length / 4) * 4, '=');
    const payloadBytes = Uint8Array.from(atob(encodedPayload), (character) =>
      character.charCodeAt(0)
    );
    const payload: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('exp' in payload) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      !('sub' in payload) ||
      payload.sub !== address
    ) {
      throw new Error('The token must include a numeric expiry and the connected wallet subject.');
    }

    const expiresAt = payload.exp * 1_000;
    if (expiresAt <= Date.now()) {
      throw new Sep10Error(
        'INVALID_TOKEN',
        'The authentication server returned an expired token.',
        {
          diagnostics,
        }
      );
    }
    return expiresAt;
  } catch (cause) {
    if (cause instanceof Sep10Error) throw cause;
    throw new Sep10Error('INVALID_TOKEN', 'The authentication server returned a malformed token.', {
      diagnostics,
      cause,
    });
  }
}

function throwWithDiagnostics(
  error: unknown,
  diagnostics: Sep10Diagnostics,
  fallbackCode: Sep10ErrorCode,
  fallbackMessage: string
): never {
  if (error instanceof Sep10Error) {
    throw new Sep10Error(error.code, error.message, { diagnostics, cause: error });
  }
  throw new Sep10Error(fallbackCode, fallbackMessage, { diagnostics, cause: error });
}

async function performAuthentication(options: AuthenticateSep10Options): Promise<Sep10Session> {
  const fetcher = options.fetcher ?? fetch;
  const diagnostics: Sep10Diagnostics = {
    domain: null,
    network: options.network,
    expiresAt: null,
    serverHealth: 'unknown',
  };
  const reportDiagnostics = () => options.onDiagnostics?.({ ...diagnostics });

  await options.assertWalletIdentity();

  const homeDomain = options.homeDomain.trim().toLowerCase().replace(/\.$/, '');
  if (!HOME_DOMAIN_PATTERN.test(homeDomain)) {
    throw new Sep10Error('CONFIGURATION', 'The SEP-10 service domain is invalid.', { diagnostics });
  }
  diagnostics.domain = homeDomain;
  reportDiagnostics();

  let tomlResponse: Response;
  try {
    tomlResponse = await fetcher(`https://${homeDomain}/.well-known/stellar.toml`, {
      headers: { Accept: 'text/plain' },
      redirect: 'error',
    });
  } catch (cause) {
    diagnostics.serverHealth = 'unavailable';
    reportDiagnostics();
    throw new Sep10Error('SERVER_UNAVAILABLE', 'The Stellar domain could not be reached.', {
      diagnostics,
      cause,
    });
  }

  if (!tomlResponse.ok) {
    diagnostics.serverHealth = 'unavailable';
    reportDiagnostics();
    throw new Sep10Error(
      'SERVER_UNAVAILABLE',
      `The Stellar domain returned HTTP ${tomlResponse.status} for stellar.toml.`,
      { diagnostics }
    );
  }
  diagnostics.serverHealth = 'available';
  reportDiagnostics();

  let toml: string;
  try {
    toml = await tomlResponse.text();
  } catch (cause) {
    throw new Sep10Error('CONFIGURATION', 'The Stellar domain returned unreadable configuration.', {
      diagnostics,
      cause,
    });
  }
  const config = parseStellarToml(toml, diagnostics);
  const challengeUrl = new URL(config.webAuthEndpoint);
  challengeUrl.searchParams.set('account', options.address);

  let challengeResponse: Response;
  try {
    challengeResponse = await fetcher(challengeUrl, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
    });
  } catch (cause) {
    diagnostics.serverHealth = 'unavailable';
    reportDiagnostics();
    throw new Sep10Error('SERVER_UNAVAILABLE', 'The SEP-10 server could not be reached.', {
      diagnostics,
      cause,
    });
  }
  diagnostics.serverHealth = 'available';
  reportDiagnostics();
  if (!challengeResponse.ok) {
    throw errorForHttpStatus(challengeResponse.status, diagnostics);
  }

  let challengePayload: unknown;
  try {
    challengePayload = await challengeResponse.json();
  } catch (cause) {
    throw new Sep10Error(
      'CHALLENGE_INVALID',
      'The SEP-10 server returned invalid challenge data.',
      {
        diagnostics,
        cause,
      }
    );
  }
  if (
    !challengePayload ||
    typeof challengePayload !== 'object' ||
    !('transaction' in challengePayload) ||
    typeof challengePayload.transaction !== 'string' ||
    !challengePayload.transaction
  ) {
    throw new Sep10Error(
      'CHALLENGE_INVALID',
      'The SEP-10 server did not return a challenge transaction.',
      {
        diagnostics,
      }
    );
  }

  let challengeDetails: ReturnType<typeof WebAuth.readChallengeTx>;
  try {
    challengeDetails = WebAuth.readChallengeTx(
      challengePayload.transaction,
      config.signingKey,
      options.networkPassphrase,
      homeDomain,
      config.webAuthDomain
    );
  } catch (cause) {
    const isExpired = cause instanceof Error && /expired/i.test(cause.message);
    throw new Sep10Error(
      isExpired ? 'CHALLENGE_EXPIRED' : 'CHALLENGE_INVALID',
      isExpired
        ? 'The SEP-10 challenge has expired. Retry authentication to request a new challenge.'
        : 'The SEP-10 challenge is invalid or belongs to a different domain or network.',
      { diagnostics, cause }
    );
  }

  if (challengeDetails.clientAccountID !== options.address) {
    throw new Sep10Error('CHALLENGE_INVALID', 'The SEP-10 challenge targets a different wallet.', {
      diagnostics,
    });
  }

  const timeBounds = challengeDetails.tx.timeBounds;
  if (!timeBounds) {
    throw new Sep10Error(
      'CHALLENGE_INVALID',
      'The SEP-10 challenge must have finite time bounds.',
      {
        diagnostics,
      }
    );
  }
  const minTime = Number(timeBounds.minTime);
  const maxTime = Number(timeBounds.maxTime);
  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || maxTime <= nowSeconds) {
    throw new Sep10Error(
      'CHALLENGE_EXPIRED',
      'The SEP-10 challenge has expired. Request a new challenge.',
      {
        diagnostics,
      }
    );
  }
  if (minTime > nowSeconds || maxTime - minTime > MAX_CHALLENGE_LIFETIME_SECONDS) {
    throw new Sep10Error(
      'CHALLENGE_INVALID',
      'The SEP-10 challenge time bounds are invalid or exceed the five-minute limit.',
      { diagnostics }
    );
  }

  const webAuthDomainOperation = challengeDetails.tx.operations.find(
    (operation) => operation.type === 'manageData' && operation.name === 'web_auth_domain'
  );
  if (
    webAuthDomainOperation?.type !== 'manageData' ||
    !webAuthDomainOperation?.value ||
    webAuthDomainOperation.value.toString() !== config.webAuthDomain
  ) {
    throw new Sep10Error(
      'CHALLENGE_INVALID',
      'The SEP-10 challenge is not bound to its advertised domain.',
      {
        diagnostics,
      }
    );
  }

  const challengeKey = `${config.webAuthEndpoint.origin}${config.webAuthEndpoint.pathname}:${challengePayload.transaction}`;
  pruneUsedChallenges(Date.now());
  if (usedChallenges.has(challengeKey)) {
    throw new Sep10Error(
      'CHALLENGE_REPLAYED',
      'The SEP-10 server reused a challenge that was already processed. Retry later.',
      { diagnostics }
    );
  }
  if (usedChallenges.size >= MAX_USED_CHALLENGES) {
    throw new Sep10Error(
      'CHALLENGE_LIMIT',
      'Too many recent SEP-10 challenges are being tracked. Retry after earlier challenges expire.',
      { diagnostics }
    );
  }
  usedChallenges.set(challengeKey, Date.now() + CHALLENGE_TTL_MS);

  let signedTransaction: string;
  try {
    await options.assertWalletIdentity();
    signedTransaction = await options.signTransaction(challengePayload.transaction);
    await options.assertWalletIdentity();
  } catch (cause) {
    if (cause instanceof Sep10Error)
      throwWithDiagnostics(cause, diagnostics, cause.code, cause.message);
    throw new Sep10Error(
      'SIGNING_REJECTED',
      'The wallet did not sign the SEP-10 challenge. You can retry authentication.',
      { diagnostics, cause }
    );
  }

  try {
    const signers = WebAuth.verifyChallengeTxSigners(
      signedTransaction,
      config.signingKey,
      options.networkPassphrase,
      [options.address],
      homeDomain,
      config.webAuthDomain
    );
    if (!signers.includes(options.address)) {
      throw new Error('The signed challenge does not contain the connected wallet signature.');
    }
  } catch (cause) {
    throw new Sep10Error('CHALLENGE_INVALID', 'The wallet returned an invalid signed challenge.', {
      diagnostics,
      cause,
    });
  }

  const exchangeBody = new URLSearchParams({ transaction: signedTransaction });
  let exchangeResponse: Response;
  try {
    exchangeResponse = await fetcher(config.webAuthEndpoint, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: exchangeBody,
      redirect: 'error',
    });
  } catch (cause) {
    diagnostics.serverHealth = 'unavailable';
    reportDiagnostics();
    throw new Sep10Error('SERVER_UNAVAILABLE', 'The SEP-10 token exchange could not be reached.', {
      diagnostics,
      cause,
    });
  }
  diagnostics.serverHealth = 'available';
  reportDiagnostics();
  if (!exchangeResponse.ok) {
    throw errorForHttpStatus(exchangeResponse.status, diagnostics);
  }

  let tokenPayload: unknown;
  try {
    tokenPayload = await exchangeResponse.json();
  } catch (cause) {
    throw new Sep10Error('INVALID_TOKEN', 'The SEP-10 server returned invalid token data.', {
      diagnostics,
      cause,
    });
  }
  if (
    !tokenPayload ||
    typeof tokenPayload !== 'object' ||
    !('token' in tokenPayload) ||
    typeof tokenPayload.token !== 'string' ||
    !tokenPayload.token
  ) {
    throw new Sep10Error(
      'INVALID_TOKEN',
      'The SEP-10 server did not return an authentication token.',
      {
        diagnostics,
      }
    );
  }

  const expiresAt = parseJwtExpiry(tokenPayload.token, options.address, diagnostics);
  diagnostics.expiresAt = expiresAt;
  reportDiagnostics();
  return {
    token: tokenPayload.token,
    address: options.address,
    domain: homeDomain,
    authOrigin: config.webAuthEndpoint.origin,
    network: options.network,
    expiresAt,
  };
}

export function authenticateWithSep10(options: AuthenticateSep10Options): Promise<Sep10Session> {
  const key = `${options.address}:${options.homeDomain.toLowerCase()}:${options.networkPassphrase}`;
  const current = inFlight.get(key);
  if (current) return current;

  const pending = performAuthentication(options).finally(() => {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  });
  inFlight.set(key, pending);
  return pending;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  session: Sep10Session,
  init?: RequestInit,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  if (!session.token || session.expiresAt <= Date.now()) {
    throw new Sep10Error(
      'AUTH_REQUIRED',
      'A valid SEP-10 session is required before making this request.'
    );
  }

  const normalizedDomain = session.domain.toLowerCase().replace(/\.$/, '');
  if (!HOME_DOMAIN_PATTERN.test(normalizedDomain)) {
    throw new Sep10Error('CONFIGURATION', 'The SEP-10 service domain is invalid.');
  }
  const baseUrl =
    typeof window === 'undefined' ? `https://${normalizedDomain}/` : `${window.location.origin}/`;
  const requestUrl = new URL(
    typeof Request !== 'undefined' && input instanceof Request ? input.url : input.toString(),
    baseUrl
  );
  if (
    requestUrl.protocol !== 'https:' ||
    requestUrl.username ||
    requestUrl.password ||
    requestUrl.origin !== session.authOrigin
  ) {
    throw new Sep10Error(
      'CONFIGURATION',
      'Authenticated requests must use the SEP-10 server HTTPS origin.'
    );
  }

  const request =
    input instanceof Request ? new Request(input, init) : new Request(requestUrl, init);
  const headers = new Headers(request.headers);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set('Authorization', `Bearer ${session.token}`);
  let response: Response;
  try {
    response = await fetcher(new Request(request, { headers, redirect: 'error' }));
  } catch (cause) {
    throw new Sep10Error('SERVER_UNAVAILABLE', 'The authenticated service could not be reached.', {
      cause,
      diagnostics: {
        domain: normalizedDomain,
        network: session.network,
        expiresAt: session.expiresAt,
        serverHealth: 'unavailable',
      },
    });
  }
  if (!response.ok) {
    throw errorForHttpStatus(
      response.status,
      {
        domain: normalizedDomain,
        network: session.network,
        expiresAt: session.expiresAt,
        serverHealth: 'available',
      },
      'backend'
    );
  }
  return response;
}

export function __resetSep10State(): void {
  inFlight.clear();
  usedChallenges.clear();
}
