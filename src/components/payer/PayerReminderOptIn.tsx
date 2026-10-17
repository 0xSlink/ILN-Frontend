'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';

export default function PayerReminderOptIn() {
  const { address, isConnected } = useWallet();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPreference = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reminder_preferences')
        .select('email, enabled')
        .eq('address', address)
        .maybeSingle();

      if (data) {
        setEmail(data.email);
        setEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error loading preference:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadPreference();
    }
  }, [isConnected, address]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setSaving(true);
    try {
      // eslint-disable-next-line no-restricted-globals, no-restricted-syntax -- Legacy inline exception pending query hook migration
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, email, enabled }),
      });

      if (response.status === 429) {
        addToast({
          type: 'warning',
          title: 'Too many attempts',
          message: 'Please wait a moment and try saving your preference again.',
        });
        return;
      }

      if (!response.ok) throw new Error('Failed to save');

      const body = (await response.json()) as {
        success?: boolean;
        saved?: boolean;
        delivery?: 'ok' | 'degraded';
      };

      if (body.success && body.delivery === 'degraded') {
        // Preference WAS saved, but the delivery channel is temporarily degraded.
        // This is a different user action than a failed save: no re-entry needed.
        addToast({
          type: 'warning',
          title: 'Preference saved, delivery temporarily degraded',
          message: enabled
            ? `Your preference is saved, but reminder delivery is temporarily degraded. We'll resume sending to ${email} shortly.`
            : 'Your preference is saved, but reminder delivery is temporarily degraded.',
        });
        return;
      }

      addToast({
        type: 'success',
        title: 'Preferences saved',
        message: enabled
          ? `You will receive reminders at ${email}`
          : 'Email reminders are now disabled',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Your preference failed to save.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-outlined text-primary">mail</span>
        <h3 className="text-lg font-bold">Email Reminders</h3>
      </div>
      <p className="text-sm text-on-surface-variant mb-6">
        Get notified 72h and 24h before your invoices are due.
      </p>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-surface-container-highest rounded-xl" />
          <div className="h-6 w-1/2 bg-surface-container-highest rounded-xl" />
          <div className="h-12 bg-surface-container-highest rounded-xl" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary' : 'bg-outline-variant/30'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium">
              {enabled ? 'Reminders enabled' : 'Reminders disabled'}
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || !email}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      )}
    </div>
  );
}
