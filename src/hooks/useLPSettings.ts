import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useWallet } from '@/context/WalletContext';
import type { NotificationCategory } from '@/context/NotificationContext';

const SETTINGS_KEY = 'iln-lp-settings';

export interface NotificationPreferences {
  categories: Record<NotificationCategory, boolean>;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  email: string;
}

interface LPSettings {
  minReputation: number;
  notificationPreferences: NotificationPreferences;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: {
    invoice: true,
    lp: true,
    governance: true,
    reputation: true,
    admin: true,
  },
  inAppEnabled: true,
  emailEnabled: false,
  email: '',
};

const DEFAULT_SETTINGS: LPSettings = {
  minReputation: 0,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
};

export function useLPSettings() {
  const { address } = useWallet();
  const [settings, setSettings] = useState<LPSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          notificationPreferences: {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...(parsed.notificationPreferences ?? {}),
            categories: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
              ...(parsed.notificationPreferences?.categories ?? {}),
            },
          },
        });
      }
    } catch (e) {
      console.error('Failed to load LP settings', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const updateSettings = (newSettings: Partial<LPSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  };

  const updateNotificationPreferences = useCallback(
    (partial: Partial<NotificationPreferences>) => {
      const updatedPrefs: NotificationPreferences = {
        ...settings.notificationPreferences,
        ...partial,
        categories: {
          ...settings.notificationPreferences.categories,
          ...(partial.categories ?? {}),
        },
      };

      const updated = { ...settings, notificationPreferences: updatedPrefs };
      setSettings(updated);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

      if (updatedPrefs.emailEnabled && updatedPrefs.email && address) {
        supabase
          .from('reminder_preferences')
          .upsert({
            address,
            email: updatedPrefs.email,
            enabled: true,
            updated_at: new Date().toISOString(),
          })
          .then(({ error }: { error: { message: string } | null }) => {
            if (error) {
              console.error('Failed to sync email preference to Supabase', error);
            }
          });
      } else if (!updatedPrefs.emailEnabled && address) {
        supabase
          .from('reminder_preferences')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('address', address)
          .then(({ error }: { error: { message: string } | null }) => {
            if (error) {
              console.error('Failed to sync email preference to Supabase', error);
            }
          });
      }
    },
    [settings, address]
  );

  return {
    settings,
    updateSettings,
    updateNotificationPreferences,
    isLoaded,
  };
}
