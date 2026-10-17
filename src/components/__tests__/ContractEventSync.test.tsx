import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContractEventSync from '../ContractEventSync';

const useContractEventsMock = vi.fn();
vi.mock('@/hooks/useContractEvents', () => ({
  useContractEvents: (...args: unknown[]) => useContractEventsMock(...args),
}));

describe('ContractEventSync', () => {
  beforeEach(() => {
    useContractEventsMock.mockReset();
  });

  it('renders nothing when there is no error', () => {
    useContractEventsMock.mockReturnValue({ error: null, retryCount: 0, refresh: vi.fn() });
    const { container } = render(<ContractEventSync />);
    expect(container).toBeEmptyDOMElement();
    expect(useContractEventsMock).toHaveBeenCalledWith(true);
  });

  it('shows the error message without a retry count when retryCount is 0', () => {
    useContractEventsMock.mockReturnValue({
      error: 'Connection lost',
      retryCount: 0,
      refresh: vi.fn(),
    });
    render(<ContractEventSync />);
    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
    expect(screen.queryByText(/Retry attempt/)).not.toBeInTheDocument();
  });

  it('shows the retry count when retrying', () => {
    useContractEventsMock.mockReturnValue({
      error: 'Falling back to polling',
      retryCount: 2,
      refresh: vi.fn(),
    });
    render(<ContractEventSync />);
    expect(screen.getByText('Retry attempt 2 of 3')).toBeInTheDocument();
  });

  it('calls refresh when the button is clicked', () => {
    const refresh = vi.fn();
    useContractEventsMock.mockReturnValue({ error: 'boom', retryCount: 1, refresh });
    render(<ContractEventSync />);
    fireEvent.click(screen.getByText('Refresh Now'));
    expect(refresh).toHaveBeenCalled();
  });
});
