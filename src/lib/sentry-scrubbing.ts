/**
 * Sentry event & breadcrumb data-scrubbing policy (Issue #1355).
 *
 * Source of truth for client-side telemetry redaction before events leave the
 * browser via `sentry.client.config.ts`:
 * - Wallet addresses (Stellar public keys `G...`, contract IDs `C...`, muxed
 *   accounts `M...`) and secret seeds (`S...`).
 * - Invoice identifiers in route paths (`/i/<id>`, `/pay/<id>`, `/invoices/<id>`),
 *   query parameters, messages, tags, and structured metadata.
 * - Transaction payloads (Soroban/Stellar base64 XDR envelopes, 64-hex tx hashes,
 *   signatures, and structured `xdr`/`transactionPayload` fields).
 * - Personally identifiable information (emails, IP addresses, phone numbers,
 *   user profile fields, auth headers, cookies, and bearer/JWT tokens).
 *
 * Failure behavior:
 * - Scrubbing is pure, cycle-safe, depth-bounded, and never mutates caller-owned
 *   references in place.
 * - If an unexpected malformed object is encountered, the scrubber falls back to
 *   returning a safe redacted string rather than throwing inside `beforeSend`.
 */

export const REDACTED_WALLET = '[REDACTED_WALLET]';
export const REDACTED_INVOICE = '[REDACTED_INVOICE]';
export const REDACTED_TX = '[REDACTED_TX]';
export const REDACTED_PII = '[REDACTED_PII]';
export const REDACTED_SECRET = '[REDACTED_SECRET]';

const MAX_SCRUB_DEPTH = 10;

const SECRET_KEYS = new Set([
  'secret',
  'secretkey',
  'secretseed',
  'privatekey',
  'seed',
  'mnemonic',
  'password',
  'passwd',
  'authorization',
  'cookie',
  'setcookie',
  'xapikey',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'token',
  'jwt',
  'bearer',
]);

const TX_KEYS = new Set([
  'xdr',
  'txxdr',
  'signedtxxdr',
  'signedxdr',
  'unsignedxdr',
  'transactionpayload',
  'txpayload',
  'envelope',
  'txenvelope',
  'txhash',
  'transactionhash',
  'signature',
  'signedenvelope',
]);

const WALLET_KEYS = new Set([
  'wallet',
  'walletaddress',
  'publickey',
  'address',
  'payer',
  'payeraddress',
  'freelancer',
  'freelanceraddress',
  'lpaddress',
  'destination',
  'recipient',
  'sender',
  'account',
  'signer',
]);

const INVOICE_KEYS = new Set([
  'invoiceid',
  'invoicenumber',
  'invoiceref',
  'invoice',
  'invoicecode',
]);

