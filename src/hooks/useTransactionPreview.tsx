'use client';

import { useState, useCallback, useRef } from 'react';
import TransactionPreviewModal from '@/components/TransactionPreviewModal';
import { decodeTransactionXdr, type DecodedTransaction } from '@/utils/decodeTransaction';

type ResolveFn = () => void;
type RejectFn = (error: Error) => void;

interface PreviewState {
  isOpen: boolean;
  decoded: DecodedTransaction | null;
  rawXdr: string;
}

interface UseTransactionPreviewReturn {
  previewModal: React.ReactNode;
  requestPreview: (txXdr: string) => Promise<boolean>;
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

  const handleConfirm = useCallback(() => {
    setPreview((prev) => ({ ...prev, isOpen: false }));
    resolverRef.current?.resolve();
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setPreview((prev) => ({ ...prev, isOpen: false }));
    resolverRef.current?.reject(new Error('Transaction cancelled by user'));
    resolverRef.current = null;
  }, []);

  const requestPreview = useCallback((txXdr: string): Promise<boolean> => {
    const decoded = decodeTransactionXdr(txXdr);

    return new Promise<boolean>((resolve, reject) => {
      resolverRef.current = {
        resolve: () => resolve(true),
        reject: (err) => reject(err),
      };

      setPreview({
        isOpen: true,
        decoded,
        rawXdr: txXdr,
      });
    });
  }, []);

  const previewModal = preview.isOpen ? (
    <TransactionPreviewModal
      decoded={preview.decoded}
      rawXdr={preview.rawXdr}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { previewModal, requestPreview };
}
