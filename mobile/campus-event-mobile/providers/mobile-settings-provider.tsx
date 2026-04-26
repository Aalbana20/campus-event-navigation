import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { mobileSettingsStorage } from '@/lib/mobile-file-storage';
import { supabase } from '@/lib/supabase';

export type ThemeMode = 'light' | 'dark' | 'device';
export type AccentColorKey = 'green' | 'blue' | 'purple' | 'pink' | 'orange' | 'red' | 'white';

export const ACCENT_COLOR_OPTIONS: {
  key: AccentColorKey;
  label: string;
  color: string;
  softColor: string;
}[] = [
  { key: 'green', label: 'Green', color: '#32d74b', softColor: 'rgba(50, 215, 75, 0.16)' },
  { key: 'blue', label: 'Blue', color: '#0a84ff', softColor: 'rgba(10, 132, 255, 0.16)' },
  { key: 'purple', label: 'Purple', color: '#bf5af2', softColor: 'rgba(191, 90, 242, 0.16)' },
  { key: 'pink', label: 'Pink', color: '#ff2d92', softColor: 'rgba(255, 45, 146, 0.16)' },
  { key: 'orange', label: 'Orange', color: '#ff9f0a', softColor: 'rgba(255, 159, 10, 0.16)' },
  { key: 'red', label: 'Red', color: '#ff453a', softColor: 'rgba(255, 69, 58, 0.16)' },
  { key: 'white', label: 'White', color: '#ffffff', softColor: 'rgba(255, 255, 255, 0.16)' },
];

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
  accentColor: AccentColorKey;
  resolvedThemeMode: 'light' | 'dark';
  updateSetting: (key: MobileSettingsKey, value: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: AccentColorKey) => void;
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
const ACCENT_COLOR_STORAGE_KEY = 'mobileAccentColor';
const SETTINGS_SUPABASE_TIMEOUT_MS = 5000;
const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'device';
const isAccentColor = (value: unknown): value is AccentColorKey =>
  ACCENT_COLOR_OPTIONS.some((option) => option.key === value);

const withSettingsTimeout = async <T,>(label: string, promise: PromiseLike<T>) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${SETTINGS_SUPABASE_TIMEOUT_MS}ms`)),
      SETTINGS_SUPABASE_TIMEOUT_MS
    );

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

export function MobileSettingsProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useColorScheme();
  const [settings, setSettings] = useState<MobileSettingsState>(initialSettings);
  const [themeMode, setThemeMode] = useState<ThemeMode>('device');
  const [accentColor, setAccentColor] = useState<AccentColorKey>('green');
  const hasLoadedPersistedState = useRef(false);
  const supabaseUserIdRef = useRef<string | null>(null);

  const resolvedThemeMode =
    themeMode === 'device' ? (deviceColorScheme === 'light' ? 'light' : 'dark') : themeMode;

  useEffect(() => {
    let isMounted = true;

    const hydrateSettings = async () => {
      try {
        const [storedSettings, storedThemeMode, storedAccentColor] = await Promise.all([
          mobileSettingsStorage.getItem(SETTINGS_STORAGE_KEY),
          mobileSettingsStorage.getItem(THEME_MODE_STORAGE_KEY),
          mobileSettingsStorage.getItem(ACCENT_COLOR_STORAGE_KEY),
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

        if (isAccentColor(storedAccentColor)) {
          setAccentColor(storedAccentColor);
        }

        // Load from Supabase if signed in — Supabase value wins over local cache
        if (supabase) {
          const { data: { session } } = await withSettingsTimeout(
            'settings.auth.getSession',
            supabase.auth.getSession()
          );

          if (session?.user?.id) {
            supabaseUserIdRef.current = session.user.id;

            const { data: profileRow } = await withSettingsTimeout(
              'settings.profile',
              supabase
                .from('profiles')
                .select('settings')
                .eq('id', session.user.id)
                .maybeSingle()
            );

            if (profileRow?.settings && typeof profileRow.settings === 'object' && isMounted) {
              const {
                accentColor: remoteAccentColor,
                ...remoteSettings
              } = profileRow.settings as Partial<MobileSettingsState> & {
                accentColor?: unknown;
              };
              setSettings((currentSettings) => ({
                ...currentSettings,
                ...remoteSettings,
              }));
              if (isAccentColor(remoteAccentColor)) {
                setAccentColor(remoteAccentColor);
              }
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
      try {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && nextSession?.user?.id) {
          supabaseUserIdRef.current = nextSession.user.id;

          const { data: profileRow } = await withSettingsTimeout(
            'settings.authState.profile',
            client
              .from('profiles')
              .select('settings')
              .eq('id', nextSession.user.id)
              .maybeSingle()
          );

          if (profileRow?.settings && typeof profileRow.settings === 'object') {
            const {
              accentColor: remoteAccentColor,
              ...remoteSettings
            } = profileRow.settings as Partial<MobileSettingsState> & {
              accentColor?: unknown;
            };
            setSettings((currentSettings) => ({
              ...currentSettings,
              ...remoteSettings,
            }));
            if (isAccentColor(remoteAccentColor)) {
              setAccentColor(remoteAccentColor);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          supabaseUserIdRef.current = null;
        }
      } catch (error) {
        console.warn('Unable to sync mobile settings from Supabase:', error);
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
        .update({ settings: { ...settings, accentColor } })
        .eq('id', supabaseUserIdRef.current)
        .then(({ error }) => {
          if (error) console.error('Unable to sync settings to Supabase:', error);
        });
    }
  }, [accentColor, settings]);

  useEffect(() => {
    if (!hasLoadedPersistedState.current) return;

    void mobileSettingsStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode).catch((error) => {
      console.error('Unable to persist mobile theme mode:', error);
    });
  }, [themeMode]);

  useEffect(() => {
    if (!hasLoadedPersistedState.current) return;

    void mobileSettingsStorage.setItem(ACCENT_COLOR_STORAGE_KEY, accentColor).catch((error) => {
      console.error('Unable to persist mobile accent color:', error);
    });
  }, [accentColor]);

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
      accentColor,
      resolvedThemeMode,
      updateSetting,
      setThemeMode,
      setAccentColor,
    }),
    [accentColor, resolvedThemeMode, settings, themeMode]
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
