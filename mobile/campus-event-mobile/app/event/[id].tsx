import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventActionTrigger } from '@/components/mobile/EventActionTrigger';
import { EventGalleryViewer } from '@/components/mobile/EventGalleryViewer';
import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import { calculateDistanceMiles, formatDistanceAway } from '@/lib/mobile-event-distance';
import type { EventMemoryRecord } from '@/lib/mobile-event-memories';
import { getAvatarImageSource, getEventGalleryUris, getEventImageSource } from '@/lib/mobile-media';
import { pickStoryMediaFromLibrary } from '@/lib/mobile-story-composer';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { CreateEventInput, EventRecord } from '@/types/models';

type EditEventForm = {
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  image: string;
};

const toEditEventForm = (event: EventRecord): EditEventForm => ({
  title: event.title,
  description: event.description,
  eventDate: event.eventDate,
  startTime: event.startTime,
  endTime: event.endTime,
  locationName: event.locationName,
  locationAddress: event.locationAddress,
  image: event.image,
});

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    getEventById,
    currentUser,
    savedEventIds,
    toggleSaveEvent,
    updateEvent,
    currentUserAttendedEvent,
    postEventMemory,
    loadEventMemoriesForEvent,
  } = useMobileApp();
  const [canAddMemory, setCanAddMemory] = useState(false);
  const [eventMemories, setEventMemories] = useState<EventMemoryRecord[]>([]);
  const [isMemoryBusy, setIsMemoryBusy] = useState(false);
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [editForm, setEditForm] = useState<EditEventForm | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [mapButtonLabel, setMapButtonLabel] = useState('Open in Maps');

  const event = id ? getEventById(String(id)) : undefined;
  const galleryImages = getEventGalleryUris(event?.imageUrls, event?.image);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event?.locationAddress || event?.locationName || ''
  )}`;

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

  useEffect(() => {
    let cancelled = false;

    const loadDistanceLabel = async () => {
      if (!event?.locationCoordinates) {
        setMapButtonLabel('Open in Maps');
        return;
      }

      setMapButtonLabel('Locating...');

      try {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        const permission =
          existingPermission.status === 'granted'
            ? existingPermission
            : await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          if (!cancelled) setMapButtonLabel('Open in Maps');
          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const distanceLabel = formatDistanceAway(
          calculateDistanceMiles(
            {
              latitude: currentPosition.coords.latitude,
              longitude: currentPosition.coords.longitude,
            },
            event.locationCoordinates
          )
        );

        if (!cancelled) {
          setMapButtonLabel(distanceLabel || 'Open in Maps');
        }
      } catch {
        if (!cancelled) setMapButtonLabel('Open in Maps');
      }
    };

    void loadDistanceLabel();

    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.locationCoordinates]);

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
  const isHostedByCurrentUser = event.createdBy === currentUser.id;

  const handleOpenEdit = () => {
    setEditForm(toEditEventForm(event));
  };

  const handleSaveEdit = async () => {
    if (!editForm || isSavingEdit) return;

    const input: CreateEventInput = {
      title: editForm.title,
      description: editForm.description,
      date: '',
      eventDate: editForm.eventDate,
      startTime: editForm.startTime,
      endTime: editForm.endTime,
      locationName: editForm.locationName,
      locationAddress: editForm.locationAddress,
      locationCoordinates: event.locationCoordinates || null,
      host: event.host,
      organizer: event.organizer,
      dressCode: event.dressCode,
      tags: event.tags,
      privacy: event.privacy,
      eventType: event.price && event.price !== 'Free' ? 'Paid' : 'Free',
      capacity: event.capacity ? String(event.capacity) : '',
      image: editForm.image,
      imageUrls: editForm.image ? [editForm.image] : event.imageUrls,
    };

    try {
      setIsSavingEdit(true);
      const updated = await updateEvent(event.id, input);
      if (!updated) {
        Alert.alert('Edit Event', 'Could not update this event right now.');
        return;
      }
      setEditForm(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

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
          <Pressable style={styles.heroImagePressable} onPress={() => setIsGalleryVisible(true)}>
            <Image source={getEventImageSource(event.image)} style={styles.heroImage} />
            {galleryImages.length > 1 ? (
              <View style={styles.galleryCountPill}>
                <Ionicons name="images-outline" size={14} color="#ffffff" />
                <Text style={styles.galleryCountText}>{galleryImages.length}</Text>
              </View>
            ) : null}
          </Pressable>
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

          <View style={styles.memoriesSection}>
            <View style={styles.memoryHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Tag Photos</Text>
                <Text style={styles.memoryCopy}>
                  Photos people tagged to this event after attending.
                </Text>
              </View>
              {canAddMemory ? (
                <Pressable
                  style={styles.memoryButton}
                  disabled={isMemoryBusy}
                  onPress={() => void handleAddMemory()}>
                  <Text style={styles.memoryButtonText}>
                    {isMemoryBusy ? 'Adding...' : 'Tag Photo'}
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
                <Text style={styles.memoryEmptyText}>No tagged photos yet.</Text>
              </View>
            )}
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={isHostedByCurrentUser ? handleOpenEdit : () => toggleSaveEvent(event.id)}>
              <Text style={styles.primaryButtonText}>
                {isHostedByCurrentUser ? 'Edit' : isSaved ? 'Going' : 'RSVP'}
              </Text>
            </Pressable>
            {(event.locationAddress || event.locationName) ? (
              <Pressable
                style={[styles.secondaryButton, styles.mapButton]}
                onPress={() => Linking.openURL(mapsUrl).catch(() => {})}>
                <Ionicons name="map-outline" size={16} color={theme.text} />
                <Text style={styles.secondaryButtonText}>{mapButtonLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <EventGalleryViewer
        visible={isGalleryVisible}
        images={galleryImages}
        onClose={() => setIsGalleryVisible(false)}
      />

      <Modal
        visible={Boolean(editForm)}
        transparent
        animationType="slide"
        onRequestClose={() => setEditForm(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editOverlay}>
          <Pressable style={styles.editBackdrop} onPress={() => setEditForm(null)} />
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <Pressable style={styles.editIconButton} onPress={() => setEditForm(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
              <Text style={styles.editTitle}>Edit Event</Text>
              <Pressable
                style={[styles.editIconButton, styles.editSaveButton]}
                disabled={!editForm || isSavingEdit}
                onPress={() => void handleSaveEdit()}>
                <Text style={styles.editSaveText}>{isSavingEdit ? '...' : 'Save'}</Text>
              </Pressable>
            </View>

            {editForm ? (
              <ScrollView
                contentContainerStyle={styles.editContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <TextInput
                  value={editForm.title}
                  onChangeText={(text) => setEditForm((form) => (form ? { ...form, title: text } : form))}
                  placeholder="Title"
                  placeholderTextColor={theme.textMuted}
                  style={styles.editInput}
                />
                <TextInput
                  value={editForm.description}
                  onChangeText={(text) =>
                    setEditForm((form) => (form ? { ...form, description: text } : form))
                  }
                  placeholder="Description"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.editInput, styles.editTextArea]}
                  multiline
                />
                <View style={styles.editRow}>
                  <TextInput
                    value={editForm.eventDate}
                    onChangeText={(text) =>
                      setEditForm((form) => (form ? { ...form, eventDate: text } : form))
                    }
                    placeholder="2026-04-25"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.editInput, styles.editHalfInput]}
                  />
                  <TextInput
                    value={editForm.startTime}
                    onChangeText={(text) =>
                      setEditForm((form) => (form ? { ...form, startTime: text } : form))
                    }
                    placeholder="16:00"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.editInput, styles.editHalfInput]}
                  />
                </View>
                <TextInput
                  value={editForm.endTime}
                  onChangeText={(text) =>
                    setEditForm((form) => (form ? { ...form, endTime: text } : form))
                  }
                  placeholder="End time"
                  placeholderTextColor={theme.textMuted}
                  style={styles.editInput}
                />
                <TextInput
                  value={editForm.locationName}
                  onChangeText={(text) =>
                    setEditForm((form) => (form ? { ...form, locationName: text } : form))
                  }
                  placeholder="Location"
                  placeholderTextColor={theme.textMuted}
                  style={styles.editInput}
                />
                <TextInput
                  value={editForm.locationAddress}
                  onChangeText={(text) =>
                    setEditForm((form) => (form ? { ...form, locationAddress: text } : form))
                  }
                  placeholder="Address"
                  placeholderTextColor={theme.textMuted}
                  style={styles.editInput}
                />
                <TextInput
                  value={editForm.image}
                  onChangeText={(text) => setEditForm((form) => (form ? { ...form, image: text } : form))}
                  placeholder="Flyer image URL"
                  placeholderTextColor={theme.textMuted}
                  style={styles.editInput}
                />
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    heroImagePressable: {
      flex: 1,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    galleryCountPill: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(8, 11, 16, 0.66)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    galleryCountText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
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
    sectionEyebrow: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
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
    mapButton: {
      flexDirection: 'row',
      gap: 8,
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
    editOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    editBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    editSheet: {
      maxHeight: '88%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 18,
      paddingTop: 16,
      backgroundColor: 'rgba(18,19,24,0.99)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    editHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    editIconButton: {
      minWidth: 54,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
    },
    editSaveButton: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    editSaveText: {
      color: theme.background,
      fontSize: 13,
      fontWeight: '900',
    },
    editTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    editContent: {
      gap: 10,
      paddingBottom: 34,
    },
    editInput: {
      minHeight: 54,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: 15,
      fontWeight: '700',
    },
    editTextArea: {
      minHeight: 112,
      textAlignVertical: 'top',
      lineHeight: 21,
    },
    editRow: {
      flexDirection: 'row',
      gap: 10,
    },
    editHalfInput: {
      flex: 1,
    },
  });
