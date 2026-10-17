/**
 * Accessibility re-audit for the UI surfaces introduced by the final mainnet
 * readiness batch (issue #119).
 *
 * Method: follows the project's established accessibility approach documented in
 * docs/accessibility-implementation-summary.md — jest-axe automated audits plus
 * explicit DOM assertions for the ARIA patterns that axe cannot fully verify
 * (live-region semantics, labelled loading states, programmatic label
 * association). Surfaces covered:
 *
 * 1. DelegationPanel real-data states — labelled input, labelled async
 *    federation-resolution spinner, polite live region for resolution results
 *    and cycle-detection errors, assertive error alert for transaction
 *    failures, and a labelled loading state instead of a silent one.
 * 2. Admin confirmation dialogs — the former window.confirm flow rendered in
 *    the browser chrome, which is invisible to axe. Replaced by an in-page
 *    role="dialog" with aria-modal, a labelled title and description, and a
 *    Cancel-first focus target so a destructive action cannot be confirmed by
 *    a stray Enter.
 * 3. Admin dashboard status feedback — async action results (actionMessage,
 *    tokenActionMessage) and the filtered-out empty state are announced via
 *    role="status" live regions.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DelegationPanel } from '@/components/governance/DelegationPanel';
import AdminConfirmDialog from '@/components/admin/AdminConfirmDialog';
import AdminHealthDashboard from '@/app/admin/page';

const adminAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const walletState = {
  address: adminAddress as string | null,
  signTx: vi.fn(),
};
const txState = { error: null as string | null, loading: false };

const mockIsValidStellarAddress = vi.fn();
const mockResolveFederatedAddress = vi.fn();
const mockExecute = vi.fn();

vi.mock('@/utils/governance', () => ({
  isValidStellarAddress: (...args: unknown[]) => mockIsValidStellarAddress(...args),
}));

vi.mock('@/utils/federation', () => ({
  resolveFederatedAddress: (...args: unknown[]) => mockResolveFederatedAddress(...args),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({
    execute: mockExecute,
    loading: txState.loading,
    error: txState.error,
  }),
}));

const fetchProtocolHealth = vi.fn();
const fetchAdminActionHistory = vi.fn();
const setProtocolPaused = vi.fn();
const executeReadyProposals = vi.fn();

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock('@/utils/admin-health', () => ({
  fetchProtocolHealth: () => fetchProtocolHealth(),
  fetchAdminActionHistory: () => fetchAdminActionHistory(),
  setProtocolPaused: (...args: unknown[]) => setProtocolPaused(...args),
  executeReadyProposals: (...args: unknown[]) => executeReadyProposals(...args),
  isAdminAddress: (address: string | null | undefined) => address === adminAddress,
}));

const mockHealth = {
  paused: false,
  disputedInvoices: [],
  pendingProposals: [],
  readyProposals: [
    {
      id: 3,
      title: 'Ready proposal',
      description: 'Ready to execute.',
      type: 'ProtocolUpgrade',
      status: 'Passed',
      proposer: 'GPROPOSER',
      createdAt: 1,
      votingStartsAt: 1,
      votingEndsAt: 2,
      executableAfter: 3,
      votesFor: 10,
      votesAgainst: 0,
      quorumRequired: 10,
    },
  ],
  oracleLastUpdatedAt: Math.floor(Date.now() / 1000) - 600,
  contractVersion: 'testnet:CD3TE3IA',
  upgradeWindowStartsAt: Math.floor(Date.now() / 1000) + 3 * 86_400,
  treasuryBalanceXlm: 123.45,
};

beforeEach(() => {
  vi.clearAllMocks();
  walletState.address = adminAddress;
  txState.error = null;
  txState.loading = false;
  mockExecute.mockResolvedValue(true);
  mockResolveFederatedAddress.mockReset();
  mockIsValidStellarAddress.mockReset();
  fetchProtocolHealth.mockReset();
  fetchProtocolHealth.mockResolvedValue(mockHealth);
  fetchAdminActionHistory.mockReset();
  fetchAdminActionHistory.mockResolvedValue([]);
  setProtocolPaused.mockReset();
  setProtocolPaused.mockResolvedValue({ txHash: 'abc', paused: true });
  executeReadyProposals.mockReset();
  executeReadyProposals.mockResolvedValue(['tx']);
});

describe('DelegationPanel accessibility (batch re-audit)', () => {
  it('has no axe violations in the connected real-data state', async () => {
    mockIsValidStellarAddress.mockReturnValue(false);
    const { container } = render(<DelegationPanel />);
    await waitFor(() => {
      expect(screen.queryByText('Loading your delegation status…')).not.toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('associates the delegate input with its programmatic label', () => {
    render(<DelegationPanel />);
    expect(screen.getByLabelText('Delegate Your Votes')).toBeInTheDocument();
  });

  it('announces the loading state via a labelled status region', async () => {
    render(<DelegationPanel />);
    expect(
      screen.getByRole('status', { name: 'Loading your delegation status…' })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole('status', { name: 'Loading your delegation status…' })
      ).not.toBeInTheDocument();
    });
  });

  it('labels the federation resolution spinner for screen readers', async () => {
    mockResolveFederatedAddress.mockReturnValue(new Promise(() => {}));
    render(<DelegationPanel />);
    fireEvent.change(screen.getByLabelText('Delegate Your Votes'), {
      target: { value: 'user*example.org' },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('status', { name: 'Resolving federation address' })
      ).toBeInTheDocument();
    });
  });

  it('exposes the transaction error as an assertive alert', () => {
    txState.error = 'Delegation transaction failed.';
    render(<DelegationPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('Delegation transaction failed.');
  });
});

describe('AdminConfirmDialog accessibility (batch re-audit)', () => {
  const dialogProps = {
    title: 'Pause the protocol',
    description: 'This sensitive admin action will call the contract.',
    confirmLabel: 'Pause protocol',
    onConfirm: () => {},
    onCancel: () => {},
  };

  it('has no axe violations', async () => {
    const { container } = render(<AdminConfirmDialog {...dialogProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('exposes title and description via aria-labelledby and aria-describedby', () => {
    render(<AdminConfirmDialog {...dialogProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Pause the protocol').id).toBe('admin-confirm-title');
    expect(
      screen.getByText('This sensitive admin action will call the contract.').id
    ).toBe('admin-confirm-description');
  });

  it('cancels on Escape via the shared focus trap', () => {
    const onCancel = vi.fn();
    render(<AdminConfirmDialog {...dialogProps} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('focuses the non-destructive Cancel action when opened', () => {
    render(<AdminConfirmDialog {...dialogProps} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
});

describe('Admin dashboard status feedback accessibility (batch re-audit)', () => {
  it('has no axe violations on the admin dashboard', async () => {
    const { container } = render(<AdminHealthDashboard />);
    await screen.findByText('Protocol Health');
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });

  it('announces async admin action results through a live region', async () => {
    const user = userEvent.setup();
    render(<AdminHealthDashboard />);
    await user.click(await screen.findByRole('button', { name: 'Pause' }));

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Pause protocol' }));

    await waitFor(() => {
      const statuses = screen.getAllByRole('status');
      expect(
        statuses.some((el) => el.textContent?.includes('Protocol paused successfully.'))
      ).toBe(true);
    });
    expect(setProtocolPaused).toHaveBeenCalledWith(true, adminAddress, walletState.signTx);
  });

  it('renders the filtered-out audit log empty state as a live region', async () => {
    const user = userEvent.setup();
    render(<AdminHealthDashboard />);
    await screen.findByText('Admin Action Audit Log');

    await user.click(screen.getByRole('button', { name: 'Signer Rotations (Security)' }));
    await waitFor(() => {
      const statuses = screen.getAllByRole('status');
      expect(
        statuses.some((el) =>
          el.textContent?.includes('No admin actions found for the selected filter.')
        )
      ).toBe(true);
    });
  });
});
