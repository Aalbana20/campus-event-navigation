import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { CreateEventInput, EventPrivacy } from '@/types/models';

const BASE_TAGS = ['campus', 'community', 'students'];

const TAG_RULES = [
  { keywords: ['basketball', 'game', 'court'], tags: ['sports', 'game', 'basketball'] },
  { keywords: ['concert', 'music', 'dj'], tags: ['music', 'concert', 'live'] },
  { keywords: ['movie', 'film', 'screening'], tags: ['film', 'movie', 'screening'] },
  { keywords: ['party', 'mixer', 'night'], tags: ['social', 'nightlife', 'party'] },
  { keywords: ['workshop', 'panel', 'career'], tags: ['learning', 'networking', 'campus'] },
];

const normalizeTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-');

const formatDateLabel = (value: string) => {
  if (!value) return '';

  const [year, month, day] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
};

const formatTimeLabel = (time: string) => {
  if (!time) return '';

  const [hours, minutes] = time.split(':');
  const numericHours = Number(hours);

  if (Number.isNaN(numericHours)) return time;

  const suffix = numericHours >= 12 ? 'PM' : 'AM';
  const displayHour = numericHours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
};

function FieldShell({
  children,
  onVoicePress,
}: {
  children: React.ReactNode;
  onVoicePress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <View style={styles.fieldShell}>
      {children}
      <Pressable style={styles.voiceButton} onPress={onVoicePress}>
        <Ionicons name="mic-outline" size={16} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { createEvent } = useMobileApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [privacy, setPrivacy] = useState<EventPrivacy>('public');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [organizer, setOrganizer] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const suggestedTags = useMemo(() => {
    const haystack = [title, description, locationName, locationAddress, organizer].join(' ').toLowerCase();

    const dynamicTags = TAG_RULES.flatMap((rule) =>
      rule.keywords.some((keyword) => haystack.includes(keyword)) ? rule.tags : []
    );

    const privacyTags = privacy === 'private' ? ['private', 'invite-only'] : ['open'];
    const uniqueTags = [...new Set([...BASE_TAGS, ...dynamicTags, ...privacyTags])];

    return uniqueTags.map(normalizeTag).filter(Boolean);
  }, [description, locationAddress, locationName, organizer, privacy, title]);

  const addTag = (rawTag: string) => {
    const nextTag = normalizeTag(rawTag);
    if (!nextTag || tags.includes(nextTag)) return;
    setTags((currentTags) => [...currentTags, nextTag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag));
  };

  const handlePublish = () => {
    const payload: CreateEventInput = {
      title,
      description,
      date: formatDateLabel(date) || 'TBD',
      eventDate: date,
      startTime,
      endTime,
      locationName,
      locationAddress,
      organizer,
      dressCode,
      tags,
      privacy,
      image: imageUrl,
    };

    const createdEvent = createEvent(payload);

    Alert.alert('Event Published', `"${createdEvent.title}" is now live in your mobile app flow.`);
    router.push('/(tabs)/events');
  };

  const showVoicePlaceholder = () => {
    Alert.alert('Voice Input', 'Voice capture can plug into Expo-native speech input in the next pass.');
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Event</Text>
          <Text style={styles.subtitle}>Match the newer web flow without overbuilding the mobile form yet.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Event Title</Text>
          <FieldShell onVoicePress={showVoicePlaceholder}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Spring Campus Festival"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
            />
          </FieldShell>

          <Text style={styles.label}>Description</Text>
          <FieldShell onVoicePress={showVoicePlaceholder}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the vibe, audience, and what people should expect."
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />
          </FieldShell>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="2026-04-30"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Start Time</Text>
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                placeholder="19:00"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>End Time</Text>
              <TextInput
                value={endTime}
                onChangeText={setEndTime}
                placeholder="21:00"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Location Name</Text>
          <FieldShell onVoicePress={showVoicePlaceholder}>
            <TextInput
              value={locationName}
              onChangeText={setLocationName}
              placeholder="Student Center Ballroom"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
            />
          </FieldShell>

          <Text style={styles.label}>Address</Text>
          <FieldShell onVoicePress={showVoicePlaceholder}>
            <TextInput
              value={locationAddress}
              onChangeText={setLocationAddress}
              placeholder="30665 Student Services Center, Princess Anne, MD"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
            />
          </FieldShell>
          <Text style={styles.helperText}>
            Address autocomplete can plug into Google Places or Maps next without restructuring this field.
          </Text>

          <Text style={styles.label}>Tags</Text>
          <View style={styles.tagsWrap}>
            {tags.map((tag) => (
              <Pressable key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                <Text style={styles.tagChipText}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.tagInputRow}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add a tag"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, styles.tagInput]}
            />
            <Pressable style={styles.tagAddButton} onPress={() => addTag(tagInput)}>
              <Text style={styles.tagAddButtonText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.suggestedWrap}>
            {suggestedTags.map((tag) => (
              <Pressable
                key={tag}
                style={[
                  styles.suggestedChip,
                  tags.includes(tag) && styles.suggestedChipSelected,
                ]}
                onPress={() => (tags.includes(tag) ? removeTag(tag) : addTag(tag))}>
                <Text
                  style={[
                    styles.suggestedChipText,
                    tags.includes(tag) && styles.suggestedChipTextSelected,
                  ]}>
                  #{tag}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Organizer</Text>
              <FieldShell onVoicePress={showVoicePlaceholder}>
                <TextInput
                  value={organizer}
                  onChangeText={setOrganizer}
                  placeholder="Student Activities Board"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
              </FieldShell>
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Dress Code</Text>
              <FieldShell onVoicePress={showVoicePlaceholder}>
                <TextInput
                  value={dressCode}
                  onChangeText={setDressCode}
                  placeholder="Casual"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                />
              </FieldShell>
            </View>
          </View>

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.segmentedRow}>
            <Pressable
              style={[styles.segmentedButton, privacy === 'public' && styles.segmentedButtonActive]}
              onPress={() => setPrivacy('public')}>
              <Text
                style={[
                  styles.segmentedText,
                  privacy === 'public' && styles.segmentedTextActive,
                ]}>
                Public
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentedButton, privacy === 'private' && styles.segmentedButtonActive]}
              onPress={() => setPrivacy('private')}>
              <Text
                style={[
                  styles.segmentedText,
                  privacy === 'private' && styles.segmentedTextActive,
                ]}>
                Private
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Flyer / Image URL</Text>
          <TextInput
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://..."
            placeholderTextColor={theme.textMuted}
            style={styles.input}
          />
          <Text style={styles.helperText}>
            Native image upload can plug into Expo image picker next without changing the publish model.
          </Text>

          <Pressable style={styles.publishButton} onPress={handlePublish}>
            <Text style={styles.publishButtonText}>Publish Event</Text>
          </Pressable>
          <Text style={styles.previewText}>
            Preview: {[formatDateLabel(date), formatTimeLabel(startTime), locationName || locationAddress]
              .filter(Boolean)
              .join(' • ') || 'Your event details will preview here as you type.'}
          </Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      padding: 18,
      gap: 18,
      paddingBottom: 140,
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
    formCard: {
      padding: 18,
      borderRadius: 28,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    label: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: theme.text,
      fontSize: 15,
    },
    textarea: {
      minHeight: 120,
      paddingTop: 16,
      paddingRight: 52,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    rowItem: {
      flex: 1,
      minWidth: 96,
      gap: 8,
    },
    fieldShell: {
      position: 'relative',
    },
    voiceButton: {
      position: 'absolute',
      right: 12,
      top: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    helperText: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -2,
    },
    tagsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    tagChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.accentSoft,
    },
    tagChipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    tagInputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    tagInput: {
      flex: 1,
    },
    tagAddButton: {
      minWidth: 72,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingHorizontal: 14,
    },
    tagAddButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    suggestedWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    suggestedChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    suggestedChipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    suggestedChipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    suggestedChipTextSelected: {
      color: theme.background,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 6,
      borderRadius: 20,
      backgroundColor: theme.surfaceAlt,
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
      fontSize: 14,
      fontWeight: '800',
    },
    segmentedTextActive: {
      color: theme.background,
    },
    publishButton: {
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 15,
      borderRadius: 20,
      backgroundColor: theme.accent,
    },
    publishButtonText: {
      color: theme.background,
      fontSize: 15,
      fontWeight: '800',
    },
    previewText: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 8,
    },
  });
