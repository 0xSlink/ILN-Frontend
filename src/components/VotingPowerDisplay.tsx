'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { getDelegationInfo } from '@/utils/governance';
import { formatTokenAmount } from '@/utils/format';

interface DelegationInfo {
  delegatedTo: string | null;
  delegatedAmount: number;
  incomingDelegations: number;
}

interface VotingPowerDisplayProps {
  votingPower: number;
  className?: string;
}

export default function VotingPowerDisplay({
  votingPower,
  className = '',
}: VotingPowerDisplayProps) {
  const { address, isConnected } = useWallet();
  const [delegationInfo, setDelegationInfo] = useState<DelegationInfo>({
    delegatedTo: null,
    delegatedAmount: 0,
    incomingDelegations: 0,
  });
  const [ownBalance, setOwnBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setDelegationInfo({
        delegatedTo: null,
        delegatedAmount: 0,
        incomingDelegations: 0,
      });
      setOwnBalance(0);
      return;
    }

    setLoading(true);

    // Fetch delegation information
    getDelegationInfo(address)
      .then((info) => {
        setDelegationInfo(info);
        // Calculate own balance (voting power minus incoming delegations)
        setOwnBalance(Math.max(0, votingPower - info.incomingDelegations));
      })
      .catch((error) => {
        console.error('Failed to fetch delegation info:', error);
        // Fallback: assume all voting power is own balance
        setOwnBalance(votingPower);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, isConnected, votingPower]);

  if (!isConnected) {
    return (
      <div
        className={`bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 ${className}`}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant">
            account_balance_wallet
          </span>
          <div>
            <div className="font-medium text-on-surface">Connect Wallet</div>
            <div className="text-sm text-on-surface-variant">
              Connect your wallet to view voting power
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-surface-container animate-pulse rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-surface-container animate-pulse rounded mb-2"></div>
            <div className="h-3 bg-surface-container animate-pulse rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-surface-container-low rounded-xl p-4 border border-outline-variant/20 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary">how_to_vote</span>
            <span className="font-bold text-on-surface">Your Voting Power</span>
          </div>

          {/* Total Voting Power */}
          <div className="mb-4">
            <div className="text-2xl font-bold text-primary mb-1">
              {formatTokenAmount(BigInt(votingPower * 1e7), { symbol: 'ILN', decimals: 7 })}
            </div>
            <div className="text-sm text-on-surface-variant">Total voting weight</div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Your balance:</span>
              <span className="font-medium">
                {formatTokenAmount(BigInt(ownBalance * 1e7), { symbol: 'ILN', decimals: 7 })}
              </span>
            </div>

            {delegationInfo.incomingDelegations > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Delegated to you:</span>
                <span className="font-medium text-green-600">
                  +
                  {formatTokenAmount(BigInt(delegationInfo.incomingDelegations * 1e7), {
                    symbol: 'ILN',
                    decimals: 7,
                  })}
                </span>
              </div>
            )}

            {delegationInfo.delegatedTo && (
              <div className="mt-3 p-3 bg-surface-container-high rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-orange-600 text-[16px]">
                    forward
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Delegated
                  </span>
                </div>
                <div className="text-sm">
                  <div className="text-on-surface-variant mb-1">
                    Your voting power is currently delegated to:
                  </div>
                  <div className="font-mono text-xs bg-surface-container-lowest px-2 py-1 rounded border">
                    {delegationInfo.delegatedTo.slice(0, 8)}...
                    {delegationInfo.delegatedTo.slice(-8)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Link
          href="/governance/delegation"
          className="ml-4 p-2 text-on-surface-variant hover:text-primary hover:bg-surface-variant/50 rounded-lg transition-colors"
          title="Manage delegation"
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </Link>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-4 border-t border-outline-variant/20">
        <div className="flex gap-2">
          <Link
            href="/governance/delegation"
            className="flex-1 text-center py-2 px-3 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          >
            Manage Delegation
          </Link>
          {votingPower > 0 && (
            <Link
              href="/governance/new"
              className="flex-1 text-center py-2 px-3 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Proposal
            </Link>
          )}
        </div>
      </div>

      {/* Voting Power Explanation */}
      {votingPower === 0 && (
        <div className="mt-4 p-3 bg-surface-container-high rounded-lg">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px] mt-0.5">
              info
            </span>
            <div className="text-xs text-on-surface-variant">
              <div className="font-medium mb-1">No voting power</div>
              <div>
                You need ILN tokens to participate in governance. Earn tokens by providing liquidity
                or contributing to the protocol.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
