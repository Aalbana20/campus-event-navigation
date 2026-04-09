import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { MobileAppProvider } from '@/providers/mobile-app-provider';
import { MobileInboxProvider } from '@/providers/mobile-inbox-provider';
import { MobileSettingsProvider, useMobileSettings } from '@/providers/mobile-settings-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { resolvedThemeMode } = useMobileSettings();
  const isDark = resolvedThemeMode === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
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
