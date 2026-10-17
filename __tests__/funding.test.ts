import { expect, test, describe } from 'vitest';
import { transformFundingData } from '@/utils/funding';
import { DailyFundingBucket } from '@/components/charts/FundingChart';

describe('Funding Utils', () => {
  test('transformFundingData correctly transforms token data into row properties', () => {
    const mockData: DailyFundingBucket[] = [
      {
        date: '2026-04-24',
        label: 'Apr 24',
        total_usdc_equiv: 15000,
        invoices_funded: 5,
        tokens: [
          { symbol: 'USDC', amount: 10000, color: '#008080' },
          { symbol: 'EURC', amount: 4000, color: '#2e7d32' },
          { symbol: 'XLM', amount: 1000, color: '#d32f2f' },
        ],
      },
    ];

    const result = transformFundingData(mockData);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Apr 24');
    expect(result[0].USDC).toBe(10000);
    expect(result[0].EURC).toBe(4000);
    expect(result[0].XLM).toBe(1000);
    expect(result[0].invoices_funded).toBe(5);
  });

  test('transformFundingData handles multiple days', () => {
    const mockData: DailyFundingBucket[] = [
      {
        date: '2026-04-23',
        label: 'Apr 23',
        total_usdc_equiv: 5000,
        invoices_funded: 2,
        tokens: [{ symbol: 'USDC', amount: 5000, color: '#008080' }],
      },
      {
        date: '2026-04-24',
        label: 'Apr 24',
        total_usdc_equiv: 8000,
        invoices_funded: 3,
        tokens: [{ symbol: 'USDC', amount: 8000, color: '#008080' }],
      },
    ];

    const result = transformFundingData(mockData);

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Apr 23');
    expect(result[1].label).toBe('Apr 24');
    expect(result[0].USDC).toBe(5000);
    expect(result[1].USDC).toBe(8000);
  });

  test('transformFundingData handles empty data', () => {
    const result = transformFundingData([]);
    expect(result).toHaveLength(0);
  });
});
