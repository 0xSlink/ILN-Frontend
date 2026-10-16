import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRiskAnalysis } from '../useRiskAnalysis';

const calculateRiskFactorsMock = vi.fn();
const calculateInvoiceRiskScoreMock = vi.fn();
const calculatePortfolioRiskMetricsMock = vi.fn();
const generateRiskTrendDataMock = vi.fn();

vi.mock('@/utils/riskCalculations', () => ({
  calculateRiskFactors: (...args: unknown[]) => calculateRiskFactorsMock(...args),
  calculateInvoiceRiskScore: (...args: unknown[]) => calculateInvoiceRiskScoreMock(...args),
  calculatePortfolioRiskMetrics: (...args: unknown[]) => calculatePortfolioRiskMetricsMock(...args),
  generateRiskTrendData: (...args: unknown[]) => generateRiskTrendDataMock(...args),
}));

vi.mock('@/utils/risk', () => ({
  scoreToRiskLevel: (score: number) => (score >= 70 ? 'Low' : score >= 40 ? 'Medium' : 'High'),
}));

function invoice(overrides: Partial<any> = {}) {
  return {
    id: 1n,
    freelancer: 'GFREELANCER',
    payer: 'GPAYER',
    amount: 1_000_000_000n,
    due_date: 1_900_000_000n,
    discount_rate: 400,
    status: 'Funded',
    token: '',
    ...overrides,
  };
}

describe('useRiskAnalysis', () => {
  beforeEach(() => {
    calculateRiskFactorsMock.mockReset();
    calculateRiskFactorsMock.mockReturnValue({ fundingAge: 5 });
    calculateInvoiceRiskScoreMock.mockReset();
    calculateInvoiceRiskScoreMock.mockReturnValue(80);
    calculatePortfolioRiskMetricsMock.mockReset();
    calculatePortfolioRiskMetricsMock.mockReturnValue({ overallRisk: 'Low' });
    generateRiskTrendDataMock.mockReset();
    generateRiskTrendDataMock.mockReturnValue([{ date: '2026-01-01', avgRisk: 10 }]);
  });

  it('builds a risk detail per invoice using the payer score lookup', () => {
    const payerScores = new Map([['GPAYER', { score: 90 }]]);
    const inv = invoice();
    const { result } = renderHook(() =>
      useRiskAnalysis({ invoices: [inv], payerScores: payerScores as any })
    );

    expect(calculateRiskFactorsMock).toHaveBeenCalledWith({ score: 90 }, Number(inv.due_date));
    expect(calculateInvoiceRiskScoreMock).toHaveBeenCalledWith({ score: 90 }, 5);
    expect(result.current.invoiceRisks).toEqual([
      expect.objectContaining({
        id: inv.id,
        freelancer: inv.freelancer,
        riskLevel: 'Low',
        riskScore: 80,
        payerScore: { score: 90 },
        riskFactors: { fundingAge: 5 },
      }),
    ]);
  });

  it('passes null for the payer score when the payer is unknown', () => {
    const { result } = renderHook(() =>
      useRiskAnalysis({ invoices: [invoice()], payerScores: new Map() })
    );

    expect(calculateRiskFactorsMock).toHaveBeenCalledWith(null, expect.any(Number));
    expect(result.current.invoiceRisks[0].payerScore).toBeNull();
  });

  it('handles a null payerScores map', () => {
    const { result } = renderHook(() =>
      useRiskAnalysis({ invoices: [invoice()], payerScores: null })
    );
    expect(calculateRiskFactorsMock).toHaveBeenCalledWith(null, expect.any(Number));
    expect(result.current.invoiceRisks).toHaveLength(1);
  });

  it('derives portfolio metrics from the computed invoice risks', () => {
    const { result } = renderHook(() =>
      useRiskAnalysis({ invoices: [invoice()], payerScores: new Map() })
    );
    expect(calculatePortfolioRiskMetricsMock).toHaveBeenCalledWith(result.current.invoiceRisks);
    expect(result.current.portfolioMetrics).toEqual({ overallRisk: 'Low' });
  });

  it('generates trend data using the default 30-day window', () => {
    const { result } = renderHook(() =>
      useRiskAnalysis({ invoices: [invoice()], payerScores: new Map() })
    );
    expect(generateRiskTrendDataMock).toHaveBeenCalledWith(result.current.invoiceRisks, 30);
  });

  it('passes a custom trendDays value through', () => {
    renderHook(() =>
      useRiskAnalysis({ invoices: [invoice()], payerScores: new Map(), trendDays: 7 })
    );
    expect(generateRiskTrendDataMock).toHaveBeenCalledWith(expect.anything(), 7);
  });
});
