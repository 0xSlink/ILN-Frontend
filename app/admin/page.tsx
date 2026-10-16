'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useWallet } from '@/context/WalletContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import {
  executeReadyProposals,
  fetchProtocolHealth,
  isAdminAddress,
  setProtocolPaused,
  type ProtocolHealth,
} from '@/utils/admin-health';

const REFRESH_INTERVAL_MS = 30_000;

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000));
}

function formatRelative(timestamp: number) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MetricPanel({
  title,
  value,
  detail,
  tone = 'default',
}: {
  title: string;
  value: string;
  detail: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'border-outline-variant/20 bg-surface-container-lowest',
    success: 'border-green-500/20 bg-green-500/10',
    warning: 'border-amber-500/25 bg-amber-500/10',
    danger: 'border-error/25 bg-error-container/15',
  }[tone];

  return (
    <section className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
        {title}
      </p>
      <p className="mt-3 text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{detail}</p>
    </section>
  );
}

export default function AdminHealthDashboard() {
  useDocumentTitle({ pageTitle: 'Admin Protocol Health' });
  const { address, signTx } = useWallet();
  const isAdmin = isAdminAddress(address);
  const [health, setHealth] = useState<ProtocolHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);

  // Token management state
  const {
    tokens,
    isLoading: tokensLoading,
    approveToken,
    removeToken,
    validateTokenAddress,
  } = useApprovedTokens();
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [tokenAddressError, setTokenAddressError] = useState<string | null>(null);
  const [tokenActionMessage, setTokenActionMessage] = useState<string | null>(null);
  const [tokenActionBusy, setTokenActionBusy] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const nextHealth = await fetchProtocolHealth();
      setHealth(nextHealth);
      setLastRefreshAt(Date.now());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load protocol health.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadHealth();
    const interval = setInterval(() => void loadHealth(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadHealth]);

  const openDisputeCount = health?.disputedInvoices.length ?? 0;
  const pendingProposalCount = health?.pendingProposals.length ?? 0;
  const readyProposalCount = health?.readyProposals.length ?? 0;
  const oracleAgeMinutes = health
    ? Math.floor((Date.now() / 1000 - health.oracleLastUpdatedAt) / 60)
    : 0;
  const contractUpgradeDetail = useMemo(() => {
    if (!health) return 'Upgrade window unavailable';
    const days = Math.max(
      0,
      Math.ceil((health.upgradeWindowStartsAt - Math.floor(Date.now() / 1000)) / 86_400)
    );
    return days <= 7
      ? `Upgrade window opens in ${days} days`
      : `Next upgrade window: ${formatDateTime(health.upgradeWindowStartsAt)}`;
  }, [health]);

  const handlePauseToggle = async () => {
    if (!address || !health) return;
    const nextPaused = !health.paused;
    const confirmed = window.confirm(
      `Confirm ${nextPaused ? 'pausing' : 'unpausing'} the protocol. This sensitive admin action will call the contract.`
    );
    if (!confirmed) return;

    setActionBusy('pause');
    setActionMessage(null);
    try {
      await setProtocolPaused(nextPaused, address, signTx);
      setActionMessage(`Protocol ${nextPaused ? 'paused' : 'unpaused'} successfully.`);
      await loadHealth();
    } catch (actionError) {
      setActionMessage(
        actionError instanceof Error ? actionError.message : 'Protocol status update failed.'
      );
    } finally {
      setActionBusy(null);
    }
  };

  const handleExecuteReady = async () => {
    if (!address || !health || health.readyProposals.length === 0) return;
    const confirmed = window.confirm(
      `Confirm executing ${health.readyProposals.length} ready governance proposal${health.readyProposals.length === 1 ? '' : 's'}.`
    );
    if (!confirmed) return;

    setActionBusy('execute');
    setActionMessage(null);
    try {
      await executeReadyProposals(health.readyProposals, address, signTx);
      setActionMessage('Ready governance proposals executed.');
      await loadHealth();
    } catch (actionError) {
      setActionMessage(
        actionError instanceof Error ? actionError.message : 'Proposal execution failed.'
      );
    } finally {
      setActionBusy(null);
    }
  };

  const handleApproveToken = async () => {
    if (!address) return;
    const tokenId = newTokenAddress.trim();
    if (!validateTokenAddress(tokenId)) {
      setTokenAddressError(
        'Enter a valid Stellar contract address (56 characters, starts with C or G).'
      );
      return;
    }
    setTokenAddressError(null);
    setTokenActionBusy('approve');
    setTokenActionMessage(null);
    try {
      await approveToken(address, tokenId, signTx);
      setTokenActionMessage(`Token ${tokenId.slice(0, 8)}… approved successfully.`);
      setNewTokenAddress('');
    } catch (err) {
      setTokenActionMessage(err instanceof Error ? err.message : 'Token approval failed.');
    } finally {
      setTokenActionBusy(null);
    }
  };

  const handleRemoveToken = async (tokenId: string, symbol: string) => {
    if (!address) return;
    const confirmed = window.confirm(
      `Confirm removing token ${symbol} (${tokenId.slice(0, 8)}…) from the approved list. This will prevent new invoices from using this token.`
    );
    if (!confirmed) return;

    setTokenActionBusy(`remove-${tokenId}`);
    setTokenActionMessage(null);
    try {
      await removeToken(address, tokenId, signTx);
      setTokenActionMessage(`Token ${symbol} removed successfully.`);
    } catch (err) {
      setTokenActionMessage(err instanceof Error ? err.message : 'Token removal failed.');
    } finally {
      setTokenActionBusy(null);
    }
  };

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-surface-container-lowest">
        <Navbar />
        <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-error">403</p>
          <h1 className="mt-3 text-3xl font-bold text-on-surface">Admin access required</h1>
          <p className="mt-3 text-sm text-on-surface-variant">
            Connect the configured governance admin address to view protocol health.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-container-lowest">
      <Navbar />
      <section className="px-4 pb-12 pt-28 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin</p>
              <h1 className="mt-2 text-3xl font-bold text-on-surface">Protocol Health</h1>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Live operational metrics that need admin attention. This view refreshes every 30
                seconds.
              </p>
            </div>
            <div className="text-sm text-on-surface-variant">
              {lastRefreshAt
                ? `Last refreshed ${formatRelative(Math.floor(lastRefreshAt / 1000))}`
                : 'Waiting for refresh'}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-surface-container" />
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-error/20 bg-error-container/15 p-4 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}

          {health ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricPanel
                  title="Protocol Status"
                  value={health.paused ? 'Paused' : 'Running'}
                  detail={
                    health.paused
                      ? 'Funding and settlement actions should remain halted.'
                      : 'Protocol write actions are available.'
                  }
                  tone={health.paused ? 'danger' : 'success'}
                />
                <MetricPanel
                  title="Open Disputes"
                  value={openDisputeCount.toString()}
                  detail={
                    openDisputeCount > 0
                      ? 'Invoices need governance or admin review.'
                      : 'No disputed invoices are currently open.'
                  }
                  tone={openDisputeCount > 0 ? 'warning' : 'success'}
                />
                <MetricPanel
                  title="Pending Governance Proposals"
                  value={pendingProposalCount.toString()}
                  detail={`${readyProposalCount} proposal${readyProposalCount === 1 ? '' : 's'} ready to execute.`}
                  tone={readyProposalCount > 0 ? 'warning' : 'default'}
                />
                <MetricPanel
                  title="Oracle Last Updated"
                  value={formatRelative(health.oracleLastUpdatedAt)}
                  detail={`Last heartbeat: ${formatDateTime(health.oracleLastUpdatedAt)}`}
                  tone={
                    oracleAgeMinutes > 30 ? 'danger' : oracleAgeMinutes > 15 ? 'warning' : 'success'
                  }
                />
                <MetricPanel
                  title="Contract Version"
                  value={health.contractVersion}
                  detail={contractUpgradeDetail}
                  tone={contractUpgradeDetail.includes('opens in') ? 'warning' : 'default'}
                />
                <MetricPanel
                  title="Treasury Balance"
                  value={`${health.treasuryBalanceXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`}
                  detail="Native XLM balance for the configured admin treasury account."
                />
              </div>

              <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Action Shortcuts</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Sensitive actions ask for confirmation before calling protocol helpers.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handlePauseToggle}
                      disabled={actionBusy !== null}
                      className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {actionBusy === 'pause'
                        ? 'Submitting...'
                        : health.paused
                          ? 'Unpause'
                          : 'Pause'}
                    </button>
                    <Link
                      href="/lp?filter=disputed"
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-outline-variant/30 px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant/20"
                    >
                      View Disputed Invoices
                    </Link>
                    <button
                      type="button"
                      onClick={handleExecuteReady}
                      disabled={actionBusy !== null || readyProposalCount === 0}
                      className="min-h-11 rounded-xl border border-primary/40 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                      {actionBusy === 'execute' ? 'Executing...' : 'Execute Ready Proposals'}
                    </button>
                  </div>
                </div>
                {actionMessage ? (
                  <p className="mt-4 text-sm font-medium text-on-surface">{actionMessage}</p>
                ) : null}
              </section>
            </>
          ) : null}

          {/* ── Token Management ─────────────────────────────────────────── */}
          <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
            <h2 className="text-lg font-bold text-on-surface">Approved Tokens</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Manage which tokens are accepted for ILN invoices. Removing a token prevents new
              invoices from using it but does not affect existing funded invoices.
            </p>

            {/* Approve new token */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="new-token-address"
                  className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant"
                >
                  Token Contract Address
                </label>
                <input
                  id="new-token-address"
                  type="text"
                  value={newTokenAddress}
                  onChange={(e) => {
                    setNewTokenAddress(e.target.value);
                    setTokenAddressError(null);
                  }}
                  placeholder="C… or G… (56 characters)"
                  className="rounded-xl border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-describedby={tokenAddressError ? 'token-address-error' : undefined}
                />
                {tokenAddressError ? (
                  <p id="token-address-error" className="text-xs text-error">
                    {tokenAddressError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleApproveToken}
                disabled={tokenActionBusy !== null || !newTokenAddress.trim()}
                className="mt-6 min-h-11 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 sm:mt-0 sm:self-end"
              >
                {tokenActionBusy === 'approve' ? 'Approving…' : 'Approve Token'}
              </button>
            </div>

            {/* Existing tokens */}
            <div className="mt-5">
              {tokensLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-container" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2" aria-label="Approved tokens list">
                  {tokens.map((token) => (
                    <li
                      key={token.contractId}
                      className="flex items-center justify-between rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                            token.isAllowed
                              ? 'bg-primary/15 text-primary'
                              : 'bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          {token.iconLabel}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-on-surface">
                            {token.symbol}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {token.contractId.slice(0, 12)}…
                          </div>
                        </div>
                        {token.isAllowed ? (
                          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-green-700 dark:text-green-400">
                            Approved
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            Not approved
                          </span>
                        )}
                      </div>
                      {token.isAllowed ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveToken(token.contractId, token.symbol)}
                          disabled={tokenActionBusy !== null}
                          className="rounded-xl border border-error/30 px-3 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                          aria-label={`Remove ${token.symbol}`}
                        >
                          {tokenActionBusy === `remove-${token.contractId}`
                            ? 'Removing…'
                            : 'Remove'}
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {tokens.length === 0 ? (
                    <li className="py-6 text-center text-sm text-on-surface-variant">
                      No tokens found.
                    </li>
                  ) : null}
                </ul>
              )}
            </div>

            {tokenActionMessage ? (
              <p className="mt-4 text-sm font-medium text-on-surface">{tokenActionMessage}</p>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
