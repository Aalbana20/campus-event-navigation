import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverStoriesRow } from '@/components/mobile/DiscoverStoriesRow';
import { DiscoverModeSwitch } from '@/components/mobile/DiscoverModeSwitch';
import { EventStackCard } from '@/components/mobile/EventStackCard';
import { useAppTheme } from '@/lib/app-theme';
import { buildMobileDiscoverStoryItems } from '@/lib/mobile-discover-social';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';

export default function DiscoverScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { width, height } = useWindowDimensions();
  const {
    currentUser,
    followingProfiles,
    profiles,
    events,
    savedEventIds,
    discoverDismissedIds,
    acceptDiscoverEvent,
    rejectDiscoverEvent,
    resetDiscoverDeck,
    refreshData,
  } = useMobileApp();
  const { unreadNotificationCount } = useMobileInbox();

  const translate = useRef(new Animated.ValueXY()).current;
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'friends'>('events');

  const storyItems = useMemo(() => {
    if (!currentUser) return [];
    return buildMobileDiscoverStoryItems({
      currentUser,
      followingProfiles,
      profiles,
      events,
    });
  }, [currentUser, followingProfiles, profiles, events]);

  const discoverEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          !savedEventIds.includes(event.id) &&
          !discoverDismissedIds.includes(event.id)
      ),
    [discoverDismissedIds, events, savedEventIds]
  );

  const currentEvent = discoverEvents[0];
  const cardHeight = Math.max(540, Math.min(height * 0.76, 760));

  useEffect(() => {
    translate.setValue({ x: 0, y: 0 });
  }, [currentEvent?.id, translate]);

  const animateDismiss = useCallback((direction: 'left' | 'right') => {
    if (!currentEvent) return;

    Animated.timing(translate, {
      toValue: { x: direction === 'right' ? width * 1.18 : -width * 1.18, y: 0 },
      duration: 210,
      useNativeDriver: false,
    }).start(() => {
      if (direction === 'right') {
        acceptDiscoverEvent(currentEvent.id);
      } else {
        rejectDiscoverEvent(currentEvent.id);
      }

      translate.setValue({ x: 0, y: 0 });
    });
  }, [acceptDiscoverEvent, currentEvent, rejectDiscoverEvent, translate, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          translate.setValue({ x: gestureState.dx, y: gestureState.dy * 0.08 });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 92) {
            animateDismiss('right');
            return;
          }

          if (gestureState.dx < -92) {
            animateDismiss('left');
            return;
          }

          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 7,
          }).start();
        },
      }),
    [animateDismiss, translate]
  );

  const rotation = translate.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  const openNotifications = () => {
    router.push('/inbox');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  return (
    <AppScreen style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <View style={styles.headerActionsLeft}>
            <Pressable style={styles.headerIconButton} onPress={() => router.push('/(tabs)/events?tab=create')}>
              <Ionicons name="add-outline" size={20} color={theme.text} />
            </Pressable>
          </View>

          <DiscoverModeSwitch activeMode={activeTab} onChange={setActiveTab} />

          <View style={styles.headerActions}>
            <Pressable style={styles.headerIconButton} onPress={openNotifications}>
              <Ionicons name="notifications-outline" size={18} color={theme.text} />
              {unreadNotificationCount > 0 ? <View style={styles.headerBadge} /> : null}
            </Pressable>
          </View>
        </View>

        <DiscoverStoriesRow
          items={storyItems}
          onOpenSuggestion={() => setActiveTab('friends')}
        />

        <View style={styles.cardStage}>
          {currentEvent ? (
            <View style={[styles.cardDeck, { minHeight: cardHeight + 22 }]}>
              <View style={[styles.cardBackdrop, { height: cardHeight - 18 }]} />

              <Animated.View
                style={[
                  styles.animatedCard,
                  {
                    transform: [
                      { translateX: translate.x },
                      { translateY: translate.y },
                      { rotate: rotation },
                    ],
                  },
                ]}
                {...panResponder.panHandlers}>
                <EventStackCard
                  event={currentEvent}
                  height={cardHeight}
                  onPress={() =>
                    router.push({
                      pathname: '/event/[id]',
                      params: { id: currentEvent.id },
                    })
                  }
                />
              </Animated.View>
            </View>
          ) : (
            <View style={[styles.endState, { minHeight: cardHeight - 12 }]}>
              <Text style={styles.endTitle}>You made it to the end.</Text>
              <Text style={styles.endCopy}>
                Accepted and rejected events have moved out of your stack for now.
              </Text>
              <Pressable style={styles.resetButton} onPress={resetDiscoverDeck}>
                <Text style={styles.resetButtonText}>Reload Discover</Text>
              </Pressable>
            </View>
          )}
        </View>

        {currentEvent ? (
          <View style={styles.swipeHint}>
            <Ionicons name="swap-horizontal-outline" size={16} color={theme.textMuted} />
            <Text style={styles.swipeHintText}>Swipe left to pass or right to save</Text>
          </View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 12,
      backgroundColor: theme.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
    },
  headerActionsLeft: {
      width: 40,
    alignItems: 'flex-start',
    },
    headerActions: {
      width: 40,
      alignItems: 'flex-end',
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerBadge: {
      position: 'absolute',
      top: 11,
      right: 11,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.success,
    },
    cardStage: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    cardDeck: {
      justifyContent: 'flex-start',
    },
    cardBackdrop: {
      position: 'absolute',
      left: 10,
      right: 10,
      top: 16,
      borderRadius: 30,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    animatedCard: {
      width: '100%',
    },
    swipeHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 12,
      paddingBottom: 4,
    },
    swipeHintText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    endState: {
      padding: 24,
      borderRadius: 30,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    endTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    endCopy: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    resetButton: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    resetButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
  });
