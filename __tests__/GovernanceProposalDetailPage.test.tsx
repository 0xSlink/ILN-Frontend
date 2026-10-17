import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import ProposalDetailPage from '../app/governance/[id]/page';
import { useWallet } from '@/context/WalletContext';
import { useTransaction } from '@/hooks/useTransaction';
import { useToast } from '@/context/ToastContext';
import { fetchProposal, executeProposal } from '@/utils/governance';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ id: '3' })),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

// These pages render the app chrome (notification bell), which needs the
// notification context.
vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({
    notifications: [],
    unreadCount: 0,
    setNotifications: vi.fn(),
    addNotification: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearUnread: vi.fn(),
    isRead: vi.fn(() => true),
  }),
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: vi.fn(),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/utils/governance', async () => {
  const actual = await vi.importActual<typeof import('@/utils/governance')>('@/utils/governance');
  return {
    ...actual,
    fetchProposal: vi.fn(),
    executeProposal: vi.fn(),
  };
});

const mockUseWallet = useWallet as unknown as vi.Mock;
const mockUseTransaction = useTransaction as unknown as vi.Mock;
const mockUseToast = useToast as unknown as vi.Mock;
const mockFetchProposal = fetchProposal as unknown as vi.Mock;
const mockExecuteProposal = executeProposal as unknown as vi.Mock;
const mockExecute = vi.fn(async (operation: any) => {
  return operation(async () => 'signed-xdr');
});

const baseProposal = {
  id: 3,
  title: 'Enable EURC Support',
  description: 'Enable EURC token support for invoices.',
  type: 'ProtocolUpgrade' as const,
  proposer: 'GCZX...1234',
  createdAt: Math.floor(Date.now() / 1000) - 14 * 86400,
  votingStartsAt: Math.floor(Date.now() / 1000) - 14 * 86400,
  votingEndsAt: Math.floor(Date.now() / 1000) - 7 * 86400,
  votesFor: 215800,
  votesAgainst: 44100,
  quorumRequired: 100000,
  parameterChanges: [
    {
      parameter: 'accepted_tokens',
      currentValue: '[USDC]',
      newValue: '[USDC, EURC]',
    },
  ],
};

function setupMocks() {
  mockUseWallet.mockReturnValue({
    address: 'GABCD...WXYZ',
    isConnected: true,
    connect: vi.fn(),
    signTx: vi.fn().mockResolvedValue('signed-xdr'),
  });
  mockUseToast.mockReturnValue({
    addToast: vi.fn(() => 'toast-id'),
    updateToast: vi.fn(),
  });
  mockUseTransaction.mockReturnValue({
    execute: mockExecute,
    loading: false,
    signingModal: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('Governance proposal detail page timelock execution', () => {
  it('shows timelock countdown for a passed proposal before expiry', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetchProposal.mockResolvedValue({
      ...baseProposal,
      status: 'Passed',
      executableAfter: now + 5 * 86400,
    });

    render(<ProposalDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Timelock expires in/i)).toBeDefined();
    });

    expect(screen.queryByRole('button', { name: /Execute Proposal/i })).toBeNull();
  });

  it('shows execute button when timelock has expired', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetchProposal.mockResolvedValue({
      ...baseProposal,
      status: 'Passed',
      executableAfter: now - 3600,
    });

    render(<ProposalDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Execute Proposal/i })).toBeDefined();
    });

    expect(screen.getByText(/Timelock expired/i)).toBeDefined();
  });

  it('executes a passed proposal after timelock expiry and updates to Executed', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockFetchProposal
      .mockResolvedValueOnce({
        ...baseProposal,
        status: 'Passed',
        executableAfter: now - 3600,
      })
      .mockResolvedValueOnce({
        ...baseProposal,
        status: 'Executed',
        executableAfter: now - 3600,
      });

    mockExecuteProposal.mockResolvedValue('tx-hash-123');

    render(<ProposalDetailPage />);

    const executeButton = await screen.findByRole('button', { name: /Execute Proposal/i });
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
      expect(screen.getByText(/Already executed/i)).toBeDefined();
    });
  });

  it('renders already executed state for a previously executed proposal', async () => {
    mockFetchProposal.mockResolvedValue({
      ...baseProposal,
      status: 'Executed',
      executableAfter: Math.floor(Date.now() / 1000) - 86400,
    });

    render(<ProposalDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Already executed/i)).toBeDefined();
      expect(screen.getByText(/accepted tokens updated to \[USDC, EURC\]/i)).toBeDefined();
    });

    expect(screen.queryByRole('button', { name: /Execute Proposal/i })).toBeNull();
  });
});
