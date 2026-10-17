'use client';

import React, { useState, useMemo } from 'react';
import { PayerPerformance } from '@/utils/lp-analytics';
import { formatAddress, formatUSDC, tokenAmountToNumber } from '@/utils/format';

interface Props {
  data: PayerPerformance[];
}

type SortKey = keyof PayerPerformance;

const PayerPerformanceTable: React.FC<Props> = ({ data }) => {
  const [sortKey, setSortKey] = useState<SortKey>('totalInvoices');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const exportToCSV = () => {
    const headers = ['Payer', 'Total Invoices', 'Funded Amount', 'Total Yield', 'Default Rate'];
    const rows = sortedData.map((p) => [
      p.payer,
      p.totalInvoices,
      tokenAmountToNumber(p.fundedAmount),
      tokenAmountToNumber(p.totalYield),
      `${p.defaultRate.toFixed(2)}%`,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `lp_payer_performance_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.click();
  };

  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h3 className="font-headline text-lg font-bold">Payer Performance</h3>
        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-variant/10 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Export CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Payer
              </th>
              <th
                className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary"
                onClick={() => toggleSort('totalInvoices')}
              >
                Invoices {sortKey === 'totalInvoices' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary"
                onClick={() => toggleSort('totalYield')}
              >
                Total Yield {sortKey === 'totalYield' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant cursor-pointer hover:text-primary"
                onClick={() => toggleSort('defaultRate')}
              >
                Default Rate {sortKey === 'defaultRate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {sortedData.map((payer) => (
              <tr key={payer.payer} className="hover:bg-surface-container-low transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono text-sm">{formatAddress(payer.payer)}</span>
                  {payer.defaultRate > 5 && (
                    <span className="ml-2 bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      Risk
                    </span>
                  )}
                  {payer.totalYield > 100000000n && (
                    <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      Top
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm font-medium">{payer.totalInvoices}</td>
                <td className="px-6 py-4 text-sm font-bold text-primary">
                  {formatUSDC(payer.totalYield)}
                </td>
                <td
                  className={`px-6 py-4 text-sm font-bold ${
                    payer.defaultRate > 0 ? 'text-error' : 'text-green-600'
                  }`}
                >
                  {payer.defaultRate.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayerPerformanceTable;
