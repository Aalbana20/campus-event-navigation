import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
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
import type { CreatePersonalCalendarItemInput } from '@/types/models';
import { CreateEventComposer } from '@/components/mobile/CreateEventComposer';

type CalendarCreateMode = 'event' | 'personal';

type CalendarCreateSheetProps = {
  visible: boolean;
  selectedDate: string | null;
  initialMode?: CalendarCreateMode;
  onClose: () => void;
  onAddPersonalItem: (input: CreatePersonalCalendarItemInput) => void;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function CalendarCreateSheet({
  visible,
  selectedDate,
  initialMode = 'event',
  onClose,
  onAddPersonalItem,
}: CalendarCreateSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const defaultDate = selectedDate || toDateKey(new Date());
  const [mode, setMode] = useState<CalendarCreateMode>('event');
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalDate, setPersonalDate] = useState(defaultDate);
  const [personalTime, setPersonalTime] = useState('');
  const [personalNote, setPersonalNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setPersonalDate(defaultDate);
  }, [defaultDate, initialMode, visible]);

  const resetPersonalForm = () => {
    setPersonalTitle('');
    setPersonalDate(defaultDate);
    setPersonalTime('');
    setPersonalNote('');
  };

  const handleCreatePersonal = () => {
    if (!personalTitle.trim()) return;

    onAddPersonalItem({
      date: personalDate || defaultDate,
      title: personalTitle,
      time: personalTime,
      note: personalNote,
    });

    resetPersonalForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={25} color={theme.text} />
            </Pressable>

            <Text style={styles.headerTitle}>New</Text>

            <Pressable
              style={[styles.iconButton, mode === 'personal' && styles.confirmButton]}
              onPress={mode === 'personal' ? handleCreatePersonal : undefined}
              disabled={mode === 'event'}>
              <Ionicons
                name="checkmark"
                size={25}
                color={mode === 'personal' ? theme.text : theme.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segmentedButton, mode === 'event' && styles.segmentedButtonActive]}
              onPress={() => setMode('event')}>
              <Text
                style={[styles.segmentedText, mode === 'event' && styles.segmentedTextActive]}>
                Event
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segmentedButton,
                mode === 'personal' && styles.segmentedButtonActive,
              ]}
              onPress={() => setMode('personal')}>
              <Text
                style={[styles.segmentedText, mode === 'personal' && styles.segmentedTextActive]}>
                Personal
              </Text>
            </Pressable>
          </View>

          {mode === 'event' ? (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <CreateEventComposer
                key={`event-${visible ? defaultDate : 'closed'}`}
                initialDate={defaultDate}
                onPublished={onClose}
              />
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <TextInput
                  value={personalTitle}
                  onChangeText={setPersonalTitle}
                  placeholder="Title"
                  placeholderTextColor={theme.textMuted}
                  style={styles.titleInput}
                  autoFocus
                />
                <View style={styles.divider} />
                <TextInput
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  placeholder="Location or note"
                  placeholderTextColor={theme.textMuted}
                  style={styles.titleInput}
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Date</Text>
                  <TextInput
                    value={personalDate}
                    onChangeText={setPersonalDate}
                    placeholder="2026-04-20"
                    placeholderTextColor={theme.textMuted}
                    style={styles.pillInput}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Time</Text>
                  <TextInput
                    value={personalTime}
                    onChangeText={setPersonalTime}
                    placeholder="14:00"
                    placeholderTextColor={theme.textMuted}
                    style={styles.pillInput}
                  />
                </View>
              </View>

              <Pressable
                style={[
                  styles.personalCreateButton,
                  !personalTitle.trim() && styles.personalCreateButtonDisabled,
                ]}
                disabled={!personalTitle.trim()}
                onPress={handleCreatePersonal}>
                <Text style={styles.personalCreateButtonText}>Add Personal Item</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    sheet: {
      height: '94%',
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
      backgroundColor: 'rgba(18,19,24,0.99)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      paddingTop: 18,
      paddingHorizontal: 18,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    iconButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(28,30,36,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    confirmButton: {
      backgroundColor: 'rgba(99,99,102,0.5)',
    },
    headerTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
    },
    segmentedControl: {
      flexDirection: 'row',
      padding: 5,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      marginBottom: 16,
    },
    segmentedButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 14,
    },
    segmentedButtonActive: {
      backgroundColor: 'rgba(99,99,102,0.5)',
    },
    segmentedText: {
      color: theme.textMuted,
      fontSize: 16,
      fontWeight: '700',
    },
    segmentedTextActive: {
      color: theme.text,
      fontWeight: '800',
    },
    content: {
      gap: 16,
      paddingBottom: 48,
    },
    formGroup: {
      borderRadius: 22,
      backgroundColor: 'rgba(44,44,46,0.58)',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    titleInput: {
      minHeight: 64,
      paddingHorizontal: 20,
      color: theme.text,
      fontSize: 22,
      fontWeight: '700',
    },
    divider: {
      height: 1,
      marginLeft: 20,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    row: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      paddingHorizontal: 20,
    },
    rowLabel: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
    },
    pillInput: {
      minWidth: 138,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: 'rgba(99,99,102,0.28)',
      color: theme.text,
      fontSize: 16,
      textAlign: 'right',
    },
    personalCreateButton: {
      minHeight: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a84ff',
    },
    personalCreateButtonDisabled: {
      opacity: 0.5,
    },
    personalCreateButtonText: {
      color: theme.background,
      fontSize: 15,
      fontWeight: '800',
    },
  });
