import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { CalendarCreateSheet } from '@/components/mobile/CalendarCreateSheet';
import { CalendarSearchSheet } from '@/components/mobile/CalendarSearchSheet';
import { DayAgendaItem, DayAgendaSheet } from '@/components/mobile/DayAgendaSheet';
import { EventListCard } from '@/components/mobile/EventListCard';
import { MonthlyCalendar } from '@/components/mobile/MonthlyCalendar';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { CreatePersonalCalendarItemInput } from '@/types/models';

type EventsTab = 'event' | 'calendar';
type CalendarFilter = 'all' | 'going' | 'created';
type CalendarMode = 'month' | 'year';

const FILTER_LABELS: Record<CalendarFilter, string> = {
  all: 'All',
  going: 'Going',
  created: 'Created',
};

const resolveEventsTab = (value?: string | string[] | null): EventsTab => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  if (normalizedValue === 'event' || normalizedValue === 'events' || normalizedValue === 'my-events') return 'event';
  return 'calendar';
};

const shouldOpenCreateFromParam = (value?: string | string[] | null) => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === 'create';
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    getCreatedEventsForProfile,
    getGoingEventsForProfile,
    getCalendarEventsForProfile,
    getPersonalCalendarItemsForProfile,
    toggleSaveEvent,
    addPersonalCalendarItem,
  } = useMobileApp();

  const [activeTab, setActiveTab] = useState<EventsTab>(() => resolveEventsTab(params.tab));
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAgendaOpen, setIsAgendaOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    setActiveTab(resolveEventsTab(params.tab));
    if (shouldOpenCreateFromParam(params.tab)) {
      setIsCreateOpen(true);
    }
  }, [params.tab]);

  const goingEvents = getGoingEventsForProfile(currentUser.id);
  const createdEvents = getCreatedEventsForProfile(currentUser.id);
  const calendarEvents = getCalendarEventsForProfile(currentUser.id);
  const personalCalendarItems = getPersonalCalendarItemsForProfile(currentUser.id);

  const visibleCalendarEvents = useMemo(() => {
    if (calendarFilter === 'going') return goingEvents;
    if (calendarFilter === 'created') return createdEvents;
    return calendarEvents;
  }, [calendarEvents, calendarFilter, createdEvents, goingEvents]);

  const visiblePersonalItems = useMemo(
    () => (calendarFilter === 'all' ? personalCalendarItems : []),
    [calendarFilter, personalCalendarItems]
  );

  const scheduledDates = useMemo(() => {
    const nextDates = new Set<string>();

    visibleCalendarEvents.forEach((event) => {
      if (event.eventDate) nextDates.add(event.eventDate);
    });

    visiblePersonalItems.forEach((item) => {
      if (item.date) nextDates.add(item.date);
    });

    return nextDates;
  }, [visibleCalendarEvents, visiblePersonalItems]);

  const selectedAgendaItems = useMemo(() => {
    if (!selectedDate) return [];

    const eventItems: DayAgendaItem[] = visibleCalendarEvents
      .filter((event) => event.eventDate === selectedDate)
      .map((event) => ({
        id: event.id,
        type: 'event',
        title: event.title,
        time: event.startTime || undefined,
        subtitle: [event.locationName, event.organizer].filter(Boolean).join(' • '),
      }));

    const personalItems: DayAgendaItem[] = visiblePersonalItems
      .filter((item) => item.date === selectedDate)
      .map((item) => ({
        id: item.id,
        type: 'personal',
        title: item.title,
        time: item.time,
        note: item.note,
      }));

    return sortAgendaItems([...eventItems, ...personalItems]);
  }, [selectedDate, visibleCalendarEvents, visiblePersonalItems]);

  const selectedDateLabel = selectedDate ? formatDateLabel(selectedDate) : '';

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setVisibleMonth(parseDateKey(dateKey));
    setCalendarMode('month');
    setIsAgendaOpen(true);
  };

  const handleSelectMonth = (month: Date) => {
    setVisibleMonth(month);
    setCalendarMode('month');
  };

  const handleTodayPress = () => {
    const today = new Date();
    setVisibleMonth(today);
    setSelectedDate(toDateKey(today));
    setCalendarMode('month');
  };

  const handleFilterChange = (nextFilter: CalendarFilter) => {
    setCalendarFilter(nextFilter);
    setIsFilterOpen(false);
  };

  const handleAddPersonalItemForSelectedDate = (input: { title: string; note?: string; time?: string }) => {
    if (!selectedDate) return;

    addPersonalCalendarItem({
      date: selectedDate,
      title: input.title,
      note: input.note,
      time: input.time,
    });
  };

  const handleCreatePersonalItem = (input: CreatePersonalCalendarItemInput) => {
    addPersonalCalendarItem(input);
  };

  const renderCalendar = () => (
    <>
      <View style={styles.calendarTopBar}>
        <Pressable
          style={styles.yearButton}
          onPress={() => setCalendarMode((currentMode) => (currentMode === 'year' ? 'month' : 'year'))}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <Text style={styles.yearButtonText}>{visibleMonth.getFullYear()}</Text>
        </Pressable>
      </View>

      <MonthlyCalendar
        month={visibleMonth}
        mode={calendarMode}
        selectedDate={selectedDate}
        scheduledDates={scheduledDates}
        onSelectDate={handleSelectDate}
        onSelectMonth={handleSelectMonth}
      />
    </>
  );

  return (
    <AppScreen edges={[]}>
      <View style={styles.screenRoot}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {activeTab === 'calendar' ? renderCalendar() : null}

          {activeTab === 'event' ? (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Event</Text>
                <Text style={styles.summaryCopy}>
                  Your going and created events stay here for quick access and planning.
                </Text>
              </View>

              {visibleCalendarEvents.length > 0 ? (
                visibleCalendarEvents.map((event) => (
                  <EventListCard
                    key={event.id}
                    event={event}
                    actionLabel={goingEvents.some((goingEvent) => goingEvent.id === event.id) ? 'Remove' : 'View'}
                    actionTone="muted"
                    onPress={() =>
                      router.push({
                        pathname: '/event/[id]',
                        params: { id: event.id },
                      })
                    }
                    onActionPress={() => {
                      if (goingEvents.some((goingEvent) => goingEvent.id === event.id)) {
                        void toggleSaveEvent(event.id);
                        return;
                      }

                      router.push({
                        pathname: '/event/[id]',
                        params: { id: event.id },
                      });
                    }}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No events for this filter.</Text>
                  <Text style={styles.emptyCopy}>
                    Try All, Going, or Created from the bottom control.
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>

        <>
          {activeTab === 'calendar' ? (
            <Pressable style={styles.todayButton} onPress={handleTodayPress}>
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
          ) : null}

          {isFilterOpen ? (
            <View style={styles.filterMenu}>
              {(['all', 'going', 'created'] as CalendarFilter[]).map((filter) => (
                <Pressable
                  key={filter}
                  style={[
                    styles.filterMenuItem,
                    calendarFilter === filter && styles.filterMenuItemActive,
                  ]}
                  onPress={() => handleFilterChange(filter)}>
                  <Text
                    style={[
                      styles.filterMenuText,
                      calendarFilter === filter && styles.filterMenuTextActive,
                    ]}>
                    {FILTER_LABELS[filter]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.calendarActionControl}>
            <Pressable
              style={styles.actionControlButton}
              onPress={() => setIsFilterOpen((currentValue) => !currentValue)}>
              <Text style={styles.actionControlLabel}>{FILTER_LABELS[calendarFilter]}</Text>
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable
              style={styles.actionControlButton}
              onPress={() => {
                setIsFilterOpen(false);
                setIsSearchOpen(true);
              }}>
              <Ionicons name="search-outline" size={20} color={theme.text} />
            </Pressable>
            <View style={styles.actionDivider} />
            <Pressable
              style={styles.actionControlButton}
              onPress={() => {
                setIsFilterOpen(false);
                setIsCreateOpen(true);
              }}>
              <Ionicons name="add" size={22} color={theme.text} />
            </Pressable>
          </View>
        </>
      </View>

      <DayAgendaSheet
        visible={isAgendaOpen && Boolean(selectedDate)}
        dateLabel={selectedDateLabel}
        items={selectedAgendaItems}
        onClose={() => setIsAgendaOpen(false)}
        onAddPersonalItem={handleAddPersonalItemForSelectedDate}
      />

      <CalendarSearchSheet
        visible={isSearchOpen}
        events={calendarEvents}
        personalItems={personalCalendarItems}
        onClose={() => setIsSearchOpen(false)}
        onSelectDate={handleSelectDate}
      />

      <CalendarCreateSheet
        visible={isCreateOpen}
        selectedDate={selectedDate}
        onClose={() => setIsCreateOpen(false)}
        onAddPersonalItem={handleCreatePersonalItem}
      />
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screenRoot: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 0,
      paddingBottom: 140,
      gap: 10,
    },
    calendarTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    yearButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    yearButtonText: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    todayButton: {
      position: 'absolute',
      left: 20,
      bottom: 96,
      minWidth: 84,
      height: 42,
      borderRadius: 21,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    todayButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    calendarActionControl: {
      position: 'absolute',
      right: 20,
      bottom: 96,
      height: 42,
      borderRadius: 21,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    actionControlButton: {
      minWidth: 44,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    actionControlLabel: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    actionDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.border,
    },
    filterMenu: {
      position: 'absolute',
      right: 120,
      bottom: 148,
      width: 116,
      borderRadius: 16,
      padding: 6,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 9,
      gap: 4,
    },
    filterMenuItem: {
      minHeight: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterMenuItemActive: {
      backgroundColor: theme.accent,
    },
    filterMenuText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    filterMenuTextActive: {
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
  });
