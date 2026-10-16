'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { Role, STEPS_BY_ROLE } from './steps';
import Spotlight from './Spotlight';
import { useRouter } from 'next/navigation';

export default function OnboardingFlow() {
  const { address, isConnected } = useWallet();
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Check localStorage on mount and when connection changes
  useEffect(() => {
    if (isConnected && address) {
      const storageKey = `iln_onboarding_completed_${address}`;
      const hasCompleted = localStorage.getItem(storageKey);

      if (!hasCompleted) {
        setIsVisible(true);
      }
    } else {
      setIsVisible(false);
      setRole(null);
      setCurrentStepIndex(0);
    }
  }, [isConnected, address]);

  const handleComplete = () => {
    if (address) {
      localStorage.setItem(`iln_onboarding_completed_${address}`, 'true');
    }
    setIsVisible(false);
    setRole(null);
    setCurrentStepIndex(0);
  };

  const handleNext = () => {
    if (!role) return;
    const steps = STEPS_BY_ROLE[role];
    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      if (nextStep.route) {
        router.push(nextStep.route);
      }
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  if (!isVisible) return null;

  // Step 1: Role Selection
  if (!role) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
        <div className="bg-surface-container-lowest rounded-[28px] shadow-2xl border border-outline-variant/20 p-8 w-full max-w-lg text-center">
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl text-on-primary-container">
              waving_hand
            </span>
          </div>
          <h2 className="text-3xl font-headline mb-3">Welcome to ILN!</h2>
          <p className="text-on-surface-variant mb-8 leading-relaxed">
            We noticed this is your first time connecting. What are you looking to do on the Invoice
            Liquidity Network?
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setRole('freelancer')}
              className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-blue-600">publish</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">I&apos;m a Freelancer</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Submit invoices and get paid instantly
                </p>
              </div>
            </button>

            <button
              onClick={() => setRole('lp')}
              className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-emerald-600">monitoring</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">I&apos;m a Liquidity Provider</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Fund invoices to earn yield
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setRole('payer');
                router.push('/payer');
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-purple-600">payments</span>
              </div>
              <div>
                <p className="font-bold text-on-surface">I&apos;m a Payer</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Settle invoices on-chain</p>
              </div>
            </button>
          </div>

          <button
            onClick={handleComplete}
            className="mt-8 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-widest"
          >
            Skip Onboarding
          </button>
        </div>
      </div>
    );
  }

  // Step 2+: Spotlight Flow
  const steps = STEPS_BY_ROLE[role];
  const currentStep = steps[currentStepIndex];

  return (
    <Spotlight
      targetId={currentStep.targetId}
      title={currentStep.title}
      content={currentStep.content}
      currentStep={currentStepIndex}
      totalSteps={steps.length}
      onNext={handleNext}
      onSkip={handleComplete}
    />
  );
}
