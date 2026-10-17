'use client';

import { getYieldPreview, type InvoiceFormValues } from '@/utils/invoiceSubmission';
import { getTokenInputDecimals } from '@/utils/token-amount-input';
import { PreviewRow, formatMiddle } from './FormHelpers';

interface SubmitStepReviewProps {
  form: InvoiceFormValues;
  selectedToken: { symbol: string; decimals: number; iconLabel: string; contractId: string; name: string } | null;
}

export default function SubmitStepReview({ form, selectedToken }: SubmitStepReviewProps) {
  const amountInputDecimals = getTokenInputDecimals(selectedToken?.symbol ?? 'USDC');
  const preview = getYieldPreview(form.amount, form.discountRate, amountInputDecimals);

  return (
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
  );
}
