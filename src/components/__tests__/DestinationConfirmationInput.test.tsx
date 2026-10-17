import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DestinationConfirmationInput from '../DestinationConfirmationInput';

describe('DestinationConfirmationInput', () => {
  const targetAddress = 'GBCONFIRMATIONADDRESS12345678901234567890123456ABCDEF';
  const expectedSuffix = 'ABCDEF';

  it('renders nothing when destination address is shorter than required length', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DestinationConfirmationInput
        destinationAddress="G123"
        onConfirmationChange={onChange}
        requiredLength={6}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('renders confirmation gate and validates exact matching suffix', () => {
    const onChange = vi.fn();
    render(
      <DestinationConfirmationInput
        destinationAddress={targetAddress}
        onConfirmationChange={onChange}
        requiredLength={6}
      />
    );

    expect(screen.getByTestId('destination-confirmation-gate')).toBeInTheDocument();
    expect(screen.getByText(/...ABCDEF/i)).toBeInTheDocument();
    expect(screen.getByText(/Type last 6 chars/i)).toBeInTheDocument();

    const input = screen.getByRole('textbox');

    // Type wrong suffix
    fireEvent.change(input, { target: { value: 'ZZZZZZ' } });
    expect(screen.getByText('Mismatch')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(false);

    // Type correct suffix (case-insensitive)
    fireEvent.change(input, { target: { value: 'abcdef' } });
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('resets confirmation when destination address prop changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DestinationConfirmationInput
        destinationAddress={targetAddress}
        onConfirmationChange={onChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: expectedSuffix } });
    expect(onChange).toHaveBeenLastCalledWith(true);

    // Change target address
    rerender(
      <DestinationConfirmationInput
        destinationAddress="GNEWADDRESS123456789012345678901234567890123456789XYZ999"
        onConfirmationChange={onChange}
      />
    );

    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
