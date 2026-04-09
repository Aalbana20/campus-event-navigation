import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';

type MonthlyCalendarProps = {
  month: Date;
  selectedDate: string | null;
  scheduledDates: Set<string>;
  onSelectDate: (date: string) => void;
  onChangeMonth: (direction: 'previous' | 'next') => void;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function MonthlyCalendar({
  month,
  selectedDate,
  scheduledDates,
  onSelectDate,
  onChangeMonth,
}: MonthlyCalendarProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  const monthLabel = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const calendarDays = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = firstDay.getDay();
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);

      return {
        key: toDateKey(date),
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month.getMonth(),
      };
    });
  }, [month]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable style={styles.monthButton} onPress={() => onChangeMonth('previous')}>
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </Pressable>

        <Text style={styles.monthLabel}>{monthLabel}</Text>

        <Pressable style={styles.monthButton} onPress={() => onChangeMonth('next')}>
          <Ionicons name="chevron-forward" size={18} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekdaysRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarDays.map((day) => {
          const isSelected = selectedDate === day.key;
          const hasItems = scheduledDates.has(day.key);

          return (
            <Pressable
              key={day.key}
              style={styles.dayCell}
              onPress={() => onSelectDate(day.key)}>
              <View
                style={[
                  styles.dayCellInner,
                  !day.isCurrentMonth && styles.dayCellOutside,
                  isSelected && styles.dayCellSelected,
                ]}>
                <Text
                  style={[
                    styles.dayLabel,
                    !day.isCurrentMonth && styles.dayLabelOutside,
                    isSelected && styles.dayLabelSelected,
                  ]}>
                  {day.dayNumber}
                </Text>
                {hasItems ? (
                  <View
                    style={[
                      styles.dayDot,
                      isSelected && styles.dayDotSelected,
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 26,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    monthButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    monthLabel: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    weekdaysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
    },
    weekdayLabel: {
      flex: 1,
      textAlign: 'center',
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.285%',
      aspectRatio: 1,
      padding: 3,
    },
    dayCellInner: {
      flex: 1,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    dayCellOutside: {
      opacity: 0.5,
    },
    dayCellSelected: {
      backgroundColor: theme.accent,
    },
    dayLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    dayLabelOutside: {
      color: theme.textMuted,
    },
    dayLabelSelected: {
      color: theme.background,
    },
    dayDot: {
      position: 'absolute',
      bottom: 8,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
    dayDotSelected: {
      backgroundColor: theme.background,
    },
  });
