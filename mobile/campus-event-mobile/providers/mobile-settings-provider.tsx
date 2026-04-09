import React, { createContext, useContext, useMemo, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';

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

export function MobileSettingsProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useColorScheme();
  const [settings, setSettings] = useState<MobileSettingsState>(initialSettings);
  const [themeMode, setThemeMode] = useState<ThemeMode>('device');

  const resolvedThemeMode =
    themeMode === 'device' ? (deviceColorScheme === 'light' ? 'light' : 'dark') : themeMode;

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
