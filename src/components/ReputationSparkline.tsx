'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { getReputationEvents } from '@/utils/soroban';

type Point = { date: string; label: string; score: number };

function build30DaySeries(
  events: Array<{ timestamp: number; score?: number }>,
  fallbackScore: number
) {
  const now = new Date();
  const days = 30;
  const series: Point[] = [];

  // Sort events by timestamp ascending
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Convert timestamps (assumed seconds) to Date
  const eventsWithDate = sorted.map((e) => ({ ...e, d: new Date(e.timestamp * 1000) }));

  let lastKnownScore = fallbackScore ?? 0;
  // Walk through days from oldest to newest
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(23, 59, 59, 999);
    // find latest event <= d
    const ev = eventsWithDate.filter((e) => e.d.getTime() <= d.getTime()).slice(-1)[0];
    if (ev && typeof ev.score === 'number') lastKnownScore = Math.max(0, Math.min(100, ev.score));
    series.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: lastKnownScore,
    });
  }

  return series;
}

export default function ReputationSparkline({
  payerAddress,
  currentScore,
}: {
  payerAddress: string;
  currentScore: number;
}) {
  const [events, setEvents] = useState<Array<{ timestamp: number; score?: number }>>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await getReputationEvents(payerAddress);
        if (!mounted) return;
        setEvents(resp.map((e: any) => ({ timestamp: Number(e.timestamp ?? 0), score: e.score })));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [payerAddress]);

  const points = useMemo(() => build30DaySeries(events, currentScore ?? 0), [events, currentScore]);

  const first = points[0]?.score ?? currentScore ?? 0;
  const last = points[points.length - 1]?.score ?? currentScore ?? 0;
  const delta = last - first;

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-start">
        <div className="text-sm text-on-surface-variant">Reputation</div>
        <div className="text-lg font-bold text-on-surface">{Math.round(last)}</div>
      </div>

      <div className="w-28 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis dataKey="label" hide />
            <Tooltip
              formatter={(value: any) => [`${value}/100`, 'Score']}
              labelFormatter={(label: string, _items: any) => {
                return label;
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={
                delta > 0
                  ? 'var(--color-success, #16a34a)'
                  : delta < 0
                    ? 'var(--color-error, #dc2626)'
                    : 'var(--color-on-surface, #0f172a)'
              }
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col items-end text-sm">
        {delta > 0 ? (
          <div className="text-success font-bold flex items-center gap-1">
            ▲ {Math.abs(Math.round(delta))}
          </div>
        ) : delta < 0 ? (
          <div className="text-error font-bold flex items-center gap-1">
            ▼ {Math.abs(Math.round(delta))}
          </div>
        ) : (
          <div className="text-on-surface-variant">—</div>
        )}
        <div className="text-xs text-on-surface-variant">30d</div>
      </div>
    </div>
  );
}
