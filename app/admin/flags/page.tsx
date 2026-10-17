'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { useWallet } from '@/context/WalletContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isAdminAddress } from '@/utils/admin-health';
import { env } from '@/lib/env';
import { logAdminAction } from '@/lib/auditLog';

/**
 * Allowlist of env var names that may appear in the flag panel.
 * Constraining this to the three known NEXT_PUBLIC_*_ENABLED vars prevents
 * accidentally surfacing any other entry from the `env` object (including
 * server-only secrets) in a future refactor.
 */
type FeatureFlagEnvName =
  | 'NEXT_PUBLIC_INSURANCE_POOL_ENABLED'
  | 'NEXT_PUBLIC_ORACLE_ENABLED'
  | 'NEXT_PUBLIC_NFT_ENABLED';

interface FlagEntry {
  name: FeatureFlagEnvName;
  label: string;
  description: string;
  enabled: boolean;
  /** Artifacts required before this flag is eligible to flip to `true` in production. */
  readiness: {
    smokeTest: boolean;
    visualBaseline: boolean;
    rollbackStep: boolean;
    flagReview: boolean;
  };
}

function getFlags(): FlagEntry[] {
  return [
    {
      name: 'NEXT_PUBLIC_INSURANCE_POOL_ENABLED',
      label: 'Insurance Pool',
      description: 'Liquidity insurance pooling panel on the LP dashboard.',
      enabled: env.NEXT_PUBLIC_INSURANCE_POOL_ENABLED,
      readiness: {
        smokeTest: true,
        visualBaseline: true,
        rollbackStep: true,
        flagReview: true,
      },
    },
    {
      name: 'NEXT_PUBLIC_ORACLE_ENABLED',
      label: 'Oracle Badge',
      description: 'Oracle verification badge component in the UI.',
      enabled: env.NEXT_PUBLIC_ORACLE_ENABLED,
      readiness: {
        smokeTest: true,
        visualBaseline: true,
        rollbackStep: true,
        flagReview: true,
      },
    },
    {
      name: 'NEXT_PUBLIC_NFT_ENABLED',
      label: 'Invoice NFT',
      description: 'Soroban Invoice NFT metadata card on invoice detail pages.',
      enabled: env.NEXT_PUBLIC_NFT_ENABLED,
      readiness: {
        smokeTest: true,
        visualBaseline: true,
        rollbackStep: true,
        flagReview: true,
      },
    },
  ];
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      data-testid={enabled ? 'flag-enabled' : 'flag-disabled'}
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest',
        enabled
          ? 'bg-green-500/15 text-green-700 dark:text-green-400'
          : 'bg-surface-variant text-on-surface-variant',
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          enabled ? 'bg-green-500' : 'bg-on-surface-variant/40',
        ].join(' ')}
      />
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function ReadinessArtifact({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      data-testid={done ? 'readiness-artifact-complete' : 'readiness-artifact-pending'}
      className="inline-flex items-center gap-1 text-xs"
    >
      <span
        aria-hidden="true"
        className={done ? 'text-green-600 dark:text-green-400' : 'text-on-surface-variant/50'}
      >
        {done ? '✓' : '○'}
      </span>
      <span className={done ? 'text-on-surface-variant' : 'text-on-surface-variant/50'}>
        {label}
      </span>
    </span>
  );
}

function ReadinessPanel({ flag }: { flag: FlagEntry }) {
  const allReady = Object.values(flag.readiness).every(Boolean);

  return (
    <div
      data-testid="readiness-panel"
      className="mt-3 rounded-xl border border-outline-variant/15 bg-surface-container p-3"
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
        Flip readiness
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        <ReadinessArtifact done={flag.readiness.smokeTest} label="Smoke test" />
        <ReadinessArtifact done={flag.readiness.visualBaseline} label="Visual baseline" />
        <ReadinessArtifact done={flag.readiness.rollbackStep} label="Rollback step" />
        <ReadinessArtifact done={flag.readiness.flagReview} label="Flag review" />
      </div>
      <p
        className={[
          'mt-2 text-xs font-semibold',
          allReady ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400',
        ].join(' ')}
        data-testid={allReady ? 'readiness-complete' : 'readiness-pending'}
      >
        {allReady ? 'All artifacts complete — eligible for sign-off' : 'Pending artifacts'}
      </p>
    </div>
  );
}

