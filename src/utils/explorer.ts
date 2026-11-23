import { NETWORK_NAME, STELLAR_NETWORK } from '@/constants';

/**
 * Stellar Expert link builders and verifiers.
 *
 * `resolveExplorerNetwork` is strict: only the two networks this app supports
 * produce a link. Unknown values return `null` instead of silently pointing a
 * transaction at testnet. `getExplorerNetworkPath` is retained for API
 * compatibility with older callers that relied on the legacy fallback.
 */

export const EXPLORER_ORIGIN = 'https://stellar.expert';
export const SUPPORTED_EXPLORER_NETWORKS = ['testnet', 'public'] as const;
export type ExplorerNetwork = (typeof SUPPORTED_EXPLORER_NETWORKS)[number];

/**
 * Validates whether a transaction hash is a standard 64-character hexadecimal Stellar transaction ID.
 */
export function isValidTxHash(hash: unknown): hash is string {
  if (typeof hash !== 'string') return false;
  const trimmed = hash.trim();
  return /^[0-9a-fA-F]{64}$/.test(trimmed);
}

/**
 * Validates a Stellar account public key (G... 56 chars).
 */
export function isValidStellarAccountAddress(address: unknown): address is string {
  if (typeof address !== 'string') return false;
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}

/**
 * Validates a Stellar contract ID (C... 56 chars).
 */
export function isValidStellarContractId(contractId: unknown): contractId is string {
  if (typeof contractId !== 'string') return false;
  return /^C[A-Z2-7]{55}$/.test(contractId.trim());
}

/** Resolve an app network label to a supported Stellar Expert path segment. */
export function resolveExplorerNetwork(network?: string): ExplorerNetwork | null {
  const raw = (network || NETWORK_NAME || STELLAR_NETWORK || 'testnet').trim().toLowerCase();
  if (raw === 'public' || raw === 'mainnet' || raw === 'main') {
    return 'public';
  }
  if (raw === 'testnet' || raw === 'test') {
    return 'testnet';
  }
  return null;
}

/**
 * Legacy normalizer kept for compatibility. New link builders use
 * `resolveExplorerNetwork`, which never guesses a network for unknown values.
 */
export function getExplorerNetworkPath(network?: string): 'public' | 'testnet' {
  const raw = (network || NETWORK_NAME || STELLAR_NETWORK || 'testnet').trim().toLowerCase();
  if (raw === 'public' || raw === 'mainnet' || raw === 'main') {
    return 'public';
  }
  return 'testnet';
}

export interface ExplorerLinkTarget {
  network?: string;
  txHash?: string;
  account?: string;
  /** Expected contract destination for a contract link. */
  contractId?: string;
}

/**
 * Confirm a Stellar Expert URL points at the expected network and destination.
 * Returns false for malformed URLs, unsupported networks, invalid identifiers,
 * or a destination that does not match the caller's verified value.
 */
export function verifyExplorerUrl(
  url: string | null | undefined,
  target: ExplorerLinkTarget
): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.origin !== EXPLORER_ORIGIN) return false;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 4 || segments[0] !== 'explorer') return false;

  const expectedNetwork = resolveExplorerNetwork(target.network);
  if (!expectedNetwork || segments[1] !== expectedNetwork) return false;

  let value: string;
  try {
    value = decodeURIComponent(segments[3]);
  } catch {
    return false;
  }

  if (target.txHash !== undefined) {
    return (
      segments[2] === 'tx' &&
      isValidTxHash(value) &&
      value.toLowerCase() === target.txHash.trim().toLowerCase()
    );
  }
  if (target.account !== undefined) {
    return (
      segments[2] === 'account' &&
      isValidStellarAccountAddress(value) &&
      value === target.account.trim()
    );
  }
  if (target.contractId !== undefined) {
    return (
      segments[2] === 'contract' &&
      isValidStellarContractId(value) &&
      value === target.contractId.trim()
    );
  }
  return false;
}

function buildExplorerUrl(
  network: string | undefined,
  entity: 'tx' | 'account' | 'contract',
  value: string
): string | null {
  const networkPath = resolveExplorerNetwork(network);
  if (!networkPath) return null;
  return `${EXPLORER_ORIGIN}/explorer/${networkPath}/${entity}/${value}`;
}

/**
 * Generates an explorer link for a confirmed transaction hash.
 * Returns null if the network, hash, or verified URL check fails.
 */
export function getExplorerTxUrl(
  txHash: string | null | undefined,
  network?: string
): string | null {
  if (!txHash || !isValidTxHash(txHash)) {
    return null;
  }
  const trimmed = txHash.trim();
  const url = buildExplorerUrl(network, 'tx', trimmed);
  return verifyExplorerUrl(url, { network, txHash: trimmed }) ? url : null;
}

/**
 * Generates an explorer link for a validated Stellar account address.
 */
export function getExplorerAccountUrl(
  address: string | null | undefined,
  network?: string
): string | null {
  if (!address || !isValidStellarAccountAddress(address)) {
    return null;
  }
  const trimmed = address.trim();
  const url = buildExplorerUrl(network, 'account', trimmed);
  return verifyExplorerUrl(url, { network, account: trimmed }) ? url : null;
}

/**
 * Generates an explorer link for a validated Stellar contract destination.
 */
export function getExplorerContractUrl(
  contractId: string | null | undefined,
  network?: string
): string | null {
  if (!contractId || !isValidStellarContractId(contractId)) {
    return null;
  }
  const trimmed = contractId.trim();
  const url = buildExplorerUrl(network, 'contract', trimmed);
  return verifyExplorerUrl(url, { network, contractId: trimmed }) ? url : null;
}
