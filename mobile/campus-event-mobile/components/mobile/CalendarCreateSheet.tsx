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
  useWindowDimensions,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource } from '@/lib/mobile-media';
import type { CreatePersonalCalendarItemInput } from '@/types/models';
import { CreateEventComposer } from '@/components/mobile/CreateEventComposer';
import { useMobileApp } from '@/providers/mobile-app-provider';

type CalendarCreateMode = 'event' | 'personal';
type CreateFlowStep = 'type' | 'privateInvite' | 'event' | 'personal';
type EventCreateKind = 'public' | 'private';

const TEMPLATE_CARDS = [
  {
    key: 'party',
    title: 'Party',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=500&q=80',
  },
  {
    key: 'sports',
    title: 'Sports',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=500&q=80',
  },
  {
    key: 'study',
    title: 'Study',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=500&q=80',
  },
  {
    key: 'concert',
    title: 'Concert',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=500&q=80',
  },
];

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
  const { height: windowHeight } = useWindowDimensions();
  const privateInviteTopOffset = Math.round(windowHeight * 0.38);
  const defaultDate = selectedDate || toDateKey(new Date());
  const [flowStep, setFlowStep] = useState<CreateFlowStep>('type');
  const [eventKind, setEventKind] = useState<EventCreateKind>('public');
  const [friendQuery, setFriendQuery] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
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
    setTemplateQuery('');
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

  const selectedFriends = useMemo(
    () => followingProfiles.filter((profile) => selectedFriendIds.has(profile.id)),
    [followingProfiles, selectedFriendIds]
  );

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) return TEMPLATE_CARDS;
    return TEMPLATE_CARDS.filter((template) =>
      template.title.toLowerCase().includes(query)
    );
  }, [templateQuery]);

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
      <Pressable
        style={[styles.iconButton, styles.headerBackButton]}
        onPress={flowStep === 'type' ? onClose : handleBack}>
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </Pressable>

      {title ? <Text style={styles.headerTitle}>{title}</Text> : <View style={styles.headerTitleSpacer} />}

      <View style={styles.headerSpacer} />
    </View>
  );

  const renderTypeSelection = () => (
    <View style={styles.typeContent}>
      {renderHeader('Create Event')}
      <View style={styles.centerCopy}>
        <Text style={styles.heroSubtitle}>How would you like to create this event?</Text>
      </View>

      <View style={styles.typeGrid}>
        <Pressable
          style={[styles.createOption, styles.createOptionHalf]}
          onPress={() => {
            setEventKind('public');
            setFlowStep('event');
          }}>
          <View style={styles.optionIcon}>
            <Ionicons name="globe-outline" size={18} color={theme.accent} />
          </View>
          <Text style={styles.optionTitle}>Public</Text>
        </Pressable>

        <Pressable
          style={[styles.createOption, styles.createOptionHalf]}
          onPress={() => {
            setEventKind('private');
            setFlowStep('privateInvite');
          }}>
          <View style={styles.optionIcon}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.text} />
          </View>
          <Text style={styles.optionTitle}>Private</Text>
        </Pressable>

        <Pressable
          style={[styles.createOption, styles.createOptionFull]}
          onPress={() => {
            setEventKind('public');
            setFlowStep('event');
          }}>
          <View style={styles.optionIcon}>
            <Ionicons name="person-outline" size={18} color={theme.text} />
          </View>
          <Text style={styles.optionTitle}>Personal</Text>
        </Pressable>
      </View>

      <View style={styles.templatesBlock}>
        <View style={styles.templateSearchBox}>
          <Ionicons name="search-outline" size={21} color={theme.text} />
          <TextInput
            value={templateQuery}
            onChangeText={setTemplateQuery}
            placeholder="Search templates"
            placeholderTextColor={theme.textMuted}
            style={styles.templateSearchInput}
          />
        </View>
        <Text style={styles.sectionLabel}>Templates</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templateCarousel}>
          {filteredTemplates.map((template) => (
            <Pressable key={template.key} style={styles.templateCard}>
              <Image source={{ uri: template.image }} style={styles.templateImage} />
              <View style={styles.templateShade} />
              <Text style={styles.templateTitle}>{template.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderPrivateInvite = () => (
    <View style={styles.typeContent}>
      {renderHeader('Select People')}

      <View style={[styles.privateInviteTop, { marginTop: privateInviteTopOffset }]}>
        {selectedFriends.length > 0 ? (
          <View style={styles.selectedCluster}>
            <View style={styles.selectedAvatarStack}>
              {selectedFriends.slice(0, 3).map((friend, index) => (
                <Image
                  key={friend.id}
                  source={getAvatarImageSource(friend.avatar)}
                  style={[
                    styles.selectedAvatar,
                    { marginLeft: index === 0 ? 0 : -11, zIndex: 4 - index },
                  ]}
                />
              ))}
              {selectedFriends.length > 3 ? (
                <View
                  style={[
                    styles.selectedAvatar,
                    styles.selectedCountBubble,
                    { marginLeft: -11, zIndex: 1 },
                  ]}>
                  <Text style={styles.selectedCountText}>+{selectedFriends.length - 3}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.selectedClusterText}>
              {selectedFriends.length} selected
            </Text>
          </View>
        ) : (
          <View style={styles.selectedClusterEmpty} />
        )}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={theme.textMuted} />
          <TextInput
            value={friendQuery}
            onChangeText={setFriendQuery}
            placeholder="Search friends..."
            placeholderTextColor={theme.textMuted}
            style={styles.searchInput}
          />
        </View>
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
              <View style={styles.friendAvatarFrame}>
                <Image source={getAvatarImageSource(friend.avatar)} style={styles.friendAvatar} />
              </View>
              <Text style={styles.friendName}>{friend.name || friend.username}</Text>
              <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                {isSelected ? <Ionicons name="checkmark" size={15} color="#ffffff" /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[
          styles.bottomPrimaryButton,
          selectedFriends.length === 0 && styles.bottomPrimaryButtonDisabled,
        ]}
        disabled={selectedFriends.length === 0}
        onPress={() => setFlowStep('event')}>
        <Text style={styles.bottomPrimaryText}>Next</Text>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
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
              <CreateEventComposer
                key={`event-${visible ? defaultDate : 'closed'}`}
                initialDate={defaultDate}
                initialPrivacy={eventKind}
                inviteeIds={
                  eventKind === 'private' ? Array.from(selectedFriendIds) : []
                }
                onExit={handleBack}
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
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    sheet: {
      height: '100%',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      backgroundColor: 'rgba(6,9,15,0.99)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      paddingTop: 34,
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
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(18,21,28,0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    headerBackButton: {
      transform: [{ translateY: 8 }],
    },
    headerSpacer: {
      width: 42,
      height: 42,
    },
    headerTitleSpacer: {
      flex: 1,
    },
    confirmButton: {
      backgroundColor: 'rgba(99,99,102,0.5)',
    },
    headerTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
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
    typeContent: {
      flex: 1,
    },
    centerCopy: {
      alignItems: 'center',
      gap: 8,
      marginTop: 34,
      marginBottom: 34,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
    },
    heroSubtitle: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    createOption: {
      minHeight: 50,
      borderRadius: 15,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    createOptionHalf: {
      flex: 1,
      minWidth: '46%',
    },
    createOptionFull: {
      width: '100%',
      marginTop: 4,
      borderColor: 'rgba(124,60,255,0.42)',
    },
    optionIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
    },
    optionTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    templatesBlock: {
      gap: 12,
      marginTop: 'auto',
      paddingBottom: 18,
    },
    templateSearchBox: {
      minHeight: 54,
      borderRadius: 27,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    templateSearchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
    sectionLabel: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    templateCarousel: {
      gap: 10,
      paddingRight: 18,
    },
    templateCard: {
      width: 78,
      height: 118,
      borderRadius: 15,
      overflow: 'hidden',
      backgroundColor: 'rgba(18,21,28,0.9)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    templateImage: {
      width: '100%',
      height: '100%',
    },
    templateShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.24)',
    },
    templateTitle: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    privateInviteTop: {
      marginBottom: 14,
    },
    searchBox: {
      minHeight: 48,
      borderRadius: 24,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: 'rgba(16,19,27,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    friendList: {
      paddingBottom: 110,
    },
    friendRow: {
      minHeight: 55,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    friendAvatarFrame: {
      width: 39,
      height: 39,
      borderRadius: 19.5,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    friendAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    friendName: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    checkCircleActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    selectedCluster: {
      minHeight: 36,
      paddingHorizontal: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 11,
      marginBottom: 10,
    },
    selectedClusterEmpty: {
      height: 18,
      marginBottom: 10,
    },
    selectedAvatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedAvatar: {
      width: 31,
      height: 31,
      borderRadius: 15.5,
      borderWidth: 2,
      borderColor: 'rgba(6,9,15,1)',
      backgroundColor: 'rgba(42,45,54,1)',
    },
    selectedCountBubble: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedCountText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
    },
    selectedClusterText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    bottomPrimaryButton: {
      position: 'absolute',
      right: 0,
      bottom: 26,
      minHeight: 48,
      minWidth: 98,
      paddingHorizontal: 18,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    bottomPrimaryButtonDisabled: {
      opacity: 0.42,
    },
    bottomPrimaryText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '900',
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
