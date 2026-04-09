import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import {
  MobileSettingsKey,
  ThemeMode,
  useMobileSettings,
} from '@/providers/mobile-settings-provider';

import { AppScreen } from './AppScreen';

type SettingsView = 'main' | 'notifications' | 'messages' | 'privacy' | 'appearance';

type ToggleItem = {
  key: MobileSettingsKey;
  label: string;
};

const NOTIFICATION_ITEMS: ToggleItem[] = [
  { key: 'pushNotifications', label: 'Push notifications' },
  { key: 'eventReminders', label: 'Event reminders' },
  { key: 'followerAlerts', label: 'New follower alerts' },
  { key: 'dmAlerts', label: 'DM alerts' },
];

const MESSAGE_ITEMS: ToggleItem[] = [
  { key: 'messageRequests', label: 'Message requests' },
  { key: 'readReceipts', label: 'Read receipts' },
  { key: 'showOnlineStatus', label: 'Show online status' },
];

const PRIVACY_ITEMS: ToggleItem[] = [
  { key: 'privateProfile', label: 'Private profile' },
  { key: 'showActivityStatus', label: 'Show activity status' },
  { key: 'followersOnlyDms', label: 'Allow DMs from followers only' },
];

const APPEARANCE_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Device', value: 'device' },
];

function SettingsNavRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <Text style={styles.navRowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

function SettingsToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.accent }}
        thumbColor={value ? theme.background : theme.surface}
        ios_backgroundColor={theme.border}
      />
    </View>
  );
}

function SettingsOptionRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={[styles.optionRow, active && styles.optionRowActive]} onPress={onPress}>
      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={active ? theme.text : theme.textMuted}
      />
    </Pressable>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { settings, themeMode, resolvedThemeMode, updateSetting, setThemeMode } = useMobileSettings();
  const [activeView, setActiveView] = useState<SettingsView>('main');

  const detailTitle =
    activeView === 'notifications'
      ? 'Notifications'
      : activeView === 'messages'
        ? 'Messages'
        : activeView === 'privacy'
          ? 'Privacy'
          : activeView === 'appearance'
            ? 'Appearance'
            : 'Settings';

  const handleBack = () => {
    if (activeView === 'main') {
      router.back();
      return;
    }

    setActiveView('main');
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => router.replace('/auth/sign-in'),
      },
    ]);
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerIconButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>{activeView === 'main' ? 'Settings and activity' : detailTitle}</Text>
            <Text style={styles.subtitle}>
              {activeView === 'main'
                ? 'Keep mobile controls aligned with the website settings experience.'
                : 'These settings are ready for later backend sync.'}
            </Text>
          </View>
        </View>

        {activeView === 'main' ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>App</Text>
              <SettingsNavRow label="Notifications" onPress={() => setActiveView('notifications')} />
              <SettingsNavRow label="Messages" onPress={() => setActiveView('messages')} />
              <SettingsNavRow label="Privacy" onPress={() => setActiveView('privacy')} />
              <SettingsNavRow label="Appearance" onPress={() => setActiveView('appearance')} />
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Account</Text>
              <Pressable style={[styles.navRow, styles.dangerRow]} onPress={handleLogout}>
                <Text style={styles.dangerRowLabel}>Log out</Text>
                <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              </Pressable>
            </View>
          </>
        ) : null}

        {activeView === 'notifications' ? (
          <View style={styles.sectionCard}>
            {NOTIFICATION_ITEMS.map((item) => (
              <SettingsToggleRow
                key={item.key}
                label={item.label}
                value={settings[item.key]}
                onValueChange={(value) => updateSetting(item.key, value)}
              />
            ))}
          </View>
        ) : null}

        {activeView === 'messages' ? (
          <View style={styles.sectionCard}>
            {MESSAGE_ITEMS.map((item) => (
              <SettingsToggleRow
                key={item.key}
                label={item.label}
                value={settings[item.key]}
                onValueChange={(value) => updateSetting(item.key, value)}
              />
            ))}
          </View>
        ) : null}

        {activeView === 'privacy' ? (
          <View style={styles.sectionCard}>
            {PRIVACY_ITEMS.map((item) => (
              <SettingsToggleRow
                key={item.key}
                label={item.label}
                value={settings[item.key]}
                onValueChange={(value) => updateSetting(item.key, value)}
              />
            ))}
          </View>
        ) : null}

        {activeView === 'appearance' ? (
          <>
            <View style={styles.sectionCard}>
              {APPEARANCE_OPTIONS.map((option) => (
                <SettingsOptionRow
                  key={option.value}
                  label={option.label}
                  active={themeMode === option.value}
                  onPress={() => setThemeMode(option.value)}
                />
              ))}
            </View>

            <View style={styles.helperCard}>
              <Text style={styles.helperText}>
                Device follows your system appearance automatically. Current:{' '}
                {resolvedThemeMode === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      padding: 18,
      gap: 18,
      paddingBottom: 120,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    headerIconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerCopy: {
      flex: 1,
      gap: 6,
      paddingTop: 2,
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    sectionCard: {
      padding: 18,
      borderRadius: 26,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    sectionTitle: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    navRow: {
      minHeight: 54,
      borderRadius: 18,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surfaceAlt,
      marginTop: 6,
    },
    navRowLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    toggleRow: {
      minHeight: 58,
      borderRadius: 18,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surfaceAlt,
      marginTop: 6,
    },
    toggleLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      flex: 1,
      paddingRight: 16,
    },
    optionRow: {
      minHeight: 56,
      borderRadius: 18,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: 'transparent',
      marginTop: 6,
    },
    optionRowActive: {
      borderColor: theme.border,
      backgroundColor: theme.accentSoft,
    },
    optionLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    optionLabelActive: {
      color: theme.text,
    },
    helperCard: {
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    helperText: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    dangerRow: {
      backgroundColor: theme.dangerSoft,
    },
    dangerRowLabel: {
      color: theme.danger,
      fontSize: 15,
      fontWeight: '700',
    },
  });
