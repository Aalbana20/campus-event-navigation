import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useAppTheme } from '@/lib/app-theme';
import { MobileAppProvider, useMobileApp } from '@/providers/mobile-app-provider';
import { MobileInboxProvider } from '@/providers/mobile-inbox-provider';
import { MobileSettingsProvider, useMobileSettings } from '@/providers/mobile-settings-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

function BootScreen() {
  const theme = useAppTheme();

  return (
    <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
      <Text style={[styles.loadingTitle, { color: theme.text }]}>Loading campus...</Text>
      <Text style={[styles.loadingCopy, { color: theme.textMuted }]}>
        Pulling your profile, events, messages, and follows from the shared backend.
      </Text>
    </View>
  );
}

function AppBootstrap() {
  const { session, isReady } = useMobileApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isReady) return;

    const inAuthFlow = segments[0] === 'auth';

    if (!session && !inAuthFlow) {
      router.replace('/auth/sign-in');
      return;
    }

    if (session && inAuthFlow) {
      router.replace('/(tabs)/Discover');
    }
  }, [isReady, router, segments, session]);

  if (!isReady) {
    return <BootScreen />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="inbox" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="profile/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

function RootNavigator() {
  const { resolvedThemeMode } = useMobileSettings();
  const isDark = resolvedThemeMode === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AppBootstrap />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <MobileSettingsProvider>
      <MobileAppProvider>
        <MobileInboxProvider>
          <RootNavigator />
        </MobileInboxProvider>
      </MobileAppProvider>
    </MobileSettingsProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingCopy: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
