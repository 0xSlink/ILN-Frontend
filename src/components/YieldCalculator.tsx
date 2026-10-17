'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateYield, formatUSDC } from '@/utils/format';

interface YieldCalculatorProps {
  onFindMatching: (amount: bigint, discountRate: number) => void;
}

type Mode = 'simple' | 'advanced';
type InvoiceCategory = 'prime' | 'standard' | 'stretch';

const CATEGORY_OPTIONS: Array<{
  value: InvoiceCategory;
  label: string;
  riskMultiplier: number;
  description: string;
}> = [
  {
    value: 'prime',
    label: 'Prime invoices',
    riskMultiplier: 1,
    description: 'Shortest duration and strongest payer history.',
  },
  {
    value: 'standard',
    label: 'Standard invoices',
    riskMultiplier: 0.88,
    description: 'Balanced risk and return profile.',
  },
  {
    value: 'stretch',
    label: 'Higher-risk invoices',
    riskMultiplier: 0.74,
    description: 'Longer tenor or weaker payer consistency.',
  },
];

const PROJECTION_WINDOWS = [30, 60, 90];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isValidCategory(value: string): value is InvoiceCategory {
  return CATEGORY_OPTIONS.some((option) => option.value === value);
}

export default function YieldCalculator({ onFindMatching }: YieldCalculatorProps) {
  const [amount, setAmount] = useState<number>(1000);
  const [discountRate, setDiscountRate] = useState<number>(100);
  const [settlementDays, setSettlementDays] = useState<number>(30);
  const [mode, setMode] = useState<Mode>('simple');
  const [category, setCategory] = useState<InvoiceCategory>('standard');
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const validationErrors = useMemo(() => {
    const errors: Partial<
      Record<'amount' | 'discountRate' | 'settlementDays' | 'category', string>
    > = {};

    if (!Number.isFinite(amount) || amount < 0) {
      errors.amount = 'Amount must be zero or greater.';
    } else if (amount > 1_000_000) {
      errors.amount = 'Amount is capped at 1,000,000 USDC.';
    }

    if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 10_000) {
      errors.discountRate = 'Discount rate must be between 0 and 10,000 bps.';
    }

    if (!Number.isFinite(settlementDays) || settlementDays < 1 || settlementDays > 365) {
      errors.settlementDays = 'Settlement days must be between 1 and 365.';
    }

    if (!isValidCategory(category)) {
      errors.category = 'Select a valid invoice category.';
    }

    return errors;
  }, [amount, discountRate, settlementDays, category]);

  const normalizedAmount = clamp(Number.isFinite(amount) ? amount : 0, 0, 1_000_000);
  const normalizedDiscountRate = clamp(Number.isFinite(discountRate) ? discountRate : 0, 0, 10_000);
  const normalizedSettlementDays = clamp(
    Number.isFinite(settlementDays) ? settlementDays : 30,
    1,
    365
  );
  const normalizedCategory = isValidCategory(category) ? category : 'standard';

  const amountBigInt = BigInt(Math.round(normalizedAmount * 1_000_000));
  const discountAmount = calculateYield(amountBigInt, normalizedDiscountRate);
  const freelancerReceives = amountBigInt - discountAmount;
  const cycleRate = normalizedDiscountRate / 10_000;
  const compoundFactor = 1 + cycleRate;

  const projectedReturn = useCallback(
    (days: number, riskMultiplier = 1) => {
      if (normalizedAmount <= 0 || normalizedSettlementDays <= 0) return 0;
      const cycles = days / normalizedSettlementDays;
      const compoundedValue = normalizedAmount * (Math.pow(compoundFactor, cycles) - 1);
      return Math.max(0, compoundedValue * riskMultiplier);
    },
    [compoundFactor, normalizedAmount, normalizedSettlementDays]
  );

  const apy = useMemo(() => {
    if (normalizedAmount <= 0 || normalizedSettlementDays <= 0) return 0;
    return (normalizedDiscountRate / 100) * (365 / normalizedSettlementDays);
  }, [normalizedAmount, normalizedDiscountRate, normalizedSettlementDays]);

  const riskAdjustedApy = useMemo(
    () =>
      apy *
      (CATEGORY_OPTIONS.find((option) => option.value === normalizedCategory)?.riskMultiplier ?? 1),
    [apy, normalizedCategory]
  );

  const comparisonData = useMemo(
    () =>
      CATEGORY_OPTIONS.map((option) => ({
        name: option.label,
        returnValue: projectedReturn(90, option.riskMultiplier),
      })),
    [projectedReturn]
  );

  const projectionData = useMemo(
    () =>
      PROJECTION_WINDOWS.map((days) => ({
        label: `${days} days`,
        value: projectedReturn(
          days,
          CATEGORY_OPTIONS.find((option) => option.value === normalizedCategory)?.riskMultiplier ??
            1
        ),
      })),
    [normalizedCategory, projectedReturn]
  );

  const handleFindMatching = useCallback(() => {
    onFindMatching(amountBigInt, normalizedDiscountRate);
  }, [amountBigInt, normalizedDiscountRate, onFindMatching]);

  const selectedCategory =
    CATEGORY_OPTIONS.find((option) => option.value === normalizedCategory) ?? CATEGORY_OPTIONS[1];

  const inputClassName = (hasError: boolean) =>
    `w-20 rounded border px-2 py-1 text-center text-sm outline-none transition-colors ${
      hasError
        ? 'border-red-500 bg-red-500/5 focus:border-red-500'
        : 'border-surface-dim bg-surface-container-lowest focus:border-primary'
    }`;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-dim">
      <div
        className="flex cursor-pointer items-center justify-between bg-surface-container-low p-4"
        onClick={() => setCollapsed((value) => !value)}
      >
        <div className="flex items-center gap-3">
          <h3 className="flex items-center gap-2 text-lg font-medium">
            <span className="material-symbols-outlined">calculate</span>
            What&apos;s my yield?
          </h3>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMode((value) => (value === 'simple' ? 'advanced' : 'simple'));
            }}
            className="rounded-full border border-outline-variant/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
          >
            {mode === 'simple' ? 'Simple' : 'Advanced'}
          </button>
        </div>
        <span className="material-symbols-outlined transition-transform duration-200">
          {collapsed ? 'expand_more' : 'expand_less'}
        </span>
      </div>

      {!collapsed && (
        <div className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="yc-amount-range"
                className="flex items-center justify-between text-sm font-medium text-on-surface-variant"
              >
                Invoice Amount (USDC)
                <span>{normalizedAmount.toLocaleString()}</span>
              </label>
              <div className="flex w-full gap-2">
                <input
                  id="yc-amount-range"
                  type="range"
                  min={0}
                  max={1000000}
                  step={100}
                  value={normalizedAmount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className="h-2 flex-1 rounded bg-primary/20"
                />
                <input
                  type="number"
                  aria-label="Invoice Amount value"
                  min={0}
                  max={1000000}
                  step={100}
                  value={normalizedAmount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  className={inputClassName(!!validationErrors.amount)}
                />
              </div>
              {validationErrors.amount && (
                <p className="text-xs text-red-500">{validationErrors.amount}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="yc-discount-range"
                className="flex items-center justify-between text-sm font-medium text-on-surface-variant"
              >
                Discount Rate (bps)
                <span>{normalizedDiscountRate.toLocaleString()}</span>
              </label>
              <div className="flex w-full gap-2">
                <input
                  id="yc-discount-range"
                  type="range"
                  min={0}
                  max={10000}
                  step={1}
                  value={normalizedDiscountRate}
                  onChange={(event) => setDiscountRate(Number(event.target.value))}
                  className="h-2 flex-1 rounded bg-primary/20"
                />
                <input
                  type="number"
                  aria-label="Discount Rate value"
                  min={0}
                  max={10000}
                  step={1}
                  value={normalizedDiscountRate}
                  onChange={(event) => setDiscountRate(Number(event.target.value))}
                  className={inputClassName(!!validationErrors.discountRate)}
                />
              </div>
              {validationErrors.discountRate && (
                <p className="text-xs text-red-500">{validationErrors.discountRate}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="yc-settlement-range"
                className="flex items-center justify-between text-sm font-medium text-on-surface-variant"
              >
                Expected Settlement (days)
                <span>{normalizedSettlementDays}</span>
              </label>
              <div className="flex w-full gap-2">
                <input
                  id="yc-settlement-range"
                  type="range"
                  min={1}
                  max={365}
                  step={1}
                  value={normalizedSettlementDays}
                  onChange={(event) => setSettlementDays(Number(event.target.value))}
                  className="h-2 flex-1 rounded bg-primary/20"
                />
                <input
                  type="number"
                  aria-label="Settlement days value"
                  min={1}
                  max={365}
                  step={1}
                  value={normalizedSettlementDays}
                  onChange={(event) => setSettlementDays(Number(event.target.value))}
                  className={inputClassName(!!validationErrors.settlementDays)}
                />
              </div>
              {validationErrors.settlementDays && (
                <p className="text-xs text-red-500">{validationErrors.settlementDays}</p>
              )}
            </div>
          </div>

          {mode === 'advanced' && (
            <div className="space-y-6 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-on-surface-variant">
                    Invoice category
                  </span>
                  <select
                    value={normalizedCategory}
                    onChange={(event) => setCategory(event.target.value as InvoiceCategory)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
                      validationErrors.category
                        ? 'border-red-500 bg-red-500/5'
                        : 'border-outline-variant/30 bg-surface-container-lowest focus:border-primary'
                    }`}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {validationErrors.category && (
                    <p className="text-xs text-red-500">{validationErrors.category}</p>
                  )}
                </label>

                <div className="rounded-xl border border-outline-variant/15 bg-surface-container p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Risk-adjusted APY
                  </p>
                  <p className="mt-2 text-2xl font-bold text-on-surface">
                    {riskAdjustedApy.toFixed(2)}%
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {selectedCategory.description}
                  </p>
                </div>

                {projectionData.map((projection) => (
                  <div
                    key={projection.label}
                    className="rounded-xl border border-outline-variant/15 bg-surface-container p-4"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      {projection.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-primary">
                      {formatUSDC(BigInt(Math.round(projection.value * 1_000_000)))}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">Projected compound yield</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-on-surface">
                      Compound yield projections
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      Shows how the invoice yield compounds if you recycle capital into similar
                      deals.
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectionData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" />
                        <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                        <Tooltip
                          formatter={(value: number) =>
                            formatUSDC(BigInt(Math.round(value * 1_000_000)))
                          }
                        />
                        <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-on-surface">Category comparison</h4>
                    <p className="text-xs text-on-surface-variant">
                      Compares the same invoice profile across different invoice risk bands.
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
                        />
                        <YAxis type="category" dataKey="name" width={100} />
                        <Tooltip
                          formatter={(value: number) =>
                            formatUSDC(BigInt(Math.round(value * 1_000_000)))
                          }
                        />
                        <Bar dataKey="returnValue" fill="#10b981" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                You send
              </p>
              <p className="mt-2 text-2xl font-bold text-on-surface">{formatUSDC(amountBigInt)}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Freelancer receives
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-500">
                {formatUSDC(freelancerReceives)}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Your yield
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-500">
                {formatUSDC(discountAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                Annualised yield (APY)
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-500">{apy.toFixed(2)}%</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-surface-dim pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-on-surface-variant">
              {normalizedAmount === 0
                ? 'No capital deployed yet.'
                : normalizedDiscountRate === 10_000
                  ? '100% discount is treated as the full invoice value returning to the LP.'
                  : `Current category: ${selectedCategory.label}.`}
            </div>

            <button
              onClick={handleFindMatching}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-surface-container-lowest transition-colors hover:bg-primary/90"
            >
              Find invoices matching these terms
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
