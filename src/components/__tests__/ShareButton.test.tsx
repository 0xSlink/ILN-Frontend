import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShareButton from '../ShareButton';
import type { Invoice } from '@/utils/soroban';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 7n,
    freelancer: 'GFREELANCER',
    funder: 'GFUNDER',
    payer: 'GPAYER',
    amount: 5_000_000_000n,
    discount_rate: 500,
    status: 'Paid',
    funded_at: BigInt(Math.floor(Date.now() / 1000) - 86400 * 3),
    ...overrides,
  } as Invoice;
}

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders nothing when the invoice is not Paid', () => {
    const { container } = render(
      <ShareButton invoice={invoice({ status: 'Funded' })} userAddress="GFREELANCER" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the viewer is neither the freelancer nor the funder', () => {
    const { container } = render(
      <ShareButton invoice={invoice()} userAddress="GSOMEONEELSE" baseUrl="https://iln.app" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('builds a freelancer-flavored tweet for the freelancer', () => {
    render(<ShareButton invoice={invoice()} userAddress="GFREELANCER" baseUrl="https://iln.app" />);
    const link = screen.getByLabelText('Share on X / Twitter') as HTMLAnchorElement;
    const text = decodeURIComponent(link.href.split('text=')[1]);
    expect(text).toContain('Just got paid on-chain');
    expect(text).toContain('https://iln.app/pay/7');
  });

  it('builds an LP-flavored tweet for the funder', () => {
    render(<ShareButton invoice={invoice()} userAddress="GFUNDER" baseUrl="https://iln.app" />);
    const link = screen.getByLabelText('Share on X / Twitter') as HTMLAnchorElement;
    const text = decodeURIComponent(link.href.split('text=')[1]);
    expect(text).toContain('Earned');
    expect(text).toContain('yield');
  });

  it('copies the tweet text to the clipboard and shows a temporary confirmation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ShareButton invoice={invoice()} userAddress="GFREELANCER" baseUrl="https://iln.app" />);

    fireEvent.click(screen.getByLabelText('Copy tweet to clipboard'));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.getByText('Copy text')).toBeInTheDocument());
    vi.useRealTimers();
  });

  it('silently ignores a clipboard failure', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<ShareButton invoice={invoice()} userAddress="GFREELANCER" baseUrl="https://iln.app" />);
    fireEvent.click(screen.getByLabelText('Copy tweet to clipboard'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
  });

  it('shows the character count for a normal-length tweet', () => {
    render(<ShareButton invoice={invoice()} userAddress="GFREELANCER" baseUrl="https://iln.app" />);
    const link = screen.getByLabelText('Share on X / Twitter') as HTMLAnchorElement;
    const text = decodeURIComponent(link.href.split('text=')[1]);
    expect(text.length).toBeLessThanOrEqual(280);
    expect(screen.getByLabelText('Character count')).toHaveTextContent(`${text.length}/280`);
  });

  it('truncates an overly long tweet while preserving the trailing share URL', () => {
    const hugeId = BigInt('1' + '0'.repeat(80));
    render(
      <ShareButton
        invoice={invoice({ id: hugeId })}
        userAddress="GFREELANCER"
        baseUrl="https://iln.app"
      />
    );
    const link = screen.getByLabelText('Share on X / Twitter') as HTMLAnchorElement;
    const text = decodeURIComponent(link.href.split('text=')[1]);
    expect(text.length).toBeLessThanOrEqual(280);
    expect(text.endsWith(`https://iln.app/pay/${hugeId.toString()}`)).toBe(true);
    expect(text).toContain('... ');
  });
});
