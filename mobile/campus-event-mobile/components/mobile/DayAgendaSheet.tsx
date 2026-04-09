import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';

export type DayAgendaItem = {
  id: string;
  type: 'event' | 'personal';
  title: string;
  subtitle?: string;
  note?: string;
  time?: string;
};

type DayAgendaSheetProps = {
  visible: boolean;
  dateLabel: string;
  items: DayAgendaItem[];
  onClose: () => void;
  onAddPersonalItem: (input: { title: string; note?: string; time?: string }) => void;
};

export function DayAgendaSheet({
  visible,
  dateLabel,
  items,
  onClose,
  onAddPersonalItem,
}: DayAgendaSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [time, setTime] = useState('');

  const handleClose = () => {
    setIsCreating(false);
    setTitle('');
    setNote('');
    setTime('');
    onClose();
  };

  const handleCreate = () => {
    if (!title.trim()) return;

    onAddPersonalItem({
      title,
      note,
      time,
    });

    setIsCreating(false);
    setTitle('');
    setNote('');
    setTime('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(eventPress) => eventPress.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{dateLabel}</Text>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {items.length > 0 ? (
              items.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <View
                    style={[
                      styles.itemBadge,
                      item.type === 'event' ? styles.eventBadge : styles.personalBadge,
                    ]}>
                    <Text style={styles.itemBadgeText}>
                      {item.type === 'event' ? 'Event' : 'Personal'}
                    </Text>
                  </View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.time ? <Text style={styles.itemMeta}>{item.time}</Text> : null}
                  {item.subtitle ? <Text style={styles.itemMeta}>{item.subtitle}</Text> : null}
                  {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nothing scheduled yet.</Text>
                <Text style={styles.emptyCopy}>
                  Add a personal item for this date or wait for event plans to appear here.
                </Text>
              </View>
            )}

            {isCreating ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>New Personal Item</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Title"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="Optional time (e.g. 18:00)"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Optional note"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.noteInput]}
                />
                <View style={styles.formActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => setIsCreating(false)}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={handleCreate}>
                    <Text style={styles.primaryButtonText}>Add Item</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.primaryButton} onPress={() => setIsCreating(true)}>
                <Text style={styles.primaryButtonText}>New Personal Item</Text>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    sheet: {
      maxHeight: '82%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.surface,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 24,
    },
    handle: {
      alignSelf: 'center',
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    title: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 14,
    },
    content: {
      gap: 12,
      paddingBottom: 12,
    },
    itemCard: {
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
      gap: 6,
    },
    itemBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    eventBadge: {
      backgroundColor: theme.successSoft,
    },
    personalBadge: {
      backgroundColor: theme.accentSoft,
    },
    itemBadgeText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '800',
    },
    itemTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    itemMeta: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    itemNote: {
      color: theme.text,
      fontSize: 13,
      lineHeight: 18,
    },
    emptyCard: {
      padding: 22,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
      gap: 8,
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
    formCard: {
      padding: 16,
      borderRadius: 24,
      backgroundColor: theme.surfaceAlt,
      gap: 10,
    },
    formTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 14,
    },
    noteInput: {
      minHeight: 96,
      paddingTop: 14,
    },
    formActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    primaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.accent,
      flex: 1,
    },
    primaryButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flex: 1,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
  });
