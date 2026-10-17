'use client';

import { type ReactNode } from 'react';
import FieldTooltip from '../FieldTooltip';
import { TokenAmount } from '../TokenSelector';

export function Field({
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

export function PreviewRow({
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

export function formatMiddle(value: string) {
  if (!value) return '-';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}
