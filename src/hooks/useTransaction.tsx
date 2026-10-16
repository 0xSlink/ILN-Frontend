'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@stellar/stellar-sdk';
import { submitSignedTransaction } from '@/utils/soroban';
import { useToast } from '@/context/ToastContext';
import { useWallet } from '@/context/WalletContext';
import { notifyTxSuccess } from '@/utils/txEvents';
import {
  parseContractError,
  CONTRACT_ERROR_MAP,
  UNKNOWN_CONTRACT_ERROR,
} from '@/lib/contract/errors';
import { formatContractError } from '@/utils/contractErrorFormatter';
import { TransactionErrorToast } from '@/components/transaction/TransactionErrorToast';
import { useTransactionPreview } from './useTransactionPreview';

type SignTxFn = (txXdr: string) => Promise<string>;

type TransactionOperation<T> = (signTx: SignTxFn) => Promise<T>;

interface ExecuteOptions {
  title?: string;
  pendingMessage?: string;
  successTitle?: string;
  successMessage?: string;
}

interface UseTransactionResult {
  execute: <T = string>(
    txOrOperation: Transaction | TransactionOperation<T>,
    options?: string | ExecuteOptions
  ) => Promise<T | null>;
  loading: boolean;
  error: string | null;
  success: boolean;
  isSigning: boolean;
  signingModal: ReactNode;
}

function isWalletRejection(message: string) {
  return /reject|cancel|denied|user rejected/i.test(message);
}

function getOptions(options?: string | ExecuteOptions): ExecuteOptions {
  if (!options) return {};
  return typeof options === 'string' ? { title: options } : options;
}

export function useTransaction(): UseTransactionResult {
  const { signTx, isConnected, address } = useWallet();
  const { addToast, updateToast } = useToast();
  const queryClient = useQueryClient();
  const { previewModal, requestPreview } = useTransactionPreview();

  const [loading, setLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const signTxWithUi: SignTxFn = useCallback(
    async (txXdr: string) => {
      try {
        await requestPreview(txXdr);
      } catch (err: any) {
        const message = err?.message || String(err || 'Transaction cancelled');
        if (isWalletRejection(message)) {
          throw new Error('Transaction cancelled');
        }
        throw err;
      }

      setIsSigning(true);
      try {
        return await signTx(txXdr);
      } catch (err: any) {
        const message = err?.message || String(err || 'Transaction cancelled');
        if (isWalletRejection(message)) {
          throw new Error('Transaction cancelled');
        }
        throw err;
      } finally {
        setIsSigning(false);
      }
    },
    [signTx, requestPreview]
  );

  const execute = useCallback(
    async <T = string,>(
      txOrOperation: Transaction | TransactionOperation<T>,
      options?: string | ExecuteOptions
    ) => {
      if (!isConnected || !address) {
        setError('Wallet not connected');
        return null;
      }

      const resolvedOptions = getOptions(options);
      const title = resolvedOptions.title ?? 'Processing transaction...';
      const pendingMessage = resolvedOptions.pendingMessage ?? 'Waiting for wallet signature...';
      const successTitle = resolvedOptions.successTitle ?? 'Transaction complete';
      const successMessage = resolvedOptions.successMessage ?? 'Your transaction was confirmed.';

      setLoading(true);
      setError(null);
      setSuccess(false);

      const toastId = addToast({
        type: 'pending',
        title,
        message: pendingMessage,
      });

      const operation: TransactionOperation<T> =
        typeof txOrOperation === 'function'
          ? txOrOperation
          : async (signTx) => {
              const { txHash } = await submitSignedTransaction({ tx: txOrOperation, signTx });
              return txHash as unknown as T;
            };

      const retry = async () => {
        // eslint-disable-next-line react-hooks/immutability
        await execute(txOrOperation, options);
      };

      try {
        const result = await operation(signTxWithUi);
        setSuccess(true);
        updateToast(toastId, {
          type: 'success',
          title: successTitle,
          message: successMessage,
        });
        queryClient.invalidateQueries();
        // Let balance/state consumers (e.g. useBalances) refresh immediately on settlement.
        notifyTxSuccess();
        return result;
      } catch (err: any) {
        const formattedErr = formatContractError(err);
        const message = formattedErr.message;
        const isRejected = formattedErr.code === 'USER_REJECTED' || isWalletRejection(message);
        setError(formattedErr.userFriendlyMessage);

        let title = 'Transaction failed';
        let toastMessage: React.ReactNode = `${message}. Please try again or contact support if the issue persists.`;

        if (isRejected) {
          title = 'Transaction cancelled';
          toastMessage = 'Transaction cancelled';
        } else {
          const code = parseContractError(err);
          const errorInfo = code ? CONTRACT_ERROR_MAP[code] : UNKNOWN_CONTRACT_ERROR;

          title = errorInfo.title;

          const hasTechnicalDetails =
            !!code ||
            (message && message !== 'Transaction failed.' && message !== errorInfo.message);
          const technicalDetails = hasTechnicalDetails
            ? code
              ? `${code}\n${message}`
              : message
            : undefined;

          toastMessage = (
            <TransactionErrorToast
              message={errorInfo.message}
              remediation={errorInfo.remediation}
              technicalDetails={technicalDetails}
            />
          );
        }

        updateToast(toastId, {
          type: 'error',
          title,
          message: toastMessage,
          action: isRejected
            ? undefined
            : {
                label: 'Retry',
                onClick: retry,
              },
        });

        return null;
      } finally {
        setLoading(false);
        setIsSigning(false);
      }
    },
    [address, addToast, isConnected, queryClient, signTxWithUi, updateToast]
  );

  const signingModal = useMemo(() => {
    if (!isSigning) return null;
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-[32px] border border-surface-variant bg-surface-container-lowest p-8 text-center shadow-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
          </div>
          <h2 className="text-xl font-bold">Waiting for wallet signature...</h2>
          <p className="mt-3 text-sm text-on-surface-variant">
            Please approve the transaction in your wallet to continue.
          </p>
        </div>
      </div>
    );
  }, [isSigning]);

  return {
    execute,
    loading,
    error,
    success,
    isSigning,
    signingModal: (
      <>
        {previewModal}
        {signingModal}
      </>
    ),
  };
}
