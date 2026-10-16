'use client';

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTokenPrice } from '@/hooks/useTokenPrice';
import { NETWORK_NAME } from '@/constants';
import TokenSelector, { TokenAmount } from '../components/TokenSelector';
import FieldTooltip from './FieldTooltip';
import { useWallet } from '@/context/WalletContext';
import { useTransaction } from '@/hooks/useTransaction';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import useAddressBook from '@/hooks/useAddressBook';
import {
  getMinimumDueDate,
  getYieldPreview,
  type InvoiceFormValues,
  validateInvoiceForm,
  parseAmountToUnits,
  parseDiscountRateToBps,
  toUnixTimestamp,
} from '@/utils/invoiceSubmission';
import {
  formatAmountEntryPreview,
  getTokenInputDecimals,
  getXlmPrecisionNote,
  sanitizeAmountInput,
} from '@/utils/token-amount-input';
import { submitInvoiceTransaction } from '@/utils/soroban';
import { useToast } from '@/context/ToastContext';

const INITIAL_FORM: InvoiceFormValues = {
  payer: '',
  amount: '',
  dueDate: '',
  discountRate: '3.00',
  tokenId: '',
};

type FormAction =
  | { type: 'set_field'; field: keyof InvoiceFormValues; value: string }
  | { type: 'reset'; values: InvoiceFormValues };

function invoiceFormReducer(state: InvoiceFormValues, action: FormAction): InvoiceFormValues {
  switch (action.type) {
    case 'set_field':
      return { ...state, [action.field]: action.value };
    case 'reset':
      return action.values;
  }
}

const STEPS = [
  { id: 1, label: 'Invoice Details' },
  { id: 2, label: 'Token & Rate' },
  { id: 3, label: 'Review & Submit' },
];

interface SubmitInvoiceFormProps {
  initialValues?: Partial<InvoiceFormValues>;
  prefillId?: string;
}

