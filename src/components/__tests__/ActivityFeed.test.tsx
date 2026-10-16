import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ActivityFeed from '../ActivityFeed';

// Mock fetch
const globalFetch = global.fetch;

function envelope(data: unknown[], droppedRecords = 0) {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      resource: 'invoice.events',
      data,
      meta: { apiVersion: '1.0.0', droppedRecords },
    }),
  };
}

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
    (global.fetch as any).mockResolvedValue(envelope([]));

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

    (global.fetch as any).mockResolvedValue(envelope(mockEvents));

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText(/Invoice submitted by/)).toBeInTheDocument();
      expect(screen.getByText(/Invoice funded by/)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'GABC...3456' })[0]).toHaveAttribute(
        'href',
        '/profile/GABC12345678901234567890123456789012345678901234567890123456'
      );
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

    (global.fetch as any).mockResolvedValue(envelope(mockEvents));

    render(<ActivityFeed invoiceId={1n} />);

    await waitFor(() => {
      expect(screen.getByText(/Invoice submitted by/)).toBeInTheDocument();
    });

    const toggle = screen.getByRole('button', { name: 'Show raw event data' });
    fireEvent.click(toggle);
    expect(screen.getByText(/"type": "submitted"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide raw event data' })).toBeInTheDocument();
  });

  it('requests events through the same-origin indexer proxy', async () => {
    (global.fetch as any).mockResolvedValue(envelope([]));
    render(<ActivityFeed invoiceId={42n} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect((global.fetch as any).mock.calls[0][0]).toBe('/api/indexer/invoices/42/events');
  });

  it('shows an explicit error instead of placeholder events when the request fails', async () => {
    (global.fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));

    render(<ActivityFeed invoiceId={1n} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load the activity feed.');
    expect(alert).toHaveTextContent('The indexer could not be reached.');
    expect(screen.queryByText(/Invoice submitted by/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invoice funded by/)).not.toBeInTheDocument();
  });

  it('recovers after a retry', async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        envelope([{ type: 'submitted', timestamp: Date.now() - 60_000, actor: 'GABCDEFGH123456' }])
      );

    render(<ActivityFeed invoiceId={1n} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/Invoice submitted by/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('discloses records the proxy dropped as malformed', async () => {
    (global.fetch as any).mockResolvedValue(
      envelope([{ type: 'submitted', timestamp: Date.now() - 60_000 }], 2)
    );
    render(<ActivityFeed invoiceId={1n} />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '2 records from the indexer could not be displayed'
    );
  });
});
