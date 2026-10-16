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

const addAddressMock = vi.fn();
const deleteAddressMock = vi.fn();
const searchAddressesMock = vi.fn();

const addressBook = [
  { id: '1', address: 'GADDRESSONELONGENOUGH1234567890', nickname: 'Alice' },
  { id: '2', address: 'GADDRESSTWOLONGENOUGH1234567890', nickname: 'Bob' },
];

vi.mock('@/hooks/useAddressBook', () => ({
  default: () => ({
    addressBook,
    addAddress: addAddressMock,
    deleteAddress: deleteAddressMock,
    searchAddresses: searchAddressesMock,
  }),
}));

describe('AddressBookPage', () => {
  beforeEach(() => {
    addToastMock.mockClear();
    updateToastMock.mockClear();
    addAddressMock.mockClear();
    deleteAddressMock.mockClear();
    searchAddressesMock.mockReset();
    searchAddressesMock.mockReturnValue(addressBook);
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
});
