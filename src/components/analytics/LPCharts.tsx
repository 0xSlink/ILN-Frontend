'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CHART_TICK_STYLE = {
  fill: '#64748b',
  fontSize: 11,
};

const COLORS = ['#0ea5e9', '#ef4444', '#fbbf24'];

export const MIN_HISTORY_POINTS = 2;

export interface YieldBarDatum {
  name: string;
  yield: number;
}

export interface CapitalLineDatum {
  time: string;
  capital: number;
  yield: number;
}

export interface OutcomePieDatum {
  name: string;
  value: number;
}

interface ChartProps<T> {
  data: T[];
  sampleLabel?: string;
}

function SampleDataLabel({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <p
      data-testid="lp-chart-sample-label"
      className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
    >
      {label}
    </p>
  );
}

function InsufficientHistory({ subject }: { subject: string }) {
  return (
    <div
      role="status"
      data-testid="lp-chart-insufficient-history"
      className="flex h-[300px] w-full items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/20 p-6 text-center"
    >
      <p className="text-sm text-on-surface-variant">
        Insufficient history for {subject}: at least {MIN_HISTORY_POINTS} verified data points are
        required. No values are estimated.
      </p>
    </div>
  );
}

export const YieldBarChart = ({ data, sampleLabel }: ChartProps<YieldBarDatum>) => (
  <div className="w-full">
    <SampleDataLabel label={sampleLabel} />
    {data.length < MIN_HISTORY_POINTS ? (
      <InsufficientHistory subject="yield history" />
    ) : (
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
            />
            <Bar dataKey="yield" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Yield (USDC)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export const CapitalLineChart = ({ data, sampleLabel }: ChartProps<CapitalLineDatum>) => (
  <div className="w-full">
    <SampleDataLabel label={sampleLabel} />
    {data.length < MIN_HISTORY_POINTS ? (
      <InsufficientHistory subject="capital history" />
    ) : (
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="time" tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="capital"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              name="Capital Deployed"
            />
            <Line
              type="monotone"
              dataKey="yield"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Yield Earned"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export const OutcomePieChart = ({ data, sampleLabel }: ChartProps<OutcomePieDatum>) => (
  <div className="w-full">
    <SampleDataLabel label={sampleLabel} />
    {data.length < MIN_HISTORY_POINTS ? (
      <InsufficientHistory subject="outcome distribution" />
    ) : (
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);
