/**
 * Contract and network configuration.
 * Override these via NEXT_PUBLIC_* environment variables.
 */

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC';
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org';
export const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'TESTNET';
export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
export const TESTNET_USDC_TOKEN_ID =
  process.env.NEXT_PUBLIC_TESTNET_USDC_TOKEN_ID ||
  'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
export const NEXT_PUBLIC_INSURANCE_POOL_ENABLED =
  process.env.NEXT_PUBLIC_INSURANCE_POOL_ENABLED === 'true';
export const NEXT_PUBLIC_ORACLE_ENABLED = process.env.NEXT_PUBLIC_ORACLE_ENABLED === 'true';
export const TESTNET_EURC_TOKEN_ID =
  process.env.NEXT_PUBLIC_TESTNET_EURC_TOKEN_ID ||
  'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP';
export const TESTNET_XLM_TOKEN_ID = process.env.NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID || 'native-xlm';
export const GOVERNANCE_ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_GOVERNANCE_ADMIN_ADDRESS ||
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
export const GOVERNANCE_CONTRACT_ID = process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID || CONTRACT_ID;

// ─── Invoice NFT display (#234) ───────────────────────────────────────────────

export const NEXT_PUBLIC_NFT_ENABLED = process.env.NEXT_PUBLIC_NFT_ENABLED === 'true';
/** Optional override for a dedicated NFT contract. Defaults to {@link CONTRACT_ID}. */
export const NFT_CONTRACT_ID = process.env.NEXT_PUBLIC_NFT_CONTRACT_ID || CONTRACT_ID;
/** Optional Soroban read method used to resolve a metadata URI for `tokenId`. */
export const NFT_METADATA_METHOD = process.env.NEXT_PUBLIC_NFT_METADATA_METHOD || 'token_uri';
/**
 * Optional hints to improve event parsing without code changes.
 * Format: `mint:Minted,mint;transfer:Transfer,transfer;burn:Burned,burn`
 */
export const NFT_EVENT_HINTS = process.env.NEXT_PUBLIC_NFT_EVENT_HINTS || '';

// ─── Indexer WebSocket Configuration ────────────────────────────────────────────

export const INDEXER_WS_URL = process.env.NEXT_PUBLIC_INDEXER_WS_URL || 'ws://localhost:8080/ws';
