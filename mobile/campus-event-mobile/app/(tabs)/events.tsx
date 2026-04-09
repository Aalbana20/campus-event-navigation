import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { CreateEventComposer } from '@/components/mobile/CreateEventComposer';
import { DayAgendaItem, DayAgendaSheet } from '@/components/mobile/DayAgendaSheet';
import { EventListCard } from '@/components/mobile/EventListCard';
import { MonthlyCalendar } from '@/components/mobile/MonthlyCalendar';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';

type EventsTab = 'my-events' | 'calendar' | 'create';

const resolveEventsTab = (value?: string | string[] | null): EventsTab => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  if (normalizedValue === 'calendar' || normalizedValue === 'create') return normalizedValue;
  return 'my-events';
};

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const formatDateLabel = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

const sortAgendaItems = (items: DayAgendaItem[]) =>
  [...items].sort((left, right) => {
    if (left.time && right.time) return left.time.localeCompare(right.time);
    if (left.time) return -1;
    if (right.time) return 1;
    return left.title.localeCompare(right.title);
  });

export default function EventsScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    currentUser,
    getGoingEventsForProfile,
    getCalendarEventsForProfile,
    getPersonalCalendarItemsForProfile,
    toggleSaveEvent,
    addPersonalCalendarItem,
  } = useMobileApp();
  const [activeTab, setActiveTab] = useState<EventsTab>(() => resolveEventsTab(params.tab));
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);

  useEffect(() => {
    setActiveTab(resolveEventsTab(params.tab));
  }, [params.tab]);

  const goingEvents = getGoingEventsForProfile(currentUser.id);
  const calendarEvents = getCalendarEventsForProfile(currentUser.id);
  const personalCalendarItems = getPersonalCalendarItemsForProfile(currentUser.id);

  const scheduledDates = useMemo(() => {
    const nextDates = new Set<string>();

    calendarEvents.forEach((event) => {
      if (event.eventDate) nextDates.add(event.eventDate);
    });

    personalCalendarItems.forEach((item) => {
      if (item.date) nextDates.add(item.date);
    });

    return nextDates;
  }, [calendarEvents, personalCalendarItems]);

  const selectedAgendaItems = useMemo(() => {
    if (!selectedDate) return [];

    const eventItems: DayAgendaItem[] = calendarEvents
      .filter((event) => event.eventDate === selectedDate)
      .map((event) => ({
        id: event.id,
        type: 'event',
        title: event.title,
        time: event.startTime || undefined,
        subtitle: [event.locationName, event.organizer].filter(Boolean).join(' • '),
      }));

    const personalItems: DayAgendaItem[] = personalCalendarItems
      .filter((item) => item.date === selectedDate)
      .map((item) => ({
        id: item.id,
        type: 'personal',
        title: item.title,
        time: item.time,
        note: item.note,
      }));

    return sortAgendaItems([...eventItems, ...personalItems]);
  }, [calendarEvents, personalCalendarItems, selectedDate]);

  const selectedDateLabel = selectedDate ? formatDateLabel(selectedDate) : '';

  const handleChangeMonth = (direction: 'previous' | 'next') => {
    setVisibleMonth((currentMonth) => {
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return nextMonth;
    });
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setVisibleMonth(parseDateKey(dateKey));
    setIsAgendaOpen(true);
  };

  const handleAddPersonalItem = (input: { title: string; note?: string; time?: string }) => {
    if (!selectedDate) return;

    addPersonalCalendarItem({
      date: selectedDate,
      title: input.title,
      note: input.note,
      time: input.time,
    });
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>
            Going plans, calendar, and event creation all live together now.
          </Text>
        </View>

        <View style={styles.segmentedRow}>
          <Pressable
            style={[
              styles.segmentedButton,
              activeTab === 'my-events' && styles.segmentedButtonActive,
            ]}
            onPress={() => setActiveTab('my-events')}>
            <Text
              style={[
                styles.segmentedText,
                activeTab === 'my-events' && styles.segmentedTextActive,
              ]}>
              My Events
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentedButton,
              activeTab === 'calendar' && styles.segmentedButtonActive,
            ]}
            onPress={() => setActiveTab('calendar')}>
            <Text
              style={[
                styles.segmentedText,
                activeTab === 'calendar' && styles.segmentedTextActive,
              ]}>
              Calendar
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentedButton,
              activeTab === 'create' && styles.segmentedButtonActive,
            ]}
            onPress={() => setActiveTab('create')}>
            <Text
              style={[
                styles.segmentedText,
                activeTab === 'create' && styles.segmentedTextActive,
              ]}>
              Create
            </Text>
          </Pressable>
        </View>

        {activeTab === 'my-events' ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>My Events</Text>
              <Text style={styles.summaryCopy}>
                Events you are going to stay here for quick access and planning.
              </Text>
            </View>

            {goingEvents.length > 0 ? (
              goingEvents.map((event) => (
                <EventListCard
                  key={event.id}
                  event={event}
                  actionLabel="Remove"
                  actionTone="muted"
                  onPress={() =>
                    router.push({
                      pathname: '/event/[id]',
                      params: { id: event.id },
                    })
                  }
                  onActionPress={() => toggleSaveEvent(event.id)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nothing saved yet.</Text>
                <Text style={styles.emptyCopy}>
                  Events you accept from Discover or save in Explore will show up here.
                </Text>
              </View>
            )}
          </>
        ) : null}

        {activeTab === 'calendar' ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Calendar</Text>
              <Text style={styles.summaryCopy}>
                See your campus plans and personal reminders in one monthly view.
              </Text>
            </View>

            <View style={styles.calendarIntroCard}>
              <View style={styles.calendarIntroCopy}>
                <Text style={styles.calendarIntroTitle}>Your social calendar</Text>
                <Text style={styles.calendarIntroText}>
                  Tap any date to open the day plan with event items and personal notes together.
                </Text>
              </View>
              <View style={styles.calendarStatsRow}>
                <View style={styles.calendarStatPill}>
                  <View style={[styles.calendarStatDot, { backgroundColor: theme.success }]} />
                  <Text style={styles.calendarStatText}>{scheduledDates.size} active days</Text>
                </View>
              </View>
            </View>

            <MonthlyCalendar
              month={visibleMonth}
              selectedDate={selectedDate}
              scheduledDates={scheduledDates}
              onSelectDate={handleSelectDate}
              onChangeMonth={handleChangeMonth}
            />

            <View style={styles.calendarHintCard}>
              <Text style={styles.calendarHintTitle}>Calendar-first, create-ready.</Text>
              <Text style={styles.calendarHintCopy}>
                Day-to-create shortcuts can layer in later without changing this tab structure.
              </Text>
            </View>
          </>
        ) : null}

        {activeTab === 'create' ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Create Event</Text>
              <Text style={styles.summaryCopy}>
                Start a new event without leaving the same Events space you use to plan.
              </Text>
            </View>

            <CreateEventComposer onPublished={() => setActiveTab('my-events')} />
          </>
        ) : null}
      </ScrollView>

      <DayAgendaSheet
        visible={isAgendaOpen && Boolean(selectedDate)}
        dateLabel={selectedDateLabel}
        items={selectedAgendaItems}
        onClose={() => setIsAgendaOpen(false)}
        onAddPersonalItem={handleAddPersonalItem}
      />
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
      fontSize: 13,
      fontWeight: '800',
    },
    segmentedTextActive: {
      color: theme.background,
    },
    summaryCard: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    summaryTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    summaryCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
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
    calendarIntroCard: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    calendarIntroCopy: {
      gap: 6,
    },
    calendarIntroTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    calendarIntroText: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    calendarStatsRow: {
      flexDirection: 'row',
    },
    calendarStatPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
    },
    calendarStatDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    calendarStatText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    calendarHintCard: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    calendarHintTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    calendarHintCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
