'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@/context/WalletContext';

export type SubscriptionPlan = 'free' | 'pro';

interface SubscriptionContextType {
  plan: SubscriptionPlan;
  isPro: boolean;
  upgrade: () => void;
  dismissBanner: () => void;
  isBannerDismissed: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const PLAN_STORAGE_KEY = 'iln_subscription_plan';
const BANNER_DISMISS_KEY = 'iln_pro_banner_dismissed';

function loadPlan(): SubscriptionPlan {
  if (typeof window === 'undefined') return 'free';
  try {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    if (stored === 'pro' || stored === 'free') return stored;
  } catch {}
  return 'free';
}

function loadBannerDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BANNER_DISMISS_KEY) === 'true';
  } catch {}
  return false;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const [plan, setPlan] = useState<SubscriptionPlan>(loadPlan);
  const [bannerDismissed, setBannerDismissed] = useState(loadBannerDismissed);

  useEffect(() => {
    setPlan(loadPlan());
    setBannerDismissed(loadBannerDismissed());
  }, [address]);

  const upgrade = useCallback(() => {
    setPlan('pro');
    localStorage.setItem(PLAN_STORAGE_KEY, 'pro');
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    localStorage.setItem(BANNER_DISMISS_KEY, 'true');
  }, []);

  const isPro = plan === 'pro';

  const value = useMemo(
    () => ({
      plan,
      isPro,
      upgrade,
      dismissBanner,
      isBannerDismissed: bannerDismissed,
    }),
    [plan, isPro, upgrade, dismissBanner, bannerDismissed]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
