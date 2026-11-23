'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rpc } from '@stellar/stellar-sdk';
import { GOVERNANCE_CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from '@/constants';
import {
  forgetTrackedProposal,
  getTrackedProposals,
  proposalTrackingScope,
  reconcileTrackedProposal,
  type TrackedProposal,
} from '@/lib/governance/metadata';

/**
 * Restores proposal submissions interrupted by a reload or timeout (#1321).
 * Makes no RPC call unless this browser holds an unsettled submission.
 */
export default function CreatedProposalRecoveryNotice() {
  const [entries, setEntries] = useState<TrackedProposal[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tracked = getTrackedProposals(
      proposalTrackingScope(NETWORK_PASSPHRASE, GOVERNANCE_CONTRACT_ID)
    );
    if (tracked.length === 0) return;

    const server = new rpc.Server(RPC_URL);
    void Promise.all(
      tracked.map((entry) => reconcileTrackedProposal(entry, (hash) => server.getTransaction(hash)))
    ).then((results) => {
      if (!cancelled) {
        setEntries(results.filter((entry): entry is TrackedProposal => entry !== null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) return null;

  const dismiss = (txHash: string) => {
    forgetTrackedProposal(txHash);
    setEntries((current) => current.filter((entry) => entry.txHash !== txHash));
  };

  return (
    <div role="status" className="mb-4 space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.txHash}
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
        >
          {entry.status === 'confirmed' ? (
            <>
              <Link href={`/governance/${entry.proposalId}`} className="font-semibold underline">
                Your proposal #{entry.proposalId} was created.
              </Link>
              <button type="button" onClick={() => dismiss(entry.txHash)} className="underline">
                Dismiss
              </button>
            </>
          ) : entry.status === 'unresolved' ? (
            <>
              <span className="break-all">
                Transaction {entry.txHash} confirmed without a readable proposal id. Check the
                proposal list before submitting again.
              </span>
              <button type="button" onClick={() => dismiss(entry.txHash)} className="underline">
                Dismiss
              </button>
            </>
          ) : (
            <span className="break-all">
              Transaction {entry.txHash} is still settling. Wait before submitting it again.
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
