/**
 * SEP-10 Stellar Web Authentication utilities.
 *
 * Validates that a challenge transaction is bound to the expected home domain
 * and carries a unique, non-repeatable nonce. Prevents cross-origin challenge
 * reuse by rejecting any challenge whose web_auth_domain or manage_data
 * key does not match the configured home domain.
 *
 * #1074: Validate SEP-10 home domain
 */

import {
  TransactionBuilder,
  Networks,
  Operation,
  StrKey,
} from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '@/constants';

export const SEP10_HOME_DOMAIN =
  process.env.NEXT_PUBLIC_SEP10_HOME_DOMAIN || 'api.iln.example.com';

export const SEP10_WEB_AUTH_ENDPOINT =
  process.env.NEXT_PUBLIC_SEP10_WEB_AUTH_ENDPOINT ||
  `https://${SEP10_HOME_DOMAIN}/auth`;

export type Sep10ValidationError =
  | 'DOMAIN_MISMATCH'
  | 'INVALID_NONCE'
  | 'MISSING_MANAGE_DATA'
  | 'WRONG_SOURCE'
  | 'EXPIRED_CHALLENGE'
  | 'INVALID_XDR';

export interface Sep10ValidationResult {
  valid: boolean;
  error?: Sep10ValidationError;
  errorDetail?: string;
  clientAccountId?: string;
  nonce?: string;
  domain?: string;
}

const SEEN_NONCES = new Set<string>();
const MAX_CHALLENGE_AGE_SECONDS = 300; // 5 minutes

/**
 * Parse and validate a SEP-10 challenge transaction XDR.
 *
 * Enforces:
 * - The first manage_data operation key must be `<home_domain> auth`
 * - The web_auth_domain manage_data key must match the expected home domain
 * - The nonce has not been seen before (replay prevention)
 * - The challenge was issued within the max age window
 */
export function validateSep10Challenge(
  challengeXdr: string,
  expectedHomeDomain: string = SEP10_HOME_DOMAIN
): Sep10ValidationResult {
  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;

  try {
    tx = TransactionBuilder.fromXDR(challengeXdr, NETWORK_PASSPHRASE);
  } catch (err) {
    return {
      valid: false,
      error: 'INVALID_XDR',
      errorDetail: 'Challenge XDR could not be parsed',
    };
  }

  const ops = tx.operations;
  if (!ops.length) {
    return {
      valid: false,
      error: 'MISSING_MANAGE_DATA',
      errorDetail: 'Challenge has no operations',
    };
  }

  // First op: manage_data with key "<home_domain> auth"
  const firstOp = ops[0];
  if (firstOp.type !== 'manageData') {
    return {
      valid: false,
      error: 'MISSING_MANAGE_DATA',
      errorDetail: 'First operation must be manageData',
    };
  }

  const expectedKey = `${expectedHomeDomain} auth`;
  if (firstOp.name !== expectedKey) {
    return {
      valid: false,
      error: 'DOMAIN_MISMATCH',
      errorDetail: `manage_data key "${firstOp.name}" does not match expected "${expectedKey}"`,
    };
  }

  // Nonce is the 64-byte value of the first manage_data op
  const nonceBuffer = firstOp.value;
  if (!nonceBuffer || nonceBuffer.length !== 64) {
    return {
      valid: false,
      error: 'INVALID_NONCE',
      errorDetail: 'Challenge nonce must be exactly 64 bytes',
    };
  }
  const nonce = nonceBuffer.toString('base64');

  // Replay prevention: each nonce may only be accepted once per session
  if (SEEN_NONCES.has(nonce)) {
    return {
      valid: false,
      error: 'INVALID_NONCE',
      errorDetail: 'Challenge nonce has already been used (replay prevented)',
    };
  }

  // Validate web_auth_domain in subsequent operations
  let webAuthDomain: string | undefined;
  for (const op of ops.slice(1)) {
    if (op.type === 'manageData' && op.name === 'web_auth_domain') {
      const domainValue = op.value;
      if (domainValue) {
        webAuthDomain = domainValue.toString('utf8');
      }
      break;
    }
  }

  if (webAuthDomain !== undefined && webAuthDomain !== expectedHomeDomain) {
    return {
      valid: false,
      error: 'DOMAIN_MISMATCH',
      errorDetail: `web_auth_domain "${webAuthDomain}" does not match expected "${expectedHomeDomain}"`,
    };
  }

  // Check challenge age via transaction time bounds
  const timeBounds = tx.timeBounds;
  if (timeBounds) {
    const now = Math.floor(Date.now() / 1000);
    const maxTime = Number(timeBounds.maxTime);
    const minTime = Number(timeBounds.minTime);

    if (maxTime > 0 && now > maxTime) {
      return {
        valid: false,
        error: 'EXPIRED_CHALLENGE',
        errorDetail: 'Challenge transaction has expired',
      };
    }

    if (minTime > 0 && now - minTime > MAX_CHALLENGE_AGE_SECONDS) {
      return {
        valid: false,
        error: 'EXPIRED_CHALLENGE',
        errorDetail: 'Challenge was issued too long ago',
      };
    }
  }

  // Commit nonce to the seen set only on full validation pass
  SEEN_NONCES.add(nonce);

  // Bound set size to prevent unbounded memory growth in long sessions
  if (SEEN_NONCES.size > 500) {
    const oldest = SEEN_NONCES.values().next().value;
    if (oldest) SEEN_NONCES.delete(oldest);
  }

  const clientAccountId = StrKey.isValidEd25519PublicKey(tx.source) ? tx.source : undefined;

  return {
    valid: true,
    clientAccountId,
    nonce,
    domain: webAuthDomain ?? expectedHomeDomain,
  };
}

/**
 * Returns true if the given home domain string matches the configured
 * SEP10_HOME_DOMAIN. Used to guard against ambient cross-origin challenges
 * before even parsing the full XDR.
 */
export function isAllowedHomeDomain(domain: string): boolean {
  return domain === SEP10_HOME_DOMAIN;
}
