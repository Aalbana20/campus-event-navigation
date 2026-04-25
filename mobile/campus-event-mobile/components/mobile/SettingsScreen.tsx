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
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';
import {
  type MobileSettingsKey,
  type ThemeMode,
  useMobileSettings,
} from '@/providers/mobile-settings-provider';

import { AppScreen } from './AppScreen';

type SettingsView = 'main' | 'notifications' | 'messages' | 'privacy' | 'appearance';
type SettingsRowAction =
  | { type: 'detail'; view: SettingsView }
  | { type: 'route'; route: string }
  | { type: 'placeholder'; message?: string }
  | { type: 'logout' };
type SettingsRow = {
  id: string;
  label: string;
  subtitle?: string;
  value?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'blue' | 'danger';
  action: SettingsRowAction;
};
type SettingsSection = {
  title: string;
  rows: SettingsRow[];
};
type ToggleItem = {
  key: MobileSettingsKey;
  label: string;
  subtitle?: string;
};

const NOTIFICATION_ITEMS: ToggleItem[] = [
  { key: 'pushNotifications', label: 'Push notifications', subtitle: 'Event, message, and profile alerts.' },
  { key: 'eventReminders', label: 'Event reminders', subtitle: 'Remind me before saved events.' },
  { key: 'followerAlerts', label: 'Follower alerts', subtitle: 'New follower and close-circle updates.' },
  { key: 'dmAlerts', label: 'Message alerts', subtitle: 'Messages and story replies.' },
];

const MESSAGE_ITEMS: ToggleItem[] = [
  { key: 'messageRequests', label: 'Message requests' },
  { key: 'readReceipts', label: 'Read receipts' },
  { key: 'showOnlineStatus', label: 'Show online status' },
];

const PRIVACY_ITEMS: ToggleItem[] = [
  { key: 'privateProfile', label: 'Private profile' },
  { key: 'showActivityStatus', label: 'Show activity status' },
  { key: 'followersOnlyDms', label: 'Allow messages from followers only' },
];

const APPEARANCE_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'Device', value: 'device' },
];

