import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InvoiceFilterBar from '../InvoiceFilterBar';
import {
  EMPTY_INVOICE_FILTERS,
  countActiveInvoiceFilters,
  type InvoiceFilters,
} from '@/hooks/useInvoiceFilters';

function Harness({ initial }: { initial?: Partial<InvoiceFilters> }) {
  const [filters, setFilters] = useState<InvoiceFilters>({ ...EMPTY_INVOICE_FILTERS, ...initial });
  return (
    <InvoiceFilterBar
      filters={filters}
      onFiltersChange={(updater) =>
        setFilters((current) => (typeof updater === 'function' ? updater(current) : updater))
      }
      onClearFilters={() => setFilters(EMPTY_INVOICE_FILTERS)}
      activeFilterCount={countActiveInvoiceFilters(filters)}
    />
  );
}

function openAdvanced() {
  fireEvent.click(screen.getByText('Filters'));
}

describe('InvoiceFilterBar', () => {
  beforeEach(() => {
    localStorage.clear();
    // shouldAdvanceTime keeps testing-library's internal waitFor polling
    // working while still letting system time be pinned for date presets.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-17T12:00:00.000Z')); // Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the active filter count via the live region', () => {
    render(<Harness />);
    expect(screen.getByRole('status')).toHaveTextContent('No filters applied');
  });

  it('announces a pluralized count once filters are active', () => {
    // Harness seeds its state once via useState, so start a fresh instance
    // with the initial filters already set rather than rerendering the same one.
    render(<Harness initial={{ search: 'abc' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 filter applied');
  });

  it('updates the search filter as the user types', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Search by invoice ID, payer, or freelancer address');
    fireEvent.change(input, { target: { value: '#42' } });
    expect(input).toHaveValue('#42');
  });

  it('toggles the advanced panel open and closed', () => {
    render(<Harness />);
    const toggle = screen.getByText('Filters').closest('button')!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Status')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('toggles a status checkbox on and off', () => {
    render(<Harness />);
    openAdvanced();

    const pendingBox = screen.getByLabelText('Pending') as HTMLInputElement;
    fireEvent.click(pendingBox);
    expect(pendingBox.checked).toBe(true);

    fireEvent.click(pendingBox);
    expect(pendingBox.checked).toBe(false);
  });

  it('sets min/max amount and discount filters', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText('Minimum amount (USDC)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Maximum amount (USDC)'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Minimum discount (bps)'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Maximum discount (bps)'), { target: { value: '900' } });

    expect(screen.getByLabelText('Minimum amount (USDC)')).toHaveValue(100);
    expect(screen.getByLabelText('Maximum amount (USDC)')).toHaveValue(500);
    expect(screen.getByLabelText('Minimum discount (bps)')).toHaveValue(50);
    expect(screen.getByLabelText('Maximum discount (bps)')).toHaveValue(900);
  });

  it('applies and clears the "Today" date preset', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.click(screen.getByText('Today'));
    expect(screen.getByLabelText('Due Date from')).toHaveValue('2026-06-17');
    expect(screen.getByLabelText('Due Date to')).toHaveValue('2026-06-17');
    expect(screen.getByText('Clear date')).toBeInTheDocument();

    // Clicking the already-active preset clears it instead of reapplying.
    fireEvent.click(screen.getByText('Today'));
    expect(screen.getByLabelText('Due Date from')).toHaveValue('');
    expect(screen.queryByText('Clear date')).not.toBeInTheDocument();
  });

  it('applies the "This Week" preset relative to the pinned date', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.click(screen.getByText('This Week'));
    // 2026-06-17 is a Wednesday; week start (Sunday) is 2026-06-14.
    expect(screen.getByLabelText('Due Date from')).toHaveValue('2026-06-14');
    expect(screen.getByLabelText('Due Date to')).toHaveValue('2026-06-17');
  });

  it('applies the "This Month" preset relative to the pinned date', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.click(screen.getByText('This Month'));
    expect(screen.getByLabelText('Due Date from')).toHaveValue('2026-06-01');
    expect(screen.getByLabelText('Due Date to')).toHaveValue('2026-06-17');
  });

  it('clears a manually-set date range with "Clear date"', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText('Due Date from'), { target: { value: '2026-01-01' } });
    expect(screen.getByText('Clear date')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear date'));
    expect(screen.getByLabelText('Due Date from')).toHaveValue('');
    expect(screen.getByLabelText('Due Date to')).toHaveValue('');
  });

  it('switches the date type label between due and funded', () => {
    render(<Harness />);
    openAdvanced();

    expect(screen.getByLabelText('Due Date from')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Funded Date'));
    expect(screen.getByLabelText('Funded Date from')).toBeInTheDocument();
  });

  it('sets the token filter', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText('Token filter'), { target: { value: 'EURC' } });
    expect(screen.getByLabelText('Token filter')).toHaveValue('EURC');
  });

  it('sets minimum payer reputation and shows the explanatory copy above zero', () => {
    render(<Harness />);
    openAdvanced();

    expect(
      screen.queryByText(/Only showing invoices from payers with reputation/)
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Minimum payer reputation'), {
      target: { value: '40' },
    });
    expect(
      screen.getByText('Only showing invoices from payers with reputation ≥ 40')
    ).toBeInTheDocument();
  });

  it('shows "Clear all filters" only when filters are active and clears them', () => {
    render(<Harness initial={{ search: 'abc' }} />);
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear all filters'));
    expect(
      screen.getByPlaceholderText('Search by invoice ID, payer, or freelancer address')
    ).toHaveValue('');
  });

  it('saves the current filter set, applies it, and deletes it', async () => {
    render(<Harness initial={{ search: 'invoice-42' }} />);
    openAdvanced();

    fireEvent.click(screen.getByText('Save Current Filter'));
    fireEvent.change(screen.getByPlaceholderText('Filter name'), {
      target: { value: 'My saved view' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(localStorage.getItem('iln_saved_invoice_filters')).toContain('My saved view');
    });

    fireEvent.click(screen.getByText('Saved Filters'));
    expect(screen.getByText('Saved Filters').closest('button')).toHaveTextContent('Saved Filters1');
    fireEvent.click(screen.getByText('My saved view'));

    // Applying resets other fields to the saved snapshot; clear-all reflects it.
    expect(
      screen.getByPlaceholderText('Search by invoice ID, payer, or freelancer address')
    ).toHaveValue('invoice-42');

    fireEvent.click(screen.getByText('Saved Filters'));
    fireEvent.click(screen.getByLabelText('Delete My saved view'));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('iln_saved_invoice_filters')!)).toHaveLength(0);
    });
  });

  it('cancels the save-filter form without persisting anything', () => {
    render(<Harness />);
    openAdvanced();

    fireEvent.click(screen.getByText('Save Current Filter'));
    fireEvent.change(screen.getByPlaceholderText('Filter name'), { target: { value: 'temp' } });
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByPlaceholderText('Filter name')).not.toBeInTheDocument();
    expect(localStorage.getItem('iln_saved_invoice_filters')).toBeNull();
  });

  it('disables saving once 10 filters already exist', () => {
    const stored = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      name: `Filter ${i}`,
      filters: EMPTY_INVOICE_FILTERS,
    }));
    localStorage.setItem('iln_saved_invoice_filters', JSON.stringify(stored));

    render(<Harness />);
    openAdvanced();

    expect(screen.getByText('Save Current Filter')).toBeDisabled();
    expect(screen.getByText('Maximum of 10 saved filters reached.')).toBeInTheDocument();
  });

  it('shows "No saved filters." when the dropdown is opened with nothing saved', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Saved Filters'));
    expect(screen.getByText('No saved filters.')).toBeInTheDocument();
  });

  it('closes the saved filters dropdown on outside click', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Saved Filters'));
    expect(screen.getByText('No saved filters.')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('No saved filters.')).not.toBeInTheDocument();
  });

  it('focuses the search input on "f", clears filters on "r", and toggles help on "?" / Escape', () => {
    const onClearFilters = vi.fn();
    function HarnessWithSpy() {
      const [filters, setFilters] = useState<InvoiceFilters>(EMPTY_INVOICE_FILTERS);
      return (
        <InvoiceFilterBar
          filters={filters}
          onFiltersChange={(updater) =>
            setFilters((current) => (typeof updater === 'function' ? updater(current) : updater))
          }
          onClearFilters={() => {
            onClearFilters();
            setFilters(EMPTY_INVOICE_FILTERS);
          }}
          activeFilterCount={0}
        />
      );
    }
    render(<HarnessWithSpy />);

    fireEvent.keyDown(document.body, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      'Search by invoice ID, payer, or freelancer address'
    );
    fireEvent.keyDown(document.body, { key: 'f' });
    expect(searchInput).toHaveFocus();

    // The 'r' shortcut is intentionally suppressed while the search input is
    // focused (so typing "r" doesn't reset filters) - blur it first.
    searchInput.blur();
    fireEvent.keyDown(document.body, { key: 'r' });
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcut keys while typing in an input field', () => {
    render(<Harness />);
    openAdvanced();

    const minAmount = screen.getByLabelText('Minimum amount (USDC)');
    minAmount.focus();
    fireEvent.keyDown(minAmount, { key: '?' });

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('closes the help modal from its close button, stays open on inner click, and closes on backdrop click', () => {
    render(<Harness />);
    fireEvent.keyDown(document.body, { key: '?' });

    fireEvent.click(screen.getByLabelText('Close help'));
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: '?' });
    // Clicking inside the modal card stops propagation, so it stays open.
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    // Clicking the backdrop itself closes it.
    fireEvent.click(screen.getByText('Keyboard Shortcuts').closest('.fixed')!);
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});
