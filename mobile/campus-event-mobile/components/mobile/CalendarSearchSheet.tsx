import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { EventRecord, PersonalCalendarItem } from '@/types/models';

type CalendarSearchSheetProps = {
  visible: boolean;
  events: EventRecord[];
  personalItems: PersonalCalendarItem[];
  onClose: () => void;
  onSelectDate: (date: string) => void;
};

const formatDateLabel = (value: string) => {
  if (!value) return 'No date';
  const parsedDate = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const normalize = (value: string) => value.trim().toLowerCase();

export function CalendarSearchSheet({
  visible,
  events,
  personalItems,
  onClose,
  onSelectDate,
}: CalendarSearchSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const normalizedQuery = normalize(query);
    const eventResults = events.map((event) => ({
      id: event.id,
      type: 'event' as const,
      date: event.eventDate,
      title: event.title,
      meta: [event.time, event.locationName, event.organizer].filter(Boolean).join(' • '),
      searchText: [
        event.title,
        event.description,
        event.date,
        event.eventDate,
        event.time,
        event.location,
        event.locationName,
        event.locationAddress,
        event.organizer,
        event.dressCode,
        event.price,
        ...(event.tags || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }));

    const personalResults = personalItems.map((item) => ({
      id: item.id,
      type: 'personal' as const,
      date: item.date,
      title: item.title,
      meta: [item.time, item.note].filter(Boolean).join(' • '),
      searchText: [item.title, item.note, item.time, item.date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }));

    const combinedResults = [...eventResults, ...personalResults].sort((left, right) =>
      left.date.localeCompare(right.date)
    );

    if (!normalizedQuery) return combinedResults.slice(0, 12);
    return combinedResults
      .filter((item) => item.searchText.includes(normalizedQuery))
      .slice(0, 24);
  }, [events, personalItems, query]);

  const handleSelectResult = (date: string) => {
    if (date) {
      onSelectDate(date);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <View style={styles.searchBarRow}>
          <View style={styles.searchField}>
            <Ionicons name="search-outline" size={26} color={theme.text} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={theme.textMuted}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            <Ionicons name="mic-outline" size={22} color={theme.textMuted} />
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={27} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.resultsLabel}>
            {query.trim() ? 'Calendar results' : 'Upcoming on your calendar'}
          </Text>

          {results.length > 0 ? (
            results.map((item) => (
              <Pressable
                key={`${item.type}-${item.id}`}
                style={styles.resultCard}
                onPress={() => handleSelectResult(item.date)}>
                <View
                  style={[
                    styles.resultIcon,
                    item.type === 'personal' && styles.resultIconPersonal,
                  ]}>
                  <Ionicons
                    name={item.type === 'event' ? 'calendar-outline' : 'person-outline'}
                    size={18}
                    color={theme.text}
                  />
                </View>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultMeta}>
                    {[formatDateLabel(item.date), item.meta].filter(Boolean).join(' • ')}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No calendar matches.</Text>
              <Text style={styles.emptyCopy}>
                Try an event title, personal item, organizer, location, date, or tag.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 18,
      paddingTop: 58,
    },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    searchField: {
      flex: 1,
      minHeight: 58,
      borderRadius: 29,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      paddingVertical: 10,
    },
    closeButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resultsContent: {
      paddingTop: 28,
      paddingBottom: 44,
      gap: 12,
    },
    resultsLabel: {
      color: theme.text,
      fontSize: 34,
      fontWeight: '900',
      marginBottom: 4,
    },
    resultCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resultIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.successSoft,
    },
    resultIconPersonal: {
      backgroundColor: theme.accentSoft,
    },
    resultCopy: {
      flex: 1,
      gap: 3,
    },
    resultTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    resultMeta: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    emptyState: {
      padding: 26,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
      alignItems: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
  });