function FlagRow({ flag }: { flag: FlagEntry }) {
  return (
    <li
      data-testid="flag-row"
      className="flex flex-col gap-2 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5"
    >
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-on-surface">{flag.label}</p>
          <p className="text-sm text-on-surface-variant">{flag.description}</p>
          <code className="mt-1 text-xs text-on-surface-variant/60">{flag.name}</code>
        </div>
        <StatusBadge enabled={flag.enabled} />
      </div>
      {/* Only show the readiness panel for dark (currently-disabled) features */}
      {!flag.enabled && <ReadinessPanel flag={flag} />}
    </li>
  );
}

export default function AdminFlagDashboard() {
  const { address } = useWallet();
  const router = useRouter();
  const [flags] = useState<FlagEntry[]>(getFlags);

  useDocumentTitle({ pageTitle: 'Feature Flag Status · Admin' });

  useEffect(() => {
    if (address !== undefined && !isAdminAddress(address)) {
      router.replace('/admin');
    }
    // Log a flags.viewed audit event each time a confirmed admin opens the panel.
    if (isAdminAddress(address)) {
      logAdminAction({
        action: 'flags.viewed',
        actor: address!,
        page: '/admin/flags',
        timestamp: Math.floor(Date.now() / 1000),
        metadata: {
          flag_count: getFlags().length,
          enabled_count: getFlags().filter((f) => f.enabled).length,
        },
      });
    }
  }, [address, router]);

  const isAdmin = isAdminAddress(address);

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col">
        <Navbar />
        <section className="mx-auto mt-24 w-full max-w-2xl px-4 text-center">
          <p className="text-lg font-semibold text-on-surface">Access Restricted</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            This page is only visible to the protocol admin.
          </p>
        </section>
      </main>
    );
  }

  const enabledCount = flags.filter((f) => f.enabled).length;
  const darkCount = flags.filter((f) => !f.enabled).length;
  const darkReadyCount = flags.filter(
    (f) => !f.enabled && Object.values(f.readiness).every(Boolean)
  ).length;

  return (
    <main className="flex min-h-screen flex-col">
      <Navbar />

      <section className="mx-auto mt-10 w-full max-w-3xl px-4 pb-24">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Admin · Internal
          </p>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">Feature Flag Status</h1>
          <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
            Read-only view of the current feature flag state for this environment. Flags are
            controlled via Vercel environment variables — changes require a redeployment. Disabled
            flags show their readiness artifact status for the upcoming flip.
          </p>
        </header>

        {/* Summary counters */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              Total flags
            </p>
            <p className="mt-2 text-2xl font-bold text-on-surface">{flags.length}</p>
          </div>
          <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-400">
              Enabled
            </p>
            <p className="mt-2 text-2xl font-bold text-on-surface">{enabledCount}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              Dark / disabled
            </p>
            <p className="mt-2 text-2xl font-bold text-on-surface">{darkCount}</p>
          </div>
          <div
            className={[
              'rounded-2xl border p-4',
              darkReadyCount === darkCount && darkCount > 0
                ? 'border-green-500/20 bg-green-500/10'
                : 'border-amber-500/20 bg-amber-500/10',
            ].join(' ')}
          >
            <p
              className={[
                'text-xs font-bold uppercase tracking-[0.16em]',
                darkReadyCount === darkCount && darkCount > 0
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-amber-700 dark:text-amber-400',
              ].join(' ')}
            >
              Flip-ready
            </p>
            <p className="mt-2 text-2xl font-bold text-on-surface">
              {darkReadyCount}
              <span className="text-base font-normal text-on-surface-variant"> / {darkCount}</span>
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-3" data-testid="flag-list">
          {flags.map((flag) => (
            <FlagRow key={flag.name} flag={flag} />
          ))}
        </ul>

        {/* Footer note */}
        <div
          className="mt-8 flex flex-col gap-1 text-xs text-on-surface-variant/60"
          data-testid="flags-footer-note"
        >
          <p>
            Flag values are read from <code className="font-mono">NEXT_PUBLIC_*_ENABLED</code>{' '}
            environment variables at build time. To change a flag, update the variable in Vercel and
            trigger a redeployment. Refer to the internal repository docs for the flag lifecycle
            policy and rollback runbook.
          </p>
        </div>
      </section>
    </main>
  );
}
