import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

import { expoSupabaseStorage } from './supabase-storage';

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const constantsWithLegacyManifest = Constants as typeof Constants & {
  manifest?: { extra?: ExpoExtra } | null;
};
const extra =
  ((Constants.expoConfig?.extra ??
    constantsWithLegacyManifest.manifest?.extra ??
    {}) as ExpoExtra) || {};
const runtimeEnv =
  typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : {};

const supabaseUrl =
  runtimeEnv.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
const supabaseAnonKey =
  runtimeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

const isPlaceholderValue = (value: string) =>
  !value ||
  value.includes('your-anon-key') ||
  value.includes('YOUR_') ||
  value.includes('placeholder');

export const hasSupabaseConfig = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !isPlaceholderValue(supabaseUrl) &&
    !isPlaceholderValue(supabaseAnonKey)
);

console.info('[mobile:supabase] configuration', {
  hasSupabaseUrl: Boolean(supabaseUrl),
  hasSupabaseAnonKey: Boolean(supabaseAnonKey),
  runtimeUrl: Boolean(runtimeEnv.EXPO_PUBLIC_SUPABASE_URL),
  runtimeAnonKey: Boolean(runtimeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  expoExtraUrl: Boolean(extra.supabaseUrl),
  expoExtraAnonKey: Boolean(extra.supabaseAnonKey),
});

export const SUPABASE_CONFIG_ERROR = hasSupabaseConfig
  ? null
  : 'Missing mobile Supabase config. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to mobile/campus-event-mobile/.env (see .env.example) or provide them through expo.extra.';

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: expoSupabaseStorage,
      },
      global: {
        headers: {
          'X-Client-Info': 'campus-event-mobile',
        },
      },
    })
  : null;
