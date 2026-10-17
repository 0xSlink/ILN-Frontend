'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  isConnected,
  getAddress,
  setAllowed,
  signTransaction,
  getNetwork,
  requestAccess,
} from '@stellar/freighter-api';
import { NETWORK_NAME, NETWORK_PASSPHRASE, SEP10_HOME_DOMAIN } from '@/constants';
import {
  normalizeWalletNetwork,
  getMismatchDetails,
  getConfiguredStellarNetwork,
  type MismatchDetails,
} from '@/utils/network';
import { getWalletRoles, type WalletRole } from '@/utils/soroban';
import { trackEvent } from '@/lib/analytics';
import {
  clearWalletStorage,
  getStoredWalletProvider,
  setStoredWalletProvider,
  WALLET_ADDRESS_STORAGE_KEY,
  type WalletProviderType,
} from '@/utils/walletStorage';
import WalletSelectionModal from '@/components/WalletSelectionModal';
import { useToast } from './ToastContext';
import {
  authenticatedFetch,
  authenticateWithSep10,
  Sep10Error,
  type Sep10Diagnostics,
  type Sep10Session,
} from '@/utils/sep10';

type WalletProviderName = WalletProviderType;

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isInstalled: boolean;
  isReconnecting: boolean;
  preferredWalletProvider: WalletProviderName | null;
  error: string | null;
  networkMismatch: boolean;
  rpcMismatch: boolean;
  mismatchDetails: MismatchDetails | null;
  switchingNetwork: boolean;
  walletNetwork: string | null;
  roles: WalletRole[];
  rolesLoading: boolean;
  authStatus: 'idle' | 'authenticating' | 'authenticated' | 'error' | 'expired';
  authError: Sep10Error | null;
  authDiagnostics: Sep10Diagnostics;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (txXdr: string) => Promise<string>;
  switchNetwork: () => Promise<void>;
  authenticate: () => Promise<void>;
  authenticatedRequest: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEY = WALLET_ADDRESS_STORAGE_KEY;

function extractConnectionState(result: unknown): boolean {
  if (typeof result === 'boolean') {
    return result;
  }

  if (result && typeof result === 'object' && 'isConnected' in result) {
    return Boolean((result as { isConnected?: unknown }).isConnected);
  }

  return false;
}

function extractNetworkName(result: unknown): string | null {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object' && 'network' in result) {
    const network = (result as { network?: unknown }).network;
    return typeof network === 'string' ? network : null;
  }

  return null;
}

