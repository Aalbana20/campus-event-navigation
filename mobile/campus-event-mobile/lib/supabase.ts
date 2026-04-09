import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

import { expoSupabaseStorage } from './supabase-storage';

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = ((Constants.expoConfig?.extra ?? {}) as ExpoExtra) || {};
const runtimeEnv =
  typeof process !== 'undefined'
    ? (process.env as Record<string, string | undefined>)
    : {};

const supabaseUrl =
  runtimeEnv.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
const supabaseAnonKey =
  runtimeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

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
  : 'Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the repo root .env or EXPO_PUBLIC_SUPABASE_* vars for Expo.';

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
