import { useMemo } from 'react';

import { useMobileSettings } from '@/providers/mobile-settings-provider';

const palettes = {
  light: {
    background: '#f5f7fb',
    surface: '#ffffff',
    surfaceAlt: '#eef2f8',
    text: '#111318',
    textMuted: '#667085',
    border: 'rgba(17, 24, 39, 0.08)',
    accent: '#111318',
    accentSoft: '#e8eefc',
    success: '#1f9d55',
    successSoft: '#eaf8f0',
    danger: '#d92d20',
    dangerSoft: '#fff0ee',
    tabBar: '#ffffff',
    overlay: 'rgba(10, 14, 22, 0.3)',
    shadow: 'rgba(15, 23, 42, 0.12)',
    cardImageOverlay: 'rgba(10, 14, 22, 0.22)',
  },
  dark: {
    background: '#000000',
    surface: '#101010',
    surfaceAlt: '#1a1a1c',
    text: '#ffffff',
    textMuted: '#c7c7cc',
    border: 'rgba(255, 255, 255, 0.1)',
    accent: '#ffffff',
    accentSoft: '#202024',
    success: '#52d68a',
    successSoft: 'rgba(82, 214, 138, 0.14)',
    danger: '#ff7a7a',
    dangerSoft: 'rgba(255, 122, 122, 0.14)',
    tabBar: '#050505',
    overlay: 'rgba(0, 0, 0, 0.58)',
    shadow: 'rgba(0, 0, 0, 0.34)',
    cardImageOverlay: 'rgba(0, 0, 0, 0.32)',
  },
} as const;

export type AppTheme = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  tabBar: string;
  overlay: string;
  shadow: string;
  cardImageOverlay: string;
};

export function useAppTheme(): AppTheme {
  const { resolvedThemeMode } = useMobileSettings();

  return useMemo(() => palettes[resolvedThemeMode], [resolvedThemeMode]);
}
