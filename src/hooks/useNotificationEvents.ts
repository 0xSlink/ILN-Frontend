'use client';

import { useEffect, useRef } from 'react';
import type { Invoice } from '@/utils/soroban';
import { getReputation } from '@/utils/soroban';
import { fetchProposals, type Proposal } from '@/utils/governance';
import type { NotificationItem } from '@/context/NotificationContext';

const POLL_INTERVAL_MS = 60_000;
const TERMINAL_STATUSES = ['Paid', 'Defaulted', 'Cancelled'];

interface NotificationEventsOptions {
  invoices: Invoice[];
  address?: string | null;
  addNotification: (
    notification: Omit<NotificationItem, 'createdAt' | 'read'> & { id?: string }
  ) => NotificationItem;
}

function notifyInvoiceChange(
  invoice: Invoice,
  address: string,
  addNotification: NotificationEventsOptions['addNotification']
) {
  const invoiceId = invoice.id.toString();
  const isFreelancer = invoice.freelancer === address;
  const isPayer = invoice.payer === address;
  if (!isFreelancer && !isPayer) return;

  const href = isFreelancer ? '/freelancer' : '/payer';
  const category = 'invoice' as const;

  if (invoice.status === 'Paid') {
    addNotification({
      id: `invoice-${invoiceId}-paid`,
      category,
      type: 'settled',
      title: `Invoice #${invoiceId} settled`,
      message: `Invoice #${invoiceId} was marked as paid.`,
      href,
    });
    return;
  }

  if (invoice.status === 'Defaulted') {
    addNotification({
      id: `invoice-${invoiceId}-defaulted`,
      category,
      type: 'expired',
      title: `Invoice #${invoiceId} defaulted`,
      message: `Invoice #${invoiceId} has defaulted.`,
      href,
    });
    return;
  }

  if (invoice.status === 'Cancelled') {
    addNotification({
      id: `invoice-${invoiceId}-cancelled`,
      category,
      type: 'disputed',
      title: `Invoice #${invoiceId} cancelled`,
      message: `Invoice #${invoiceId} was cancelled.`,
      href,
    });
  }
}

function notifyGovernanceChange(
  proposal: Proposal,
  previousStatus: string | undefined,
  addNotification: NotificationEventsOptions['addNotification']
) {
  if (!previousStatus || previousStatus === proposal.status) return;
  if (!['Passed', 'Executed', 'Rejected', 'Vetoed'].includes(proposal.status)) {
    return;
  }

  addNotification({
    id: `governance-proposal-${proposal.id}-${proposal.status}`,
    category: 'governance',
    type: 'proposal',
    title: `Proposal #${proposal.id} ${proposal.status.toLowerCase()}`,
    message: `"${proposal.title}" is now ${proposal.status.toLowerCase()}.`,
    href: `/governance/${proposal.id}`,
  });
}

export function useNotificationEvents({
  invoices,
  address,
  addNotification,
}: NotificationEventsOptions) {
  const invoiceStates = useRef<Map<string, string>>(new Map());
  const proposalStates = useRef<Map<number, string>>(new Map());
  const reputationScore = useRef<number | null>(null);

  useEffect(() => {
    if (!address) return;

    const evaluateInvoices = (current: Invoice[]) => {
      current.forEach((invoice) => {
        const key = invoice.id.toString();
        const prev = invoiceStates.current.get(key);
        if (prev && prev !== invoice.status && TERMINAL_STATUSES.includes(invoice.status)) {
          notifyInvoiceChange(invoice, address, addNotification);
        }
        invoiceStates.current.set(key, invoice.status);
      });
    };

    evaluateInvoices(invoices);

    const poll = async () => {
      const proposals = await fetchProposals();
      proposals.forEach((proposal) => {
        const prev = proposalStates.current.get(proposal.id);
        notifyGovernanceChange(proposal, prev, addNotification);
        proposalStates.current.set(proposal.id, proposal.status);
      });

      const reputation = await getReputation(address);
      if (reputation) {
        const prev = reputationScore.current;
        if (prev !== null && prev !== reputation.score) {
          const increased = reputation.score > prev;
          addNotification({
            id: `reputation-${address}-${reputation.score}`,
            category: 'reputation',
            type: 'reputation',
            title: increased ? 'Reputation increased' : 'Reputation decreased',
            message: `Your reputation score is now ${reputation.score} (was ${prev}).`,
            href: '/freelancer',
          });
        }
        reputationScore.current = reputation.score;
      }
    };

    poll();
    const interval = window.setInterval(() => {
      evaluateInvoices(invoices);
      poll();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [address, addNotification, invoices]);
}
