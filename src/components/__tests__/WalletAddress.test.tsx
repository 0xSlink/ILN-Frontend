/**
 * @file WalletAddress.test.tsx
 *
 * Covers the WalletAddress component states:
 *
 *  1. Loading – renders a skeleton while Federation resolution is pending.
 *  2. Federation resolved – shows `alice*example.com`.
 *  3. Federation absent – shows the truncated G-address fallback.
 *  4. Copy button – writes the original G-address to the clipboard.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveFederatedAddress = vi.fn<[string], Promise<string>>();

vi.mock('@/utils/federation', () => ({
  resolveFederatedAddress: (addr: string) => resolveFederatedAddress(addr),
}));

import WalletAddress from '../WalletAddress';

const FULL_ADDRESS = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';
const SHORT_ADDRESS = 'GCCC...CCC6';

describe('WalletAddress', () => {
  beforeEach(() => {
    resolveFederatedAddress.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a skeleton while resolution is in flight', () => {
    resolveFederatedAddress.mockReturnValue(new Promise(() => {}));
    render(<WalletAddress address={FULL_ADDRESS} />);
    expect(screen.getByTestId('wallet-address-skeleton')).toBeInTheDocument();
  });

  it('renders the Federation address when one is returned', async () => {
    resolveFederatedAddress.mockResolvedValue('alice*iln.finance');
    render(<WalletAddress address={FULL_ADDRESS} />);
    await waitFor(() =>
      expect(screen.getByTestId('wallet-address-display')).toHaveTextContent('alice*iln.finance')
    );
  });

  it('falls back to the truncated G-address when Federation is unavailable', async () => {
    resolveFederatedAddress.mockResolvedValue(FULL_ADDRESS);
    render(<WalletAddress address={FULL_ADDRESS} />);
    await waitFor(() =>
      expect(screen.getByTestId('wallet-address-display')).toHaveTextContent(SHORT_ADDRESS)
    );
  });

  it('copies the full G-address to the clipboard, not the Federation alias', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    resolveFederatedAddress.mockResolvedValue('alice*iln.finance');

    render(<WalletAddress address={FULL_ADDRESS} />);
    const copyBtn = await screen.findByRole('button', { name: /copy wallet address/i });
    fireEvent.click(copyBtn);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FULL_ADDRESS));
  });

  it('renders nothing visible (no skeleton, no value) when address is empty', () => {
    render(<WalletAddress address="" />);
    expect(screen.queryByTestId('wallet-address-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wallet-address-display')).toBeInTheDocument();
  });

  it('respects hideCopy', async () => {
    resolveFederatedAddress.mockResolvedValue(FULL_ADDRESS);
    render(<WalletAddress address={FULL_ADDRESS} hideCopy />);
    await screen.findByTestId('wallet-address-display');
    expect(screen.queryByRole('button', { name: /copy wallet address/i })).not.toBeInTheDocument();
  });
});
