'use client';

import { useState, useCallback, useRef } from 'react';
import TransactionPreviewModal from '@/components/TransactionPreviewModal';
import { decodeTransactionXdr, type DecodedTransaction } from '@/utils/decodeTransaction';
import type { ExpectedTransactionAction } from '@/utils/transactionPattern';

type ResolveFn = () => void;
type RejectFn = (error: Error) => void;

interface PreviewState {
  isOpen: boolean;
  decoded: DecodedTransaction | null;
  rawXdr: string;
  expectedAction?: ExpectedTransactionAction;
}

interface UseTransactionPreviewReturn {
  previewModal: React.ReactNode;
  requestPreview: (txXdr: string, expectedAction?: ExpectedTransactionAction) => Promise<boolean>;
}

export function useTransactionPreview(): UseTransactionPreviewReturn {
  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    decoded: null,
    rawXdr: '',
  });

  const resolverRef = useRef<{
    resolve: ResolveFn;
    reject: RejectFn;
  } | null>(null);
  // The element that had focus when the modal opened (e.g. the "Pay" button
  // that triggered this preview), so keyboard/screen-reader focus returns
  // there on close instead of being dropped to <body> (#1128).
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const restoreFocus = useCallback(() => {
    triggerElementRef.current?.focus();
    triggerElementRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    setPreview((prev) => ({ ...prev, isOpen: false }));
    restoreFocus();
    resolverRef.current?.resolve();
    resolverRef.current = null;
  }, [restoreFocus]);

  const handleCancel = useCallback(() => {
    setPreview((prev) => ({ ...prev, isOpen: false }));
    restoreFocus();
    resolverRef.current?.reject(new Error('Transaction cancelled by user'));
    resolverRef.current = null;
  }, [restoreFocus]);

  const requestPreview = useCallback(
    (txXdr: string, expectedAction?: ExpectedTransactionAction): Promise<boolean> => {
      const decoded = decodeTransactionXdr(txXdr);
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      return new Promise<boolean>((resolve, reject) => {
        resolverRef.current = {
          resolve: () => resolve(true),
          reject: (err) => reject(err),
        };

        setPreview({
          isOpen: true,
          decoded,
          expectedAction,
          rawXdr: txXdr,
        });
      });
    },
    []
  );

  const previewModal = preview.isOpen ? (
    <TransactionPreviewModal
      decoded={preview.decoded}
      expectedAction={preview.expectedAction}
      rawXdr={preview.rawXdr}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { previewModal, requestPreview };
}
