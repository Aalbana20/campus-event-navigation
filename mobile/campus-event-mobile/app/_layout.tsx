import 'react-native-url-polyfill/auto';
import { DarkTheme, DefaultTheme, ThemeProvider, useTheme } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { MobileAppProvider, useMobileApp } from '@/providers/mobile-app-provider';
import { MobileInboxProvider } from '@/providers/mobile-inbox-provider';
import { MobileSettingsProvider, useMobileSettings } from '@/providers/mobile-settings-provider';
import { MobileShareSheetProvider } from '@/providers/mobile-share-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

function BootScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
      <Text style={[styles.loadingTitle, { color: colors.text }]}>Loading campus...</Text>
      <Text style={[styles.loadingCopy, { color: colors.border }]}>
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
      // Route to the base tabs layout instead of a hardcoded specific file casing
      // to avoid unmatched route crashes.
      router.replace('/(tabs)');
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
      <Stack.Screen
        name="story/create"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="story/share"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="create-event"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="map"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="recaps/index" options={{ headerShown: false }} />
      <Stack.Screen name="recaps/[eventId]" options={{ headerShown: false }} />
      <Stack.Screen name="profile/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="event/manage/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="auth/sign-up" options={{ headerShown: false }} />
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
          <MobileShareSheetProvider>
            <RootNavigator />
          </MobileShareSheetProvider>
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
