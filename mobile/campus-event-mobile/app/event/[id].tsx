import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventActionTrigger } from '@/components/mobile/EventActionTrigger';
import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import type { EventMemoryRecord } from '@/lib/mobile-event-memories';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { pickStoryMediaFromLibrary } from '@/lib/mobile-story-composer';
import { useMobileApp } from '@/providers/mobile-app-provider';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    getEventById,
    savedEventIds,
    toggleSaveEvent,
    currentUserAttendedEvent,
    postEventMemory,
    loadEventMemoriesForEvent,
  } = useMobileApp();
  const [canAddMemory, setCanAddMemory] = useState(false);
  const [eventMemories, setEventMemories] = useState<EventMemoryRecord[]>([]);
  const [isMemoryBusy, setIsMemoryBusy] = useState(false);

  const event = id ? getEventById(String(id)) : undefined;

  useEffect(() => {
    if (!event?.id) return;

    let isCancelled = false;

    void (async () => {
      const [eligible, memories] = await Promise.all([
        currentUserAttendedEvent(event.id),
        loadEventMemoriesForEvent(event.id),
      ]);

      if (isCancelled) return;
      setCanAddMemory(eligible);
      setEventMemories(memories);
    })();

    return () => {
      isCancelled = true;
    };
  }, [currentUserAttendedEvent, event?.id, loadEventMemoriesForEvent]);

  if (!event) {
    return (
      <AppScreen>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Event not found.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const isSaved = savedEventIds.includes(String(event.id));
  const detailTags = (event.tags || []).filter(Boolean);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.locationAddress || event.locationName
  )}`;

  const handleAddMemory = async () => {
    if (!event?.id || isMemoryBusy) return;

    try {
      const media = await pickStoryMediaFromLibrary();
      if (!media) return;

      setIsMemoryBusy(true);
      await postEventMemory({ eventId: event.id, media });
      const refreshed = await loadEventMemoriesForEvent(event.id);
      setEventMemories(refreshed);
      Alert.alert('Memory added', 'Your event memory is now attached to this event.');
    } catch (error) {
      Alert.alert(
        'Add Memory',
        error instanceof Error ? error.message : 'Could not add this memory right now.'
      );
    } finally {
      setIsMemoryBusy(false);
    }
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={getEventImageSource(event.image)} style={styles.heroImage} />
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </Pressable>
          <EventActionTrigger event={event} style={styles.actionButton} />
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.meta}>
                {[event.date, event.time, event.locationName].filter(Boolean).join(' • ')}
              </Text>
              <View style={styles.creatorCard}>
                <View style={styles.creatorRow}>
                  <Image source={getAvatarImageSource(event.creatorAvatar)} style={styles.creatorAvatar} />
                  <View style={styles.creatorTextWrap}>
                    <Text style={styles.creatorLabel}>Hosted by</Text>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {getEventCreatorLabel(event)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.privacyPill}>
              <Text style={styles.privacyText}>{event.isPrivate ? 'Private' : 'Public'}</Text>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.description}>
              {event.description || 'No description available yet.'}
            </Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Organizer</Text>
              <Text style={styles.detailValue}>{event.organizer || 'Campus Host'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dress Code</Text>
              <Text style={styles.detailValue}>{event.dressCode || 'Open'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>
                {event.locationAddress || event.locationName || 'Address unavailable'}
              </Text>
            </View>
          </View>

          {detailTags.length > 0 ? (
            <View style={styles.tagsSection}>
              <Text style={styles.sectionEyebrow}>Tags</Text>
              <View style={styles.tagsRow}>
                {detailTags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.memoriesSection}>
            <View style={styles.memoryHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Event Memories</Text>
                <Text style={styles.memoryCopy}>
                  RSVP-based photos and videos from people tied to this event.
                </Text>
              </View>
              {canAddMemory ? (
                <Pressable
                  style={styles.memoryButton}
                  disabled={isMemoryBusy}
                  onPress={() => void handleAddMemory()}>
                  <Text style={styles.memoryButtonText}>
                    {isMemoryBusy ? 'Adding...' : 'Add Memory'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {eventMemories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.memoryRow}>
                  {eventMemories.map((memory) => (
                    <View key={memory.id} style={styles.memoryTile}>
                      {memory.mediaType === 'video' ? (
                        <View style={styles.memoryVideoFallback}>
                          <Ionicons name="play-circle-outline" size={30} color="#ffffff" />
                        </View>
                      ) : (
                        <Image source={{ uri: memory.mediaUrl }} style={styles.memoryImage} />
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.memoryEmpty}>
                <Text style={styles.memoryEmptyText}>No memories yet.</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.primaryButton} onPress={() => toggleSaveEvent(event.id)}>
              <Text style={styles.primaryButtonText}>{isSaved ? 'Going' : 'RSVP'}</Text>
            </Pressable>
            {(event.locationAddress || event.locationName) ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => Linking.openURL(mapsUrl).catch(() => {})}>
                <Text style={styles.secondaryButtonText}>View Map</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 120,
    },
    heroWrap: {
      height: 340,
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    backButton: {
      position: 'absolute',
      left: 18,
      top: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(8, 11, 16, 0.64)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButton: {
      position: 'absolute',
      right: 18,
      top: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    body: {
      marginTop: -28,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 12,
      backgroundColor: theme.background,
      gap: 18,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleBlock: {
      flex: 1,
      gap: 8,
    },
    creatorCard: {
      alignSelf: 'flex-start',
      marginTop: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    creatorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    creatorAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    creatorTextWrap: {
      flexShrink: 1,
      gap: 2,
    },
    creatorLabel: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    creatorName: {
      flexShrink: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
    },
    meta: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    privacyPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    privacyText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    description: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 24,
    },
    sectionBlock: {
      gap: 8,
    },
    detailsCard: {
      gap: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    detailRow: {
      gap: 6,
    },
    detailLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 22,
    },
    tagsSection: {
      gap: 10,
    },
    sectionEyebrow: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    tagChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tagText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '700',
    },
    memoriesSection: {
      gap: 12,
    },
    memoryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    memoryCopy: {
      marginTop: 4,
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    memoryButton: {
      flexShrink: 0,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryButtonText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    memoryRow: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: 20,
    },
    memoryTile: {
      width: 96,
      height: 128,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryImage: {
      width: '100%',
      height: '100%',
    },
    memoryVideoFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.42)',
    },
    memoryEmpty: {
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryEmptyText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },
    primaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.accent,
    },
    primaryButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
    },
    centeredTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
  });
