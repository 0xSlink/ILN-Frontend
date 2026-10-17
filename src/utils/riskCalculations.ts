'use client';

import { PayerScore } from '@/utils/risk';

export interface InvoiceRiskDetail {
  id: bigint;
  freelancer: string;
  amount: bigint;
  discount_rate: number;
  due_date: bigint;
  status: string;
  payerScore: PayerScore | null;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  riskScore: number;
  riskFactors: {
    onTimePaymentRate: number;
    defaultCount: number;
    fundingAge: number;
  };
}

export interface RiskTrendData {
  date: string;
  averageRisk: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  totalPortfolioRisk: number;
}

export interface RiskReport {
  generatedAt: string;
  portfolioOverview: {
    totalInvoices: number;
    totalFunded: bigint;
    averageRiskScore: number;
    riskDistribution: Record<string, number>;
  };
  invoiceRisks: InvoiceRiskDetail[];
  trendData: RiskTrendData[];
}

/**
 * Calculate risk factors for an invoice based on payer history
 */
export function calculateRiskFactors(payerScore: PayerScore | null, fundedDate: number) {
  const now = Math.floor(Date.now() / 1000);
  const fundingAge = Math.floor((now - fundedDate) / (60 * 60 * 24)); // days

  if (!payerScore) {
    return {
      onTimePaymentRate: 0,
      defaultCount: 0,
      fundingAge,
    };
  }

  const total = payerScore.settled_on_time + payerScore.defaults;
  const onTimePaymentRate = total > 0 ? (payerScore.settled_on_time / total) * 100 : 0;

  return {
    onTimePaymentRate,
    defaultCount: payerScore.defaults,
    fundingAge,
  };
}

/**
 * Calculate risk score for a single invoice (0-100 scale)
 */
export function calculateInvoiceRiskScore(
  payerScore: PayerScore | null,
  fundingAge: number
): number {
  if (!payerScore) return 50; // Neutral for unknown payers

  // Start with payer score (0-100)
  let score = payerScore.score;

  // Adjust for funding age: older funded invoices carry slightly higher risk
  // Max adjustment: -10 points after 90 days
  const ageAdjustment = Math.min(fundingAge / 9, 10);
  score -= ageAdjustment;

  // Penalize based on default history
  if (payerScore.defaults > 0) {
    score -= payerScore.defaults * 5; // -5 per default
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate portfolio-level risk metrics
 */
export function calculatePortfolioRiskMetrics(invoiceRisks: InvoiceRiskDetail[]) {
  if (invoiceRisks.length === 0) {
    return {
      averageRiskScore: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      unknownRiskCount: 0,
      totalFunded: 0n,
    };
  }

  const averageRiskScore =
    invoiceRisks.reduce((sum, inv) => sum + inv.riskScore, 0) / invoiceRisks.length;

  const distribution = {
    highRiskCount: invoiceRisks.filter((inv) => inv.riskLevel === 'High').length,
    mediumRiskCount: invoiceRisks.filter((inv) => inv.riskLevel === 'Medium').length,
    lowRiskCount: invoiceRisks.filter((inv) => inv.riskLevel === 'Low').length,
    unknownRiskCount: invoiceRisks.filter((inv) => inv.riskLevel === 'Unknown').length,
  };

  const totalFunded = invoiceRisks.reduce((sum, inv) => sum + inv.amount, 0n);

  return {
    averageRiskScore,
    totalFunded,
    ...distribution,
  };
}

/**
 * Generate historical risk trend data (mock implementation for now)
 * In production, this would fetch from a real time-series database
 */
export function generateRiskTrendData(
  invoiceRisks: InvoiceRiskDetail[],
  days: number = 30
): RiskTrendData[] {
  const now = Date.now();
  const trends: RiskTrendData[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    // Simulate historical data with slight variations
    const variation = Math.sin((i / days) * Math.PI) * 5;
    const metrics = calculatePortfolioRiskMetrics(invoiceRisks);

    trends.push({
      date: dateStr,
      averageRisk: Math.max(0, Math.min(100, metrics.averageRiskScore + variation)),
      lowRiskCount: metrics.lowRiskCount,
      mediumRiskCount: metrics.mediumRiskCount,
      highRiskCount: metrics.highRiskCount,
      totalPortfolioRisk:
        (metrics.highRiskCount * 3 + metrics.mediumRiskCount * 2 + metrics.lowRiskCount) /
        Math.max(1, invoiceRisks.length),
    });
  }

  return trends;
}

/**
 * Risk factor explanation strings
 */
export const RISK_FACTOR_EXPLANATIONS: Record<string, string> = {
  onTimePaymentRate:
    'Percentage of invoices this payer has settled by the due date. Higher is better.',
  defaultCount:
    'Number of defaults or missed payments. Lower is better. Any defaults significantly increase risk.',
  fundingAge:
    'Days since this invoice was funded. Longer-funded invoices carry slightly higher default risk.',
};
