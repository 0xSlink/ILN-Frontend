'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import BatchInvoiceForm from '@/components/BatchInvoiceForm';

export default function BatchInvoiceSubmissionPage() {
  const router = useRouter();
  const { isConnected, connect } = useWallet();
  const { addToast } = useToast();

  const handleSuccess = (results: { successful: number; failed: number }) => {
    if (results.failed === 0) {
      addToast({
        type: 'success',
        title: 'Batch Submission Complete',
        message: `Successfully submitted ${results.successful} invoices.`,
      });
    } else {
      addToast({
        type: 'warning',
        title: 'Batch Submission Partial',
        message: `${results.successful} invoices submitted, ${results.failed} failed.`,
      });
    }
    router.push('/dashboard');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">
            account_balance_wallet
          </span>
          <h1 className="text-xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-on-surface-variant mb-6">
            Connect your Freighter wallet to submit batch invoices.
          </p>
          <button
            onClick={connect}
            className="bg-primary text-surface-container-lowest px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-on-surface mb-2">Batch Invoice Submission</h1>
          <p className="text-on-surface-variant">
            Submit multiple invoices at once using CSV upload or dynamic form entry.
          </p>
        </div>

        <BatchInvoiceForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
