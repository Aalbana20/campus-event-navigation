import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { EventRecord } from '@/types/models';

import { EventActionTrigger } from './EventActionTrigger';

type EventStackCardProps = {
  event: EventRecord;
  height: number;
  onPress?: () => void;
};

export function EventStackCard({ event, height, onPress }: EventStackCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={[styles.card, { height }]} onPress={onPress}>
      <ImageBackground source={getEventImageSource(event.image)} style={styles.image} imageStyle={styles.imageStyle}>
        <View style={styles.overlay} />
        <EventActionTrigger event={event} style={styles.actions} />

        <View style={styles.topRow}>
          {event.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bottomContent}>
          <View style={styles.contentShell}>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.meta}>
              {[event.date, event.time, event.locationName].filter(Boolean).join(' • ')}
            </Text>
            <Text style={styles.description} numberOfLines={4}>
              {event.description}
            </Text>

            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Ionicons name="people-outline" size={14} color="#ffffff" />
                <Text style={styles.badgeText}>{event.goingCount} going</Text>
              </View>

              <View style={styles.badge}>
                <Ionicons name="repeat-outline" size={14} color="#ffffff" />
                <Text style={styles.badgeText}>{event.repostedByIds.length} reposts</Text>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: 32,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 0.22,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 8,
    },
    image: {
      flex: 1,
      justifyContent: 'space-between',
      padding: 18,
    },
    imageStyle: {
      borderRadius: 32,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.cardImageOverlay,
    },
    actions: {
      position: 'absolute',
      right: 18,
      top: 18,
      zIndex: 2,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    topRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 48,
      paddingRight: 56,
    },
    tagChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: 'rgba(8, 11, 16, 0.7)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    tagText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },
    bottomContent: {
      gap: 10,
    },
    contentShell: {
      borderRadius: 26,
      padding: 18,
      backgroundColor: 'rgba(8, 11, 16, 0.54)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      gap: 10,
    },
    title: {
      color: '#ffffff',
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 36,
    },
    meta: {
      color: 'rgba(255, 255, 255, 0.88)',
      fontSize: 14,
      fontWeight: '600',
    },
    description: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 14,
      lineHeight: 20,
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 2,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: 'rgba(8, 11, 16, 0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
  });
