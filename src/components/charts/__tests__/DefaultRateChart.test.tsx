import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DefaultRateChart from '../DefaultRateChart';

const fetchMock = vi.fn();

describe('DefaultRateChart', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  it('shows a loading spinner while fetching', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<DefaultRateChart />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders monthly buckets fetched from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        monthly: [
          { date: '2026-06', label: 'Jun 2026', defaulted: 1, funded: 10, defaultRate: 10 },
          { date: '2026-07', label: 'Jul 2026', defaulted: 2, funded: 10, defaultRate: 20 },
        ],
      }),
    });
    render(<DefaultRateChart />);

    await waitFor(() => expect(screen.getByText('20.00%')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/defaults?period=12m')
    );
  });

  it('shows an up trend arrow when the rate increased', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        monthly: [
          { date: '2026-06', label: 'Jun 2026', defaulted: 1, funded: 10, defaultRate: 10 },
          { date: '2026-07', label: 'Jul 2026', defaulted: 3, funded: 10, defaultRate: 30 },
        ],
      }),
    });
    render(<DefaultRateChart />);
    await waitFor(() => expect(screen.getByText('↑')).toBeInTheDocument());
  });

  it('shows a down trend arrow when the rate decreased', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        monthly: [
          { date: '2026-06', label: 'Jun 2026', defaulted: 3, funded: 10, defaultRate: 30 },
          { date: '2026-07', label: 'Jul 2026', defaulted: 1, funded: 10, defaultRate: 10 },
        ],
      }),
    });
    render(<DefaultRateChart />);
    await waitFor(() => expect(screen.getByText('↓')).toBeInTheDocument());
  });

  it('shows a flat trend arrow when the rate is unchanged', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        monthly: [
          { date: '2026-06', label: 'Jun 2026', defaulted: 1, funded: 10, defaultRate: 10 },
          { date: '2026-07', label: 'Jul 2026', defaulted: 1, funded: 10, defaultRate: 10 },
        ],
      }),
    });
    render(<DefaultRateChart />);
    await waitFor(() => expect(screen.getByText('→')).toBeInTheDocument());
  });

  it('falls back to generated mock data when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    render(<DefaultRateChart />);
    await waitFor(() => expect(screen.queryByText(/animate-spin/)).not.toBeInTheDocument());
    // 12 months of mock data always render some current-rate percentage.
    await waitFor(() => expect(screen.getByText('All-time')).toBeInTheDocument());
  });

  it('falls back to generated mock data when the response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<DefaultRateChart />);
    await waitFor(() => expect(screen.getByText('Current')).toBeInTheDocument());
  });
});
