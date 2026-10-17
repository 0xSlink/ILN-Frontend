'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';

/**
 * Opt-in email/webhook subscription for status-page incidents (#937).
 * UX mirrors src/components/payer/PayerReminderOptIn.tsx: a single form,
 * optimistic-but-honest save states, no separate "account" concept beyond
 * the email address itself.
 */
export default function StatusSubscribe() {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/status-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          webhookUrl: webhookUrl.trim() ? webhookUrl.trim() : undefined,
          enabled: true,
        }),
      });

      if (response.status === 429) {
        addToast({
          type: 'warning',
          title: 'Too many attempts',
          message: 'Please wait a moment and try again.',
        });
        return;
      }
      if (!response.ok) throw new Error('Failed to save');

      addToast({
        type: 'success',
        title: 'Subscribed',
        message: "You'll be notified when an incident opens or resolves.",
      });
    } catch (error) {
      console.error('Error saving status subscription:', error);
      addToast({ type: 'error', title: 'Save failed', message: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      data-testid="status-subscribe-form"
      className="flex flex-col gap-3 p-4 rounded-lg bg-surface-container"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="status-subscribe-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="status-subscribe-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="px-3 py-2 rounded-md border border-outline bg-surface"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="status-subscribe-webhook" className="text-sm font-medium">
          Webhook URL (optional)
        </label>
        <input
          id="status-subscribe-webhook"
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-service.example.com/hooks/iln-status"
          className="px-3 py-2 rounded-md border border-outline bg-surface"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="self-start px-4 py-2 rounded-md bg-primary text-on-primary disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Subscribe to incident updates'}
      </button>
    </form>
  );
}
