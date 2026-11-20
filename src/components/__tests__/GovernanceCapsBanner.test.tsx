import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import GovernanceCapsBanner from '../GovernanceCapsBanner';

describe('GovernanceCapsBanner', () => {
  it('renders nothing when no caps are active', () => {
    const { container } = render(
      <GovernanceCapsBanner
        maxInvoiceAmountFormatted={null}
        tokenVolumeCapFormatted={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders banner variant with max invoice and TVL caps', () => {
    render(
      <GovernanceCapsBanner
        maxInvoiceAmountFormatted="5,000 USDC"
        tokenVolumeCapFormatted="50,000 USDC"
        currentVolumeFormatted="15,000 USDC"
      />
    );

    expect(screen.getByTestId('governance-caps-banner')).toBeInTheDocument();
    expect(screen.getByText('Staged Rollout Safeguards Active')).toBeInTheDocument();
    expect(screen.getByTestId('banner-max-invoice-cap')).toHaveTextContent('5,000 USDC');
    expect(screen.getByTestId('banner-token-volume-cap')).toHaveTextContent('15,000 USDC / 50,000 USDC');

    const link = screen.getByRole('link', { name: /view governance/i });
    expect(link).toHaveAttribute('href', '/governance');
  });

  it('renders inline variant for contextual embedding in forms', () => {
    render(
      <GovernanceCapsBanner
        variant="inline"
        maxInvoiceAmountFormatted="5,000 USDC"
      />
    );

    const notice = screen.getByTestId('governance-cap-notice');
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent('Maximum invoice amount during initial launch: 5,000 USDC');
  });
});
