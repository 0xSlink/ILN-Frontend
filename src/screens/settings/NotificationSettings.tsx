'use client';

/**
 * NotificationSettings — Issue #70
 *
 * Notification preferences page at /settings/notifications.
 * Allows users to configure email and webhook alerts per event type,
 * test webhooks, and manage/delete active subscriptions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type EventType = 'funded' | 'settled' | 'defaulted' | 'due_date_warning';

const EVENT_TYPES: { key: EventType; label: string }[] = [
  { key: 'funded', label: 'Invoice Funded' },
  { key: 'settled', label: 'Invoice Settled' },
  { key: 'defaulted', label: 'Invoice Defaulted' },
  { key: 'due_date_warning', label: 'Due Date Warning' },
];

interface Subscription {
  id: string;
  type: 'email' | 'webhook';
  target: string;
  events: EventType[];
  createdAt: string;
}

interface EventToggles {
  funded: boolean;
  settled: boolean;
  defaulted: boolean;
  due_date_warning: boolean;
}

const DEFAULT_TOGGLES: EventToggles = {
  funded: true,
  settled: true,
  defaulted: true,
  due_date_warning: true,
};

const STORAGE_KEY = 'iln-notification-subscriptions';

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadSubscriptions(): Subscription[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubscriptions(subs: Subscription[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
}

function enabledEvents(toggles: EventToggles): EventType[] {
  return (Object.keys(toggles) as EventType[]).filter((k) => toggles[k]);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NotificationSettings() {
  const { addToast } = useToast();

  // Email form
  const [email, setEmail] = useState('');
  const [emailToggles, setEmailToggles] = useState<EventToggles>(DEFAULT_TOGGLES);

  // Webhook form
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookToggles, setWebhookToggles] = useState<EventToggles>(DEFAULT_TOGGLES);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    setSubscriptions(loadSubscriptions());
  }, []);

  const persistAndSet = (subs: Subscription[]) => {
    setSubscriptions(subs);
    saveSubscriptions(subs);
  };

  // ── Email save ──────────────────────────────────────────────────────────────

  const handleSaveEmail = useCallback(() => {
    if (!email.includes('@')) {
      addToast({ type: 'error', title: 'Please enter a valid email address.' });
      return;
    }
    const events = enabledEvents(emailToggles);
    if (events.length === 0) {
      addToast({ type: 'error', title: 'Select at least one event type.' });
      return;
    }
    const sub: Subscription = {
      id: `email-${Date.now()}`,
      type: 'email',
      target: email,
      events,
      createdAt: new Date().toISOString(),
    };
    // POST /subscribe (mocked — integrate with real notification service)
    persistAndSet([...subscriptions, sub]);
    setEmail('');
    addToast({ type: 'success', title: 'Email subscription saved.' });
  }, [email, emailToggles, subscriptions, addToast]);

  // ── Webhook save ────────────────────────────────────────────────────────────

  const handleSaveWebhook = useCallback(() => {
    if (!webhookUrl.startsWith('http')) {
      addToast({ type: 'error', title: 'Please enter a valid webhook URL.' });
      return;
    }
    const events = enabledEvents(webhookToggles);
    if (events.length === 0) {
      addToast({ type: 'error', title: 'Select at least one event type.' });
      return;
    }
    const sub: Subscription = {
      id: `webhook-${Date.now()}`,
      type: 'webhook',
      target: webhookUrl,
      events,
      createdAt: new Date().toISOString(),
    };
    persistAndSet([...subscriptions, sub]);
    setWebhookUrl('');
    addToast({ type: 'success', title: 'Webhook subscription saved.' });
  }, [webhookUrl, webhookToggles, subscriptions, addToast]);

  // ── Test webhook ────────────────────────────────────────────────────────────

  const handleTestWebhook = useCallback(async () => {
    if (!webhookUrl.startsWith('http')) {
      addToast({ type: 'error', title: 'Enter a valid webhook URL first.' });
      return;
    }
    setTestingWebhook(true);
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test', message: 'Invoice Liquidity Network test webhook' }),
      });
      addToast({ type: 'success', title: 'Test webhook sent successfully.' });
    } catch {
      addToast({ type: 'error', title: 'Webhook test failed. Check the URL.' });
    } finally {
      setTestingWebhook(false);
    }
  }, [webhookUrl, addToast]);

  // ── Delete subscription ─────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string) => {
      persistAndSet(subscriptions.filter((s) => s.id !== id));
      addToast({ type: 'success', title: 'Subscription removed.' });
    },
    [subscriptions, addToast]
  );

  // ── Toggle helper ───────────────────────────────────────────────────────────

  const toggle =
    (setter: React.Dispatch<React.SetStateAction<EventToggles>>, key: EventType) => () =>
      setter((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-bold">Notification Settings</h1>

      {/* ── Email notifications ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Email Notifications</h2>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            data-testid="email-input"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">Notify me when:</legend>
          {EVENT_TYPES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={emailToggles[key]}
                onChange={toggle(setEmailToggles, key)}
                data-testid={`email-toggle-${key}`}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <button
          onClick={handleSaveEmail}
          data-testid="save-email-btn"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
        >
          Save email subscription
        </button>
      </section>

      {/* ── Webhook notifications ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Webhook Notifications</h2>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Webhook URL</span>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            data-testid="webhook-url-input"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">Notify me when:</legend>
          {EVENT_TYPES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={webhookToggles[key]}
                onChange={toggle(setWebhookToggles, key)}
                data-testid={`webhook-toggle-${key}`}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="flex gap-3">
          <button
            onClick={handleSaveWebhook}
            data-testid="save-webhook-btn"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
          >
            Save webhook
          </button>
          <button
            onClick={handleTestWebhook}
            disabled={testingWebhook}
            data-testid="test-webhook-btn"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testingWebhook ? 'Sending…' : 'Test webhook'}
          </button>
        </div>
      </section>

      {/* ── Active subscriptions ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Active Subscriptions</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500">No active subscriptions.</p>
        ) : (
          <ul className="divide-y divide-gray-100" data-testid="subscription-list">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="flex items-start justify-between py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{sub.target}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {sub.type === 'email' ? '📧 Email' : '🔗 Webhook'} · {sub.events.join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(sub.id)}
                  data-testid={`delete-sub-${sub.id}`}
                  className="shrink-0 text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
