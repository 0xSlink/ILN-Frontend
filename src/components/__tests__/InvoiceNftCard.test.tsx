import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useInvoiceNft', () => ({
  useInvoiceNft: vi.fn(),
}));

import { useInvoiceNft } from '@/hooks/useInvoiceNft';
import InvoiceNftCard from '../InvoiceNftCard';

const mockedUseInvoiceNft = vi.mocked(useInvoiceNft);

describe('InvoiceNftCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The card renders null unless the NFT feature flag is on.
    vi.stubEnv('NEXT_PUBLIC_NFT_ENABLED', 'true');
  });

  it('renders loading skeleton initially', () => {
    mockedUseInvoiceNft.mockReturnValue({ state: null, loading: true, reload: vi.fn() } as any);
    render(<InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders nothing when NFT status is none', () => {
    mockedUseInvoiceNft.mockReturnValue({
      loading: false,
      reload: vi.fn(),
      state: { status: 'none', tokenId: 1n, transfers: [] },
    } as any);
    const { container } = render(
      <InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders error state with retry', () => {
    const reload = vi.fn();
    mockedUseInvoiceNft.mockReturnValue({
      loading: false,
      reload,
      state: { status: 'error', tokenId: 1n, transfers: [], error: 'Boom' },
    } as any);
    render(<InvoiceNftCard invoiceId={1n} invoiceStatus="Pending" walletAddress={null} />);
    expect(screen.getByText('Unable to load NFT right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(reload).toHaveBeenCalled();
  });

  it('renders minted state with holder and history', () => {
    mockedUseInvoiceNft.mockReturnValue({
      loading: false,
      reload: vi.fn(),
      state: {
        status: 'minted',
        tokenId: 42n,
        currentHolder: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        mintDate: Date.UTC(2026, 0, 1),
        mintTxHash: 'abcd'.repeat(16),
        transfers: [
          {
            txHash: 'beef'.repeat(16),
            timestamp: Date.UTC(2026, 0, 2),
            from: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            to: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
          },
        ],
      },
    } as any);

    render(
      <InvoiceNftCard
        invoiceId={42n}
        invoiceStatus="Funded"
        walletAddress={'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'}
        invoiceFunder={'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'}
      />
    );

    expect(screen.getByText('Invoice NFT')).toBeInTheDocument();
    expect(screen.getByText('Token ID')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Transfer History')).toBeInTheDocument();
    expect(screen.getByText('Your NFT claim receipt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View tx' })).toBeInTheDocument();
  });

  it('shows burn pending notice when invoice is paid but burn not detected', () => {
    mockedUseInvoiceNft.mockReturnValue({
      loading: false,
      reload: vi.fn(),
      state: {
        status: 'minted',
        tokenId: 9n,
        transfers: [],
        currentHolder: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      },
    } as any);
    render(<InvoiceNftCard invoiceId={9n} invoiceStatus="Paid" walletAddress={null} />);
    expect(screen.getByText(/burn transaction is not detected yet/i)).toBeInTheDocument();
  });

  it('shows burned state with burn tx', () => {
    mockedUseInvoiceNft.mockReturnValue({
      loading: false,
      reload: vi.fn(),
      state: { status: 'burned', tokenId: 7n, transfers: [], burnTxHash: 'cafe'.repeat(16) },
    } as any);
    render(<InvoiceNftCard invoiceId={7n} invoiceStatus="Paid" walletAddress={null} />);
    expect(screen.getByText('NFT Burned')).toBeInTheDocument();
    expect(screen.getByText('Burn Tx')).toBeInTheDocument();
  });
});
