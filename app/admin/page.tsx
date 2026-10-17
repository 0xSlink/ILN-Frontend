'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import { useWallet } from '@/context/WalletContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import FunnelAnalyticsPanel from '@/components/admin/FunnelAnalyticsPanel';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import {
  executeReadyProposals,
  fetchAdminActionHistory,
  fetchProtocolHealth,
  isAdminAddress,
  setProtocolPaused,
  type AdminActionItem,
  type ProtocolHealth,
} from '@/utils/admin-health';
import AdminActionHistoryPanel from '@/components/AdminActionHistoryPanel';
import { logAdminAction } from '@/lib/auditLog';

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
  const [adminActions, setAdminActions] = useState<AdminActionItem[]>([]);
  const [actionFilter, setActionFilter] = useState<'all' | 'signer_rotation' | 'parameter_update'>(
    'all'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    | { type: 'pause' }
    | { type: 'execute' }
    | { type: 'remove-token'; tokenId: string; symbol: string }
    | null
  >(null);

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
      const [nextHealth, nextActions] = await Promise.all([
        fetchProtocolHealth(),
        fetchAdminActionHistory(),
      ]);
      setHealth(nextHealth);
      setAdminActions(nextActions);
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

  const filteredAdminActions = useMemo(() => {
    if (actionFilter === 'all') return adminActions;
    return adminActions.filter((a) => a.category === actionFilter);
  }, [actionFilter, adminActions]);

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

  const requestPauseToggle = () => {
    if (!health) return;
    const action = health.paused ? 'protocol.unpause_requested' : 'protocol.pause_requested';
    logAdminAction({ action, actor: address ?? 'unknown', page: '/admin', timestamp: Math.floor(Date.now() / 1000) });
    setPendingConfirmation({ type: 'pause' });
  };

  const performPauseToggle = async () => {
    if (!address || !health) return;
    const nextPaused = !health.paused;
    const ts = () => Math.floor(Date.now() / 1000);

    logAdminAction({
      action: nextPaused ? 'protocol.pause_confirmed' : 'protocol.unpause_confirmed',
      actor: address,
      page: '/admin',
      timestamp: ts(),
    });

    setActionBusy('pause');
    setActionMessage(null);
    try {
      await setProtocolPaused(nextPaused, address, signTx);
      logAdminAction({
        action: nextPaused ? 'protocol.pause_succeeded' : 'protocol.unpause_succeeded',
        actor: address,
        page: '/admin',
        timestamp: ts(),
      });
      setActionMessage(`Protocol ${nextPaused ? 'paused' : 'unpaused'} successfully.`);
      await loadHealth();
    } catch (actionError) {
      logAdminAction({
        action: nextPaused ? 'protocol.pause_failed' : 'protocol.unpause_failed',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: {
          error: actionError instanceof Error ? actionError.message : String(actionError),
        },
      });
      setActionMessage(
        actionError instanceof Error ? actionError.message : 'Protocol status update failed.'
      );
    } finally {
      setActionBusy(null);
    }
  };

  const requestExecuteReady = () => {
    if (!health || health.readyProposals.length === 0) return;
    logAdminAction({
      action: 'governance.execute_requested',
      actor: address ?? 'unknown',
      page: '/admin',
      timestamp: Math.floor(Date.now() / 1000),
      metadata: { proposal_count: health.readyProposals.length },
    });
    setPendingConfirmation({ type: 'execute' });
  };

  const performExecuteReady = async () => {
    if (!address || !health || health.readyProposals.length === 0) return;
    const ts = () => Math.floor(Date.now() / 1000);

    logAdminAction({
      action: 'governance.execute_confirmed',
      actor: address,
      page: '/admin',
      timestamp: ts(),
      metadata: { proposal_count: health.readyProposals.length },
    });

    setActionBusy('execute');
    setActionMessage(null);
    try {
      await executeReadyProposals(health.readyProposals, address, signTx);
      logAdminAction({
        action: 'governance.execute_succeeded',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: { proposal_count: health.readyProposals.length },
      });
      setActionMessage('Ready governance proposals executed.');
      await loadHealth();
    } catch (actionError) {
      logAdminAction({
        action: 'governance.execute_failed',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: {
          proposal_count: health.readyProposals.length,
          error: actionError instanceof Error ? actionError.message : String(actionError),
        },
      });
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
    const ts = () => Math.floor(Date.now() / 1000);

    logAdminAction({
      action: 'token.approve_submitted',
      actor: address,
      page: '/admin',
      timestamp: ts(),
      metadata: { token_id_prefix: tokenId.slice(0, 8) },
    });

    try {
      await approveToken(address, tokenId, signTx);
      logAdminAction({
        action: 'token.approve_succeeded',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: { token_id_prefix: tokenId.slice(0, 8) },
      });
      setTokenActionMessage(`Token ${tokenId.slice(0, 8)}… approved successfully.`);
      setNewTokenAddress('');
    } catch (err) {
      logAdminAction({
        action: 'token.approve_failed',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: {
          token_id_prefix: tokenId.slice(0, 8),
          error: err instanceof Error ? err.message : String(err),
        },
      });
      setTokenActionMessage(err instanceof Error ? err.message : 'Token approval failed.');
    } finally {
      setTokenActionBusy(null);
    }
  };

  const requestRemoveToken = (tokenId: string, symbol: string) => {
    logAdminAction({
      action: 'token.remove_requested',
      actor: address ?? 'unknown',
      page: '/admin',
      timestamp: Math.floor(Date.now() / 1000),
      metadata: { token_symbol: symbol, token_id_prefix: tokenId.slice(0, 8) },
    });
    setPendingConfirmation({ type: 'remove-token', tokenId, symbol });
  };

  const performRemoveToken = async (tokenId: string, symbol: string) => {
    if (!address) return;
    const ts = () => Math.floor(Date.now() / 1000);

    logAdminAction({
      action: 'token.remove_confirmed',
      actor: address,
      page: '/admin',
      timestamp: ts(),
      metadata: { token_symbol: symbol, token_id_prefix: tokenId.slice(0, 8) },
    });

    setTokenActionBusy(`remove-${tokenId}`);
    setTokenActionMessage(null);
    try {
      await removeToken(address, tokenId, signTx);
      logAdminAction({
        action: 'token.remove_succeeded',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: { token_symbol: symbol, token_id_prefix: tokenId.slice(0, 8) },
      });
      setTokenActionMessage(`Token ${symbol} removed successfully.`);
    } catch (err) {
      logAdminAction({
        action: 'token.remove_failed',
        actor: address,
        page: '/admin',
        timestamp: ts(),
        metadata: {
          token_symbol: symbol,
          token_id_prefix: tokenId.slice(0, 8),
          error: err instanceof Error ? err.message : String(err),
        },
      });
      setTokenActionMessage(err instanceof Error ? err.message : 'Token removal failed.');
    } finally {
      setTokenActionBusy(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;
    const confirmation = pendingConfirmation;
    setPendingConfirmation(null);
    if (confirmation.type === 'pause') {
      await performPauseToggle();
    } else if (confirmation.type === 'execute') {
      await performExecuteReady();
    } else {
      await performRemoveToken(confirmation.tokenId, confirmation.symbol);
    }
  };

  const cancelPendingAction = () => {
    setPendingConfirmation(null);
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
                  detail={`${readyProposalCount} proposal${
                    readyProposalCount === 1 ? '' : 's'
                  } ready to execute.`}
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
                  value={`${health.treasuryBalanceXlm.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })} XLM`}
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
                      onClick={requestPauseToggle}
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
                      onClick={requestExecuteReady}
                      disabled={actionBusy !== null || readyProposalCount === 0}
                      className="min-h-11 rounded-xl border border-primary/40 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                      {actionBusy === 'execute' ? 'Executing...' : 'Execute Ready Proposals'}
                    </button>
                  </div>
                </div>
                {actionMessage ? (
                  <p role="status" className="mt-4 text-sm font-medium text-on-surface">
                    {actionMessage}
                  </p>
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
                          onClick={() => requestRemoveToken(token.contractId, token.symbol)}
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
              <p role="status" className="mt-4 text-sm font-medium text-on-surface">
                {tokenActionMessage}
              </p>
            ) : null}
          </section>

          {/* ── Admin Action Audit Log (#103, #3) ────────────────────────── */}
          <section
            className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5"
            data-testid="admin-action-audit-log"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-primary text-xl"
                    aria-hidden="true"
                  >
                    history_edu
                  </span>
                  <h2 className="text-lg font-bold text-on-surface">Admin Action Audit Log</h2>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Immutable on-chain audit trail of administrative operations. Multisig signer
                  rotations are explicitly distinguished given their higher security significance.
                </p>
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Admin action filters"
              >
                {[
                  { value: 'all', label: 'All Actions' },
                  { value: 'signer_rotation', label: 'Signer Rotations (Security)' },
                  { value: 'parameter_update', label: 'Parameter Updates' },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() =>
                      setActionFilter(tab.value as 'all' | 'signer_rotation' | 'parameter_update')
                    }
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                      actionFilter === tab.value
                        ? 'bg-primary text-white'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    aria-pressed={actionFilter === tab.value}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredAdminActions.map((action) => {
                const isSigner = action.category === 'signer_rotation';
                return (
                  <article
                    key={action.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isSigner
                        ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm'
                        : 'border-outline-variant/20 bg-surface-container'
                    }`}
                    data-testid={`admin-action-${action.category}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isSigner
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          }`}
                          aria-hidden="true"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {isSigner ? 'admin_panel_settings' : 'tune'}
                          </span>
                        </span>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-on-surface">{action.title}</h3>
                            {isSigner ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-800 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[12px]">
                                  security
                                </span>
                                Security Critical
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                Routine Parameter
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-on-surface-variant">{action.description}</p>

                          {isSigner && action.metadata ? (
                            <div className="mt-3 rounded-lg border border-amber-500/20 bg-surface/80 p-3 text-xs text-on-surface space-y-1.5">
                              <div className="flex flex-col sm:flex-row sm:gap-2">
                                <span className="font-semibold text-on-surface-variant">
                                  Previous Signer:
                                </span>
                                <span className="font-mono text-on-surface break-all">
                                  {action.metadata.oldSigner || 'None (Initial)'}
                                </span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:gap-2">
                                <span className="font-semibold text-on-surface-variant">
                                  New Signer:
                                </span>
                                <span className="font-mono text-on-surface break-all">
                                  {action.metadata.newSigner}
                                </span>
                              </div>
                              {action.metadata.reason ? (
                                <div className="flex flex-col sm:flex-row sm:gap-2">
                                  <span className="font-semibold text-on-surface-variant">
                                    Reason:
                                  </span>
                                  <span className="text-on-surface">{action.metadata.reason}</span>
                                </div>
                              ) : null}
                              <p className="pt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                Note: Signer rotation grants multisig transaction authorization on
                                the ILN contract.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1 sm:items-end shrink-0 text-xs text-on-surface-variant">
                        <span>{formatDateTime(action.timestamp)}</span>
                        <span className="text-[11px] text-on-surface-variant/70">
                          {formatRelative(action.timestamp)}
                        </span>
                        {action.txHash ? (
                          <span
                            className="font-mono text-[10px] text-primary"
                            title={action.txHash}
                          >
                            tx: {action.txHash.slice(0, 8)}…{action.txHash.slice(-6)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}

              {filteredAdminActions.length === 0 ? (
                <div
                  role="status"
                  className="rounded-xl border border-dashed border-outline-variant/30 p-6 text-center text-sm text-on-surface-variant"
                >
                  No admin actions found for the selected filter.
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Financial Flow Funnel & Signing Analytics ────────────────── */}
          <FunnelAnalyticsPanel />
        </div>
      </section>

      {pendingConfirmation ? (
        <AdminConfirmDialog
          title={
            pendingConfirmation.type === 'pause'
              ? health?.paused
                ? 'Unpause the protocol'
                : 'Pause the protocol'
              : pendingConfirmation.type === 'execute'
                ? 'Execute ready proposals'
                : 'Remove approved token'
          }
          description={
            pendingConfirmation.type === 'pause'
              ? 'This sensitive admin action will call the contract. Funding and settlement behaviour changes immediately for all users.'
              : pendingConfirmation.type === 'execute'
                ? `Confirm executing ${
                    health?.readyProposals.length ?? 0
                  } ready governance proposal${
                    (health?.readyProposals.length ?? 0) === 1 ? '' : 's'
                  }. This sensitive admin action will call the contract.`
                : `Confirm removing token ${pendingConfirmation.symbol} (${pendingConfirmation.tokenId.slice(
                    0,
                    8
                  )}…) from the approved list. This will prevent new invoices from using this token.`
          }
          confirmLabel={
            pendingConfirmation.type === 'pause'
              ? health?.paused
                ? 'Unpause protocol'
                : 'Pause protocol'
              : pendingConfirmation.type === 'execute'
                ? 'Execute proposals'
                : 'Remove token'
          }
          onConfirm={() => void confirmPendingAction()}
          onCancel={cancelPendingAction}
        />
      ) : null}
    </main>
  );
}
