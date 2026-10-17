'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTokenPrice } from '@/hooks/useTokenPrice';
import { getMinimumDueDate, getYieldPreview, type InvoiceFormValues } from '@/utils/invoiceSubmission';
import {
  formatAmountEntryPreview,
  getTokenInputDecimals,
  getXlmPrecisionNote,
  sanitizeAmountInput,
} from '@/utils/token-amount-input';
import useAddressBook from '@/hooks/useAddressBook';
import { Field } from './FormHelpers';

interface SubmitStepDetailsProps {
  form: InvoiceFormValues;
  setField: (field: keyof InvoiceFormValues, value: string) => void;
  displayErrors: Record<string, string | undefined>;
  handleBlur: (field: keyof InvoiceFormValues) => void;
  selectedToken: { symbol: string; decimals: number } | null;
  referralCode: string;
  setReferralCode: (value: string) => void;
}

export default function SubmitStepDetails({
  form,
  setField,
  displayErrors,
  handleBlur,
  selectedToken,
  referralCode,
  setReferralCode,
}: SubmitStepDetailsProps) {
  const { t } = useTranslation();
  const { searchAddresses } = useAddressBook();
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressBookQuery, setAddressBookQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const amountInputDecimals = getTokenInputDecimals(selectedToken?.symbol ?? 'USDC');
  const { usdPrice } = useTokenPrice(selectedToken?.symbol);
  const parsedAmount = Number.parseFloat(form.amount);
  const usdEquivalent =
    usdPrice !== null && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount * usdPrice
      : null;
  const amountEntryPreview = selectedToken
    ? formatAmountEntryPreview(form.amount, selectedToken.symbol)
    : null;

  const handleAmountChange = (value: string) => {
    setField('amount', sanitizeAmountInput(value, amountInputDecimals));
  };

  const handleSelectAddress = (addr: string) => {
    setField('payer', addr);
    setAddressBookOpen(false);
    setAddressBookQuery('');
    setHighlightedIndex(-1);
  };

  const handleAddressBookKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setAddressBookOpen(false);
      setAddressBookQuery('');
      setHighlightedIndex(-1);
      return;
    }

    const filtered = searchAddresses(addressBookQuery || form.payer);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(Math.min(filtered.length - 1, highlightedIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(Math.max(-1, highlightedIndex - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const selectedAddress = filtered[highlightedIndex];
      handleSelectAddress(selectedAddress.address);
    }
  };

  return (
    <>
      <Field
        label={t('submitForm.payerLabel')}
        tooltip="The Stellar wallet address of the person or company who owes you payment. They'll need to sign a transaction to settle."
        error={displayErrors.payer}
        errorId="payer-error"
        hint={t('submitForm.payerHint')}
      >
        <div className="relative">
          <input
            value={form.payer}
            onBlur={() => handleBlur('payer')}
            aria-describedby={displayErrors.payer ? 'payer-error' : undefined}
            aria-invalid={Boolean(displayErrors.payer)}
            onChange={(event) => {
              setField('payer', event.target.value);
              setAddressBookQuery(event.target.value);
              setAddressBookOpen(true);
              setHighlightedIndex(-1);
            }}
            onKeyDown={handleAddressBookKeyDown}
            className="w-full rounded-2xl bg-surface-container-low px-4 py-3.5 text-sm border border-outline-variant/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="G..."
            autoComplete="off"
            spellCheck={false}
          />
          {addressBookOpen && (
            <div className="absolute left-0 right-0 mt-1 z-10 max-h-[200px] overflow-auto border border-surface-dim rounded-xl bg-surface-container-low shadow-lg">
              {addressBookQuery ? (
                searchAddresses(addressBookQuery).map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`px-4 py-3 text-sm cursor-pointer ${highlightedIndex === index ? 'bg-primary text-surface-container-lowest' : 'hover:bg-surface-variant/50'}`}
                    onClick={() => handleSelectAddress(entry.address)}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{entry.nickname}</span>
                      <span className="text-xs text-on-surface-variant/50">
                        {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-on-surface-variant">
                  {t('addressBook.noMatches')}
                </div>
              )}
            </div>
          )}
        </div>
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label={`${t('submitForm.amountLabel')}${selectedToken ? ` (${selectedToken.symbol})` : ''}`}
          tooltip="The full value of the invoice. This is what the payer owes you in total."
          error={displayErrors.amount}
          errorId="amount-error"
        >
          <input
            value={form.amount}
            onBlur={() => handleBlur('amount')}
            aria-describedby={displayErrors.amount ? 'amount-error' : undefined}
            aria-invalid={Boolean(displayErrors.amount)}
            onChange={(event) => handleAmountChange(event.target.value)}
            className="w-full rounded-2xl bg-surface-container-low px-4 py-3.5 text-sm border border-outline-variant/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="5000.00"
            inputMode="decimal"
          />
          {selectedToken?.symbol === 'XLM' ? (
            <p
              className="mt-2 text-xs text-on-surface-variant"
              data-testid="xlm-amount-note"
            >
              {getXlmPrecisionNote()}
            </p>
          ) : null}
          {amountEntryPreview ? (
            <p
              className="mt-2 text-xs font-medium text-on-surface"
              data-testid="amount-entry-preview"
            >
              {amountEntryPreview}
            </p>
          ) : null}
          {usdEquivalent !== null ? (
            <p
              className="mt-2 text-xs font-medium text-on-surface-variant"
              data-testid="usd-preview"
            >
              ~ $
              {usdEquivalent.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              USD
              <span className="ml-1 text-on-surface-variant/60">
                · Price is approximate
              </span>
            </p>
          ) : null}
        </Field>
        <Field label="Due date" error={displayErrors.dueDate} errorId="due-date-error">
          <input
            aria-label="Due date"
            value={form.dueDate}
            onBlur={() => handleBlur('dueDate')}
            aria-describedby={displayErrors.dueDate ? 'due-date-error' : undefined}
            aria-invalid={Boolean(displayErrors.dueDate)}
            onChange={(event) => setField('dueDate', event.target.value)}
            min={getMinimumDueDate()}
            className="w-full rounded-2xl bg-surface-container-low px-4 py-3.5 text-sm border border-outline-variant/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            type="date"
          />
        </Field>
      </div>
      <Field
        label="Referral code (optional)"
        tooltip="If someone referred you to the network, enter their referral code here. Optional."
        hint="Leave blank if you don't have one."
      >
        <input
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
          className="w-full rounded-2xl bg-surface-container-low px-4 py-3.5 text-sm border border-outline-variant/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          placeholder="e.g. ILN-FRIEND"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
    </>
  );
}
