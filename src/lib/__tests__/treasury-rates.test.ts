import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchThreeMonthTBillRatePct } from '../treasury-rates';

const fetchMock = vi.fn();

describe('fetchThreeMonthTBillRatePct', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('returns the fetched rate when valid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ avg_interest_rate_amt: '4.87' }] }),
    });
    expect(await fetchThreeMonthTBillRatePct()).toBe(4.87);
  });

  it('falls back to the default when the response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    expect(await fetchThreeMonthTBillRatePct()).toBe(5.25);
  });

  it('falls back to the default when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    expect(await fetchThreeMonthTBillRatePct()).toBe(5.25);
  });

  it('falls back to the default when the rate is not a valid positive number', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ avg_interest_rate_amt: 'not-a-number' }] }),
    });
    expect(await fetchThreeMonthTBillRatePct()).toBe(5.25);
  });

  it('falls back to the default when data is empty', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    expect(await fetchThreeMonthTBillRatePct()).toBe(5.25);
  });
});
