import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DynamicInvoicePdfButton from '../DynamicInvoicePdfButton';

vi.mock('../InvoicePdfButton', () => ({
  default: () => <div data-testid="real-invoice-pdf-button" />,
}));

describe('DynamicInvoicePdfButton', () => {
  it('eventually renders the real InvoicePdfButton', async () => {
    render(<DynamicInvoicePdfButton invoice={{} as any} data={{} as any} />);
    expect(await screen.findByTestId('real-invoice-pdf-button')).toBeInTheDocument();
  });
});
