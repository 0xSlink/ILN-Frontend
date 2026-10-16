import { Invoice } from './soroban';

export interface FreelancerMetrics {
  totalInvoiced: bigint;
  totalLiquidityReceived: bigint; // net of discounts (amount - discount cost)
  totalDiscountCost: bigint; // sum of all discounts paid
  avgDiscountRate: number; // percentage
  fundedRate: number; // percentage of submitted invoices that got funded
  avgTimeToFunding: number | null; // hours
}

export interface MonthlyInvoiceData {
  month: string; // e.g., "Jan 26"
  submitted: number;
  funded: number;
}

export interface DiscountOverTimeData {
  date: string; // e.g., "Jan 24"
  discountCost: number; // in USDC
}

export interface PayerReliability {
  payer: string;
  onTimeRate: number; // percentage
  avgSettlementDays: number;
  totalInvoices: number;
  fundedAmount: bigint;
}

/**
 * Calculate key metrics for a freelancer's invoice history
 */
export function calculateFreelancerMetrics(
  invoices: Invoice[],
  address: string
): FreelancerMetrics {
  const freelancerInvoices = invoices.filter((i) => i.freelancer === address);

  if (freelancerInvoices.length === 0) {
    return {
      totalInvoiced: 0n,
      totalLiquidityReceived: 0n,
      totalDiscountCost: 0n,
      avgDiscountRate: 0,
      fundedRate: 0,
      avgTimeToFunding: null,
    };
  }

  let totalInvoiced = 0n;
  let totalDiscountCost = 0n;
  let fundedCount = 0;
  let totalDiscountRate = 0;
  let totalTimeToFunding = 0;
  let fundedWithTimeCount = 0;

  freelancerInvoices.forEach((i) => {
    totalInvoiced += i.amount;

    // Calculate discount cost: amount * discount_rate / 10000
    const discount = (i.amount * BigInt(i.discount_rate)) / 10000n;
    totalDiscountCost += discount;
    totalDiscountRate += i.discount_rate;

    if (i.status === 'Funded' || i.status === 'Paid') {
      fundedCount++;

      // Calculate time to funding
      if (i.funded_at) {
        const submittedTime = Math.floor(Number(i.due_date) * 1000); // Approximate submission time as due date
        const fundedTime = Number(i.funded_at) * 1000;
        // Use a more reasonable calculation: assume submission was some time before due date
        // For now, we'll calculate from current block time backwards
        const timeToFundingMs = fundedTime - submittedTime;
        if (timeToFundingMs >= 0) {
          totalTimeToFunding += timeToFundingMs;
          fundedWithTimeCount++;
        }
      }
    }
  });

  // Calculate liquidity received (net of discounts)
  const totalLiquidityReceived = totalInvoiced - totalDiscountCost;

  // Calculate averages
  const fundedRate = (fundedCount / freelancerInvoices.length) * 100;
  const avgDiscountRate = totalDiscountRate / freelancerInvoices.length / 100;
  const avgTimeToFunding =
    fundedWithTimeCount > 0
      ? totalTimeToFunding / fundedWithTimeCount / (1000 * 60 * 60) // convert ms to hours
      : null;

  return {
    totalInvoiced,
    totalLiquidityReceived,
    totalDiscountCost,
    avgDiscountRate,
    fundedRate,
    avgTimeToFunding,
  };
}

/**
 * Get monthly invoice submitted vs funded data (last 12 months)
 */
export function getMonthlyInvoiceData(invoices: Invoice[], address: string): MonthlyInvoiceData[] {
  const freelancerInvoices = invoices.filter((i) => i.freelancer === address);

  // Get last 12 months of data
  const months: Record<string, { submitted: number; funded: number }> = {};
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    months[monthKey] = { submitted: 0, funded: 0 };
  }

  freelancerInvoices.forEach((i) => {
    // Use due_date as approximate submission date
    const date = new Date(Number(i.due_date) * 1000);
    const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });

    if (months[monthKey]) {
      months[monthKey].submitted++;
      if (i.status === 'Funded' || i.status === 'Paid') {
        months[monthKey].funded++;
      }
    }
  });

  return Object.entries(months).map(([month, data]) => ({
    month,
    submitted: data.submitted,
    funded: data.funded,
  }));
}

