import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { RecapPostCard } from '@/components/mobile/RecapPostCard';
import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { createBackendRecap } from '@/lib/mobile-recaps-backend';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useRecapComposer } from '@/providers/mobile-recap-composer';
import type { EventRecord } from '@/types/models';

export default function RecapPreviewRoute() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const composer = useRecapComposer();
  const { currentUser, events, savedEventIds, getEventById } = useMobileApp();

  const [isEventPickerVisible, setIsEventPickerVisible] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.max(260, windowWidth - 28);

  const taggedEvent = composer.taggedEventId
    ? getEventById(composer.taggedEventId)
    : undefined;

  const shareableEvents = useMemo(() => {
    if (!currentUser?.id) return [] as EventRecord[];
    const seen = new Set<string>();
    const list: EventRecord[] = [];
    events.forEach((event) => {
      const id = String(event.id);
      if (seen.has(id)) return;
      const isAttending = Array.isArray(event.attendees)
        ? event.attendees.includes(currentUser.id)
        : false;
      const isCreated = String(event.createdBy) === String(currentUser.id);
      const isSaved = savedEventIds.includes(id);
      if (isAttending || isCreated || isSaved) {
        seen.add(id);
        list.push(event);
      }
    });
    return list;
  }, [currentUser?.id, events, savedEventIds]);

  const handleSelectEvent = useCallback(
    (event: EventRecord) => {
      composer.setTaggedEventId(String(event.id));
      setIsEventPickerVisible(false);
    },
    [composer]
  );

  const handleClearEvent = useCallback(() => {
    composer.setTaggedEventId(null);
  }, [composer]);

  const handleOpenCreatorProfile = useCallback(() => {
    router.push({
      pathname: '/recap-profile/[userId]',
      params: { userId: currentUser.id },
    });
  }, [currentUser.id, router]);

  const handleOpenTaggedEvent = useCallback(() => {
    if (!taggedEvent?.id) return;
    router.push({
      pathname: '/event/[id]',
      params: { id: String(taggedEvent.id) },
    });
  }, [router, taggedEvent?.id]);

  const handleOpenEventPicker = useCallback(() => {
    if (shareableEvents.length === 0) {
      Alert.alert(
        'Tag an event',
        'Save, RSVP, or create an event first to tag it on a recap.'
      );
      return;
    }
    setIsEventPickerVisible(true);
  }, [shareableEvents.length]);

  const handleOpenCalendarSelector = useCallback(() => {
    setIsEventPickerVisible(false);
    Alert.alert(
      'Calendar selector',
      'The full calendar event selector will connect here. Use the event row for now.'
    );
  }, []);

  const handleShare = useCallback(async () => {
    if (isPosting) return;
    const caption = composer.text.trim();
    if (!caption && composer.photos.length === 0) {
      Alert.alert('Add text or media to create a recap.');
      return;
    }

    setIsPosting(true);
    try {
      const destination = composer.destination;
      await createBackendRecap({
        authorId: currentUser.id,
        caption,
        photos: composer.photos,
        destination,
        taggedEventId: taggedEvent?.id ? String(taggedEvent.id) : null,
      });
      composer.reset();
      router.replace({
        pathname: '/(tabs)/video-posts',
        params: {
          view: 'recaps',
          recapCategory: destination,
        },
      });
    } catch (error) {
      Alert.alert(
        'Could not post recap',
        error instanceof Error ? error.message : 'Please try again in a moment.'
      );
    } finally {
      setIsPosting(false);
    }
  }, [composer, currentUser.id, isPosting, router, taggedEvent?.id]);

  const captionText = composer.text.trim();
  const creatorLabel = currentUser.username
    ? `@${currentUser.username}`
    : currentUser.name || 'You';
  const cardTaggedEvent = taggedEvent
    ? {
        id: String(taggedEvent.id),
        title: taggedEvent.title || 'Tagged event',
        image: taggedEvent.image || '',
        date: taggedEvent.date,
        time: taggedEvent.time,
      }
    : null;

  return (
    <AppScreen style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerSideButton}
          onPress={() => router.back()}
          accessibilityLabel="Back"
          accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Preview</Text>
        <Pressable
          style={[
            styles.headerShareButton,
            isPosting && styles.headerShareButtonDisabled,
          ]}
          onPress={handleShare}
          disabled={isPosting}
          accessibilityRole="button"
          accessibilityLabel="Share recap">
          <Text style={styles.headerShareText}>
            {isPosting ? 'Sharing…' : 'Share'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <RecapPostCard
          width={cardWidth}
          creatorName={currentUser.name || creatorLabel}
          creatorUsername={currentUser.username}
          creatorAvatar={currentUser.avatar}
          caption={captionText}
          photos={composer.photos}
          taggedEvent={cardTaggedEvent}
          showTagEventButton
          onPressTagEvent={handleOpenEventPicker}
          onPressCreator={handleOpenCreatorProfile}
          onPressEvent={handleOpenTaggedEvent}
          onRemoveTaggedEvent={handleClearEvent}
        />
      </ScrollView>

      <Modal
        transparent
        visible={isEventPickerVisible}
        animationType="slide"
        onRequestClose={() => setIsEventPickerVisible(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsEventPickerVisible(false)}>
          <Pressable
            style={styles.modalSheet}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Tag an event</Text>
              <Pressable
                style={styles.calendarSelectorButton}
                onPress={handleOpenCalendarSelector}
                accessibilityLabel="Open calendar event selector"
                accessibilityRole="button">
                <Ionicons name="calendar-outline" size={15} color={theme.text} />
                <Text style={styles.calendarSelectorText}>Calendar</Text>
              </Pressable>
            </View>
            {shareableEvents.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsRow}>
                {shareableEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() => handleSelectEvent(event)}>
                    <Image
                      source={getEventImageSource(event.image)}
                      style={styles.eventCardImage}
                    />
                    <View style={styles.eventCardOverlay} />
                    <View style={styles.eventCardCopy}>
                      <Text style={styles.eventCardTitle} numberOfLines={2}>
                        {event.title || 'Campus Event'}
                      </Text>
                      <Text style={styles.eventCardMeta} numberOfLines={1}>
                        {[event.date, event.time].filter(Boolean).join(' · ') || 'Date TBA'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.modalEmpty}>No events to tag yet.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingTop: 20,
      paddingBottom: 10,
    },
    headerSideButton: {
      minWidth: 56,
      height: 38,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    headerShareButton: {
      minWidth: 64,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 999,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    headerShareButtonDisabled: {
      opacity: 0.5,
    },
    headerShareText: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '800',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingBottom: 32,
      gap: 12,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingTop: 10,
      paddingBottom: 26,
    },
    modalHandle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 8,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
      flex: 1,
    },
    modalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 18,
      marginBottom: 12,
    },
    calendarSelectorButton: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    calendarSelectorText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    eventsRow: {
      paddingHorizontal: 18,
      gap: 12,
    },
    modalEmpty: {
      color: theme.textMuted,
      paddingHorizontal: 18,
      paddingVertical: 12,
      fontSize: 14,
    },
    eventCard: {
      width: 160,
      height: 200,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    eventCardImage: {
      width: '100%',
      height: '100%',
    },
    eventCardOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.32)',
    },
    eventCardCopy: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      gap: 2,
    },
    eventCardTitle: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 16,
    },
    eventCardMeta: {
      color: 'rgba(255,255,255,0.86)',
      fontSize: 11,
      fontWeight: '700',
    },
  });
