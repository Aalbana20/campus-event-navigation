import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { CalendarCreateSheet } from '@/components/mobile/CalendarCreateSheet';
import { CalendarSearchSheet } from '@/components/mobile/CalendarSearchSheet';
import { EventListCard } from '@/components/mobile/EventListCard';
import { MonthlyCalendar } from '@/components/mobile/MonthlyCalendar';
import { useAppTheme } from '@/lib/app-theme';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { CreatePersonalCalendarItemInput, EventRecord, PersonalCalendarItem } from '@/types/models';

type EventsTab = 'event' | 'calendar';
type CalendarFilter = 'all' | 'going' | 'hosting';
type CreateMode = 'event' | 'personal';
type DatePickerMode = 'month' | 'day' | 'year';
type CalendarDayFeedItem = {
  dateKey: string;
  events: EventRecord[];
  personalItems: PersonalCalendarItem[];
};

type EventsScreenProps = {
  searchSignal?: number;
  createSignal?: number;
};

const FILTER_LABELS: Record<CalendarFilter, string> = {
  all: 'All',
  going: 'Going',
  hosting: 'Hosting',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const resolveEventsTab = (value?: string | string[] | null): EventsTab => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  if (normalizedValue === 'event' || normalizedValue === 'events' || normalizedValue === 'my-events') return 'event';
  return 'calendar';
};

const shouldOpenCreateFromParam = (value?: string | string[] | null) => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === 'create';
};

const resolveCreateMode = (value?: string | string[] | null): CreateMode => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === 'personal' ? 'personal' : 'event';
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

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(year, monthIndex + 1, 0).getDate();

const buildDateKey = (year: number, monthIndex: number, day: number) => {
  const clampedDay = Math.min(day, getDaysInMonth(year, monthIndex));
  return toDateKey(new Date(year, monthIndex, clampedDay));
};

