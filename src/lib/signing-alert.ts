'use client';

import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/lib/analytics';

/**
 * High-Priority Transaction-Signing Failure Rate Alerting
 *
 * Dedicated real-time monitoring and fast-escalation pipeline for transaction-signing
 * failures across financial flows (invoices, LP deposits, governance votes).
 *
 * Distinct from general error tracking (Issue 54 severity tiering), a sudden spike
 * in signing failures is treated as an immediate potential SEV-1 incident (indicating
 * a wallet extension break, RPC node failure, ABI contract mismatch, or active attack).
 */

export interface SigningAttempt {
  id: string;
  flow: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  timestamp: number;
}

export interface SigningAlertPayload {
  alertId: string;
  triggeredAt: number;
  severity: 'SEV-1' | 'SEV-2';
  failureRate: number;
  consecutiveFailures: number;
  totalAttemptsInWindow: number;
  failedAttemptsInWindow: number;
  affectedFlow: string;
  recentErrors: string[];
  description: string;
}

export interface SigningHealthStatus {
  isHealthy: boolean;
  totalAttempts: number;
  failedAttempts: number;
  failureRate: number;
  consecutiveFailures: number;
  activeAlert: SigningAlertPayload | null;
}

// Window size for rolling rate calculation
const WINDOW_SIZE = 20;
// Tight alert threshold: 20% failure rate with minimum 5 attempts
const FAILURE_RATE_ALERT_THRESHOLD = 0.2;
const MIN_ATTEMPTS_FOR_RATE_ALERT = 5;
// Immediate consecutive failures threshold
const CONSECUTIVE_FAILURES_THRESHOLD = 3;

// In-memory sliding window
const recentAttempts: SigningAttempt[] = [];
let consecutiveFailuresCount = 0;
let activeAlertPayload: SigningAlertPayload | null = null;

export const SIGNING_ALERT_EVENT = 'iln:signing_alert';

/**
 * Record a transaction signing attempt (success or failure).
 * Automatically calculates failure rate and triggers immediate SEV-1 escalation if threshold is crossed.
 */
export function recordSigningAttempt(params: {
  flow: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
}): SigningHealthStatus {
  const attempt: SigningAttempt = {
    id: `sign-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    flow: params.flow,
    success: params.success,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    durationMs: params.durationMs,
    timestamp: Date.now(),
  };

  recentAttempts.push(attempt);
  if (recentAttempts.length > WINDOW_SIZE) {
    recentAttempts.shift();
  }

  if (params.success) {
    consecutiveFailuresCount = 0;
    // Auto-resolve active alert if health has recovered
    if (activeAlertPayload && recentAttempts.length >= 5) {
      const currentFailures = recentAttempts.filter((a) => !a.success).length;
      const currentRate = currentFailures / recentAttempts.length;
      if (currentRate < 0.1) {
        activeAlertPayload = null;
      }
    }
  } else {
    consecutiveFailuresCount += 1;
  }

  // Calculate sliding window metrics
  const totalInWindow = recentAttempts.length;
  const failedInWindow = recentAttempts.filter((a) => !a.success).length;
  const failureRate = totalInWindow > 0 ? failedInWindow / totalInWindow : 0;

  // Check alert triggers
  const isConsecutiveSpike = consecutiveFailuresCount >= CONSECUTIVE_FAILURES_THRESHOLD;
  const isRateSpike =
    totalInWindow >= MIN_ATTEMPTS_FOR_RATE_ALERT && failureRate >= FAILURE_RATE_ALERT_THRESHOLD;

  if ((isConsecutiveSpike || isRateSpike) && !activeAlertPayload) {
    const recentErrors = recentAttempts
      .filter((a) => !a.success && (a.errorMessage || a.errorCode))
      .map((a) => `${a.errorCode || 'UNKNOWN'}: ${a.errorMessage || 'Signing rejected/failed'}`)
      .slice(-5);

    activeAlertPayload = {
      alertId: `alert-sign-${Date.now()}`,
      triggeredAt: Date.now(),
      severity: 'SEV-1',
      failureRate: Math.round(failureRate * 1000) / 10,
      consecutiveFailures: consecutiveFailuresCount,
      totalAttemptsInWindow: totalInWindow,
      failedAttemptsInWindow: failedInWindow,
      affectedFlow: params.flow,
      recentErrors,
      description: isConsecutiveSpike
        ? `Critical signing spike: ${consecutiveFailuresCount} consecutive transaction-signing failures in flow '${params.flow}'`
        : `Critical signing spike: ${(failureRate * 100).toFixed(1)}% failure rate (${failedInWindow}/${totalInWindow} attempts)`,
    };

    triggerSigningFailureAlert(activeAlertPayload);
  }

  return getSigningHealthStatus();
}

/**
 * Escalate the signing failure alert through Sentry, analytics, and incident response channels.
 */
function triggerSigningFailureAlert(alert: SigningAlertPayload): void {
  // 1. Dispatch Sentry high-priority SEV-1 notification
  try {
    Sentry.captureMessage(
      `[SEV-1 Alert] Transaction-signing failure rate spike: ${alert.description}`,
      {
        level: 'fatal',
        tags: {
          alert_type: 'signing_failure_spike',
          severity: 'SEV-1',
          affected_flow: alert.affectedFlow,
        },
        extra: {
          failureRatePercent: alert.failureRate,
          consecutiveFailures: alert.consecutiveFailures,
          totalAttempts: alert.totalAttemptsInWindow,
          failedAttempts: alert.failedAttemptsInWindow,
          recentErrors: alert.recentErrors,
        },
      }
    );
  } catch {
    // Sentry may not be initialized in some test environments
  }

  // 2. Track analytics alert event
  trackEvent('signing_failure_spike_alert', {
    severity: alert.severity,
    failureRate: alert.failureRate,
    consecutiveFailures: alert.consecutiveFailures,
    flow: alert.affectedFlow,
  });

  // 3. Dispatch DOM CustomEvent for internal dashboards & UI notifications
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<SigningAlertPayload>(SIGNING_ALERT_EVENT, { detail: alert })
    );
  }
}

/**
 * Current signing health status.
 */
export function getSigningHealthStatus(): SigningHealthStatus {
  const total = recentAttempts.length;
  const failed = recentAttempts.filter((a) => !a.success).length;
  const failureRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : 0;

  return {
    isHealthy: activeAlertPayload === null,
    totalAttempts: total,
    failedAttempts: failed,
    failureRate,
    consecutiveFailures: consecutiveFailuresCount,
    activeAlert: activeAlertPayload,
  };
}

/**
 * Reset signing alert state (for test isolation).
 */
export function resetSigningAlertState(): void {
  recentAttempts.length = 0;
  consecutiveFailuresCount = 0;
  activeAlertPayload = null;
}
