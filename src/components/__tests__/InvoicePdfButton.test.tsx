import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoicePdfButton from '../InvoicePdfButton';
import type { Invoice } from '@/utils/soroban';

const buildInvoicePdfMock = vi.fn();
const invoicePdfFilenameMock = vi.fn((id: bigint) => `ILN-Invoice-${id.toString()}.pdf`);

vi.mock('@/utils/invoicePdf', () => ({
  buildInvoicePdf: (...args: unknown[]) => buildInvoicePdfMock(...args),
  invoicePdfFilename: (...args: [bigint]) => invoicePdfFilenameMock(...args),
}));

const invoice = { id: 42n } as Invoice;
const data = { tokenSymbol: 'USDC', amountFormatted: '1,000.00', dueDateFormatted: 'Jan 1, 2030' };

const createObjectURLMock = vi.fn(() => 'blob:preview-url');
const revokeObjectURLMock = vi.fn();

describe('InvoicePdfButton', () => {
  beforeEach(() => {
    buildInvoicePdfMock.mockReset();
    invoicePdfFilenameMock.mockClear();
    createObjectURLMock.mockClear();
    revokeObjectURLMock.mockClear();
    (global as any).URL.createObjectURL = createObjectURLMock;
    (global as any).URL.revokeObjectURL = revokeObjectURLMock;
  });

  it('opens the export dialog on click and closes it via the close button', () => {
    render(<InvoicePdfButton invoice={invoice} data={data} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));
    expect(screen.getByRole('dialog', { name: 'PDF export options' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the dialog when the backdrop is clicked, but not the panel', () => {
    render(<InvoicePdfButton invoice={invoice} data={data} />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));

    fireEvent.click(screen.getByText('Export Invoice PDF'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('updates the notes character count as the user types', () => {
    render(<InvoicePdfButton invoice={invoice} data={data} />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));

    fireEvent.change(screen.getByPlaceholderText('Optional notes for the recipient…'), {
      target: { value: 'hello' },
    });
    expect(screen.getByText('5/1000')).toBeInTheDocument();
  });

  it('previews the PDF, building a blob URL for the iframe', async () => {
    buildInvoicePdfMock.mockResolvedValue({ output: () => new ArrayBuffer(8) });
    render(<InvoicePdfButton invoice={invoice} data={data} baseUrl="https://iln.app" />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));

    fireEvent.click(screen.getByText('Preview'));
    await waitFor(() => expect(screen.getByTitle('PDF Preview')).toBeInTheDocument());

    expect(buildInvoicePdfMock).toHaveBeenCalledWith(
      invoice,
      expect.objectContaining({
        ...data,
        shareUrl: 'https://iln.app/i/42',
        notes: undefined,
        termsAndConditions: undefined,
        paymentInstructions: undefined,
      })
    );
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  it('trims custom field input and includes it in the built PDF data', async () => {
    buildInvoicePdfMock.mockResolvedValue({ output: () => new ArrayBuffer(8) });
    render(<InvoicePdfButton invoice={invoice} data={data} baseUrl="https://iln.app" />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));

    fireEvent.change(screen.getByPlaceholderText('Optional notes for the recipient…'), {
      target: { value: '  note text  ' },
    });
    fireEvent.click(screen.getByText('Preview'));

    await waitFor(() => expect(buildInvoicePdfMock).toHaveBeenCalled());
    expect(buildInvoicePdfMock).toHaveBeenCalledWith(
      invoice,
      expect.objectContaining({ notes: 'note text' })
    );
  });

  it('downloads the PDF and closes the dialog on success', async () => {
    const saveMock = vi.fn();
    buildInvoicePdfMock.mockResolvedValue({ save: saveMock });
    render(<InvoicePdfButton invoice={invoice} data={data} />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));

    fireEvent.click(within(screen.getByRole('dialog')).getByText('Download PDF'));

    await waitFor(() => expect(saveMock).toHaveBeenCalledWith('ILN-Invoice-42.pdf'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('revokes the previous preview URL when closing after a preview was generated', async () => {
    buildInvoicePdfMock.mockResolvedValue({ output: () => new ArrayBuffer(8) });
    render(<InvoicePdfButton invoice={invoice} data={data} />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));
    fireEvent.click(screen.getByText('Preview'));
    await waitFor(() => expect(screen.getByTitle('PDF Preview')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Close'));
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:preview-url');
  });

  it('falls back to window.location.origin for the share URL when no baseUrl is given', async () => {
    buildInvoicePdfMock.mockResolvedValue({ output: () => new ArrayBuffer(8) });
    render(<InvoicePdfButton invoice={invoice} data={data} />);
    fireEvent.click(screen.getByLabelText('Download invoice as PDF'));
    fireEvent.click(screen.getByText('Preview'));

    await waitFor(() => expect(buildInvoicePdfMock).toHaveBeenCalled());
    expect(buildInvoicePdfMock).toHaveBeenCalledWith(
      invoice,
      expect.objectContaining({ shareUrl: expect.stringContaining('/i/42') })
    );
  });
});
