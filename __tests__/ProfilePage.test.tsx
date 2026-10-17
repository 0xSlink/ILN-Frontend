import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '../app/profile/[address]/page';
import type { Invoice, ReputationScore } from '@/utils/soroban';
import * as soroban from '@/utils/soroban';
import * as federation from '@/utils/federation';

vi.mock('@/components/ProfileActivityChart', () => ({
  default: ({ data }: { data: unknown[] }) => <div>Score chart with {data.length} points</div>,
}));

vi.mock('@/components/ActivityHeatmap', () => ({
  default: () => <div>Activity heatmap</div>,
}));

vi.mock('@/components/DecayWarningBanner', () => ({
  DecayWarningBanner: () => null,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ address: 'GPAYER1' }),
}));

vi.mock('@/utils/soroban', () => ({
  getAllInvoices: vi.fn(),
  getReputation: vi.fn(),
  getReputationEvents: vi.fn(),
}));

vi.mock('@/utils/federation', () => ({
  resolveFederatedAddress: vi.fn(),
}));

const mockedGetAllInvoices = vi.mocked(soroban.getAllInvoices);
const mockedGetReputation = vi.mocked(soroban.getReputation);
const mockedGetReputationEvents = vi.mocked(soroban.getReputationEvents);
const mockedResolveFederatedAddress = vi.mocked(federation.resolveFederatedAddress);

const profileAddress = 'GPAYER1';

const sampleInvoices: Invoice[] = [
  {
    id: 1n,
    status: 'Paid',
    freelancer: 'GFR1',
    payer: profileAddress,
    amount: 10_000_000n,
    due_date: 1710000000n,
    discount_rate: 500,
    funder: 'GLP1',
  },
  {
    id: 2n,
    status: 'Defaulted',
    freelancer: 'GFR2',
    payer: profileAddress,
    amount: 5_000_000n,
    due_date: 1710003600n,
    discount_rate: 600,
    funder: 'GLP2',
  },
  {
    id: 3n,
    status: 'Funded',
    freelancer: profileAddress,
    payer: 'GPAYER2',
    amount: 12_000_000n,
    due_date: 1710007200n,
    discount_rate: 700,
    funder: profileAddress,
  },
];

const sampleReputation: ReputationScore = {
  score: 82,
  invoices_submitted: 4,
  invoices_paid: 10,
  invoices_defaulted: 1,
};

describe('Profile page', () => {
  beforeEach(() => {
    mockedGetAllInvoices.mockReset();
    mockedGetReputation.mockReset();
    mockedGetReputationEvents.mockReset();
    mockedResolveFederatedAddress.mockReset();

    mockedGetAllInvoices.mockResolvedValue(sampleInvoices);
    mockedGetReputation.mockResolvedValue(sampleReputation);
    mockedGetReputationEvents.mockResolvedValue([]);
    mockedResolveFederatedAddress.mockResolvedValue('alice*stellar.org');
  });

  it('renders public reputation data and recent activity', async () => {
    render(<ProfilePage />);

    expect(screen.getByRole('status', { name: /Loading profile data/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('alice*stellar.org')).toBeInTheDocument());

    expect(mockedGetReputation).toHaveBeenCalledWith(profileAddress);
    expect(screen.getByText(new RegExp(profileAddress))).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByText('1 invoices submitted')).toBeInTheDocument();
    expect(screen.getByText('2 invoices')).toBeInTheDocument();
    expect(screen.getByText('1 positions')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent invoice activity' })).toBeInTheDocument();
  });

  it('renders score history when event data is available', async () => {
    mockedGetReputationEvents.mockResolvedValue([
      { type: 'score_updated', timestamp: 1710000000, score: 70 },
      { type: 'score_updated', timestamp: 1710007200, score: 82 },
    ]);

    render(<ProfilePage />);

    expect(await screen.findByText('Score chart with 2 points')).toBeInTheDocument();
  });

  it('renders empty reputation and invoice states', async () => {
    mockedGetAllInvoices.mockResolvedValue([]);
    mockedGetReputation.mockResolvedValue(null);
    mockedResolveFederatedAddress.mockResolvedValue(profileAddress);

    render(<ProfilePage />);

    expect(await screen.findByText('No score')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText(/No score event history/i)).toBeInTheDocument();
    expect(screen.getByText(/No recent invoice activity found/i)).toBeInTheDocument();
  });

  it('renders an error state when profile data fails to load', async () => {
    mockedGetAllInvoices.mockRejectedValue(new Error('RPC down'));

    render(<ProfilePage />);

    expect(await screen.findByText('Failed to load profile data.')).toBeInTheDocument();
  });
});
