import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InsurancePoolPanel from '@/components/InsurancePoolPanel';
import { useInsurance } from '@/hooks/useInsurance';
import { useTransaction } from '@/hooks/useTransaction';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';

vi.mock('@/hooks/useInsurance');
vi.mock('@/hooks/useTransaction');
vi.mock('@/hooks/useApprovedTokens');
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6',
  }),
}));

describe('InsurancePoolPanel', () => {
  const mockRefresh = vi.fn();
  const mockExecute = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // The panel renders null unless the insurance pool feature flag is on.
    vi.stubEnv('NEXT_PUBLIC_INSURANCE_POOL_ENABLED', 'true');

    (useInsurance as any).mockReturnValue({
      poolInfo: {
        balance: 500000000000n,
        enrolled_count: 12,
        premium_rate: 50,
      },
      isEnrolled: false,
      isLoading: false,
      refresh: mockRefresh,
    });

    (useTransaction as any).mockReturnValue({
      execute: mockExecute,
    });

    (useApprovedTokens as any).mockReturnValue({
      defaultToken: { symbol: 'USDC', decimals: 7 },
    });
  });

  it('renders pool information correctly', () => {
    render(<InsurancePoolPanel />);

    expect(screen.getByText('Default Protection')).toBeInTheDocument();
    expect(screen.getByText(/50,000 USDC/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('0.5%')).toBeInTheDocument();
    expect(screen.getByText('Not Enrolled')).toBeInTheDocument();
  });

  it('shows enrolled status when LP is enrolled', () => {
    (useInsurance as any).mockReturnValue({
      poolInfo: {
        balance: 500000000000n,
        enrolled_count: 12,
        premium_rate: 50,
      },
      isEnrolled: true,
      isLoading: false,
      refresh: mockRefresh,
    });

    render(<InsurancePoolPanel />);

    expect(screen.getByText('Enrolled')).toBeInTheDocument();
    expect(screen.getByText('Deposit More Premium')).toBeInTheDocument();
  });

  it('calls execute when clicking enroll', async () => {
    render(<InsurancePoolPanel />);

    const enrollButton = screen.getByText('Enroll in Protection');
    fireEvent.click(enrollButton);

    expect(mockExecute).toHaveBeenCalled();
  });

  it('shows loading skeleton when isLoading is true', () => {
    (useInsurance as any).mockReturnValue({
      poolInfo: null,
      isEnrolled: false,
      isLoading: true,
      refresh: mockRefresh,
    });

    const { container } = render(<InsurancePoolPanel />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});
