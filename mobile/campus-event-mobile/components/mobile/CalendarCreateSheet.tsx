import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
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
import { getAvatarImageSource } from '@/lib/mobile-media';
import type { CreatePersonalCalendarItemInput } from '@/types/models';
import { CreateEventComposer } from '@/components/mobile/CreateEventComposer';
import { useMobileApp } from '@/providers/mobile-app-provider';

type CalendarCreateMode = 'event' | 'personal';
type CreateFlowStep = 'type' | 'privateInvite' | 'event' | 'personal';
type EventCreateKind = 'public' | 'private';

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
  const { followingProfiles } = useMobileApp();
  const defaultDate = selectedDate || toDateKey(new Date());
  const [flowStep, setFlowStep] = useState<CreateFlowStep>('type');
  const [eventKind, setEventKind] = useState<EventCreateKind>('public');
  const [friendQuery, setFriendQuery] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalDate, setPersonalDate] = useState(defaultDate);
  const [personalTime, setPersonalTime] = useState('');
  const [personalNote, setPersonalNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setFlowStep(initialMode === 'personal' ? 'personal' : 'type');
    setEventKind('public');
    setFriendQuery('');
    setSelectedFriendIds(new Set());
    setPersonalDate(defaultDate);
  }, [defaultDate, initialMode, visible]);

  const filteredFriends = useMemo(() => {
    const query = friendQuery.trim().toLowerCase();
    if (!query) return followingProfiles;
    return followingProfiles.filter((profile) =>
      [profile.name, profile.username].join(' ').toLowerCase().includes(query)
    );
  }, [followingProfiles, friendQuery]);

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

  const handleBack = () => {
    if (flowStep === 'privateInvite') {
      setFlowStep('type');
      return;
    }
    if (flowStep === 'event' && eventKind === 'private') {
      setFlowStep('privateInvite');
      return;
    }
    if (flowStep === 'event' || flowStep === 'personal') {
      setFlowStep('type');
      return;
    }
    onClose();
  };

  const renderHeader = (title: string) => (
    <View style={styles.header}>
      <Pressable style={styles.iconButton} onPress={flowStep === 'type' ? onClose : handleBack}>
        <Ionicons name={flowStep === 'type' ? 'close' : 'chevron-back'} size={25} color={theme.text} />
      </Pressable>

      <Text style={styles.headerTitle}>{title}</Text>

      <View style={styles.headerSpacer} />
    </View>
  );

  const renderTypeSelection = () => (
    <View style={styles.typeContent}>
      {renderHeader('New')}
      <View style={styles.centerCopy}>
        <Text style={styles.heroTitle}>What are you creating?</Text>
        <Text style={styles.heroSubtitle}>Choose the type of event you want to create.</Text>
      </View>

      <View style={styles.optionList}>
        <Pressable
          style={styles.createOption}
          onPress={() => {
            setEventKind('public');
            setFlowStep('event');
          }}>
          <View style={styles.optionIcon}>
            <Ionicons name="globe-outline" size={28} color={theme.accent} />
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>Public Event</Text>
            <Text style={styles.optionSubtitle}>Anyone can discover and join</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.textMuted} />
        </Pressable>

        <Pressable
          style={styles.createOption}
          onPress={() => {
            setEventKind('private');
            setFlowStep('privateInvite');
          }}>
          <View style={styles.optionIcon}>
            <Ionicons name="lock-closed-outline" size={28} color={theme.accent} />
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>Private Event</Text>
            <Text style={styles.optionSubtitle}>Only selected people can see it</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.textMuted} />
        </Pressable>

        <Pressable style={styles.createOption} onPress={() => setFlowStep('personal')}>
          <View style={styles.optionIcon}>
            <Ionicons name="person-outline" size={28} color={theme.accent} />
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>Personal Plan</Text>
            <Text style={styles.optionSubtitle}>Just for you (not shared)</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  const renderPrivateInvite = () => (
    <View style={styles.typeContent}>
      {renderHeader('Private Event')}
      <View style={styles.centerCopy}>
        <Text style={styles.heroTitle}>Who can see this?</Text>
        <Text style={styles.heroSubtitle}>Select the people you want to invite.</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={theme.textMuted} />
        <TextInput
          value={friendQuery}
          onChangeText={setFriendQuery}
          placeholder="Search friends..."
          placeholderTextColor={theme.textMuted}
          style={styles.searchInput}
        />
      </View>

      <ScrollView contentContainerStyle={styles.friendList} showsVerticalScrollIndicator={false}>
        {filteredFriends.map((friend) => {
          const isSelected = selectedFriendIds.has(friend.id);
          return (
            <Pressable
              key={friend.id}
              style={styles.friendRow}
              onPress={() =>
                setSelectedFriendIds((currentIds) => {
                  const nextIds = new Set(currentIds);
                  if (nextIds.has(friend.id)) nextIds.delete(friend.id);
                  else nextIds.add(friend.id);
                  return nextIds;
                })
              }>
              <Image source={getAvatarImageSource(friend.avatar)} style={styles.friendAvatar} />
              <Text style={styles.friendName}>{friend.name || friend.username}</Text>
              <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                {isSelected ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.bottomPrimaryButton} onPress={() => setFlowStep('event')}>
        <Text style={styles.bottomPrimaryText}>Continue</Text>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <View style={styles.sheet}>
          {flowStep === 'type' ? renderTypeSelection() : null}
          {flowStep === 'privateInvite' ? renderPrivateInvite() : null}

          {flowStep === 'event' ? (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {renderHeader(eventKind === 'private' ? 'Private Event' : 'New Event')}
              <CreateEventComposer
                key={`event-${visible ? defaultDate : 'closed'}`}
                initialDate={defaultDate}
                initialPrivacy={eventKind}
                onPublished={onClose}
              />
            </ScrollView>
          ) : null}

          {flowStep === 'personal' ? (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {renderHeader('Personal Plan')}
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
          ) : null}
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
