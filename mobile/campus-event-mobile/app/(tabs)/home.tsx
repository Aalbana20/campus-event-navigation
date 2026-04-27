import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedToggle } from '@/components/mobile/SegmentedToggle';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';

import DiscoverScreen from './Discover';
import EventsScreen from './events';

type HomeView = 'events' | 'calendar';

const HOME_VIEWS: { id: HomeView; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'calendar', label: 'Calendar' },
];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { unreadNotificationCount } = useMobileInbox();
  const [activeView, setActiveView] = useState<HomeView>('events');
  const [calendarSearchSignal, setCalendarSearchSignal] = useState(0);
  const [calendarCreateSignal, setCalendarCreateSignal] = useState(0);

  const handleOpenCreate = useCallback(() => {
    if (activeView === 'calendar') {
      setCalendarCreateSignal((signal) => signal + 1);
      return;
    }
    router.push('/story/create');
  }, [activeView, router]);

  const handleOpenNotifications = useCallback(() => {
    router.push('/inbox');
  }, [router]);

  const handleOpenCalendarSearch = useCallback(() => {
    setCalendarSearchSignal((signal) => signal + 1);
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.toggleBar, { paddingTop: insets.top + 4 }]}>
        <View style={styles.topBarRow}>
          <View style={styles.topActionSlot}>
            <Pressable style={styles.topActionButton} onPress={handleOpenCreate}>
              <Ionicons name="add-outline" size={22} color={theme.text} />
            </Pressable>
          </View>

          <SegmentedToggle
            options={HOME_VIEWS}
            value={activeView}
            onChange={setActiveView}
            width={220}
          />

          <View style={[styles.topActionSlot, styles.topActionSlotRight]}>
            {activeView === 'events' ? (
              <Pressable style={styles.topActionButton} onPress={handleOpenNotifications}>
                <Ionicons name="notifications-outline" size={20} color={theme.text} />
                {unreadNotificationCount > 0 ? <View style={styles.topActionBadge} /> : null}
              </Pressable>
            ) : (
              <Pressable style={styles.topActionButton} onPress={handleOpenCalendarSearch}>
                <Ionicons name="search-outline" size={20} color={theme.text} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View style={styles.content} pointerEvents="box-none">
        {activeView === 'events' ? (
          <DiscoverScreen hideModeSwitch initialMode="events" embedded />
        ) : (
          <EventsScreen
            searchSignal={calendarSearchSignal}
            createSignal={calendarCreateSignal}
          />
        )}
      </View>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    toggleBar: {
      paddingBottom: 4,
      paddingHorizontal: 14,
      backgroundColor: theme.background,
    },
    topBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    topActionSlot: {
      width: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    topActionSlotRight: {
      alignItems: 'flex-end',
    },
    topActionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    topActionBadge: {
      position: 'absolute',
      top: 12,
      right: 11,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.success,
    },
    content: {
      flex: 1,
    },
  });
