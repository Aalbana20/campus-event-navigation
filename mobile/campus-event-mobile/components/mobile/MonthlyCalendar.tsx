import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';

type CalendarMode = 'month' | 'year';

type MonthlyCalendarProps = {
  month: Date;
  mode: CalendarMode;
  selectedDate: string | null;
  scheduledDates: Set<string>;
  onSelectDate: (date: string) => void;
  onSelectMonth: (month: Date) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildMonthDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = firstDay.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return Array.from({ length: offset + daysInMonth }, (_, index) => {
    if (index < offset) return null;

    const date = new Date(month.getFullYear(), month.getMonth(), index - offset + 1);
    return {
      key: toDateKey(date),
      dayNumber: date.getDate(),
    };
  });
};

function MonthGrid({
  month,
  selectedDate,
  scheduledDates,
  compact = false,
  showWeekdays = false,
  onSelectDate,
}: {
  month: Date;
  selectedDate: string | null;
  scheduledDates: Set<string>;
  compact?: boolean;
  showWeekdays?: boolean;
  onSelectDate: (date: string) => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const todayKey = toDateKey(new Date());
  const days = useMemo(() => buildMonthDays(month), [month]);

  return (
    <View style={compact ? styles.compactMonth : styles.monthBlock}>
      {showWeekdays ? (
        <View style={styles.weekdaysRow}>
          {WEEKDAY_LABELS.map((label, index) => (
            <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={compact ? styles.compactGrid : styles.grid}>
        {days.map((day, index) => {
          if (!day) {
            return <View key={`empty-${index}`} style={compact ? styles.compactDayCell : styles.dayCell} />;
          }

          const isSelected = selectedDate === day.key;
          const isToday = todayKey === day.key;
          const hasItems = scheduledDates.has(day.key);

          return (
            <Pressable
              key={day.key}
              style={compact ? styles.compactDayCell : styles.dayCell}
              onPress={() => onSelectDate(day.key)}>
              <View
                style={[
                  compact ? styles.compactDayInner : styles.dayInner,
                  isToday && styles.todayInner,
                  isSelected && styles.selectedInner,
                ]}>
                <Text
                  style={[
                    compact ? styles.compactDayLabel : styles.dayLabel,
                    isToday && styles.todayLabel,
                    isSelected && styles.selectedLabel,
                  ]}>
                  {day.dayNumber}
                </Text>
                {hasItems ? (
                  <View style={[compact ? styles.compactDot : styles.dayDot, isSelected && styles.selectedDot]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MonthlyCalendar({
  month,
  mode,
  selectedDate,
  scheduledDates,
  onSelectDate,
  onSelectMonth,
}: MonthlyCalendarProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const year = month.getFullYear();
  const monthsToRender = useMemo(
    () => Array.from({ length: 8 }, (_, index) => new Date(year, month.getMonth() + index, 1)),
    [month, year]
  );
  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(year, index, 1)),
    [year]
  );

  if (mode === 'year') {
    return (
      <View style={styles.yearView}>
        <Text style={styles.yearTitle}>{year}</Text>
        <View style={styles.yearDivider} />
        <View style={styles.yearGrid}>
          {yearMonths.map((yearMonth) => (
            <Pressable
              key={yearMonth.getMonth()}
              style={styles.yearMonthCard}
              onPress={() => onSelectMonth(yearMonth)}>
              <Text
                style={[
                  styles.yearMonthTitle,
                  yearMonth.getMonth() === month.getMonth() && styles.yearMonthTitleActive,
                ]}>
                {MONTH_LABELS[yearMonth.getMonth()]}
              </Text>
              <MonthGrid
                month={yearMonth}
                selectedDate={selectedDate}
                scheduledDates={scheduledDates}
                compact
                onSelectDate={(date) => {
                  onSelectMonth(yearMonth);
                  onSelectDate(date);
                }}
              />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.monthList}>
      {monthsToRender.map((visibleMonth, index) => (
        <View key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`} style={styles.monthSection}>
          <Text style={styles.monthTitle}>
            {visibleMonth.toLocaleDateString('en-US', { month: 'long' })}
          </Text>
          <MonthGrid
            month={visibleMonth}
            selectedDate={selectedDate}
            scheduledDates={scheduledDates}
            showWeekdays={index === 0}
            onSelectDate={onSelectDate}
          />
        </View>
      ))}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    monthList: {
      gap: 28,
    },
    monthSection: {
      gap: 12,
    },
    monthTitle: {
      color: theme.text,
      fontSize: 42,
      fontWeight: '900',
      letterSpacing: 0,
    },
    monthBlock: {
      gap: 8,
    },
    weekdaysRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: 8,
    },
    weekdayLabel: {
      width: `${100 / 7}%`,
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    dayCell: {
      width: `${100 / 7}%`,
      minHeight: 72,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      alignItems: 'center',
      paddingTop: 12,
    },
    dayInner: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedInner: {
      backgroundColor: '#ff453a',
    },
    todayInner: {
      backgroundColor: theme.surface,
    },
    dayLabel: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
    },
    selectedLabel: {
      color: '#ffffff',
    },
    todayLabel: {
      color: theme.text,
    },
    dayDot: {
      position: 'absolute',
      bottom: -7,
      width: 14,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.success,
    },
    selectedDot: {
      backgroundColor: '#ffffff',
    },
    yearView: {
      gap: 16,
    },
    yearTitle: {
      color: '#ff453a',
      fontSize: 44,
      fontWeight: '900',
      letterSpacing: 0,
    },
    yearDivider: {
      height: 1,
      backgroundColor: theme.border,
    },
    yearGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 28,
      justifyContent: 'space-between',
    },
    yearMonthCard: {
      width: '31%',
      gap: 8,
    },
    yearMonthTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '900',
    },
    yearMonthTitleActive: {
      color: '#ff453a',
    },
    compactMonth: {
      gap: 4,
    },
    compactGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    compactDayCell: {
      width: `${100 / 7}%`,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactDayInner: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compactDayLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    compactDot: {
      position: 'absolute',
      bottom: -3,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
  });