/**
 * Get discount cost over time (line chart data)
 */
export function getDiscountOverTimeData(
  invoices: Invoice[],
  address: string
): DiscountOverTimeData[] {
  const freelancerInvoices = invoices.filter(
    (i) => i.freelancer === address && i.status === 'Paid'
  );
  const dates: Record<string, bigint> = {};

  freelancerInvoices.forEach((i) => {
    if (i.funded_at) {
      const date = new Date(Number(i.funded_at) * 1000);
      const dateKey = date.toLocaleString('default', { month: 'short', day: 'numeric' });
      const discountCost = (i.amount * BigInt(i.discount_rate)) / 10000n;
      dates[dateKey] = (dates[dateKey] || 0n) + discountCost;
    }
  });

  // Sort by date and convert to USDC (6 decimals)
  return Object.entries(dates)
    .map(([date, cost]) => ({
      date,
      discountCost: Number(cost) / 1_000_000,
    }))
    .sort((a, b) => {
      // Sort dates chronologically (this is a simple sort, may need refinement)
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
}

/**
 * Get payer reliability from freelancer's perspective (on-time payment %)
 */
export function getPayerReliability(invoices: Invoice[], address: string): PayerReliability[] {
  const freelancerInvoices = invoices.filter((i) => i.freelancer === address);
  const payers: Record<
    string,
    {
      totalInvoices: number;
      onTimeCount: number;
      totalSettlementDays: number;
      settledCount: number;
      fundedAmount: bigint;
    }
  > = {};

  freelancerInvoices.forEach((i) => {
    if (!payers[i.payer]) {
      payers[i.payer] = {
        totalInvoices: 0,
        onTimeCount: 0,
        totalSettlementDays: 0,
        settledCount: 0,
        fundedAmount: 0n,
      };
    }
    payers[i.payer].totalInvoices++;
    payers[i.payer].fundedAmount += i.amount;

    // Calculate on-time payment (if paid before due date)
    if (i.status === 'Paid' && i.funded_at) {
      payers[i.payer].settledCount++;
      const dueDate = Number(i.due_date);
      const paidDate = Number(i.funded_at);
      if (paidDate <= dueDate) {
        payers[i.payer].onTimeCount++;
      }
      const settlementDays = (paidDate - dueDate) / (24 * 60 * 60);
      payers[i.payer].totalSettlementDays += settlementDays;
    }
  });

  return Object.entries(payers).map(([payer, data]) => ({
    payer,
    onTimeRate: data.settledCount > 0 ? (data.onTimeCount / data.settledCount) * 100 : 0,
    avgSettlementDays: data.settledCount > 0 ? data.totalSettlementDays / data.settledCount : 0,
    totalInvoices: data.totalInvoices,
    fundedAmount: data.fundedAmount,
  }));
}

/**
 * Get outcome breakdown for freelancer (submitted, funded, paid, defaulted)
 */
export function getOutcomeBreakdown(invoices: Invoice[], address: string) {
  const freelancerInvoices = invoices.filter((i) => i.freelancer === address);
  const counts = { Submitted: 0, Funded: 0, Paid: 0, Defaulted: 0 };

  freelancerInvoices.forEach((i) => {
    counts.Submitted++;
    if (i.status === 'Funded') counts.Funded++;
    else if (i.status === 'Paid') {
      counts.Paid++;
      counts.Funded++; // Paid invoices were also funded
    } else if (i.status === 'Defaulted') counts.Defaulted++;
  });

  return [
    { name: 'Funded', value: counts.Funded },
    { name: 'Paid', value: counts.Paid },
    { name: 'Defaulted', value: counts.Defaulted },
  ];
}
