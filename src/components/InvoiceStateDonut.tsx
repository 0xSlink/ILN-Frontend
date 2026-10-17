'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import useInvoiceStateCounts from '@/hooks/useInvoiceStateCounts';

const COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  FUNDED: '#10b981',
  PAID: '#3b82f6',
  EXPIRED: '#ef4444',
  CANCELLED: '#6b7280',
  DISPUTED: '#a78bfa',
};

interface InvoiceStateDonutProps {
  onStateFilter?: (states: string[]) => void;
  filteredStates?: string[];
}

export default function InvoiceStateDonut({
  onStateFilter,
  filteredStates = [],
}: InvoiceStateDonutProps) {
  const { counts, total, loading } = useInvoiceStateCounts();

  if (loading) return <div className="rounded-lg bg-surface-container-low p-6">Loading...</div>;
  if (!counts) return <div className="rounded-lg bg-surface-container-low p-6">No data</div>;

  const data = Object.keys(counts).map((k) => ({
    name: k,
    value: counts[k],
    percent: total ? (counts[k] / total) * 100 : 0,
  }));

  const toggleState = (state: string) => {
    const next = filteredStates.includes(state)
      ? filteredStates.filter((s) => s !== state)
      : [...filteredStates, state];
    onStateFilter?.(next);
  };

  const filteredData =
    filteredStates.length > 0 ? data.filter((d) => filteredStates.includes(d.name)) : data;

  return (
    <div className="motion-safe:animate-donut-grow rounded-lg bg-surface-container-low p-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest">Invoice States</p>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={filteredData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              isAnimationActive
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {filteredData.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] ?? '#ddd'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => {
                const p = total ? ((value / total) * 100).toFixed(1) : '0';
                return [String(value), `${name} — ${p}%`];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.map((d) => {
          const active = filteredStates.length === 0 || filteredStates.includes(d.name);
          return (
            <button
              key={d.name}
              onClick={() => toggleState(d.name)}
              className={`flex items-center gap-3 rounded-lg p-2 text-left transition-all ${
                active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              } ${
                filteredStates.includes(d.name) ? 'ring-1 ring-primary' : ''
              } hover:bg-surface-variant/30`}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  background: COLORS[d.name] ?? '#ddd',
                  display: 'inline-block',
                  borderRadius: 3,
                  flexShrink: 0,
                }}
              />
              <div className="text-sm">
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-on-surface-variant">
                  {d.value} — {total ? ((d.value / total) * 100).toFixed(1) : '0'}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {filteredStates.length > 0 && (
        <button
          onClick={() => onStateFilter?.([])}
          className="mt-2 text-xs font-bold uppercase tracking-wide text-primary hover:underline"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
