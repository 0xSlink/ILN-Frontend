'use client';

import { useMemo } from 'react';
import { Invoice } from '@/utils/soroban';
import { PayerScore, scoreToRiskLevel } from '@/utils/risk';
import {
  InvoiceRiskDetail,
  RiskTrendData,
  calculateRiskFactors,
  calculateInvoiceRiskScore,
  calculatePortfolioRiskMetrics,
  generateRiskTrendData,
} from '@/utils/riskCalculations';

interface UseRiskAnalysisProps {
  invoices: Invoice[];
  payerScores: Map<string, PayerScore> | null;
  trendDays?: number;
}

export function useRiskAnalysis({ invoices, payerScores, trendDays = 30 }: UseRiskAnalysisProps) {
  const invoiceRisks = useMemo<InvoiceRiskDetail[]>(() => {
    return invoices.map((invoice) => {
      const payer = invoice.payer as string;
      const payerScore = payerScores?.get(payer) || null;
      const riskFactors = calculateRiskFactors(payerScore, Number(invoice.due_date));
      const riskScore = calculateInvoiceRiskScore(payerScore, riskFactors.fundingAge);
      const riskLevel = scoreToRiskLevel(riskScore);

      return {
        id: invoice.id,
        freelancer: invoice.freelancer,
        amount: invoice.amount,
        discount_rate: invoice.discount_rate,
        due_date: invoice.due_date,
        status: invoice.status,
        payerScore,
        riskLevel,
        riskScore,
        riskFactors,
      };
    });
  }, [invoices, payerScores]);

  const portfolioMetrics = useMemo(() => {
    return calculatePortfolioRiskMetrics(invoiceRisks);
  }, [invoiceRisks]);

  const trendData = useMemo<RiskTrendData[]>(() => {
    return generateRiskTrendData(invoiceRisks, trendDays);
  }, [invoiceRisks, trendDays]);

  return {
    invoiceRisks,
    portfolioMetrics,
    trendData,
  };
}
