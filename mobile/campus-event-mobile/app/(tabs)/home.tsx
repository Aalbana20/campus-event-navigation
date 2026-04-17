import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
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
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [activeView, setActiveView] = useState<HomeView>('events');

  return (
    <View style={styles.root}>
      <AppScreen style={styles.toggleBar}>
        <SegmentedToggle
          options={HOME_VIEWS}
          value={activeView}
          onChange={setActiveView}
          width={220}
        />
      </AppScreen>

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
      paddingTop: 8,
      paddingBottom: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
      backgroundColor: theme.background,
      flexGrow: 0,
    },
    content: {
      flex: 1,
    },
  });
