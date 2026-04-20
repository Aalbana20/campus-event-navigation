import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedToggle } from '@/components/mobile/SegmentedToggle';
import { useAppTheme } from '@/lib/app-theme';

import DiscoverScreen from './Discover';
import EventsScreen from './events';

type HomeView = 'events' | 'calendar';

const HOME_VIEWS: { id: HomeView; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'calendar', label: 'Calendar' },
];

export default function HomeScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [activeView, setActiveView] = useState<HomeView>('events');

  return (
    <View style={styles.root}>
      <View style={[styles.toggleBar, { paddingTop: insets.top + 8 }]}>
        <SegmentedToggle
          options={HOME_VIEWS}
          value={activeView}
          onChange={setActiveView}
          width={220}
        />
      </View>

      <View style={styles.content} pointerEvents="box-none">
        {activeView === 'events' ? (
          <DiscoverScreen hideModeSwitch initialMode="events" embedded />
        ) : (
          <EventsScreen />
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
      paddingBottom: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
  });