function buildSettingsSections(): SettingsSection[] {
  return [
    {
      title: 'Your account',
      rows: [
        { id: 'account-center', label: 'Account Center', subtitle: 'Profile, username, and account tools', icon: 'person-circle-outline', action: { type: 'placeholder' } },
        { id: 'password', label: 'Password and security', icon: 'shield-checkmark-outline', action: { type: 'placeholder' } },
        { id: 'personal-details', label: 'Personal details', icon: 'id-card-outline', action: { type: 'placeholder' } },
      ],
    },
    {
      title: 'How you use the app',
      rows: [
        { id: 'saved', label: 'Saved', subtitle: 'Saved events and posts', icon: 'bookmark-outline', action: { type: 'route', route: '/(tabs)/profile' } },
        { id: 'archive', label: 'Archive', icon: 'archive-outline', action: { type: 'placeholder' } },
        { id: 'activity', label: 'Your activity', icon: 'pulse-outline', action: { type: 'placeholder' } },
        { id: 'notifications', label: 'Notifications', icon: 'notifications-outline', action: { type: 'detail', view: 'notifications' } },
        { id: 'time', label: 'Time management', icon: 'timer-outline', action: { type: 'placeholder' } },
      ],
    },
    {
      title: 'Who can see your content',
      rows: [
        { id: 'privacy', label: 'Account privacy', icon: 'lock-closed-outline', action: { type: 'detail', view: 'privacy' } },
        { id: 'close-circle', label: 'Close Circle', icon: 'star-outline', action: { type: 'placeholder' } },
        { id: 'blocked', label: 'Blocked', icon: 'ban-outline', action: { type: 'placeholder' } },
        { id: 'visibility', label: 'Story and event visibility', icon: 'eye-outline', action: { type: 'placeholder' } },
        { id: 'friends-activity', label: 'Activity in Friends tab', icon: 'people-outline', action: { type: 'placeholder' } },
      ],
    },
    {
      title: 'How others can interact with you',
      rows: [
        { id: 'messages', label: 'Messages and story replies', icon: 'chatbubble-ellipses-outline', action: { type: 'detail', view: 'messages' } },
        { id: 'tags', label: 'Tags and mentions', icon: 'at-outline', action: { type: 'placeholder' } },
        { id: 'comments', label: 'Comments', icon: 'chatbox-outline', action: { type: 'placeholder' } },
        { id: 'sharing', label: 'Sharing and reuse', icon: 'repeat-outline', action: { type: 'placeholder' } },
        { id: 'restricted', label: 'Restricted', icon: 'remove-circle-outline', action: { type: 'placeholder' } },
        { id: 'limit', label: 'Limit interactions', icon: 'hand-left-outline', action: { type: 'placeholder' } },
        { id: 'hidden-words', label: 'Hidden Words', icon: 'text-outline', action: { type: 'placeholder' } },
        { id: 'invite', label: 'Follow and invite friends', icon: 'person-add-outline', action: { type: 'placeholder' } },
      ],
    },
    {
      title: 'What you see',
      rows: [
        { id: 'favorites', label: 'Favorites', icon: 'heart-outline', action: { type: 'placeholder' } },
        { id: 'muted', label: 'Muted accounts', icon: 'volume-mute-outline', action: { type: 'placeholder' } },
        { id: 'content-preferences', label: 'Content preferences', icon: 'options-outline', action: { type: 'placeholder' } },
        { id: 'counts', label: 'Like and share counts', icon: 'stats-chart-outline', action: { type: 'placeholder' } },
      ],
    },
    {
      title: 'Your app and media',
      rows: [
        { id: 'download', label: 'Archiving and downloading', icon: 'download-outline', action: { type: 'placeholder' } },
        { id: 'accessibility', label: 'Accessibility', icon: 'accessibility-outline', action: { type: 'placeholder' } },
        { id: 'language', label: 'Language and translations', icon: 'language-outline', action: { type: 'placeholder' } },
        { id: 'quality', label: 'Media quality', icon: 'image-outline', action: { type: 'placeholder' } },
        { id: 'permissions', label: 'App permissions', icon: 'phone-portrait-outline', action: { type: 'placeholder' } },
        { id: 'appearance', label: 'Appearance', icon: 'contrast-outline', action: { type: 'detail', view: 'appearance' } },
      ],
    },
    {
      title: 'More info and support',
      rows: [
        { id: 'help', label: 'Help', icon: 'help-circle-outline', action: { type: 'placeholder' } },
        { id: 'privacy-center', label: 'Privacy Center', icon: 'finger-print-outline', action: { type: 'placeholder' } },
        { id: 'account-status', label: 'Account Status', icon: 'checkmark-circle-outline', action: { type: 'placeholder' } },
        { id: 'community-notes', label: 'Community Notes', subtitle: 'Coming later', icon: 'document-text-outline', action: { type: 'placeholder' } },
        { id: 'about', label: 'About', icon: 'information-circle-outline', action: { type: 'placeholder' } },
      ],
    },
    {
      title: 'Login',
      rows: [
        { id: 'add-account', label: 'Add account', icon: 'add-circle-outline', tone: 'blue', action: { type: 'placeholder', message: 'Add account support is coming soon.' } },
        { id: 'logout', label: 'Log out', icon: 'log-out-outline', tone: 'danger', action: { type: 'logout' } },
      ],
    },
  ];
}

