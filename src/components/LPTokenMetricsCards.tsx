'use client';

import React from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { TokenYieldMetrics, TESTNET_EXCHANGE_RATES, convertToUSD } from '@/utils/per-token-yield';
import { formatTokenAmount } from '@/utils/format';

interface LPTokenMetricsCardsProps {
  metrics: TokenYieldMetrics[];
  showUSDEquivalent: boolean;
  onToggleUSD: () => void;
}

export default function LPTokenMetricsCards({
  metrics,
  showUSDEquivalent,
  onToggleUSD,
}: LPTokenMetricsCardsProps) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* USD Toggle */}
      <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="usd-toggle"
            className="text-sm font-semibold text-on-surface cursor-pointer"
          >
            Show in USD equivalent (Testnet Rates)
          </label>
          <span className="text-xs text-on-surface-variant italic">
            Approximate rates:{' '}
            {Object.entries(TESTNET_EXCHANGE_RATES)
              .map(([token, rate]) => `1 ${token} = ${rate} USD`)
              .join(', ')}
          </span>
        </div>
        <button
          id="usd-toggle"
          onClick={onToggleUSD}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            showUSDEquivalent ? 'bg-primary' : 'bg-surface-container'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-on-primary transition-transform ${
              showUSDEquivalent ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Token Metrics Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const yieldEarned = showUSDEquivalent
            ? convertToUSD(metric.totalYieldEarned, metric.token)
            : metric.totalYieldEarned;

          const funded = showUSDEquivalent
            ? convertToUSD(metric.totalFunded, metric.token)
            : metric.totalFunded;

          const pendingYield = showUSDEquivalent
            ? convertToUSD(metric.pendingYield, metric.token)
            : metric.pendingYield;

          const displaySymbol = showUSDEquivalent ? 'USD' : metric.token.symbol;
          const displayDecimals = showUSDEquivalent ? 6 : metric.token.decimals;

          return (
            <div
              key={metric.token.contractId}
              className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6"
            >
              {/* Token Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {metric.token.iconLabel}
                  </div>
                  <span className="font-semibold text-on-surface">{metric.token.symbol}</span>
                </div>
                <span className="text-xs font-bold uppercase text-on-surface-variant">
                  {metric.paidCount}/{metric.invoiceCount} Invoices
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-3">
                {/* Total Funded */}
                <div className="rounded-lg bg-surface-container-low p-3">
                  <p className="text-xs uppercase tracking-wider text-on-surface-variant">
                    Total Funded
                  </p>
                  <p className="mt-1 font-headline text-lg font-bold text-on-surface">
                    {formatTokenAmount(funded, {
                      symbol: displaySymbol,
                      decimals: displayDecimals,
                    })}
                  </p>
                </div>

                {/* Yield Earned with Percentage */}
                <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                  <p className="text-xs uppercase tracking-wider text-green-700 dark:text-green-400">
                    Yield Earned
                  </p>
                  <p className="mt-1 flex items-baseline gap-2 font-headline">
                    <span className="text-lg font-bold text-green-700 dark:text-green-400">
                      {formatTokenAmount(yieldEarned, {
                        symbol: displaySymbol,
                        decimals: displayDecimals,
                      })}
                    </span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-500">
                      ({metric.yieldPercentage.toFixed(2)}%)
                    </span>
                  </p>
                </div>

                {/* Pending Yield */}
                {Number(metric.pendingYield) > 0 && (
                  <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20">
                    <p className="text-xs uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                      Pending Yield
                    </p>
                    <p className="mt-1 font-headline text-sm font-bold text-yellow-700 dark:text-yellow-400">
                      {formatTokenAmount(pendingYield, {
                        symbol: displaySymbol,
                        decimals: displayDecimals,
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Sparkline */}
              {metric.sparklineData && metric.sparklineData.length > 0 && (
                <div className="mt-3 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metric.sparklineData.map((v, i) => ({ v, i }))}>
                      <defs>
                        <linearGradient
                          id={`sparkGrad-${metric.token.contractId}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={
                              metric.sparklineData![metric.sparklineData!.length - 1] >=
                              metric.sparklineData![0]
                                ? '#10b981'
                                : '#ef4444'
                            }
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={
                              metric.sparklineData![metric.sparklineData!.length - 1] >=
                              metric.sparklineData![0]
                                ? '#10b981'
                                : '#ef4444'
                            }
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                        formatter={(value: number) => [
                          formatTokenAmount(BigInt(Math.round(value)), {
                            symbol: displaySymbol,
                            decimals: displayDecimals,
                          }),
                          'Value',
                        ]}
                        labelFormatter={() => '7-Day Trend'}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={
                          metric.sparklineData[metric.sparklineData.length - 1] >=
                          metric.sparklineData[0]
                            ? '#10b981'
                            : '#ef4444'
                        }
                        fill={`url(#sparkGrad-${metric.token.contractId})`}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
