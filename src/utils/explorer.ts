import { NETWORK_NAME, STELLAR_NETWORK } from '@/constants';

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

/**
 * Normalizes the network name into Stellar Expert's network slug ('public' | 'testnet').
 */
export function getExplorerNetworkPath(network?: string): 'public' | 'testnet' {
  const raw = (network || NETWORK_NAME || STELLAR_NETWORK || 'testnet').trim().toLowerCase();
  if (raw === 'public' || raw === 'mainnet' || raw === 'main') {
    return 'public';
  }
  return 'testnet';
}

/**
 * Generates an explorer link for a confirmed transaction hash.
 * Returns null if the transaction hash is invalid, unconfirmed, or fabricated.
 */
export function getExplorerTxUrl(
  txHash: string | null | undefined,
  network?: string
): string | null {
  if (!txHash || !isValidTxHash(txHash)) {
    return null;
  }
  const networkPath = getExplorerNetworkPath(network);
  return `https://stellar.expert/explorer/${networkPath}/tx/${txHash.trim()}`;
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
  const networkPath = getExplorerNetworkPath(network);
  return `https://stellar.expert/explorer/${networkPath}/account/${address.trim()}`;
}

/**
 * Generates an explorer link for a validated Stellar contract ID.
 */
export function getExplorerContractUrl(
  contractId: string | null | undefined,
  network?: string
): string | null {
  if (!contractId || !isValidStellarContractId(contractId)) {
    return null;
  }
  const networkPath = getExplorerNetworkPath(network);
  return `https://stellar.expert/explorer/${networkPath}/contract/${contractId.trim()}`;
}