export function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const sections = useMemo(() => buildSettingsSections(), []);
  const { signOut } = useMobileApp();
  const { settings, themeMode, resolvedThemeMode, updateSetting, setThemeMode } =
    useMobileSettings();
  const [activeView, setActiveView] = useState<SettingsView>('main');
  const [searchText, setSearchText] = useState('');

  const detailTitle =
    activeView === 'notifications'
      ? 'Notifications'
      : activeView === 'messages'
        ? 'Messages and story replies'
        : activeView === 'privacy'
          ? 'Account privacy'
          : activeView === 'appearance'
            ? 'Appearance'
            : 'Settings and activity';

  const filteredSections = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return sections;

    return sections
      .map((section) => ({
        ...section,
        rows: section.rows.filter((row) =>
          [row.label, row.subtitle, row.value, section.title]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        ),
      }))
      .filter((section) => section.rows.length > 0);
  }, [searchText, sections]);

  const handleBack = () => {
    if (activeView !== 'main') {
      setActiveView('main');
      return;
    }

    router.back();
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void signOut().then(() => router.replace('/auth/sign-in'));
        },
      },
    ]);
  };

  const handleRowPress = (row: SettingsRow) => {
    if (row.action.type === 'detail') {
      setActiveView(row.action.view);
      return;
    }

    if (row.action.type === 'route') {
      router.push(row.action.route as never);
      return;
    }

    if (row.action.type === 'logout') {
      handleLogout();
      return;
    }

    Alert.alert(row.label, row.action.message || 'This setting is ready for a future update.');
  };

  const renderRow = (row: SettingsRow) => {
    const iconColor =
      row.tone === 'danger' ? theme.danger : row.tone === 'blue' ? '#0a84ff' : theme.text;
    const labelColor =
      row.tone === 'danger' ? theme.danger : row.tone === 'blue' ? '#0a84ff' : theme.text;

    return (
      <Pressable key={row.id} style={styles.row} onPress={() => handleRowPress(row)}>
        <View style={styles.rowIcon}>
          <Ionicons name={row.icon} size={20} color={iconColor} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowLabel, { color: labelColor }]}>{row.label}</Text>
          {row.subtitle ? <Text style={styles.rowSubtitle}>{row.subtitle}</Text> : null}
        </View>
        {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
        {row.action.type !== 'logout' ? (
          <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
        ) : null}
      </Pressable>
    );
  };

  const renderToggleRow = (item: ToggleItem) => (
    <View key={item.key} style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name="toggle-outline" size={20} color={theme.text} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{item.label}</Text>
        {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
      </View>
      <Switch
        value={settings[item.key]}
        onValueChange={(value) => updateSetting(item.key, value)}
        trackColor={{ false: 'rgba(255,255,255,0.16)', true: '#30d158' }}
        thumbColor="#ffffff"
        ios_backgroundColor="rgba(255,255,255,0.16)"
      />
    </View>
  );

  return (
    <AppScreen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.title}>{detailTitle}</Text>
          <View style={styles.headerIconPlaceholder} />
        </View>

        {activeView === 'main' ? (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={theme.textMuted} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search"
                placeholderTextColor={theme.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>

            {filteredSections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionRows}>{section.rows.map(renderRow)}</View>
              </View>
            ))}
          </>
        ) : null}

        {activeView === 'notifications' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification settings</Text>
            <View style={styles.sectionRows}>{NOTIFICATION_ITEMS.map(renderToggleRow)}</View>
          </View>
        ) : null}

        {activeView === 'messages' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Messages and replies</Text>
            <View style={styles.sectionRows}>{MESSAGE_ITEMS.map(renderToggleRow)}</View>
          </View>
        ) : null}

        {activeView === 'privacy' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <View style={styles.sectionRows}>{PRIVACY_ITEMS.map(renderToggleRow)}</View>
          </View>
        ) : null}

        {activeView === 'appearance' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Theme</Text>
              <View style={styles.sectionRows}>
                {APPEARANCE_OPTIONS.map((option) => {
                  const isActive = themeMode === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      style={styles.row}
                      onPress={() => setThemeMode(option.value)}>
                      <View style={styles.rowIcon}>
                        <Ionicons
                          name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                          size={21}
                          color={isActive ? '#30d158' : theme.textMuted}
                        />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowLabel}>{option.label}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Device follows your system appearance automatically. Current:{' '}
                {resolvedThemeMode === 'dark' ? 'Dark' : 'Light'}.
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
    screen: {
      backgroundColor: '#000000',
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 120,
      gap: 18,
    },
    header: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    headerIconPlaceholder: {
      width: 42,
      height: 42,
    },
    title: {
      flex: 1,
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
    },
    searchBox: {
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 13,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
      paddingVertical: 0,
    },
    section: {
      gap: 9,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
      paddingHorizontal: 2,
    },
    sectionRows: {
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    row: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    rowSubtitle: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    rowValue: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    infoCard: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    infoText: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
  });
