import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventStackCard } from '@/components/mobile/EventStackCard';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';

export default function DiscoverScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { width, height } = useWindowDimensions();
  const {
    currentUser,
    events,
    savedEventIds,
    discoverDismissedIds,
    acceptDiscoverEvent,
    rejectDiscoverEvent,
    resetDiscoverDeck,
  } = useMobileApp();

  const translate = useRef(new Animated.ValueXY()).current;

  const discoverEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.createdBy !== currentUser.id &&
          !savedEventIds.includes(event.id) &&
          !discoverDismissedIds.includes(event.id)
      ),
    [currentUser.id, discoverDismissedIds, events, savedEventIds]
  );

  const currentEvent = discoverEvents[0];
  const cardHeight = Math.max(380, Math.min(height * 0.72, 720));

  useEffect(() => {
    translate.setValue({ x: 0, y: 0 });
  }, [currentEvent?.id, translate]);

  const animateDismiss = (direction: 'left' | 'right') => {
    if (!currentEvent) return;

    Animated.timing(translate, {
      toValue: { x: direction === 'right' ? width * 1.2 : -width * 1.2, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (direction === 'right') {
        acceptDiscoverEvent(currentEvent.id);
      } else {
        rejectDiscoverEvent(currentEvent.id);
      }

      translate.setValue({ x: 0, y: 0 });
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10,
        onPanResponderMove: (_, gestureState) => {
          translate.setValue({ x: gestureState.dx, y: gestureState.dy * 0.12 });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 110) {
            animateDismiss('right');
            return;
          }

          if (gestureState.dx < -110) {
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
    [currentEvent?.id, width]
  );

  const rotation = translate.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  return (
    <AppScreen style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Campus Event Navigation</Text>
            <Text style={styles.title}>Discover</Text>
          </View>
          <Text style={styles.stackCount}>{discoverEvents.length} left</Text>
        </View>

        <View style={styles.cardStage}>
          {currentEvent ? (
            <Animated.View
              style={[
                styles.animatedCard,
                {
                  transform: [{ translateX: translate.x }, { translateY: translate.y }, { rotate: rotation }],
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
          ) : (
            <View style={styles.endState}>
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

        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={() => animateDismiss('left')}>
            <Ionicons name="close" size={32} color={theme.danger} />
          </Pressable>

          <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={() => animateDismiss('right')}>
            <Ionicons name="heart" size={28} color={theme.success} />
          </Pressable>
        </View>
      </View>
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
      paddingHorizontal: 18,
      paddingBottom: 24,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingTop: 8,
      paddingBottom: 14,
    },
    eyebrow: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '800',
    },
    stackCount: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    cardStage: {
      flex: 1,
      justifyContent: 'center',
    },
    animatedCard: {
      width: '100%',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 28,
      paddingTop: 18,
    },
    actionButton: {
      width: 78,
      height: 78,
      borderRadius: 39,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rejectButton: {
      borderColor: theme.dangerSoft,
    },
    acceptButton: {
      borderColor: theme.successSoft,
    },
    endState: {
      padding: 24,
      borderRadius: 30,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
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