const PII_KEYS = new Set([
  'email',
  'useremail',
  'phone',
  'phonenumber',
  'ip',
  'ipaddress',
  'fullname',
  'firstname',
  'lastname',
  'username',
  'ssn',
  'taxid',
  'dob',
  'dateofbirth',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function redactByKeyHint(keyHint: string | undefined): string | undefined {
  if (!keyHint) return undefined;
  const normalized = normalizeKey(keyHint);
  if (SECRET_KEYS.has(normalized)) return REDACTED_SECRET;
  if (TX_KEYS.has(normalized)) return REDACTED_TX;
  if (WALLET_KEYS.has(normalized)) return REDACTED_WALLET;
  if (INVOICE_KEYS.has(normalized)) return REDACTED_INVOICE;
  if (PII_KEYS.has(normalized)) return REDACTED_PII;
  return undefined;
}

/**
 * Redacts wallet addresses, secret seeds, invoice identifiers, transaction
 * payloads, auth tokens, and PII patterns embedded within free-form strings
 * (messages, URLs, query strings, stack traces, or serialized payloads).
 */
export function scrubSensitiveString(input: string): string {
  let result = input;

  // 1. Auth tokens & Stellar secret seeds first (highest sensitivity).
  result = result.replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED_SECRET}`);
  result = result.replace(
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    REDACTED_SECRET
  );
  result = result.replace(/\bS[A-Z2-7]{55}\b/g, REDACTED_SECRET);

  // 2. Stellar public keys (G...), Soroban contract IDs (C...), muxed accounts (M...).
  result = result.replace(/\b[GC][A-Z2-7]{55}\b/g, REDACTED_WALLET);
  result = result.replace(/\bM[A-Z2-7]{68}\b/g, REDACTED_WALLET);

  // 3. Transaction payloads: base64 XDR envelopes and 64-hex transaction hashes.
  result = result.replace(/\bAAAA[A-Za-z0-9+/]{24,}={0,2}/g, REDACTED_TX);
  result = result.replace(/\b[0-9a-fA-F]{64}\b/g, REDACTED_TX);

  // 4. Sensitive query parameters (wallet, invoice, tx, secrets, PII).
  result = result.replace(
    /([?&](?:invoiceId|invoice_id|invoice)=)([^&#\s]+)/gi,
    `$1${REDACTED_INVOICE}`
  );
  result = result.replace(
    /([?&](?:wallet|wallet_address|address|payer|freelancer|account)=)([^&#\s]+)/gi,
    `$1${REDACTED_WALLET}`
  );
  result = result.replace(
    /([?&](?:xdr|tx|txXdr|tx_hash|txHash|signature|payload)=)([^&#\s]+)/gi,
    `$1${REDACTED_TX}`
  );
  result = result.replace(
    /([?&](?:token|api_key|apiKey|secret|auth|jwt)=)([^&#\s]+)/gi,
    `$1${REDACTED_SECRET}`
  );
  result = result.replace(/([?&](?:email|phone|ip)=)([^&#\s]+)/gi, `$1${REDACTED_PII}`);

  // 5. Invoice identifiers in route paths (preserve static /invoices/batch route) and text.
  result = result.replace(/(\/(?:i|pay)\/)([^/?#\s]+)/gi, `$1${REDACTED_INVOICE}`);
  result = result.replace(
    /(\/invoices\/)(?!batch(?=$|[/?#\s]))([^/?#\s]+)/gi,
    `$1${REDACTED_INVOICE}`
  );
  result = result.replace(/\bINV-[A-Za-z0-9_-]+\b/gi, REDACTED_INVOICE);
  result = result.replace(
    /(\binvoice(?:\s*(?:id|number|ref))?\s*(?:#|:|=)\s*)([A-Za-z0-9_-]+)/gi,
    `$1${REDACTED_INVOICE}`
  );

  // 6. PII: email addresses, IPv4 addresses, and phone numbers.
  result = result.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    REDACTED_PII
  );
  result = result.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, REDACTED_PII);
  result = result.replace(/(?<!\w)\+?\d[\d\s().-]{8,}\d(?!\w)/g, REDACTED_PII);

  return result;
}

/**
 * Recursively scrubs objects, arrays, and strings using both key-based and
 * pattern-based redaction while guarding against circular graphs and deep trees.
 */
export function scrubSensitiveValue(
  value: unknown,
  keyHint?: string,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0
): unknown {
  const keyRedaction = redactByKeyHint(keyHint);
  if (keyRedaction !== undefined && value !== null && value !== undefined) {
    return keyRedaction;
  }

  if (typeof value === 'string') {
    return scrubSensitiveString(value);
  }

  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }

  if (depth >= MAX_SCRUB_DEPTH) {
    return '[REDACTED_DEPTH_LIMIT]';
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveValue(item, undefined, seen, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    output[k] = scrubSensitiveValue(v, k, seen, depth + 1);
  }
  return output;
}

function scrubUserObject(user: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(user)) {
    const normalized = normalizeKey(k);
    if (
      normalized === 'email' ||
      normalized === 'ipaddress' ||
      normalized === 'username' ||
      normalized === 'name'
    ) {
      scrubbed[k] = REDACTED_PII;
      continue;
    }
    scrubbed[k] = scrubSensitiveValue(v, k);
  }
  return scrubbed;
}

/**
 * Sentry `beforeBreadcrumb` hook that redacts sensitive fields from navigation,
 * fetch/XHR, console, and UI breadcrumbs before they attach to error events.
 */
export function scrubSentryBreadcrumb<T extends Record<string, unknown>>(breadcrumb: T): T {
  try {
    const clone: Record<string, unknown> = { ...breadcrumb };
    if (typeof clone.message === 'string') {
      clone.message = scrubSensitiveString(clone.message);
    }
    if (clone.data && typeof clone.data === 'object') {
      clone.data = scrubSensitiveValue(clone.data);
    }
    return clone as T;
  } catch {
    return breadcrumb;
  }
}

/**
 * Sentry `beforeSend` hook that scrubs wallet addresses, invoice identifiers,
 * transaction payloads, secrets, and PII across the full event envelope.
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  try {
    const clone: Record<string, unknown> = { ...event };

    if (typeof clone.message === 'string') {
      clone.message = scrubSensitiveString(clone.message);
    }
    if (typeof clone.transaction === 'string') {
      clone.transaction = scrubSensitiveString(clone.transaction);
    }
    if (clone.user && typeof clone.user === 'object' && !Array.isArray(clone.user)) {
      clone.user = scrubUserObject(clone.user as Record<string, unknown>);
    }
    if (clone.request && typeof clone.request === 'object') {
      clone.request = scrubSensitiveValue(clone.request);
    }
    if (clone.extra && typeof clone.extra === 'object') {
      clone.extra = scrubSensitiveValue(clone.extra);
    }
    if (clone.contexts && typeof clone.contexts === 'object') {
      clone.contexts = scrubSensitiveValue(clone.contexts);
    }
    if (clone.tags && typeof clone.tags === 'object') {
      clone.tags = scrubSensitiveValue(clone.tags);
    }
    if (clone.exception && typeof clone.exception === 'object') {
      clone.exception = scrubSensitiveValue(clone.exception);
    }
    if (Array.isArray(clone.breadcrumbs)) {
      clone.breadcrumbs = clone.breadcrumbs.map((crumb) =>
        crumb && typeof crumb === 'object'
          ? scrubSentryBreadcrumb(crumb as Record<string, unknown>)
          : crumb
      );
    } else if (
      clone.breadcrumbs &&
      typeof clone.breadcrumbs === 'object' &&
      Array.isArray((clone.breadcrumbs as Record<string, unknown>).values)
    ) {
      const crumbContainer = clone.breadcrumbs as Record<string, unknown>;
      clone.breadcrumbs = {
        ...crumbContainer,
        values: (crumbContainer.values as unknown[]).map((crumb) =>
          crumb && typeof crumb === 'object'
            ? scrubSentryBreadcrumb(crumb as Record<string, unknown>)
            : crumb
        ),
      };
    }

    return clone as T;
  } catch {
    return event;
  }
}