function extractAllowedState(result: unknown): boolean {
  if (typeof result === 'boolean') {
    return result;
  }

  if (result && typeof result === 'object' && 'isAllowed' in result) {
    return Boolean((result as { isAllowed?: unknown }).isAllowed);
  }

  return false;
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToast, updateToast } = useToast();
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const [rpcMismatch, setRpcMismatch] = useState(false);
  const [mismatchDetails, setMismatchDetails] = useState<MismatchDetails | null>(null);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [walletNetwork, setWalletNetwork] = useState<string | null>(null);
  const [roles, setRoles] = useState<WalletRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    'idle' | 'authenticating' | 'authenticated' | 'error' | 'expired'
  >('idle');
  const [authError, setAuthError] = useState<Sep10Error | null>(null);
  const [authDiagnostics, setAuthDiagnostics] = useState<Sep10Diagnostics>({
    domain: null,
    network: NETWORK_NAME,
    expiresAt: null,
    serverHealth: 'unknown',
  });
  const [authSession, setAuthSessionState] = useState<Sep10Session | null>(null);
  const authSessionRef = useRef<Sep10Session | null>(null);
  const authSessionVersion = useRef(0);
  const activeAddress = useRef<string | null>(null);
  // Which provider to connect with is chosen in the selection modal (#2).
  const [isSelectingProvider, setIsSelectingProvider] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<WalletProviderName | null>(null);
  const [openWalletConnectByDefault, setOpenWalletConnectByDefault] = useState(false);

  const setAuthSession = useCallback((session: Sep10Session | null) => {
    authSessionRef.current = session;
    setAuthSessionState(session);
  }, []);

  const updateAddress = useCallback(
    (nextAddress: string | null) => {
      if (activeAddress.current !== nextAddress) {
        authSessionVersion.current += 1;
        activeAddress.current = nextAddress;
        setAuthSession(null);
        setAuthStatus('idle');
        setAuthError(null);
        setAuthDiagnostics({
          domain: null,
          network: NETWORK_NAME,
          expiresAt: null,
          serverHealth: 'unknown',
        });
      }
      setAddress(nextAddress);
    },
    [setAuthSession]
  );

  const invalidateAuthForNetworkChange = useCallback(
    (message: string) => {
      if (!authSessionRef.current) return;
      setAuthSession(null);
      setAuthStatus('error');
      setAuthError(new Sep10Error('NETWORK_MISMATCH', message));
    },
    [setAuthSession]
  );

  useEffect(() => {
    if (!authSession) return;

    let timer: ReturnType<typeof setTimeout>;
    const expireSession = () => {
      const currentSession = authSessionRef.current;
      if (currentSession !== authSession) return;

      const remaining = authSession.expiresAt - Date.now();
      if (remaining > 0) {
        timer = setTimeout(expireSession, Math.min(remaining, 2_147_483_647));
        return;
      }

      setAuthSession(null);
      setAuthStatus('expired');
      setAuthError(
        new Sep10Error(
          'AUTH_REQUIRED',
          'The SEP-10 session expired. Authenticate again to continue.'
        )
      );
    };

    timer = setTimeout(
      expireSession,
      Math.min(Math.max(authSession.expiresAt - Date.now(), 0), 2_147_483_647)
    );
    return () => clearTimeout(timer);
  }, [authSession, setAuthSession]);

  const checkNetwork = useCallback(async () => {
    try {
      const network = extractNetworkName(await getNetwork());
      if (!network) {
        invalidateAuthForNetworkChange(
          'The wallet network could not be verified. Authenticate again after reconnecting.'
        );
        setWalletNetwork(null);
        setNetworkMismatch(false);
        setRpcMismatch(false);
        setMismatchDetails(null);
        return true;
      }
      setWalletNetwork(network);

      const details = getMismatchDetails(network);
      setMismatchDetails(details);
      setNetworkMismatch(details.walletMismatch);
      setRpcMismatch(details.rpcMismatch);

      const sessionNetwork = authSessionRef.current
        ? normalizeWalletNetwork(authSessionRef.current.network)
        : null;
      if (sessionNetwork && sessionNetwork !== details.walletNetwork) {
        invalidateAuthForNetworkChange(
          'The wallet network changed. Authenticate again on the configured network.'
        );
      }

      return !details.walletMismatch;
    } catch (e) {
      console.error('Failed to get network', e);
      invalidateAuthForNetworkChange(
        'The wallet network could not be verified. Authenticate again after reconnecting.'
      );
      setWalletNetwork(null);
      setNetworkMismatch(false);
      setRpcMismatch(false);
      setMismatchDetails(null);
      return false;
    }
  }, [invalidateAuthForNetworkChange]);

  const checkConnection = useCallback(async () => {
    try {
      const installed = extractConnectionState(await isConnected());
      setIsInstalled(installed);

      if (installed) {
        const { address } = await getAddress();
        if (address) {
          updateAddress(address);
          localStorage.setItem(STORAGE_KEY, address);
          await checkNetwork();
        }
      }
    } catch (e) {
      console.error('Check connection failed', e);
    }
  }, [checkNetwork, updateAddress]);

  const attemptSilentReconnect = useCallback(async () => {
    const savedProvider = getStoredWalletProvider();
    setSelectedProvider(savedProvider);
    if (savedProvider !== 'freighter') {
      return;
    }

    setIsReconnecting(true);

    try {
      const installed = extractConnectionState(await isConnected());
      setIsInstalled(installed);

      if (!installed) {
        clearWalletStorage();
        setSelectedProvider(null);
        return;
      }

      const { address } = await getAddress();
      if (!address) {
        clearWalletStorage();
        setSelectedProvider(null);
        return;
      }

      updateAddress(address);
      localStorage.setItem(STORAGE_KEY, address);
      await checkNetwork();
    } catch (e) {
      console.error('Silent reconnect failed', e);
      clearWalletStorage();
      setSelectedProvider(null);
    } finally {
      setIsReconnecting(false);
    }
  }, [checkNetwork, updateAddress]);

  useEffect(() => {
    attemptSilentReconnect();
  }, [attemptSilentReconnect]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    let cancelled = false;

    async function detectRoles(walletAddress: string) {
      setRolesLoading(true);
      try {
        const nextRoles = await getWalletRoles(walletAddress);
        if (!cancelled) setRoles(nextRoles);
      } catch (roleError) {
        console.error('Failed to detect wallet roles', roleError);
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    }

    if (!address || networkMismatch) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }

    void detectRoles(address);

    return () => {
      cancelled = true;
    };
  }, [address, networkMismatch]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (address) checkNetwork();
    }, 5000);
    return () => clearInterval(interval);
  }, [address, checkNetwork]);

  // Opening the wallet picker is what "Connect Wallet" now triggers (#2); the
  // actual per-provider connect runs once the user chooses.
  const connect = async () => {
    setError(null);
    setOpenWalletConnectByDefault(selectedProvider === 'walletconnect');
    setIsSelectingProvider(true);
  };

  const connectFreighter = async () => {
    setIsSelectingProvider(false);
    setError(null);
    const toastId = addToast({ type: 'pending', title: 'Connecting to Freighter...' });

    try {
      const installed = extractConnectionState(await isConnected());
      if (!installed) {
        const msg = 'Freighter not installed. Please install the extension.';
        setError(msg);
        updateToast(toastId, { type: 'error', title: 'Connection Failed', message: msg });
        window.open('https://www.freighter.app/', '_blank');
        return;
      }

      const isAllowed = extractAllowedState(await setAllowed());
      if (isAllowed) {
        const { address, error: freighterError } = await getAddress();

        if (freighterError) {
          setError(freighterError);
          updateToast(toastId, {
            type: 'error',
            title: 'Connection Failed',
            message: freighterError,
          });
          return;
        }

        if (address) {
          updateAddress(address);
          localStorage.setItem(STORAGE_KEY, address);
          setSelectedProvider('freighter');
          setStoredWalletProvider('freighter');

          const isCorrectNetwork = await checkNetwork();
          if (!isCorrectNetwork) {
            const networkMsg = `Please switch Freighter to ${NETWORK_NAME}`;
            setError(networkMsg);
            updateToast(toastId, { type: 'error', title: 'Network Mismatch', message: networkMsg });
          } else {
            updateToast(toastId, {
              type: 'success',
              title: 'Connected',
              message: `Connected as ${address.substring(0, 6)}...`,
            });
            trackEvent('wallet_connected', { provider: 'freighter', network: NETWORK_NAME });
          }
        }
      } else {
        const msg = 'Connection rejected by user.';
        setError(msg);
        updateToast(toastId, { type: 'error', title: 'Connection Failed', message: msg });
      }
    } catch (e: any) {
      console.error('Connection error:', e);
      const msg = e.message || 'Connection failed';
      setError(msg);
      updateToast(toastId, { type: 'error', title: 'Connection Failed', message: msg });
    }
  };

  const switchNetwork = useCallback(async () => {
    if (!address) return;
    setSwitchingNetwork(true);
    try {
      const targetNetwork = getConfiguredStellarNetwork() === 'mainnet' ? 'PUBLIC' : 'TESTNET';

      const extension = (window as any).stellar?.freighter || (window as any).freighter;
      if (extension?.setNetwork) {
        await extension.setNetwork(targetNetwork);
        await checkNetwork();
        if (!networkMismatch) {
          addToast({
            type: 'success',
            title: 'Network Switched',
            message: `Switched to ${NETWORK_NAME}`,
          });
        }
        return;
      }

      await requestAccess();
      addToast({
        type: 'info',
        title: 'Switch Network',
        message: `Please switch Freighter to ${NETWORK_NAME} in the extension popup.`,
      });
    } catch (e) {
      console.error('Failed to switch network', e);
      addToast({
        type: 'error',
        title: 'Switch Failed',
        message: `Could not switch network. Please manually switch Freighter to ${NETWORK_NAME}.`,
      });
    } finally {
      setSwitchingNetwork(false);
    }
  }, [address, networkMismatch, checkNetwork, addToast]);

  const disconnect = () => {
    // Clear all in-memory wallet state...
    authSessionVersion.current += 1;
    activeAddress.current = null;
    setAddress(null);
    setAuthSession(null);
    setAuthStatus('idle');
    setAuthError(null);
    setAuthDiagnostics({
      domain: null,
      network: NETWORK_NAME,
      expiresAt: null,
      serverHealth: 'unknown',
    });
    setNetworkMismatch(false);
    setRpcMismatch(false);
    setMismatchDetails(null);
    setSwitchingNetwork(false);
    setWalletNetwork(null);
    setError(null);
    setRoles([]);
    setRolesLoading(false);
    setIsSelectingProvider(false);
    setSelectedProvider(null);
    setIsReconnecting(false);
    // ...and every persisted/cached trace of the session (#4).
    clearWalletStorage();
    trackEvent('wallet_disconnected');
    addToast({ type: 'success', title: 'Disconnected' });
    // Leave any wallet-gated view for the public home page.
    router.push('/');
  };

  const signTx = useCallback(
    async (txXdr: string) => {
      const isCorrectNetwork = await checkNetwork();
      if (!isCorrectNetwork) {
        const msg = `Network mismatch. Please switch to ${NETWORK_NAME}`;
        addToast({ type: 'error', title: 'Transaction Failed', message: msg });
        throw new Error(msg);
      }
      const signed = await signTransaction(txXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (typeof signed === 'string') {
        return signed;
      }

      if (signed.error) {
        throw new Error(String(signed.error));
      }

      if (signed.signedTxXdr) {
        return signed.signedTxXdr;
      }

      throw new Error('Freighter did not return a signed transaction.');
    },
    [checkNetwork, addToast]
  );

  const authenticate = useCallback(async () => {
    if (!address) {
      const error = new Sep10Error('AUTH_REQUIRED', 'Connect a wallet before authenticating.');
      setAuthError(error);
      setAuthStatus('error');
      throw error;
    }
    if (selectedProvider !== 'freighter') {
      const error = new Sep10Error(
        'CONFIGURATION',
        'SEP-10 signing is currently available with Freighter only.'
      );
      setAuthError(error);
      setAuthStatus('error');
      throw error;
    }

    const expectedAddress = address;
    const sessionVersion = authSessionVersion.current;
    const assertWalletIdentity = async () => {
      if (
        authSessionVersion.current !== sessionVersion ||
        activeAddress.current !== expectedAddress
      ) {
        throw new Sep10Error(
          'IDENTITY_CHANGED',
          'The connected wallet changed during authentication. Retry with the active wallet.'
        );
      }

      let currentAddress: string | null;
      try {
        const result = await getAddress();
        currentAddress = result.address;
        if (result.error) currentAddress = null;
      } catch (cause) {
        throw new Sep10Error(
          'IDENTITY_CHANGED',
          'The active wallet identity could not be verified.',
          {
            cause,
          }
        );
      }
      if (currentAddress !== expectedAddress) {
        throw new Sep10Error(
          'IDENTITY_CHANGED',
          'The active wallet account changed. Reconnect the intended wallet and retry.'
        );
      }

      let currentNetwork: string | null;
      try {
        currentNetwork = extractNetworkName(await getNetwork());
      } catch (cause) {
        throw new Sep10Error(
          'NETWORK_MISMATCH',
          'The active wallet network could not be verified.',
          {
            cause,
          }
        );
      }
      if (!currentNetwork || getMismatchDetails(currentNetwork).walletMismatch) {
        throw new Sep10Error(
          'NETWORK_MISMATCH',
          `Switch the wallet to ${NETWORK_NAME} before authenticating.`
        );
      }
    };

    setAuthStatus('authenticating');
    setAuthError(null);
    setAuthSession(null);
    try {
      const session = await authenticateWithSep10({
        address: expectedAddress,
        homeDomain: SEP10_HOME_DOMAIN || window.location.hostname,
        network: NETWORK_NAME,
        networkPassphrase: NETWORK_PASSPHRASE,
        signTransaction: signTx,
        assertWalletIdentity,
        onDiagnostics: setAuthDiagnostics,
      });
      await assertWalletIdentity();
      setAuthSession(session);
      setAuthStatus('authenticated');
    } catch (cause) {
      const error =
        cause instanceof Sep10Error
          ? cause
          : new Sep10Error(
              'SERVER_UNAVAILABLE',
              'SEP-10 authentication failed. Retry to continue.',
              {
                cause,
              }
            );
      if (authSessionVersion.current === sessionVersion) {
        setAuthError(error);
        setAuthStatus(error.code === 'AUTH_REQUIRED' ? 'expired' : 'error');
      }
      throw error;
    }
  }, [address, selectedProvider, signTx]);

  const authenticatedRequest = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (
        !address ||
        selectedProvider !== 'freighter' ||
        !authSession ||
        authSession.address !== address ||
        activeAddress.current !== address ||
        authSession.expiresAt <= Date.now()
      ) {
        const error = new Sep10Error(
          'AUTH_REQUIRED',
          'Authenticate the connected wallet before accessing this resource.'
        );
        setAuthSession(null);
        setAuthStatus('expired');
        setAuthError(error);
        throw error;
      }

      try {
        let currentWallet: Awaited<ReturnType<typeof getAddress>>;
        try {
          currentWallet = await getAddress();
        } catch (cause) {
          throw new Sep10Error(
            'IDENTITY_CHANGED',
            'The active wallet identity could not be verified.',
            { cause }
          );
        }
        if (currentWallet.error || currentWallet.address !== authSession.address) {
          throw new Sep10Error(
            'IDENTITY_CHANGED',
            'The active wallet changed. Authenticate again before making this request.'
          );
        }
        let currentNetwork: string | null;
        try {
          currentNetwork = extractNetworkName(await getNetwork());
        } catch (cause) {
          throw new Sep10Error(
            'NETWORK_MISMATCH',
            'The active wallet network could not be verified.',
            {
              cause,
            }
          );
        }
        if (!currentNetwork || getMismatchDetails(currentNetwork).walletMismatch) {
          throw new Sep10Error(
            'NETWORK_MISMATCH',
            `Switch the wallet to ${NETWORK_NAME} before making this request.`
          );
        }
        return await authenticatedFetch(input, authSession, init);
      } catch (cause) {
        if (cause instanceof Sep10Error) {
          if (
            cause.code === 'HTTP_UNAUTHORIZED' ||
            cause.code === 'IDENTITY_CHANGED' ||
            cause.code === 'NETWORK_MISMATCH'
          ) {
            setAuthSession(null);
            setAuthStatus(cause.code === 'NETWORK_MISMATCH' ? 'error' : 'expired');
          }
          setAuthError(cause);
        }
        throw cause;
      }
    },
    [address, authSession, selectedProvider]
  );

  const handleSelectWalletConnect = () => {
    setAuthSession(null);
    setAuthStatus('idle');
    setAuthError(null);
    setSelectedProvider('walletconnect');
    setStoredWalletProvider('walletconnect');
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isInstalled,
        isReconnecting,
        preferredWalletProvider: selectedProvider,
        error,
        networkMismatch,
        rpcMismatch,
        mismatchDetails,
        switchingNetwork,
        walletNetwork: walletNetwork ? normalizeWalletNetwork(walletNetwork) : null,
        roles,
        rolesLoading,
        authStatus,
        authError,
        authDiagnostics,
        connect,
        disconnect,
        signTx,
        switchNetwork,
        authenticate,
        authenticatedRequest,
      }}
    >
      {children}
      {isSelectingProvider ? (
        <WalletSelectionModal
          onClose={() => {
            setIsSelectingProvider(false);
            setOpenWalletConnectByDefault(false);
          }}
          onSelectFreighter={() => void connectFreighter()}
          onSelectWalletConnect={handleSelectWalletConnect}
          initialWalletConnectView={openWalletConnectByDefault}
        />
      ) : null}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
