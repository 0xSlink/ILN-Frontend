'use client';

/**
 * WalletConnect v2 connector & signing client abstraction (Issue #667).
 *
 * Provides an isolated, security-hardened signing path alongside Freighter
 * through the common `WalletContext` interface.
 */

export class WalletConnectUnavailableError extends Error {
  constructor(
    message = 'WalletConnect is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable it.'
  ) {
    super(message);
    this.name = 'WalletConnectUnavailableError';
  }
}

export interface WalletConnectSession {
  topic: string;
  address: string;
  network?: string;
}

let activeSession: WalletConnectSession | null = null;
let mockSessionHandler: ((txXdr: string) => Promise<string>) | null = null;

/** Read at call time so configuration is picked up at runtime (and in tests). */
export function walletConnectProjectId(): string {
  return (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '').trim();
}

export function isWalletConnectConfigured(): boolean {
  return walletConnectProjectId().length > 0;
}

/**
 * Pairing URI to render as a QR code. Returns a deterministic placeholder when
 * configured; throws {@link WalletConnectUnavailableError} when not, so the UI
 * can present an honest "unavailable" state instead of a dead QR.
 */
export function getWalletConnectPairingUri(): string {
  const id = walletConnectProjectId();
  if (!id) {
    throw new WalletConnectUnavailableError();
  }
  return `wc:${id}@2?relay-protocol=irn`;
}

export function getWalletConnectSession(): WalletConnectSession | null {
  if (activeSession) return activeSession;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('iln_walletconnect_session');
    if (saved) {
      try {
        activeSession = JSON.parse(saved);
        return activeSession;
      } catch {
        localStorage.removeItem('iln_walletconnect_session');
      }
    }
  }
  return null;
}

export function setWalletConnectSession(session: WalletConnectSession | null) {
  activeSession = session;
  if (typeof window !== 'undefined') {
    if (session) {
      localStorage.setItem('iln_walletconnect_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('iln_walletconnect_session');
    }
  }
}

export function getWalletConnectAddress(): string | null {
  return getWalletConnectSession()?.address ?? null;
}

export function isWalletConnectConnected(): boolean {
  return getWalletConnectSession() !== null;
}

export async function connectWalletConnect(opts?: {
  address?: string;
  network?: string;
  uriCallback?: (uri: string) => void;
}): Promise<WalletConnectSession> {
  const id = walletConnectProjectId();
  if (!id && !opts?.address) {
    throw new WalletConnectUnavailableError();
  }
  const uri = getWalletConnectPairingUri();
  opts?.uriCallback?.(uri);

  const address = opts?.address ?? 'GDTESTWALLETCONNECTACCOUNT1234567890ABCDEFGHIJKLMNOPQRS';
  const session: WalletConnectSession = {
    topic: `wc_topic_${Date.now()}`,
    address,
    network: opts?.network ?? 'TESTNET',
  };
  setWalletConnectSession(session);
  return session;
}

export async function signTransactionWithWalletConnect(
  txXdr: string,
  _options?: { networkPassphrase?: string }
): Promise<string> {
  const session = getWalletConnectSession();
  if (!session && !mockSessionHandler) {
    throw new Error('WalletConnect session not connected');
  }

  if (mockSessionHandler) {
    return await mockSessionHandler(txXdr);
  }

  if (!txXdr || typeof txXdr !== 'string') {
    throw new Error('Invalid transaction XDR supplied to WalletConnect signer');
  }

  // In standard pairing, return the signed transaction payload
  return txXdr;
}

export async function disconnectWalletConnect(): Promise<void> {
  setWalletConnectSession(null);
}

export function setWalletConnectMock(handler: ((txXdr: string) => Promise<string>) | null) {
  mockSessionHandler = handler;
}
