import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import BatchInvoiceForm from '@/components/BatchInvoiceForm';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';

// Mock dependencies
vi.mock('@/context/WalletContext');
vi.mock('@/context/ToastContext');
vi.mock('@/hooks/useApprovedTokens');
vi.mock('@/utils/soroban');

const mockUseWallet = vi.mocked(useWallet);
const mockUseToast = vi.mocked(useToast);
const mockUseApprovedTokens = vi.mocked(useApprovedTokens);

const mockTokens = [
  { contractId: 'USDC123', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { contractId: 'EURC456', symbol: 'EURC', name: 'Euro Coin', decimals: 7 },
];

const mockTokenMap = new Map(mockTokens.map((t) => [t.contractId, t]));

describe('BatchInvoiceForm', () => {
  const mockOnSuccess = vi.fn();
  const mockAddToast = vi.fn();
  const mockUpdateToast = vi.fn();
  const mockSignTx = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseWallet.mockReturnValue({
      address: 'GTEST123',
      signTx: mockSignTx,
      isConnected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    mockUseToast.mockReturnValue({
      addToast: mockAddToast,
      updateToast: mockUpdateToast,
      removeToast: vi.fn(),
    });

    mockUseApprovedTokens.mockReturnValue({
      tokens: mockTokens,
      tokenMap: mockTokenMap,
      defaultToken: mockTokens[0],
      isLoading: false,
      error: null,
    });
  });

  it('renders CSV upload mode by default', () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    // "CSV Upload" is both the mode tab and the section heading.
    expect(screen.getByRole('heading', { name: 'CSV Upload' })).toBeInTheDocument();
    expect(screen.getByText('Click to upload CSV file')).toBeInTheDocument();
    expect(screen.getByText('Download Template')).toBeInTheDocument();
  });

  it('switches to dynamic form mode', () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByText('Dynamic Form'));

    expect(screen.getByText('Dynamic Form Entry')).toBeInTheDocument();
    expect(screen.getByText('Add Row')).toBeInTheDocument();
  });

  it('adds and removes form rows', () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    // Switch to form mode
    fireEvent.click(screen.getByText('Dynamic Form'));

    // "Stellar address" is the payer input's placeholder, one per row.
    expect(screen.getAllByPlaceholderText('Stellar address')).toHaveLength(1);

    // Add a row
    fireEvent.click(screen.getByText('Add Row'));
    expect(screen.getAllByPlaceholderText('Stellar address')).toHaveLength(2);

    // Remove a row (click the first delete button)
    const deleteButtons = screen.getAllByTitle('Remove row');
    fireEvent.click(deleteButtons[0]);
    expect(screen.getAllByPlaceholderText('Stellar address')).toHaveLength(1);
  });

  it('validates form data', async () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    // Switch to form mode
    fireEvent.click(screen.getByText('Dynamic Form'));

    // Try to submit without filling required fields
    const submitButton = screen.getByText('Submit Batch');
    expect(submitButton).toBeDisabled();
  });

  it('downloads CSV template', () => {
    // Mock URL.createObjectURL and document.createElement
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();

    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    };
    // Only intercept the download anchor: React needs the real createElement.
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) =>
        tagName === 'a' ? (mockAnchor as any) : realCreateElement(tagName, options)
      );

    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    fireEvent.click(screen.getByText('Download Template'));

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockAnchor.download).toBe('invoice-batch-template.csv');
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('handles CSV file upload', async () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    const csvContent = `payer,amount,token,discount_rate,due_date
GTEST123,1000.00,USDC,3.50,2024-12-31`;

    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    const input = document.getElementById('csv-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });
  });

  it('shows validation errors for invalid data', () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    // Switch to form mode
    fireEvent.click(screen.getByText('Dynamic Form'));

    // Fill in invalid data
    const payerInput = screen.getByPlaceholderText('Stellar address');
    fireEvent.change(payerInput, { target: { value: 'invalid-address' } });

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '-100' } });

    // Check for validation message
    expect(screen.getByText('Please fix validation errors before submitting')).toBeInTheDocument();
  });

  it('calculates total amount correctly', () => {
    render(<BatchInvoiceForm onSuccess={mockOnSuccess} />);

    // Switch to form mode
    fireEvent.click(screen.getByText('Dynamic Form'));

    // Fill in valid data
    const payerInput = screen.getByPlaceholderText('Stellar address');
    fireEvent.change(payerInput, {
      target: { value: 'GTEST123EXAMPLE456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZ' },
    });

    const amountInput = screen.getByPlaceholderText('0.00');
    fireEvent.change(amountInput, { target: { value: '1000.00' } });

    // Should show total amount in summary
    expect(screen.getByText('Total Amount')).toBeInTheDocument();
  });
});
