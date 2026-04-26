import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord } from '@/types/models';

type RecapFilter = 'now' | 'past';

const parseClockTime = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return { hours: 0, minutes: 0 };

  const twelveHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2] || 0);
    const marker = twelveHour[3].toLowerCase();
    if (marker === 'pm' && hours < 12) hours += 12;
    if (marker === 'am' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (twentyFourHour) {
    return {
      hours: Math.min(23, Number(twentyFourHour[1] || 0)),
      minutes: Math.min(59, Number(twentyFourHour[2] || 0)),
    };
  }

  return { hours: 0, minutes: 0 };
};

const getEventStartDate = (event: EventRecord) => {
  const dateValue = event.eventDate || event.date;
  if (!dateValue) return null;

  const start = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;

  const time = parseClockTime(event.startTime || event.time);
  start.setHours(time.hours, time.minutes, 0, 0);
  return start;
};

const getEventEndDate = (event: EventRecord, start: Date) => {
  const end = new Date(start);
  const endClock = parseClockTime(event.endTime);

  if (event.endTime) {
    end.setHours(endClock.hours, endClock.minutes, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    return end;
  }

  end.setHours(start.getHours() + 6);
  return end;
};

const getRecapStatus = (event: EventRecord, now: Date) => {
  const start = getEventStartDate(event);
  if (!start || start > now) return 'future';

  const end = getEventEndDate(event, start);
  return end >= now ? 'now' : 'past';
};

export default function RecapsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { events } = useMobileApp();
  const [activeFilter, setActiveFilter] = useState<RecapFilter>('now');

  const recapEvents = useMemo(() => {
    const now = new Date();

    return events
      .map((event) => ({
        event,
        status: getRecapStatus(event, now),
        start: getEventStartDate(event)?.getTime() || 0,
      }))
      .filter(({ status }) => status === 'now' || status === 'past')
      .sort((left, right) => right.start - left.start);
  }, [events]);

  const visibleEvents = recapEvents.filter(({ status }) => status === activeFilter);

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Recaps</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterRow}>
        {[
          { key: 'now' as const, label: 'Happening Now' },
          { key: 'past' as const, label: 'Past' },
        ].map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter.key)}>
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {visibleEvents.length > 0 ? (
          visibleEvents.map(({ event }) => (
            <Pressable
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/recaps/${event.id}`)}>
              <Image source={getEventImageSource(event.image)} style={styles.eventImage} />
              <View style={styles.eventCopy}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {[event.date, event.time].filter(Boolean).join(' • ')}
                </Text>
                <Text style={styles.eventHost} numberOfLines={1}>
                  {getEventCreatorLabel(event)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={30} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeFilter === 'now' ? 'No live recaps yet' : 'No past events yet'}
            </Text>
            <Text style={styles.emptyCopy}>
              Events that have started will appear here for recap posts.
            </Text>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '900',
    },
    headerSpacer: {
      width: 40,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 14,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filterPillActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    filterTextActive: {
      color: theme.accentText,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 28,
      gap: 12,
    },
    eventCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    eventImage: {
      width: 72,
      height: 88,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
    },
    eventCopy: {
      flex: 1,
      gap: 5,
    },
    eventTitle: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '900',
    },
    eventMeta: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    eventHost: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    emptyState: {
      minHeight: 360,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
  });
