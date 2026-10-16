'use client';

import { useTranslation } from 'react-i18next';
import TokenSelector from '../TokenSelector';
import { getYieldPreview, type InvoiceFormValues } from '@/utils/invoiceSubmission';
import { getTokenInputDecimals } from '@/utils/token-amount-input';
import { Field } from './FormHelpers';

interface SubmitStepTokenRateProps {
  form: InvoiceFormValues;
  setField: (field: keyof InvoiceFormValues, value: string) => void;
  displayErrors: Record<string, string | undefined>;
  handleBlur: (field: keyof InvoiceFormValues) => void;
  effectiveTokenId: string;
  tokens: Array<{ contractId: string; symbol: string; name: string; decimals: number; iconLabel: string }>;
  tokenMap: Map<string, { contractId: string; symbol: string; name: string; decimals: number; iconLabel: string }>;
  defaultToken: { contractId: string; symbol: string; name: string; decimals: number; iconLabel: string } | null;
  tokensLoading: boolean;
  tokensError: string | null;
  txLoading: boolean;
}

export default function SubmitStepTokenRate({
  form,
  setField,
  displayErrors,
  handleBlur,
  effectiveTokenId,
  tokens,
  tokenMap,
  defaultToken,
  tokensLoading,
  tokensError,
  txLoading,
}: SubmitStepTokenRateProps) {
  const { t } = useTranslation();
  const selectedToken = tokenMap.get(effectiveTokenId) ?? defaultToken ?? null;
  const amountInputDecimals = getTokenInputDecimals(selectedToken?.symbol ?? 'USDC');
  const preview = getYieldPreview(form.amount, form.discountRate, amountInputDecimals);

  const handleTokenChange = (value: string) => {
    setField('tokenId', value);
    const token = tokenMap.get(value);
    if (token && form.amount) {
      setField('amount', form.amount);
    }
  };

  return (
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
  );
}
