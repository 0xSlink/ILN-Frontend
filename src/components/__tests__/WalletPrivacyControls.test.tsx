/**
 * @file WalletPrivacyControls.test.tsx
 *
 * Covers the extracted wallet storage + disconnect controls (#1156).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WalletPrivacyControls } from '../WalletPrivacyControls';

const ADDRESS = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';

describe('WalletPrivacyControls', () => {
  it('renders the copy and disconnect controls', () => {
    render(<WalletPrivacyControls address={ADDRESS} onDisconnect={() => {}} />);
    expect(screen.getByRole('button', { name: /copy address/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('copies the address via the injected onCopy handler', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    render(<WalletPrivacyControls address={ADDRESS} onDisconnect={() => {}} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole('button', { name: /copy address/i }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith(ADDRESS));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument()
    );
  });

  it('falls back to the clipboard when no onCopy is provided', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<WalletPrivacyControls address={ADDRESS} onDisconnect={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /copy address/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ADDRESS));
  });

  it('invokes onDisconnect when Disconnect is clicked', () => {
    const onDisconnect = vi.fn();
    render(<WalletPrivacyControls address={ADDRESS} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(onDisconnect).toHaveBeenCalledOnce();
  });
});
