import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
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

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMELINE_WINDOW_DAYS = 14;

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

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDayLabel = (date: Date, todayKey: string) => {
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  if (toDateKey(date) === todayKey) return `Today — ${dateLabel}`;

  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} — ${dateLabel}`;
};

export default function RecapsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { events } = useMobileApp();
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScrollRef = useRef(false);
  const todayOffsetRef = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const todayKey = toDateKey(today);

  const timelineRows = useMemo(() => {
    const eventsWithDates = events
      .map((event) => {
        const start = getEventStartDate(event);
        return start ? { event, start, dateKey: toDateKey(startOfLocalDay(start)) } : null;
      })
      .filter(Boolean) as Array<{ event: EventRecord; start: Date; dateKey: string }>;

    const dateKeys = new Set<string>();
    for (let offset = -TIMELINE_WINDOW_DAYS; offset <= TIMELINE_WINDOW_DAYS; offset += 1) {
      dateKeys.add(toDateKey(new Date(today.getTime() + offset * DAY_MS)));
    }
    eventsWithDates.forEach(({ dateKey }) => dateKeys.add(dateKey));

    return [...dateKeys]
      .sort((left, right) => dateFromKey(right).getTime() - dateFromKey(left).getTime())
      .map((dateKey) => {
        const date = dateFromKey(dateKey);
        const dayEvents = eventsWithDates
          .filter((item) => item.dateKey === dateKey)
          .sort((left, right) => left.start.getTime() - right.start.getTime())
          .map(({ event, start }) => ({ event, start }));

        return {
          dateKey,
          date,
          label: formatDayLabel(date, todayKey),
          isToday: dateKey === todayKey,
          events: dayEvents,
        };
      });
  }, [events, today, todayKey]);

  const todayIndex = timelineRows.findIndex((row) => row.isToday);

  const scrollToToday = () => {
    if (didInitialScrollRef.current || viewportHeight <= 0 || todayIndex < 0) return;
    didInitialScrollRef.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, todayOffsetRef.current - viewportHeight / 2 + 34),
        animated: false,
      });
    });
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Recaps</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToToday}
        onLayout={(event) => {
          setViewportHeight(event.nativeEvent.layout.height);
          scrollToToday();
        }}
        showsVerticalScrollIndicator={false}>
        {timelineRows.map((row) => (
          <View
            key={row.dateKey}
            style={[styles.dateRow, row.events.length === 0 && styles.dateRowCompact]}
            onLayout={(event) => {
              if (row.isToday) {
                todayOffsetRef.current = event.nativeEvent.layout.y;
                scrollToToday();
              }
            }}>
            <View style={styles.dateHeader}>
              <View style={styles.dateLine} />
              <Text style={[styles.dateLabel, row.isToday && styles.dateLabelToday]}>
                {row.label}
              </Text>
              <View style={styles.dateLine} />
            </View>

            {row.events.length > 0 ? (
              <ScrollView
                horizontal
                contentContainerStyle={styles.eventRail}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}>
                {row.events.map(({ event, start }) => (
                  <Pressable
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() => router.push(`/recaps/${event.id}`)}>
                    <Image source={getEventImageSource(event.image)} style={styles.eventImage} />
                    <View style={styles.eventOverlay} />
                    <View style={styles.eventCopy}>
                      <Text style={styles.eventTime} numberOfLines={1}>
                        {start.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventHost} numberOfLines={1}>
                        {getEventCreatorLabel(event)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ))}
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
    content: {
      paddingTop: 8,
      paddingBottom: 34,
      gap: 8,
    },
    dateRow: {
      minHeight: 188,
      gap: 12,
    },
    dateRowCompact: {
      minHeight: 28,
      gap: 0,
    },
    dateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
    },
    dateLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    dateLabel: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
    dateLabelToday: {
      color: theme.accent,
    },
    eventRail: {
      paddingHorizontal: 18,
      gap: 12,
    },
    eventCard: {
      width: 104,
      height: 154,
      overflow: 'hidden',
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 4,
    },
    eventImage: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.surfaceAlt,
    },
    eventOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    eventCopy: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      gap: 3,
    },
    eventTime: {
      alignSelf: 'flex-start',
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 999,
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '900',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    eventTitle: {
      color: '#ffffff',
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '900',
      textShadowColor: 'rgba(0,0,0,0.55)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    eventHost: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 10,
      fontWeight: '800',
    },
  });