export default function EventsScreen({ searchSignal = 0, createSignal = 0 }: EventsScreenProps) {
  const params = useLocalSearchParams<{
    tab?: string | string[];
    createMode?: string | string[];
  }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const feedListRef = useRef<FlatList<CalendarDayFeedItem>>(null);
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
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const [feedStartDate, setFeedStartDate] = useState<string>(() => toDateKey(new Date()));
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(() =>
    resolveCreateMode(params.createMode)
  );

  useEffect(() => {
    setActiveTab(resolveEventsTab(params.tab));
    if (shouldOpenCreateFromParam(params.tab)) {
      setCreateMode(resolveCreateMode(params.createMode));
      setIsCreateOpen(true);
    }
  }, [params.createMode, params.tab]);

  useEffect(() => {
    if (searchSignal > 0) setIsSearchOpen(true);
  }, [searchSignal]);

  useEffect(() => {
    if (createSignal > 0) {
      setCreateMode('event');
      setIsCreateOpen(true);
    }
  }, [createSignal]);

  const goingEvents = getGoingEventsForProfile(currentUser.id);
  const createdEvents = getCreatedEventsForProfile(currentUser.id);
  const calendarEvents = getCalendarEventsForProfile(currentUser.id);
  const personalCalendarItems = getPersonalCalendarItemsForProfile(currentUser.id);

  const visibleCalendarEvents = useMemo(() => {
    if (calendarFilter === 'going') return goingEvents;
    if (calendarFilter === 'hosting') return createdEvents;
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

  const selectedDateObject = parseDateKey(selectedDate);
  const selectedMonthName = MONTH_NAMES[selectedDateObject.getMonth()];
  const selectedDayNumber = selectedDateObject.getDate();
  const selectedYear = selectedDateObject.getFullYear();
  const feedPageWidth = Math.max(280, screenWidth - 36);
  const pickerYears = useMemo(
    () => Array.from({ length: 9 }, (_, index) => selectedYear - 4 + index),
    [selectedYear]
  );
  const pickerDays = useMemo(
    () =>
      Array.from(
        { length: getDaysInMonth(selectedYear, selectedDateObject.getMonth()) },
        (_, index) => index + 1
      ),
    [selectedDateObject, selectedYear]
  );

  const feedDays = useMemo(
    () =>
      Array.from({ length: 45 }, (_, index) => {
        const dateKey = toDateKey(addDays(parseDateKey(feedStartDate), index));
        return {
          dateKey,
          events: visibleCalendarEvents.filter((event) => event.eventDate === dateKey),
          personalItems: visiblePersonalItems.filter((item) => item.date === dateKey),
        };
      }),
    [feedStartDate, visibleCalendarEvents, visiblePersonalItems]
  );

  const handleSelectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setFeedStartDate(dateKey);
    setVisibleMonth(parseDateKey(dateKey));
    requestAnimationFrame(() => {
      feedListRef.current?.scrollToIndex({ index: 0, animated: false });
    });
  };

  const handleSelectMonth = (month: Date) => {
    setVisibleMonth(month);
  };

  const handleFilterChange = (nextFilter: CalendarFilter) => {
    setCalendarFilter(nextFilter);
    setIsFilterOpen(false);
  };

  const handleSelectDatePart = (nextDateKey: string) => {
    setDatePickerMode(null);
    handleSelectDate(nextDateKey);
  };

  const handleCreatePersonalItem = (input: CreatePersonalCalendarItemInput) => {
    void addPersonalCalendarItem(input);
  };

  const handleFeedScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / feedPageWidth);
    const nextDay = feedDays[Math.max(0, Math.min(nextIndex, feedDays.length - 1))];
    if (!nextDay || nextDay.dateKey === selectedDate) return;
    setSelectedDate(nextDay.dateKey);
    setVisibleMonth(parseDateKey(nextDay.dateKey));
  };

  const renderCompactEventCard = (event: EventRecord) => (
    <Pressable
      key={event.id}
      style={styles.feedEventCard}
      onPress={() =>
        router.push({
          pathname: '/event/[id]',
          params: { id: event.id },
        })
      }>
      <Image source={getEventImageSource(event.image)} style={styles.feedEventImage} />
    </Pressable>
  );

  const renderPersonalCard = (item: PersonalCalendarItem) => (
    <View key={item.id} style={[styles.feedEventCard, styles.personalFeedCard]}>
      <View style={styles.personalIcon}>
        <Ionicons name="person-outline" size={20} color={theme.text} />
      </View>
    </View>
  );

  const renderFeedDay = ({ item }: { item: CalendarDayFeedItem }) => {
    const hasItems = item.events.length > 0 || item.personalItems.length > 0;
    const isPastDay = item.dateKey < toDateKey(new Date());

    return (
      <View style={[styles.feedDayPage, { width: feedPageWidth }]}>
        <Text style={styles.feedDayLabel}>
          {formatDateLabel(item.dateKey)}
        </Text>
        {hasItems ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.feedCardsRow}>
            {item.events.map(renderCompactEventCard)}
            {item.personalItems.map(renderPersonalCard)}
          </ScrollView>
        ) : (
          <View style={styles.feedEmptyState}>
            <Text style={styles.feedEmptyTitle}>
              {isPastDay ? 'No plans that day' : 'No plans yet'}
            </Text>
            <Text style={styles.feedEmptyCopy}>
              {isPastDay
                ? "You didn't have anything scheduled here."
                : 'Swipe to keep browsing upcoming days.'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderDatePicker = () => {
    if (!datePickerMode) return null;

    const pickerTitle =
      datePickerMode === 'month'
        ? 'Select Month'
        : datePickerMode === 'day'
          ? 'Select Day'
          : 'Select Year';

    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerMode(null)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setDatePickerMode(null)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>{pickerTitle}</Text>
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerOptions}
              showsVerticalScrollIndicator={false}>
              {datePickerMode === 'month'
                ? MONTH_NAMES.map((monthName, monthIndex) => {
                    const isSelected = monthIndex === selectedDateObject.getMonth();
                    return (
                      <Pressable
                        key={monthName}
                        style={[styles.pickerOption, isSelected && styles.pickerOptionActive]}
                        onPress={() =>
                          handleSelectDatePart(
                            buildDateKey(selectedYear, monthIndex, selectedDayNumber)
                          )
                        }>
                        <Text
                          style={[
                            styles.pickerOptionText,
                            isSelected && styles.pickerOptionTextActive,
                          ]}>
                          {monthName}
                        </Text>
                      </Pressable>
                    );
                  })
                : null}

              {datePickerMode === 'day'
                ? pickerDays.map((dayNumber) => {
                    const isSelected = dayNumber === selectedDayNumber;
                    return (
                      <Pressable
                        key={dayNumber}
                        style={[styles.pickerOption, isSelected && styles.pickerOptionActive]}
                        onPress={() =>
                          handleSelectDatePart(
                            buildDateKey(selectedYear, selectedDateObject.getMonth(), dayNumber)
                          )
                        }>
                        <Text
                          style={[
                            styles.pickerOptionText,
                            isSelected && styles.pickerOptionTextActive,
                          ]}>
                          {dayNumber}
                        </Text>
                      </Pressable>
                    );
                  })
                : null}

              {datePickerMode === 'year'
                ? pickerYears.map((year) => {
                    const isSelected = year === selectedYear;
                    return (
                      <Pressable
                        key={year}
                        style={[styles.pickerOption, isSelected && styles.pickerOptionActive]}
                        onPress={() =>
                          handleSelectDatePart(
                            buildDateKey(year, selectedDateObject.getMonth(), selectedDayNumber)
                          )
                        }>
                        <Text
                          style={[
                            styles.pickerOptionText,
                            isSelected && styles.pickerOptionTextActive,
                          ]}>
                          {year}
                        </Text>
                      </Pressable>
                    );
                  })
                : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderCalendar = () => (
    <>
      <View style={styles.dateHeaderRow}>
        <View style={styles.dateHeaderButton}>
          <Pressable onPress={() => setDatePickerMode('month')}>
            <Text style={styles.dateHeaderText}>{selectedMonthName}</Text>
          </Pressable>
          <Pressable onPress={() => setDatePickerMode('day')}>
            <Text style={styles.dateHeaderText}>{selectedDayNumber},</Text>
          </Pressable>
          <Pressable onPress={() => setDatePickerMode('year')}>
            <Text style={styles.dateHeaderText}>{selectedYear}</Text>
          </Pressable>
        </View>

        <View>
          <Pressable
            style={styles.headerFilterButton}
            onPress={() => setIsFilterOpen((currentValue) => !currentValue)}>
            <Text style={styles.headerFilterText}>{FILTER_LABELS[calendarFilter]}</Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={theme.text}
              style={[styles.headerFilterChevron, isFilterOpen && styles.headerFilterChevronOpen]}
            />
          </Pressable>

          {isFilterOpen ? (
            <View style={styles.headerFilterMenu}>
              {(['all', 'going', 'hosting'] as CalendarFilter[]).map((filter) => (
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
        </View>
      </View>

      <MonthlyCalendar
        month={visibleMonth}
        mode="month"
        selectedDate={selectedDate}
        scheduledDates={scheduledDates}
        onSelectDate={handleSelectDate}
        onSelectMonth={handleSelectMonth}
      />
      <View style={styles.calendarDivider} />
      <FlatList
        ref={feedListRef}
        data={feedDays}
        keyExtractor={(item) => item.dateKey}
        horizontal
        pagingEnabled
        snapToInterval={feedPageWidth}
        decelerationRate="fast"
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderFeedDay}
        onMomentumScrollEnd={handleFeedScrollEnd}
        onScrollToIndexFailed={() => undefined}
        getItemLayout={(_, index) => ({
          length: feedPageWidth,
          offset: feedPageWidth * index,
          index,
        })}
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
                    Try All, Going, or Hosting from the calendar filter.
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>

      </View>

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
        initialMode={createMode}
        onClose={() => setIsCreateOpen(false)}
        onAddPersonalItem={handleCreatePersonalItem}
      />
      {renderDatePicker()}
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
      paddingBottom: 44,
      gap: 8,
    },
    dateHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      zIndex: 3,
    },
    dateHeaderButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      justifyContent: 'flex-start',
    },
    dateHeaderText: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '900',
    },
    headerFilterButton: {
      height: 42,
      borderRadius: 21,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerFilterText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    headerFilterChevron: {
      transform: [{ rotate: '0deg' }, { translateY: 0 }],
    },
    headerFilterChevronOpen: {
      transform: [{ rotate: '180deg' }, { translateY: 1 }],
    },
    headerFilterMenu: {
      position: 'absolute',
      right: 0,
      top: 48,
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
    calendarDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginTop: -2,
      marginBottom: -2,
    },
    feedDayPage: {
      gap: 8,
      paddingRight: 10,
      minHeight: 152,
    },
    feedDayLabel: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    feedCardsRow: {
      gap: 14,
      paddingRight: 10,
    },
    feedEventCard: {
      width: 92,
      height: 126,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    feedEventImage: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.surfaceAlt,
    },
    personalFeedCard: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    personalIcon: {
      width: '100%',
      height: '100%',
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    feedEmptyState: {
      minHeight: 118,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    feedEmptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    feedEmptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    pickerOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.52)',
    },
    pickerSheet: {
      maxHeight: '58%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 28,
      backgroundColor: 'rgba(18,19,24,0.98)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    pickerHandle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      marginBottom: 14,
    },
    pickerTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 12,
    },
    pickerScroll: {
      flexGrow: 0,
    },
    pickerOptions: {
      gap: 8,
      paddingBottom: 8,
    },
    pickerOption: {
      minHeight: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerOptionActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    pickerOptionText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    pickerOptionTextActive: {
      color: theme.background,
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
