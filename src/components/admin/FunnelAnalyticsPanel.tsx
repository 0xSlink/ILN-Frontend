'use client';

import React, { useState, useEffect } from 'react';
import { getFunnelAnalyticsReport, type FlowFunnelReport } from '@/lib/funnel-tracking';
import {
  getSigningHealthStatus,
  type SigningHealthStatus,
  SIGNING_ALERT_EVENT,
} from '@/lib/signing-alert';

export default function FunnelAnalyticsPanel() {
  const [reports, setReports] = useState<FlowFunnelReport[]>([]);
  const [signingHealth, setSigningHealth] = useState<SigningHealthStatus | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string>('all');

  const refreshData = () => {
    setReports(getFunnelAnalyticsReport());
    setSigningHealth(getSigningHealthStatus());
  };

  useEffect(() => {
    refreshData();

    const handleSigningAlert = () => {
      setSigningHealth(getSigningHealthStatus());
    };

    const handleFunnelStage = () => {
      setReports(getFunnelAnalyticsReport());
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(SIGNING_ALERT_EVENT, handleSigningAlert);
      window.addEventListener('iln:funnel_stage', handleFunnelStage);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SIGNING_ALERT_EVENT, handleSigningAlert);
        window.removeEventListener('iln:funnel_stage', handleFunnelStage);
      }
    };
  }, []);

  const visibleReports =
    selectedFlow === 'all' ? reports : reports.filter((r) => r.flow === selectedFlow);

  return (
    <section
      className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5"
      data-testid="funnel-analytics-panel"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">
              filter_alt
            </span>
            <h2 className="text-lg font-bold text-on-surface">
              Financial Journey Funnel & Signing Analytics
            </h2>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tracks conversion and drop-off through multi-step financial journeys. Serves as an early
            warning signal for wallet integration regressions.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Funnel flow filters">
          {[
            { value: 'all', label: 'All Flows' },
            { value: 'invoice_submission', label: 'Invoice Submissions' },
            { value: 'lp_funding', label: 'LP Funding' },
            { value: 'governance_voting', label: 'Governance Voting' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedFlow(tab.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                selectedFlow === tab.value
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
              aria-pressed={selectedFlow === tab.value}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signing Health & SEV-1 Alert Status Banner */}
      {signingHealth && (
        <div className="mt-4">
          {!signingHealth.isHealthy && signingHealth.activeAlert ? (
            <div
              role="alert"
              className="rounded-xl border border-error/40 bg-error-container/20 p-4 text-on-error-container"
              data-testid="signing-alert-banner"
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-2xl shrink-0">
                  warning
                </span>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-error px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white">
                      {signingHealth.activeAlert.severity} ACTIVE
                    </span>
                    <span className="text-sm font-bold text-error">
                      Transaction-Signing Failure Rate Spike Detected
                    </span>
                  </div>
                  <p className="text-xs">{signingHealth.activeAlert.description}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Failure Rate: {signingHealth.activeAlert.failureRate}% (
                    {signingHealth.activeAlert.failedAttemptsInWindow}/
                    {signingHealth.activeAlert.totalAttemptsInWindow} attempts) · Consecutive
                    Failures: {signingHealth.activeAlert.consecutiveFailures}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2.5 text-xs text-green-800 dark:text-green-300">
              <div className="flex items-center gap-2 font-semibold">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-base">
                  check_circle
                </span>
                <span>Signing Pipeline Health: Optimal</span>
              </div>
              <span className="text-[11px] text-on-surface-variant">
                Failure Rate: {signingHealth.failureRate}% · 0 consecutive failures
              </span>
            </div>
          )}
        </div>
      )}

      {/* Funnel Flow Cards */}
      <div className="mt-5 space-y-6">
        {visibleReports.map((report) => (
          <div
            key={report.flow}
            className="rounded-xl border border-outline-variant/20 bg-surface-container p-4 space-y-4"
            data-testid={`funnel-report-${report.flow}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-on-surface">{report.label}</h3>
                <p className="text-xs text-on-surface-variant">
                  Total Initiated: {report.totalStarts.toLocaleString()} · Completed:{' '}
                  {report.totalCompletions.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {report.hasSigningDropoffSpike ? (
                  <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">trending_down</span>
                    Signing Drop-Off Warning (&gt;10%)
                  </span>
                ) : null}
                <div className="text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block">
                    Completion Rate
                  </span>
                  <span className="text-lg font-extrabold text-primary">
                    {report.completionRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Stepper Funnel Progress Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
              {report.stages.map((stage, idx) => (
                <div
                  key={stage.stage}
                  className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-3 space-y-1"
                >
                  <span
                    className="text-[11px] font-medium text-on-surface-variant block truncate"
                    title={stage.label}
                  >
                    {stage.label}
                  </span>
                  <p className="text-sm font-bold text-on-surface">
                    {stage.count.toLocaleString()}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant/80 pt-1 border-t border-outline-variant/10">
                    <span>Conv: {stage.conversionRate}%</span>
                    {idx > 0 ? (
                      <span className={stage.dropOffRate > 10 ? 'text-amber-600 font-bold' : ''}>
                        Drop: {stage.dropOffRate}%
                      </span>
                    ) : (
                      <span>Start</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Privacy-Conscious Data Minimization Disclaimer */}
      <div className="mt-5 rounded-xl border border-outline-variant/15 bg-surface-container/50 p-3.5 text-xs text-on-surface-variant flex items-start gap-2.5">
        <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">
          verified_user
        </span>
        <div>
          <span className="font-bold text-on-surface">Privacy-Conscious Data Minimization:</span>{' '}
          Funnel metrics track only anonymous stage progression counts, step indices, and error
          categories. No wallet balances, private keys, IP addresses, or personal data are ever
          collected or stored.
        </div>
      </div>
    </section>
  );
}
