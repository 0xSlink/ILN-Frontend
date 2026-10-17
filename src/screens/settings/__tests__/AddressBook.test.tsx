import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddressBookPage from '../AddressBook';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

const addToastMock = vi.fn(() => 'toast-id');
const updateToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: updateToastMock }),
}));

const addAddressMock = vi.fn(() => true);
const deleteAddressMock = vi.fn();
const searchAddressesMock = vi.fn();
const retryHydrationMock = vi.fn();
const clearCorruptedStateMock = vi.fn();

const addressBook = [
  { id: '1', address: 'GADDRESSONELONGENOUGH1234567890', nickname: 'Alice' },
  { id: '2', address: 'GADDRESSTWOLONGENOUGH1234567890', nickname: 'Bob' },
];

let mockHookState: Record<string, unknown> = {
  addressBook,
  addAddress: addAddressMock,
  deleteAddress: deleteAddressMock,
  searchAddresses: searchAddressesMock,
  isLoading: false,
  isDegraded: false,
  error: null,
  validationIssues: null,
  retryHydration: retryHydrationMock,
  clearCorruptedState: clearCorruptedStateMock,
};

vi.mock('@/hooks/useAddressBook', () => ({
  default: () => mockHookState,
}));

describe('AddressBookPage', () => {
  beforeEach(() => {
    addToastMock.mockClear();
    updateToastMock.mockClear();
    addAddressMock.mockReset();
    addAddressMock.mockReturnValue(true);
    deleteAddressMock.mockClear();
    retryHydrationMock.mockClear();
    clearCorruptedStateMock.mockClear();
    searchAddressesMock.mockReset();
    searchAddressesMock.mockReturnValue(addressBook);

    mockHookState = {
      addressBook,
      addAddress: addAddressMock,
      deleteAddress: deleteAddressMock,
      searchAddresses: searchAddressesMock,
      isLoading: false,
      isDegraded: false,
      error: null,
      validationIssues: null,
      retryHydration: retryHydrationMock,
      clearCorruptedState: clearCorruptedStateMock,
    };
  });

  it('renders each address book entry with its truncated address', () => {
    render(<AddressBookPage />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getAllByText('GADDRE...7890')).toHaveLength(2);
  });

  it('shows an empty state when there are no matching addresses', () => {
    searchAddressesMock.mockReturnValue([]);
    render(<AddressBookPage />);
    expect(screen.getByText('addressBook.noAddresses')).toBeInTheDocument();
  });

  it('shows an error toast when adding without both fields', () => {
    render(<AddressBookPage />);
    fireEvent.click(screen.getByText('addressBook.addAddress'));
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'addressBook.errors.missingFields' })
    );
    expect(addAddressMock).not.toHaveBeenCalled();
  });

  it('adds a new address and clears the form', () => {
    render(<AddressBookPage />);
    fireEvent.change(screen.getByPlaceholderText('addressBook.stellarAddressPlaceholder'), {
      target: { value: 'GNEWADDRESS1234567890' },
    });
    fireEvent.change(screen.getByPlaceholderText('addressBook.nicknamePlaceholder'), {
      target: { value: 'Carol' },
    });
    fireEvent.click(screen.getByText('addressBook.addAddress'));

    expect(addAddressMock).toHaveBeenCalledWith('GNEWADDRESS1234567890', 'Carol');
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'addressBook.success.added' })
    );
    expect(screen.getByPlaceholderText('addressBook.stellarAddressPlaceholder')).toHaveValue('');
  });

  it('shows error toast when adding invalid address format fails validation', () => {
    addAddressMock.mockReturnValue(false);
    render(<AddressBookPage />);

    fireEvent.change(screen.getByPlaceholderText('addressBook.stellarAddressPlaceholder'), {
      target: { value: 'invalid address with spaces' },
    });
    fireEvent.change(screen.getByPlaceholderText('addressBook.nicknamePlaceholder'), {
      target: { value: 'Bad Format' },
    });
    fireEvent.click(screen.getByText('addressBook.addAddress'));

    expect(addAddressMock).toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Invalid address or format rejected' })
    );
  });

  it('deletes an address', () => {
    render(<AddressBookPage />);
    fireEvent.click(screen.getAllByTitle('addressBook.delete')[0]);
    expect(deleteAddressMock).toHaveBeenCalledWith('1');
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'addressBook.success.deleted' })
    );
  });

  it('enters edit mode for an entry and can cancel out of it', () => {
    render(<AddressBookPage />);
    fireEvent.click(screen.getAllByTitle('addressBook.edit')[0]);
    expect(screen.getByText('addressBook.save')).toBeInTheDocument();

    fireEvent.click(screen.getByText('addressBook.cancel'));
    expect(screen.queryByText('addressBook.save')).not.toBeInTheDocument();
  });

  it('confirms an edit via the pending-toast flow', () => {
    render(<AddressBookPage />);
    fireEvent.click(screen.getAllByTitle('addressBook.edit')[0]);
    fireEvent.click(screen.getByText('addressBook.save'));

    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pending', title: 'addressBook.updating' })
    );
    expect(updateToastMock).toHaveBeenCalledWith(
      'toast-id',
      expect.objectContaining({ type: 'success', title: 'addressBook.success.updated' })
    );
    expect(screen.queryByText('addressBook.save')).not.toBeInTheDocument();
  });

  it('updates the search query and shows a filtered count when it differs from the full list', () => {
    searchAddressesMock.mockReturnValue([addressBook[0]]);
    render(<AddressBookPage />);
    fireEvent.change(screen.getByPlaceholderText('addressBook.searchPlaceholder'), {
      target: { value: 'Alice' },
    });
    expect(searchAddressesMock).toHaveBeenCalledWith('Alice');
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it('displays a warning banner when storage is in degraded mode', () => {
    mockHookState.isDegraded = true;
    render(<AddressBookPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/safe degraded mode/i);
  });

  it('displays an error alert with retry and reset recovery actions on hydration error', () => {
    mockHookState.error =
      'Wallet ownership mismatch: stored address book does not belong to active wallet.';
    render(<AddressBookPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Wallet ownership mismatch/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retryHydrationMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(clearCorruptedStateMock).toHaveBeenCalled();
  });

  it('displays validation issues banner when records are excluded during hydration', () => {
    mockHookState.validationIssues = {
      rejectedCount: 2,
      reasons: ['Unknown fields', 'Malformed address'],
    };
    render(<AddressBookPage />);

    expect(
      screen.getByText(/2 malformed record\(s\) excluded during validation/i)
    ).toBeInTheDocument();
  });
});
