'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fundInvoice,
  getAllInvoices,
  getInvoice,
  Invoice,
  submitSignedTransaction,
} from '@/utils/soroban';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { isContractEventStreamingActive } from '@/lib/contract-event-stream-state';
import { invoiceKeys, QUERY_TIMINGS } from './keys';

const TERMINAL_STATUSES = ['Paid', 'Defaulted', 'Cancelled'];

export function useInvoices() {
  return useQuery({
    queryKey: invoiceKeys.all,
    queryFn: getAllInvoices,
    ...QUERY_TIMINGS.invoices,
    refetchInterval: (query) => {
      const data = query.state.data as Invoice[] | undefined;
      if (!data) return isContractEventStreamingActive() ? 60_000 : 15_000;

      const hasActiveInvoices = data.some((invoice) => !TERMINAL_STATUSES.includes(invoice.status));

      if (!hasActiveInvoices) return false;
      return isContractEventStreamingActive() ? 60_000 : 15_000;
    },
  });
}

export function useInvoice(id: bigint | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => (id ? getInvoice(id) : Promise.reject('Invalid ID')),
    enabled: !!id,
    ...QUERY_TIMINGS.invoiceDetail,
    refetchInterval: (query) => {
      const data = query.state.data as Invoice | undefined;
      if (!data) return isContractEventStreamingActive() ? 60_000 : 15_000;
      if (TERMINAL_STATUSES.includes(data.status)) return false;
      return isContractEventStreamingActive() ? 60_000 : 15_000;
    },
  });
}

export function useFundInvoice() {
  const queryClient = useQueryClient();
  const { address, signTx } = useWallet();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async (invoiceId: bigint) => {
      if (!address || !signTx) throw new Error('Wallet not connected');

      const tx = await fundInvoice(address, invoiceId);
      return submitSignedTransaction({ tx, signTx });
    },
    onMutate: async (invoiceId) => {
      await queryClient.cancelQueries({ queryKey: invoiceKeys.all });

      const previousInvoices = queryClient.getQueryData<Invoice[]>(invoiceKeys.all);

      if (previousInvoices) {
        queryClient.setQueryData<Invoice[]>(invoiceKeys.all, (old) =>
          old?.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'Funded' } : inv))
        );
      }

      return { previousInvoices };
    },
    onError: (err, invoiceId, context) => {
      if (context?.previousInvoices) {
        queryClient.setQueryData(invoiceKeys.all, context.previousInvoices);
      }
      addToast({
        type: 'error',
        title: 'Funding failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all });
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'Invoice funded successfully!',
      });
    },
  });
}
