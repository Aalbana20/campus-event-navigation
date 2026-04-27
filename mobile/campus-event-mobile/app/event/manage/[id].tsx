import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { CreateEventInput } from '@/types/models';

export default function ManageEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser, getEventById, createEvent, deleteEvent } = useMobileApp();
  const event = id ? getEventById(String(id)) : undefined;

  if (!event || event.createdBy !== currentUser.id) {
    return (
      <AppScreen>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Event unavailable.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const duplicateEvent = async () => {
    const input: CreateEventInput = {
      title: `${event.title} Copy`,
      description: event.description,
      date: '',
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      locationCoordinates: event.locationCoordinates || null,
      host: event.host,
      organizer: event.organizer,
      dressCode: event.dressCode,
      tags: event.tags,
      privacy: event.privacy,
      eventType: event.price && event.price !== 'Free' ? 'Paid' : 'Free',
      capacity: event.capacity ? String(event.capacity) : '',
      image: event.image,
      imageUrls: event.imageUrls,
    };

    const created = await createEvent(input);
    if (!created) {
      Alert.alert('Duplicate Event', 'Could not duplicate this event right now.');
      return;
    }
    Alert.alert('Event duplicated', `"${created.title}" is ready to edit.`);
  };

  const confirmDelete = () => {
    Alert.alert('Delete Event', `Delete "${event.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteEvent(event.id);
          router.back();
        },
      },
    ]);
  };

  const rows = [
    {
      label: 'Edit Event',
      subtitle: 'Update your event details',
      icon: 'create-outline' as const,
      onPress: () =>
        router.push({
          pathname: '/event/[id]',
          params: { id: event.id, edit: '1' },
        }),
    },
    {
      label: 'View Registrations',
      subtitle: "See who's going",
      icon: 'people-outline' as const,
      onPress: () => Alert.alert('Registrations', `${event.goingCount} people are going.`),
    },
    {
      label: 'Analytics',
      subtitle: 'View event insights',
      icon: 'analytics-outline' as const,
      onPress: () => Alert.alert('Analytics', 'Event insights are coming soon.'),
    },
    {
      label: 'Duplicate Event',
      subtitle: 'Create a copy of this event',
      icon: 'copy-outline' as const,
      onPress: () => void duplicateEvent(),
    },
  ];

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.screenTitle}>Manage Event</Text>
          <View style={styles.iconSpacer} />
        </View>

        <View style={styles.eventHeader}>
          <Image source={getEventImageSource(event.image)} style={styles.eventImage} />
          <View style={styles.eventCopy}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Published</Text>
            </View>
            <Text style={styles.eventMeta}>{event.date}</Text>
            <Text style={styles.eventMeta}>{[event.startTime, event.endTime].filter(Boolean).join(' - ')}</Text>
            <Text style={styles.eventMeta}>{event.locationName}</Text>
            <Text style={styles.eventMeta}>{event.goingCount} going · {event.privacy === 'private' ? 'Private' : 'Public'}</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          <Text style={styles.menuTitle}>Event Management</Text>
          {rows.map((row) => (
            <Pressable key={row.label} style={styles.menuRow} onPress={row.onPress}>
              <Ionicons name={row.icon} size={24} color={theme.text} />
              <View style={styles.menuCopy}>
                <Text style={styles.menuLabel}>{row.label}</Text>
                <Text style={styles.menuSubtitle}>{row.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          ))}

          <Pressable style={styles.menuRow} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={24} color="#ff3b5f" />
            <View style={styles.menuCopy}>
              <Text style={styles.deleteLabel}>Delete Event</Text>
              <Text style={styles.menuSubtitle}>Remove this event</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={theme.text} />
          <Text style={styles.tipText}>You can always edit your event details, flyer, date, time, and more.</Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    content: {
      padding: 20,
      paddingBottom: 90,
      gap: 22,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconSpacer: {
      width: 48,
      height: 48,
    },
    screenTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    eventHeader: {
      flexDirection: 'row',
      gap: 14,
    },
    eventImage: {
      width: 118,
      height: 154,
      borderRadius: 18,
      backgroundColor: theme.surface,
    },
    eventCopy: {
      flex: 1,
      gap: 7,
      justifyContent: 'center',
    },
    eventTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 23,
    },
    statusPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: 'rgba(48,209,88,0.2)',
    },
    statusText: {
      color: '#30d158',
      fontSize: 12,
      fontWeight: '900',
    },
    eventMeta: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    menuCard: {
      borderRadius: 24,
      padding: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    menuTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '900',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    menuRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    menuCopy: {
      flex: 1,
      gap: 3,
    },
    menuLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '900',
    },
    menuSubtitle: {
      color: theme.textMuted,
      fontSize: 13,
    },
    deleteLabel: {
      color: '#ff3b5f',
      fontSize: 15,
      fontWeight: '900',
    },
    tipCard: {
      flexDirection: 'row',
      gap: 12,
      borderRadius: 22,
      padding: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tipText: {
      flex: 1,
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 14,
    },
    centeredTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '900',
    },
    primaryButton: {
      minWidth: 140,
      minHeight: 50,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    primaryButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '900',
    },
  });
