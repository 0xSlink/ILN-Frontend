import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InvoiceQRModal from '../InvoiceQRModal';

type QRCodeCanvasProps = {
  value: string;
  [key: string]: unknown;
};

type QRCodeSVGProps = {
  value: string;
  'aria-label'?: string;
  [key: string]: unknown;
};

vi.mock('qrcode.react', () => {
  const QRCodeCanvas = React.forwardRef<HTMLCanvasElement, QRCodeCanvasProps>(
    function QRCodeCanvas(props, ref) {
      return <canvas ref={ref} data-testid="qr-canvas" data-value={props.value} />;
    }
  );

  return {
    QRCodeCanvas,
    QRCodeSVG: (props: QRCodeSVGProps) => (
      <svg data-testid="qr-svg" data-value={props.value} aria-label={props['aria-label']} />
    ),
  };
});

const defaultProps = {
  invoiceId: 42n,
  amount: 1_500_000_000n,
  dueDate: 1_900_000_000n,
  freelancer: 'GFREELANCERFREELANCERFREELANCERFREELANCERFREELANCERQ2K',
};

describe('InvoiceQRModal', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,FAKE');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders invoice details and the pay URL derived from window.location', () => {
    render(<InvoiceQRModal {...defaultProps} onClose={vi.fn()} />);

    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByTestId('qr-svg')).toHaveAttribute(
      'data-value',
      `${window.location.origin}/pay/42`
    );
  });

  it('uses a provided baseUrl to build the pay URL', () => {
    render(<InvoiceQRModal {...defaultProps} baseUrl="https://iln.example" onClose={vi.fn()} />);

    expect(screen.getByTestId('qr-svg')).toHaveAttribute(
      'data-value',
      'https://iln.example/pay/42'
    );
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(<InvoiceQRModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close QR modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not when the card content is clicked', () => {
    const onClose = vi.fn();
    render(<InvoiceQRModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Scan to pay this invoice'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('downloads a PNG using the canvas data URL', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<InvoiceQRModal {...defaultProps} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Download PNG'));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('copies the pay link and reverts the label after a timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<InvoiceQRModal {...defaultProps} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Copy link'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pay/42`);
    });
    await screen.findByText('Copied!');

    vi.advanceTimersByTime(2000);
    await waitFor(() => {
      expect(screen.getByText('Copy link')).toBeInTheDocument();
    });
  });

  it('opens a print window with the invoice details and triggers print on load', () => {
    const printSpy = vi.fn();
    const writeSpy = vi.fn();
    const closeSpy = vi.fn();
    const fakeWindow = {
      document: { write: writeSpy, close: closeSpy },
      print: printSpy,
      onload: null as (() => void) | null,
    };
    vi.spyOn(window, 'open').mockReturnValue(
      fakeWindow as unknown as Window & { onload: (() => void) | null }
    );

    render(<InvoiceQRModal {...defaultProps} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Print QR Code'));

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Invoice QR Code #42'));
    expect(closeSpy).toHaveBeenCalled();

    fakeWindow.onload();
    expect(printSpy).toHaveBeenCalled();
  });

  it('does nothing when the print popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    render(<InvoiceQRModal {...defaultProps} onClose={vi.fn()} />);

    expect(() => fireEvent.click(screen.getByText('Print QR Code'))).not.toThrow();
  });
});
