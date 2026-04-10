import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { EventRecord } from '@/types/models';

import { EventActionTrigger } from './EventActionTrigger';

type EventStackCardProps = {
  event: EventRecord;
  height: number;
  onPress?: () => void;
  swipeDirection?: 'left' | 'right' | null;
  swipeIntensity?: number;
};

export function EventStackCard({
  event,
  height,
  onPress,
  swipeDirection = null,
  swipeIntensity = 0,
}: EventStackCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { followingProfiles } = useMobileApp();

  const mutualsGoing = useMemo(() => {
    return followingProfiles.filter((profile) => event.attendees.includes(profile.id));
  }, [event.attendees, followingProfiles]);

  const swipeFeedbackColor =
    swipeDirection === 'right'
      ? `rgba(74, 222, 128, ${Math.min(swipeIntensity * 0.5, 0.4)})`
      : swipeDirection === 'left'
        ? `rgba(248, 113, 113, ${Math.min(swipeIntensity * 0.5, 0.4)})`
        : 'transparent';

  return (
    <Pressable style={[styles.card, { height }]} onPress={onPress}>
      <ImageBackground
        source={getEventImageSource(event.image)}
        style={styles.image}
        imageStyle={styles.imageStyle}>
        <View style={styles.overlay} />
        <View style={[styles.swipeFeedback, { backgroundColor: swipeFeedbackColor }]} pointerEvents="none" />

        <View style={styles.topContent}>
          <View style={styles.topRow}>
            <View style={styles.creatorIdentity}>
              <Image source={getAvatarImageSource(event.creatorAvatar)} style={styles.creatorAvatar} />
              <Text style={styles.creatorName} numberOfLines={1}>
                {event.creatorName || event.organizer || `@${event.creatorUsername || 'host'}`}
              </Text>
            </View>
            <EventActionTrigger event={event} style={styles.actions} />
          </View>

          <View style={styles.tagsRow}>
            {event.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bottomContent}>
          <View style={styles.contentShell}>
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {[event.date, event.time, event.locationName].filter(Boolean).join(' • ')}
            </Text>
            <Text style={styles.description} numberOfLines={3}>
              {event.description}
            </Text>

            <View style={styles.badgesRow}>
              <Pressable style={styles.badge} onPress={() => { /* Expand Attendees Modal */ }}>
                <Ionicons name="people-outline" size={16} color="#ffffff" />
                <Text style={styles.badgeText}>{event.goingCount} going</Text>
              </Pressable>

              <Pressable style={styles.badge} onPress={() => { /* Expand Mutuals Modal */ }}>
                {mutualsGoing.length > 0 ? (
                  <View style={styles.mutualsStack}>
                    {mutualsGoing.slice(0, 3).map((mutual, i) => (
                      <Image
                        key={mutual.id}
                        source={getAvatarImageSource(mutual.avatar)}
                        style={[styles.mutualAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }]}
                      />
                    ))}
                  </View>
                ) : (
                  <Ionicons name="person-add-outline" size={14} color="#ffffff" />
                )}
                <Text style={styles.badgeText}>{mutualsGoing.length} mutuals</Text>
              </Pressable>
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
    swipeFeedback: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
    },
    topContent: {
      gap: 12,
      zIndex: 3,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
    },
    creatorIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(8, 11, 16, 0.7)',
      borderRadius: 999,
      padding: 6,
      paddingRight: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      flexShrink: 1,
      marginRight: 10,
    },
    creatorAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
    },
    creatorName: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
      flexShrink: 1,
    },
    actions: {
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
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
    mutualsStack: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 4,
    },
    mutualAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: '#111',
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
  });
