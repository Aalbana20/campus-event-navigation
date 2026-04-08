import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventListCard } from '@/components/mobile/EventListCard';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';

type EventsTab = 'going' | 'created';

export default function EventsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser, getGoingEventsForProfile, getCreatedEventsForProfile, toggleSaveEvent, deleteEvent } =
    useMobileApp();
  const [activeTab, setActiveTab] = useState<EventsTab>('going');

  const goingEvents = getGoingEventsForProfile(currentUser.id);
  const createdEvents = getCreatedEventsForProfile(currentUser.id);
  const eventsToRender = activeTab === 'going' ? goingEvents : createdEvents;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Events</Text>
          <Text style={styles.subtitle}>Everything you are going to or hosting lives here.</Text>
        </View>

        <View style={styles.segmentedRow}>
          <Pressable
            style={[styles.segmentedButton, activeTab === 'going' && styles.segmentedButtonActive]}
            onPress={() => setActiveTab('going')}>
            <Text
              style={[
                styles.segmentedText,
                activeTab === 'going' && styles.segmentedTextActive,
              ]}>
              Going
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentedButton, activeTab === 'created' && styles.segmentedButtonActive]}
            onPress={() => setActiveTab('created')}>
            <Text
              style={[
                styles.segmentedText,
                activeTab === 'created' && styles.segmentedTextActive,
              ]}>
              Created
            </Text>
          </Pressable>
        </View>

        {eventsToRender.length > 0 ? (
          eventsToRender.map((event) => (
            <EventListCard
              key={event.id}
              event={event}
              actionLabel={activeTab === 'going' ? 'Remove' : 'Delete'}
              actionTone={activeTab === 'going' ? 'muted' : 'danger'}
              onPress={() =>
                router.push({
                  pathname: '/event/[id]',
                  params: { id: event.id },
                })
              }
              onActionPress={() => {
                if (activeTab === 'going') {
                  toggleSaveEvent(event.id);
                  return;
                }

                Alert.alert('Delete Event', `Delete "${event.title}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteEvent(event.id),
                  },
                ]);
              }}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {activeTab === 'going' ? 'Nothing saved yet.' : 'No created events yet.'}
            </Text>
            <Text style={styles.emptyCopy}>
              {activeTab === 'going'
                ? 'Events you accept from Discover or save in Explore will show up here.'
                : 'Create an event to start building your hosted lineup.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      padding: 18,
      gap: 16,
      paddingBottom: 120,
    },
    header: {
      gap: 6,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 6,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentedButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 16,
    },
    segmentedButtonActive: {
      backgroundColor: theme.accent,
    },
    segmentedText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
    segmentedTextActive: {
      color: theme.background,
    },
    emptyState: {
      padding: 24,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
      alignItems: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