export default function SubmitInvoiceForm({ initialValues, prefillId }: SubmitInvoiceFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const { execute, loading: txLoading, error: txError, signingModal } = useTransaction();
  const {
    address,
    isConnected,
    connect,
    disconnect,
    networkMismatch,
    error: walletError,
  } = useWallet();
  const {
    tokens,
    tokenMap,
    defaultToken,
    isLoading: tokensLoading,
    error: tokensError,
  } = useApprovedTokens();

  const [showBanner, setShowBanner] = useState(!!prefillId);
  const [form, dispatchForm] = useReducer(invoiceFormReducer, {
    ...INITIAL_FORM,
    ...initialValues,
    dueDate: '',
  });
  const [touched, setTouched] = useState<Partial<Record<keyof InvoiceFormValues | 'all', boolean>>>(
    {}
  );
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<
    Partial<Record<keyof InvoiceFormValues | 'wallet' | 'submit', string>>
  >({});
  const [submittedInvoiceId, setSubmittedInvoiceId] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  // Optional referral code — captured client-side; passed to the contract.
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref') ?? '');
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    []
  );

  const effectiveTokenId = form.tokenId || defaultToken?.contractId || '';
  const selectedToken = tokenMap.get(effectiveTokenId) ?? defaultToken ?? null;
  const amountInputDecimals = getTokenInputDecimals(selectedToken?.symbol ?? 'USDC');
  const preview = getYieldPreview(form.amount, form.discountRate, amountInputDecimals);
  const amountEntryPreview = selectedToken
    ? formatAmountEntryPreview(form.amount, selectedToken.symbol)
    : null;

  const { usdPrice } = useTokenPrice(selectedToken?.symbol);
  const parsedAmount = Number.parseFloat(form.amount);
  const usdEquivalent =
    usdPrice !== null && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount * usdPrice
      : null;

  const { searchAddresses } = useAddressBook();
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [addressBookQuery, setAddressBookQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const validationErrors = useMemo(() => {
    const errs = validateInvoiceForm(
      { ...form, tokenId: effectiveTokenId },
      isConnected,
      selectedToken?.decimals ?? 7,
      selectedToken?.symbol ?? 'token'
    );
    if (!selectedToken && !tokensLoading) {
      errs.tokenId = t('submitForm.noTokensAvailable');
    }
    if (networkMismatch) {
      errs.wallet = t('submitForm.walletError', { network: NETWORK_NAME });
    }
    return errs;
  }, [form, effectiveTokenId, isConnected, selectedToken, tokensLoading, networkMismatch, t]);

  const displayErrors = useMemo(() => {
    const combined: Record<string, string | undefined> = { ...errors };
    for (const [key, val] of Object.entries(validationErrors)) {
      if (touched[key as keyof InvoiceFormValues] || touched.all) {
        combined[key] = val;
      }
    }
    return combined;
  }, [validationErrors, touched, errors]);

  const handleBlur = (field: keyof InvoiceFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const isStep1Valid =
    !validationErrors.payer &&
    !validationErrors.amount &&
    !validationErrors.dueDate &&
    !validationErrors.wallet;
  const isStep2Valid = !validationErrors.tokenId && !validationErrors.discountRate;
  const isFormValid = isStep1Valid && isStep2Valid;

  const setField = (field: keyof InvoiceFormValues, value: string) => {
    dispatchForm({ type: 'set_field', field, value });
    setErrors((current) => ({ ...current, submit: undefined }));
    setSubmittedInvoiceId(null);
  };

  const handleAmountChange = (value: string) => {
    setField('amount', sanitizeAmountInput(value, amountInputDecimals));
  };

  const handleTokenChange = (value: string) => {
    setField('tokenId', value);
    const token = tokenMap.get(value);
    if (token && form.amount) {
      setField('amount', sanitizeAmountInput(form.amount, getTokenInputDecimals(token.symbol)));
    }
  };

  const goNext = () => {
    if (step === 1 && !isStep1Valid) {
      setTouched((prev) => ({ ...prev, payer: true, amount: true, dueDate: true }));
      return;
    }
    if (step === 2 && !isStep2Valid) {
      setTouched((prev) => ({ ...prev, tokenId: true, discountRate: true }));
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const handleCopyInvoiceId = async () => {
    if (!submittedInvoiceId) return;

    try {
      await navigator.clipboard.writeText(submittedInvoiceId);
      addToast({
        type: 'success',
        title: 'Invoice ID copied',
        message: `Invoice #${submittedInvoiceId} copied to clipboard.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Copy failed',
        message: 'Unable to copy the invoice ID on this device.',
      });
    }
  };

  const handleSelectAddress = (address: string) => {
    setField('payer', address);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      setTouched({
        payer: true,
        amount: true,
        dueDate: true,
        tokenId: true,
        discountRate: true,
        all: true,
      });
      return;
    }

    const amount = parseAmountToUnits(form.amount, amountInputDecimals);
    const dueDate = toUnixTimestamp(form.dueDate);
    const discountRate = parseDiscountRateToBps(form.discountRate);

    if (
      !address ||
      !selectedToken ||
      amount === null ||
      dueDate === null ||
      discountRate === null
    ) {
      setErrors({ submit: t('submitForm.reviewFormValues') });
      return;
    }

    setErrors({});
    setSubmittedInvoiceId(null);

    const result = await execute(
      async (signTx) =>
        submitInvoiceTransaction({
          freelancer: address,
          payer: form.payer.trim(),
          amount,
          dueDate,
          discountRate,
          signTx,
          token: selectedToken.contractId,
          referralCode: referralCode.trim(),
        }),
      {
        title: 'Submitting invoice to Stellar testnet...',
        pendingMessage: 'Waiting for wallet signature...',
        successTitle: 'Invoice submitted',
        successMessage: `Invoice is now live on ${NETWORK_NAME}.`,
      }
    );

    if (!result) {
      setErrors({ submit: txError ?? 'The transaction did not complete successfully.' });
      return;
    }

    const invoiceId = result.invoiceId.toString();
    setSubmittedInvoiceId(invoiceId);
    setLastTxHash(result.txHash);

    // Best-effort per-invoice referral attribution. Never block on failure.
    const trimmedReferral = referralCode.trim();
    if (trimmedReferral) {
      try {
        window.localStorage.setItem(`iln-referral-${invoiceId}`, trimmedReferral);
      } catch {
        // localStorage may be unavailable (private mode); attribution is best-effort.
      }
    }

    redirectTimer.current = setTimeout(() => router.push(`/i/${invoiceId}`), 1500);
  };

  return (
    <div
      id="submit-invoice-form"
      className="bg-surface-container-lowest p-6 sm:p-8 rounded-[28px] shadow-xl border border-outline-variant/15"
    >
      {signingModal}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
              {t('submitForm.freelancerPortal')}
            </p>
            <h3 className="text-2xl font-headline mt-2">{t('submitForm.title')}</h3>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xl">
              {t('submitForm.subtitle')}
            </p>
            <div className="mt-4">
              <Link
                href="/invoices/batch"
                className="-my-2.5 inline-flex items-center gap-2 py-2.5 text-sm text-primary hover:underline font-medium"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Submit multiple invoices (CSV/Batch)
              </Link>
            </div>
          </div>

          <div className="sm:min-w-[220px]">
            {isConnected ? (
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
                      {t('submitForm.wallet')}
                    </p>
                    <p className="font-mono text-sm break-all mt-1">{address}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                      networkMismatch
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-primary-container text-on-primary-container'
                    }`}
                  >
                    {networkMismatch ? t('submitForm.wrongNetwork') : NETWORK_NAME}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={disconnect}
                  className="mt-4 w-full rounded-xl border border-outline-variant/20 px-4 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  {t('submitForm.disconnect')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connect}
                className="w-full rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-surface-container-lowest shadow-lg hover:bg-primary/90 transition-colors"
              >
                {t('submitForm.connectFreighter')}
              </button>
            )}
          </div>
        </div>

        {displayErrors.wallet || walletError ? (
          <div className="rounded-2xl border border-error/15 bg-error-container/70 px-4 py-3 text-sm text-on-error-container">
            {displayErrors.wallet ?? walletError}
          </div>
        ) : null}

        {showBanner && prefillId && (
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4 transition-all animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">info</span>
              <p className="text-sm font-bold text-primary">
                {t('submitForm.prefilled', { id: prefillId })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBanner(false)}
              className="rounded-full p-1 hover:bg-primary/20 text-primary transition-colors"
              aria-label="Dismiss banner"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((item) => {
            const active = item.id === step;
            const complete = item.id < step;
            return (
              <div
                key={item.id}
                className={`rounded-lg border px-4 py-3 ${
                  active
                    ? 'border-primary bg-primary-container/45'
                    : complete
                      ? 'border-primary/25 bg-primary/5'
                      : 'border-outline-variant/15 bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      active || complete
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {complete ? '✓' : item.id}
                  </span>
                  <span className="text-sm font-bold">{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSubmit}>
          <div className="space-y-5">
            {step === 1 ? (
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
            ) : null}
            {step === 2 ? (
              <>
                <TokenSelector
                  label={t('submitForm.tokenLabel')}
                  tooltip="The currency for this invoice. Currently supported: USDC, EURC, XLM."
                  value={effectiveTokenId}
                  tokens={tokens}
                  showBalances
                  error={displayErrors.tokenId}
                  disabled={tokensLoading || txLoading}
                  onChange={handleTokenChange}
                  hint={
                    tokensError
                      ? tokensError
                      : tokensLoading
                        ? t('submitForm.loadingTokens')
                        : t('submitForm.tokensHint')
                  }
                />
                <Field
                  label="Discount rate (%)"
                  tooltip={
                    <>
                      How much of the invoice value you give up in exchange for instant payment. 300
                      basis points = 3%. A lower rate attracts more LPs; a higher rate means you
                      receive less upfront.
                      <div className="mt-2 font-bold text-primary">Typical value: 100-500 bps</div>
                    </>
                  }
                  error={displayErrors.discountRate}
                  errorId="discount-rate-error"
                  hint={t('submitForm.discountRateHint')}
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <input
                      value={form.discountRate}
                      onBlur={() => handleBlur('discountRate')}
                      aria-describedby={
                        displayErrors.discountRate ? 'discount-rate-error' : undefined
                      }
                      aria-invalid={Boolean(displayErrors.discountRate)}
                      onChange={(event) => setField('discountRate', event.target.value)}
                      className="w-full rounded-2xl bg-surface-container-low px-4 py-3.5 text-sm border border-outline-variant/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="3.00"
                      inputMode="decimal"
                    />
                    <div className="rounded-2xl bg-primary-container/70 px-4 py-3 text-center text-sm font-bold text-on-primary-container">
                      {preview.discountRatePercent.toFixed(2)}%
                    </div>
                  </div>
                  {form.amount && selectedToken && (
                    <p className="mt-3 text-xs font-medium text-primary bg-primary/5 p-3 rounded-xl border border-primary/10">
                      LP preview: yield is{' '}
                      <span className="font-bold">{preview.discountRatePercent.toFixed(2)}%</span>,
                      earning{' '}
                      <span className="font-bold">
                        {preview.yieldFormatted} {selectedToken.symbol}
                      </span>
                      .
                    </p>
                  )}
                </Field>
              </>
            ) : null}

            {step === 3 ? (
              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                  Review & Submit
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <PreviewRow label="Payer" value={formatMiddle(form.payer)} />
                  <PreviewRow label="Due date" value={form.dueDate || '-'} />
                  <PreviewRow
                    label="You will receive"
                    value={`${preview.payoutFormatted} ${selectedToken?.symbol ?? ''}`.trim()}
                    token={selectedToken ?? undefined}
                    accent
                  />
                  <PreviewRow
                    label="LP yield is"
                    value={`${preview.discountRatePercent.toFixed(2)}%`}
                  />
                </div>
                <p className="mt-4 rounded-xl bg-primary/5 p-3 text-xs font-medium text-primary">
                  Your wallet will ask you to confirm the invoice submission on the final click.
                </p>
              </div>
            ) : null}

            {displayErrors.submit ? (
              <div className="rounded-2xl border border-error/15 bg-error-container/70 px-4 py-3 text-sm text-on-error-container">
                {displayErrors.submit}
              </div>
            ) : null}

            {submittedInvoiceId ? (
              <div className="rounded-2xl border border-primary/15 bg-primary-container/35 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-on-primary-container/80">
                  {t('submitForm.submissionSuccess')}
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-on-primary-container/80">
                      {t('submitForm.returnedInvoiceId')}
                    </p>
                    <p className="text-2xl font-bold text-on-primary-container">
                      #{submittedInvoiceId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyInvoiceId}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-surface-container-lowest hover:bg-primary/90 transition-colors"
                  >
                    {t('submitForm.copyInvoiceId')}
                  </button>
                </div>
                {lastTxHash ? (
                  <p className="mt-3 text-xs text-on-primary-container/80 break-all">
                    {t('submitForm.txHash')}: {lastTxHash}
                  </p>
                ) : null}
                <Link
                  href={`/i/${submittedInvoiceId}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-on-primary-container hover:underline"
                >
                  View invoice details
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(1, current - 1))}
                  className="rounded-2xl border border-outline-variant/20 px-5 py-4 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Back
                </button>
              ) : null}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                  className="flex-1 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-surface-container-lowest shadow-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={txLoading || !isFormValid}
                  className="flex-1 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-surface-container-lowest shadow-lg hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  {txLoading ? t('submitForm.submitting') : t('submitForm.submitInvoice')}
                </button>
              )}
            </div>
          </div>

          <aside className="rounded-[24px] bg-surface-container-low p-5 border border-outline-variant/15 h-fit">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant">
              {t('submitForm.preview.title')}
            </p>
            <div className="mt-5 space-y-4">
              <PreviewRow
                label={t('submitForm.preview.invoiceFaceValue')}
                value={`${preview.amountFormatted} ${selectedToken?.symbol ?? ''}`.trim()}
                token={selectedToken ?? undefined}
              />
              <PreviewRow
                label={t('submitForm.preview.freelancerPayout')}
                value={`${preview.payoutFormatted} ${selectedToken?.symbol ?? ''}`.trim()}
                token={selectedToken ?? undefined}
                accent
              />
              <PreviewRow
                label={t('submitForm.preview.lpYield')}
                value={`${preview.yieldFormatted} ${selectedToken?.symbol ?? ''}`.trim()}
                token={selectedToken ?? undefined}
              />
              <PreviewRow
                label={t('submitForm.preview.discountRate')}
                value={`${preview.discountRatePercent.toFixed(2)}%`}
              />
            </div>
            <div className="mt-5 rounded-2xl bg-surface-container-high px-4 py-4 text-sm text-on-surface-variant">
              {t('submitForm.previewNote', { network: NETWORK_NAME })}
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  tooltip,
  hint,
  error,
  errorId,
  children,
}: {
  label: string;
  tooltip?: string | ReactNode;
  hint?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant flex items-center">
          {label}
          {tooltip && <FieldTooltip content={tooltip} />}
        </span>
      </div>
      {children}
      {error ? (
        <p id={errorId} className="mt-2 text-xs font-bold text-error">
          {error}
        </p>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-on-surface-variant">{hint}</p> : null}
    </label>
  );
}

function PreviewRow({
  label,
  value,
  token,
  accent,
}: {
  label: string;
  value: string;
  token?: { symbol: string; iconLabel: string; contractId: string; name: string; decimals: number };
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-container-lowest px-4 py-3">
      <span className="text-sm text-on-surface-variant">{label}</span>
      {token ? (
        <TokenAmount
          amount={value}
          token={token}
          className={`text-sm font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}
        />
      ) : (
        <span className={`text-sm font-bold ${accent ? 'text-primary' : 'text-on-surface'}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function formatMiddle(value: string) {
  if (!value) return '-';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}
