import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mobileSettingsStorage } from '@/lib/mobile-file-storage';
import { supabase } from '@/lib/supabase';

export type ThemeMode = 'light' | 'dark' | 'device';

export type MobileSettingsState = {
  pushNotifications: boolean;
  eventReminders: boolean;
  followerAlerts: boolean;
  dmAlerts: boolean;
  messageRequests: boolean;
  readReceipts: boolean;
  showOnlineStatus: boolean;
  privateProfile: boolean;
  showActivityStatus: boolean;
  followersOnlyDms: boolean;
};

export type MobileSettingsKey = keyof MobileSettingsState;

type MobileSettingsContextValue = {
  settings: MobileSettingsState;
  themeMode: ThemeMode;
  resolvedThemeMode: 'light' | 'dark';
  updateSetting: (key: MobileSettingsKey, value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const initialSettings: MobileSettingsState = {
  pushNotifications: true,
  eventReminders: true,
  followerAlerts: true,
  dmAlerts: true,
  messageRequests: true,
  readReceipts: true,
  showOnlineStatus: true,
  privateProfile: false,
  showActivityStatus: true,
  followersOnlyDms: false,
};

const MobileSettingsContext = createContext<MobileSettingsContextValue | null>(null);
const SETTINGS_STORAGE_KEY = 'mobileSettings';
const THEME_MODE_STORAGE_KEY = 'mobileThemeMode';
const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'device';

export function MobileSettingsProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useColorScheme();
  const [settings, setSettings] = useState<MobileSettingsState>(initialSettings);
  const [themeMode, setThemeMode] = useState<ThemeMode>('device');
  const hasLoadedPersistedState = useRef(false);
  const supabaseUserIdRef = useRef<string | null>(null);

  const resolvedThemeMode =
    themeMode === 'device' ? (deviceColorScheme === 'light' ? 'light' : 'dark') : themeMode;

  useEffect(() => {
    let isMounted = true;

    const hydrateSettings = async () => {
      try {
        const [storedSettings, storedThemeMode] = await Promise.all([
          mobileSettingsStorage.getItem(SETTINGS_STORAGE_KEY),
          mobileSettingsStorage.getItem(THEME_MODE_STORAGE_KEY),
        ]);

        if (!isMounted) return;

        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings) as Partial<MobileSettingsState>;

          setSettings((currentSettings) => ({
            ...currentSettings,
            ...parsedSettings,
          }));
        }

        if (isThemeMode(storedThemeMode)) {
          setThemeMode(storedThemeMode);
        }

        // Load from Supabase if signed in — Supabase value wins over local cache
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user?.id) {
            supabaseUserIdRef.current = session.user.id;

            const { data: profileRow } = await supabase
              .from('profiles')
              .select('settings')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileRow?.settings && typeof profileRow.settings === 'object' && isMounted) {
              setSettings((currentSettings) => ({
                ...currentSettings,
                ...(profileRow.settings as Partial<MobileSettingsState>),
              }));
            }
          }
        }
      } catch (error) {
        console.error('Unable to restore mobile settings:', error);
      } finally {
        if (isMounted) {
          hasLoadedPersistedState.current = true;
        }
      }
    };

    void hydrateSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync userId ref when the auth state changes after mount
  useEffect(() => {
    if (!supabase) return;

    const client = supabase;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, nextSession) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && nextSession?.user?.id) {
        supabaseUserIdRef.current = nextSession.user.id;

        const { data: profileRow } = await client
          .from('profiles')
          .select('settings')
          .eq('id', nextSession.user.id)
          .maybeSingle();

        if (profileRow?.settings && typeof profileRow.settings === 'object') {
          setSettings((currentSettings) => ({
            ...currentSettings,
            ...(profileRow.settings as Partial<MobileSettingsState>),
          }));
        }
      } else if (event === 'SIGNED_OUT') {
        supabaseUserIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedState.current) return;

    void mobileSettingsStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch((error) => {
      console.error('Unable to persist mobile settings:', error);
    });

    if (supabase && supabaseUserIdRef.current) {
      void supabase
        .from('profiles')
        .update({ settings })
        .eq('id', supabaseUserIdRef.current)
        .then(({ error }) => {
          if (error) console.error('Unable to sync settings to Supabase:', error);
        });
    }
  }, [settings]);

  useEffect(() => {
    if (!hasLoadedPersistedState.current) return;

    void mobileSettingsStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode).catch((error) => {
      console.error('Unable to persist mobile theme mode:', error);
    });
  }, [themeMode]);

  const updateSetting = (key: MobileSettingsKey, value: boolean) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
  };

  const value = useMemo<MobileSettingsContextValue>(
    () => ({
      settings,
      themeMode,
      resolvedThemeMode,
      updateSetting,
      setThemeMode,
    }),
    [resolvedThemeMode, settings, themeMode]
  );

  return (
    <MobileSettingsContext.Provider value={value}>{children}</MobileSettingsContext.Provider>
  );
}

export function useMobileSettings() {
  const context = useContext(MobileSettingsContext);

  if (!context) {
    throw new Error('useMobileSettings must be used within a MobileSettingsProvider');
  }

  return context;
}
