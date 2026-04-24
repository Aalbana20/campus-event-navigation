import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { EventRecord, ProfileRecord } from '@/types/models';

type EventStackCardProps = {
  event: EventRecord;
  height: number;
  onPress?: () => void;
  isRsvped?: boolean;
  isSavedForLater?: boolean;
  onPressRsvp?: (event: EventRecord) => void;
  onPressComment?: (event: EventRecord) => void;
  onPressSave?: (event: EventRecord) => void;
  onPressShare?: (event: EventRecord) => void;
  onPressMutuals?: (event: EventRecord, mutuals: ProfileRecord[]) => void;
  swipeDirection?: 'left' | 'right' | null;
  swipeIntensity?: number;
};

export function EventStackCard({
  event,
  height,
  onPress,
  isRsvped = false,
  isSavedForLater = false,
  onPressRsvp,
  onPressComment,
  onPressSave,
  onPressShare,
  onPressMutuals,
  swipeDirection = null,
  swipeIntensity = 0,
}: EventStackCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { followingProfiles, profiles } = useMobileApp();

  const attendeeIds = event.attendees ?? [];

  const mutualsGoing = useMemo(
    () => followingProfiles.filter((profile) => attendeeIds.includes(profile.id)),
    [attendeeIds, followingProfiles]
  );

  const orderedAttendees = useMemo(() => {
    const seen = new Set<string>();
    const ordered: ProfileRecord[] = [];

    mutualsGoing.forEach((profile) => {
      if (seen.has(profile.id)) return;
      seen.add(profile.id);
      ordered.push(profile);
    });

    attendeeIds.forEach((id) => {
      if (seen.has(id)) return;
      const profile = profiles.find((candidate) => candidate.id === id);
      if (!profile) return;
      seen.add(profile.id);
      ordered.push(profile);
    });

    return ordered;
  }, [attendeeIds, mutualsGoing, profiles]);

  const goingCount = event.goingCount ?? attendeeIds.length ?? 0;

  const swipeFeedbackColor =
    swipeDirection === 'right'
      ? `rgba(74, 222, 128, ${Math.min(swipeIntensity * 0.5, 0.4)})`
      : swipeDirection === 'left'
        ? `rgba(248, 113, 113, ${Math.min(swipeIntensity * 0.5, 0.4)})`
        : 'transparent';

  const eventTitle = event.title || 'Campus Event';
  const eventDate = event.date || 'Date TBA';
  const eventTime = event.time || 'Time TBA';
  const visibleAttendees = orderedAttendees.slice(0, 2);

  const creatorLabel = getEventCreatorLabel(event);
  const creatorFirstName = creatorLabel.split(' ')[0] || creatorLabel;

  const stopEventPress = (eventPress: GestureResponderEvent) => {
    eventPress.stopPropagation();
  };

  const handleMutualsPress = (eventPress: GestureResponderEvent) => {
    stopEventPress(eventPress);
    onPressMutuals?.(event, orderedAttendees);
  };

  const handleRsvpPress = (eventPress: GestureResponderEvent) => {
    stopEventPress(eventPress);
    onPressRsvp?.(event);
  };

  const handleCommentPress = (eventPress: GestureResponderEvent) => {
    stopEventPress(eventPress);
    onPressComment?.(event);
  };

  const handleSavePress = (eventPress: GestureResponderEvent) => {
    stopEventPress(eventPress);
    onPressSave?.(event);
  };

  const handleSharePress = (eventPress: GestureResponderEvent) => {
    stopEventPress(eventPress);
    onPressShare?.(event);
  };

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
            <View style={styles.creatorCluster}>
              <View style={styles.creatorIdentity}>
                <Image source={getAvatarImageSource(event.creatorAvatar)} style={styles.creatorAvatar} />
                <Text style={styles.creatorName} numberOfLines={1}>
                  {creatorFirstName}
                </Text>
              </View>
            </View>

            <Pressable style={styles.mutualInlineButton} onPress={handleMutualsPress}>
              {visibleAttendees.length > 0 ? (
                <View style={styles.mutualsInlineStack}>
                  {visibleAttendees.map((attendee, index) => (
                    <Image
                      key={attendee.id}
                      source={getAvatarImageSource(attendee.avatar)}
                      style={[
                        styles.mutualInlineAvatar,
                        { marginLeft: index > 0 ? -8 : 0, zIndex: 2 - index },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.mutualInlineEmpty}>
                  <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.76)" />
                </View>
              )}
              <Text style={styles.mutualInlineCount}>{goingCount}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomContent}>
          <View style={styles.infoPills}>
            <View style={[styles.infoPill, styles.titlePill]}>
              <Text style={styles.title} numberOfLines={2}>
                {eventTitle}
              </Text>
            </View>

            <View style={styles.infoPill}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.92)" />
              <Text style={styles.infoPillText} numberOfLines={1}>
                {eventDate}
              </Text>
            </View>

            <View style={styles.infoPill}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.92)" />
              <Text style={styles.infoPillText} numberOfLines={1}>
                {eventTime}
              </Text>
            </View>
          </View>

          <View style={styles.actionRail}>
            <Pressable style={styles.actionButton} onPress={handleRsvpPress}>
              <View style={styles.rsvpIconWrap}>
                <Ionicons
                  name="person-outline"
                  size={32}
                  color={isRsvped ? '#4ade80' : '#ffffff'}
                />
                <View style={[styles.rsvpCheckBadge, isRsvped ? styles.rsvpCheckBadgeActive : undefined]}>
                  <Ionicons
                    name="checkmark"
                    size={11}
                    color={isRsvped ? '#ffffff' : 'rgba(255,255,255,0.9)'}
                  />
                </View>
              </View>
              <Text style={styles.actionCount}>{event.attendees?.length ?? 0}</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={handleCommentPress}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color="#ffffff" />
              <Text style={styles.actionCount}>{event.commentCount ?? 0}</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={handleSavePress}>
              <Ionicons
                name={isSavedForLater ? 'bookmark' : 'bookmark-outline'}
                size={30}
                color="#ffffff"
              />
              <Text style={styles.actionCount}>0</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={handleSharePress}>
              <Ionicons name="paper-plane-outline" size={30} color="#ffffff" />
              <Text style={styles.actionCount}>Share</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomHintWrap}>
          <Text style={styles.bottomHintText} numberOfLines={1}>
            Tap for details
          </Text>
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
      paddingTop: 18,
      paddingHorizontal: 16,
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
      zIndex: 3,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      gap: 10,
    },
    creatorCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    creatorIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(8, 11, 16, 0.48)',
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: 6,
      paddingRight: 11,
      gap: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      maxWidth: '72%',
    },
    creatorAvatar: {
      width: 25,
      height: 25,
      borderRadius: 12.5,
    },
    creatorName: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
      flexShrink: 1,
    },
    mutualInlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(8, 11, 16, 0.44)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.11)',
    },
    mutualsInlineStack: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 2,
    },
    mutualInlineAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: 'rgba(8, 11, 16, 0.9)',
    },
    mutualInlineEmpty: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    mutualInlineCount: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
      minWidth: 12,
      textAlign: 'center',
    },
    bottomContent: {
      zIndex: 3,
      position: 'absolute',
      bottom: 90,
      left: 16,
      right: 12,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    infoPills: {
      flex: 1,
      maxWidth: '75%',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 6,
    },
    infoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    titlePill: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 16,
      maxWidth: '100%',
    },
    title: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 28,
    },
    infoPillText: {
      color: 'rgba(255,255,255,0.95)',
      fontSize: 13,
      fontWeight: '700',
    },
    actionRail: {
      alignItems: 'center',
      gap: 36,
      alignSelf: 'flex-end',
      marginBottom: 24,
    },
    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 5,
    },
    actionCount: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'center',
      minWidth: 20,
    },
    rsvpIconWrap: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rsvpCheckBadge: {
      position: 'absolute',
      top: 13,
      left: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    rsvpCheckBadgeActive: {
      opacity: 1,
    },
    bottomHintWrap: {
      zIndex: 3,
      alignItems: 'flex-start',
      marginTop: 8,
    },
    bottomHintText: {
      color: 'rgba(255,255,255,0.68)',
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 4,
    },
  });
