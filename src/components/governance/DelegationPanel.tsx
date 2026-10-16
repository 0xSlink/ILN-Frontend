'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { isValidStellarAddress } from '@/utils/governance';
import { resolveFederatedAddress } from '@/utils/federation';
import { useWallet } from '@/context/WalletContext';
import { useTransaction } from '@/hooks/useTransaction';
import GovernanceMockStatusBanner from '@/components/governance/GovernanceMockStatusBanner';
import {
  Users,
  UserPlus,
  UserMinus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export const DelegationPanel: React.FC = () => {
  const { address, isConnected } = useWallet();
  const { execute, loading: txLoading, error: txError } = useTransaction();

  const [delegateAddress, setDelegateAddress] = useState('');
  const [resolvedDelegate, setResolvedDelegate] = useState('');
  const [resolving, setResolving] = useState(false);

  // Mock delegation state
  const [currentDelegation, setCurrentDelegation] = useState<string | null>(null);
  const [ownBalance, _setOwnBalance] = useState(1250);
  const [incomingDelegations, _setIncomingDelegations] = useState(450);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected || !address) return;

    // Simulate fetching current delegation status
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [isConnected, address]);

  const totalVotingWeight = ownBalance + incomingDelegations;

  const handleAddressChange = async (val: string) => {
    setDelegateAddress(val);
    setResolvedDelegate('');

    if (val.includes('*')) {
      setResolving(true);
      try {
        const resolved = await resolveFederatedAddress(val);
        setResolvedDelegate(resolved);
      } catch (e) {
        console.error('Federation resolution failed', e);
      } finally {
        setResolving(false);
      }
    } else if (isValidStellarAddress(val)) {
      setResolvedDelegate(val);
    }
  };

  const isCycleDetected = useMemo(() => {
    // Mock cycle detection: If address matches a known "delegator to me"
    // In a real app, this would check a delegation graph or contract state.
    const knownDelegatorsToMe = ['GABC123...', 'GDEF456...'];
    return knownDelegatorsToMe.includes(resolvedDelegate);
  }, [resolvedDelegate]);

  const handleDelegate = async () => {
    if (!resolvedDelegate || isCycleDetected) return;

    // In a real app, this would build a Soroban transaction
    // Mock: execute(delegateVotesTx)
    const success = await execute({} as any, `Delegating votes to ${resolvedDelegate}`);
    if (success) {
      setCurrentDelegation(resolvedDelegate);
      setDelegateAddress('');
      setResolvedDelegate('');
    }
  };

  const handleUndelegate = async () => {
    const success = await execute({} as any, 'Removing vote delegation');
    if (success) {
      setCurrentDelegation(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Vote Delegation</h3>
        <p className="text-gray-500 mb-6 text-sm">
          Connect your wallet to delegate your voting power.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
      <GovernanceMockStatusBanner action="delegateVotingPower" />

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Voting Power</h2>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Total Weight</p>
          <p className="text-2xl font-black text-indigo-600">{totalVotingWeight} ILN</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Your Balance</p>
          <p className="text-lg font-bold">{ownBalance} ILN</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Incoming Delegations</p>
          <p className="text-lg font-bold text-green-600">+{incomingDelegations} ILN</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-800">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Current Status</p>
          <p className="text-sm font-semibold truncate">
            {currentDelegation
              ? `Delegating to ${currentDelegation.slice(0, 6)}...`
              : 'Self-voting'}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {currentDelegation ? 'Change Delegate' : 'Delegate Your Votes'}
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Stellar address (G...) or Federation (user*domain.org)"
                value={delegateAddress}
                onChange={(e) => handleAddressChange(e.target.value)}
                className="w-full rounded-xl border-gray-300 dark:border-gray-600 dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pl-4 pr-10"
              />
              {resolving && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            <button
              onClick={handleDelegate}
              disabled={!resolvedDelegate || isCycleDetected || txLoading}
              className={`px-6 py-2 rounded-xl font-bold flex items-center space-x-2 transition-all ${
                !resolvedDelegate || isCycleDetected || txLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Delegate</span>
            </button>
          </div>

          {resolvedDelegate && !isCycleDetected && (
            <p className="mt-2 text-xs text-green-600 flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Ready to delegate to {resolvedDelegate.slice(0, 12)}...{resolvedDelegate.slice(-8)}
            </p>
          )}

          {isCycleDetected && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start space-x-2 text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-medium">
                You cannot delegate to an address that delegates back to you (Cycle detected).
              </p>
            </div>
          )}
        </div>

        {currentDelegation && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                  <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                    Delegating TO
                  </p>
                  <p className="text-sm font-mono">{currentDelegation}</p>
                </div>
              </div>
              <button
                onClick={handleUndelegate}
                disabled={txLoading}
                className="flex items-center space-x-1 text-sm font-bold text-red-600 hover:text-red-700 transition-colors"
              >
                <UserMinus className="w-4 h-4" />
                <span>Undelegate</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {txError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          {txError}
        </div>
      )}
    </div>
  );
};
