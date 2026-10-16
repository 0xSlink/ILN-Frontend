'use client';

import React from 'react';
import { useLPSettings } from '@/hooks/useLPSettings';

interface LPSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LPSettingsModal({ isOpen, onClose }: LPSettingsModalProps) {
  const { settings, updateSettings, updateNotificationPreferences } = useLPSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10">
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
          <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">settings</span>
            Risk Settings
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant/20 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="lp-min-reputation"
              className="text-sm font-bold uppercase tracking-widest text-on-surface-variant"
            >
              Minimum Reputation Threshold
            </label>
            <p className="text-sm text-on-surface-variant mb-4">
              Invoices from payers with a reputation score below this value will be dimmed in the
              marketplace.
            </p>
            <div className="flex items-center gap-4">
              <input
                id="lp-min-reputation"
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.minReputation}
                onChange={(e) => updateSettings({ minReputation: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-xl font-bold text-primary w-12 text-right">
                {settings.minReputation}
              </span>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <span className="material-symbols-outlined text-amber-600">info</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              This setting is stored locally on this device. It helps you quickly identify and avoid
              invoices that don&apos;t meet your risk criteria without removing them from the
              marketplace entirely.
            </p>
          </div>

          <div className="space-y-4 pt-2 border-t border-outline-variant/10">
            <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant pt-4">
              Notifications
            </h4>

            <div className="space-y-3">
              {(['invoice', 'lp', 'governance', 'reputation'] as const).map((category) => (
                <label key={category} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-on-surface capitalize">{category} events</span>
                  <input
                    type="checkbox"
                    checked={settings.notificationPreferences.categories[category]}
                    onChange={(e) =>
                      updateNotificationPreferences({
                        categories: {
                          ...settings.notificationPreferences.categories,
                          [category]: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 accent-primary"
                  />
                </label>
              ))}
            </div>

            <label className="flex items-center justify-between cursor-pointer pt-2">
              <span className="text-sm text-on-surface">In-app notifications</span>
              <input
                type="checkbox"
                checked={settings.notificationPreferences.inAppEnabled}
                onChange={(e) => updateNotificationPreferences({ inAppEnabled: e.target.checked })}
                className="w-5 h-5 accent-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-on-surface">Email notifications</span>
              <input
                type="checkbox"
                checked={settings.notificationPreferences.emailEnabled}
                onChange={(e) => updateNotificationPreferences({ emailEnabled: e.target.checked })}
                className="w-5 h-5 accent-primary"
              />
            </label>

            {settings.notificationPreferences.emailEnabled && (
              <input
                type="email"
                placeholder="you@example.com"
                value={settings.notificationPreferences.email}
                onChange={(e) => updateNotificationPreferences({ email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface text-sm"
              />
            )}
          </div>
        </div>

        <div className="p-6 bg-surface-container-low flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-surface-container-lowest rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
