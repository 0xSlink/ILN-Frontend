import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ActivityFeed from '../ActivityFeed';

// Mock fetch
const globalFetch = global.fetch;

describe('ActivityFeed', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = globalFetch;
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (global.fetch as any).mockReturnValue(new Promise(() => {})); // Never resolves
    render(<ActivityFeed invoiceId={1n} />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render empty state when no events', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText('No activity yet for this invoice.')).toBeInTheDocument();
    });
  });

  it('should render events correctly and link actor profile', async () => {
    const mockEvents = [
      {
        type: 'submitted',
        timestamp: Date.now() - 3600000,
        actor: 'GABC12345678901234567890123456789012345678901234567890123456',
      },
      {
        type: 'funded',
        timestamp: Date.now() - 1800000,
        actor: 'GDEF5678901234567890123456789012345678901234567890123456',
        data: { amount: '5000000000' },
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    });

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText(/Invoice submitted by/)).toBeInTheDocument();
      expect(screen.getByText(/Invoice funded by/)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'GABC...3456' }).length).toBeGreaterThan(0);
      expect(screen.getByText('1 hours ago')).toBeInTheDocument();
    });
  });

  it('should toggle raw event data when requested', async () => {
    const mockEvents = [
      {
        type: 'submitted',
        timestamp: Date.now() - 3600000,
        actor: 'GABC12345678901234567890123456789012345678901234567890123456',
      },
    ];

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    });

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText(/Invoice submitted by/)).toBeInTheDocument();
    });

    const toggle = screen.getByRole('button', { name: 'Show raw event data' });
    fireEvent.click(toggle);
    expect(screen.getByText(/"type": "submitted"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide raw event data' })).toBeInTheDocument();
  });

  it('shows an honest unavailable notice when the indexer cannot be reached', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      // No fabricated audit-trail events should be shown when the indexer is down.
      expect(screen.queryByText(/Invoice submitted by/)).not.toBeInTheDocument();
    });
  });

  it('does not show mock events when the indexer returns a non-ok response', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => [] });

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
      expect(screen.queryByText(/Invoice funded by/)).not.toBeInTheDocument();
    });
  });
});
