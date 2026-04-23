import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { supabase } from '@/lib/supabase';
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

const EVENT_IMAGE_BUCKET_CANDIDATES = ['event-flyers', 'event-images', 'event-image'];

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

export function CreateEventComposer({
  initialDate = '',
  onPublished,
}: {
  initialDate?: string;
  onPublished?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { createEvent, currentUser } = useMobileApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [privacy, setPrivacy] = useState<EventPrivacy>('public');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [dressCode, setDressCode] = useState('');
  const [eventType, setEventType] = useState<'Free' | 'Paid'>('Free');
  const [capacity, setCapacity] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const hostName = currentUser.name || currentUser.username || 'Campus Host';

  useEffect(() => {
    if (initialDate && !date) {
      setDate(initialDate);
    }
  }, [date, initialDate]);

  const handlePickImage = async () => {
    if (!supabase) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow access to your photo library to upload a flyer.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 6,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;

    setIsUploadingImage(true);

    try {
      const nextUrls: string[] = [];

      for (const [index, asset] of result.assets.entries()) {
        const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `event-${Date.now()}-${index}.${fileExt}`;
        const filePath = `events/${fileName}`;
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        let uploadedBucket = '';
        let uploadErrorMessage = 'Could not upload the images. Try again.';

        for (const bucketName of EVENT_IMAGE_BUCKET_CANDIDATES) {
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, arrayBuffer, {
              contentType: asset.mimeType || `image/${fileExt}`,
              upsert: false,
            });

          if (!uploadError) {
            uploadedBucket = bucketName;
            break;
          }

          uploadErrorMessage = uploadError.message || uploadErrorMessage;
        }

        if (!uploadedBucket) {
          Alert.alert('Upload failed', uploadErrorMessage);
          return;
        }

        const { data } = supabase.storage.from(uploadedBucket).getPublicUrl(filePath);
        if (data?.publicUrl) {
          nextUrls.push(data.publicUrl);
        }
      }

      if (!nextUrls.length) {
        Alert.alert('Upload failed', 'Could not upload the images. Try again.');
        return;
      }

      setImageUrls((currentUrls) => [...new Set([...currentUrls, ...nextUrls])]);
    } catch {
      Alert.alert('Upload failed', 'Something went wrong while uploading the event gallery.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const suggestedTags = useMemo(() => {
    const haystack = [title, description, locationName, locationAddress, hostName].join(' ').toLowerCase();

    const dynamicTags = TAG_RULES.flatMap((rule) =>
      rule.keywords.some((keyword) => haystack.includes(keyword)) ? rule.tags : []
    );

    const privacyTags = privacy === 'private' ? ['private', 'invite-only'] : ['open'];
    const uniqueTags = [...new Set([...BASE_TAGS, ...dynamicTags, ...privacyTags])];

    return uniqueTags.map(normalizeTag).filter(Boolean);
  }, [description, hostName, locationAddress, locationName, privacy, title]);

  const addTag = (rawTag: string) => {
    const nextTag = normalizeTag(rawTag);
    if (!nextTag || tags.includes(nextTag)) return;
    setTags((currentTags) => [...currentTags, nextTag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag));
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your event a name before publishing.');
      return;
    }

    const payload: CreateEventInput = {
      title,
      description,
      date: formatDateLabel(date) || 'TBD',
      eventDate: date,
      startTime,
      endTime,
      locationName,
      locationAddress,
      host: hostName,
      dressCode,
      tags,
      privacy,
      eventType,
      capacity,
      image: imageUrls[0],
      imageUrls,
    };

    const createdEvent = await createEvent(payload);

    if (!createdEvent) {
      Alert.alert('Unable to publish', 'The event could not be created right now. Please try again.');
      return;
    }

    setTitle('');
    setDescription('');
    setDate('');
    setStartTime('');
    setEndTime('');
    setLocationName('');
    setLocationAddress('');
    setPrivacy('public');
    setTagInput('');
    setTags([]);
    setDressCode('');
    setEventType('Free');
    setCapacity('');
    setImageUrls([]);

    Alert.alert('Event Published', `"${createdEvent.title}" is now live in your Events flow.`);
    onPublished?.();
  };

  const showVoicePlaceholder = () => {
    Alert.alert('Voice Input', 'Voice capture can plug into Expo-native speech input in the next pass.');
  };

  return (
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
          <Text style={styles.label}>Host</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyFieldText} numberOfLines={1}>
              {hostName}
            </Text>
          </View>
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

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Event Type</Text>
          <View style={styles.segmentedRow}>
            {(['Free', 'Paid'] as const).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.segmentedButton,
                  eventType === option && styles.segmentedButtonActive,
                ]}
                onPress={() => setEventType(option)}>
                <Text
                  style={[
                    styles.segmentedText,
                    eventType === option && styles.segmentedTextActive,
                  ]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Capacity</Text>
          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            placeholder="100"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            style={styles.input}
          />
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

      <Text style={styles.previewText}>
        Preview: {[formatDateLabel(date), formatTimeLabel(startTime), locationName || locationAddress]
          .filter(Boolean)
          .join(' • ') || 'Your event details will preview here as you type.'}
      </Text>

      <Text style={styles.label}>Flyer / Gallery</Text>
      <Pressable
        style={[styles.imagePicker, isUploadingImage && styles.imagePickerUploading]}
        onPress={() => void handlePickImage()}
        disabled={isUploadingImage}>
        {imageUrls[0] ? (
          <>
            <Image source={{ uri: imageUrls[0] }} style={styles.imagePreview} resizeMode="cover" />
            {imageUrls.length > 1 ? (
              <View style={styles.imageCountBadge}>
                <Text style={styles.imageCountText}>+{imageUrls.length - 1}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.imagePickerPlaceholder}>
            <Ionicons name="image-outline" size={28} color={theme.textMuted} />
            <Text style={styles.imagePickerText}>
              {isUploadingImage ? 'Uploading...' : 'Tap to choose a flyer and gallery images'}
            </Text>
          </View>
        )}
      </Pressable>
      {imageUrls.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageThumbRow}>
            {imageUrls.map((imageUrl, index) => (
              <Pressable
                key={`${imageUrl}-${index}`}
                style={styles.imageThumbWrap}
                onPress={() =>
                  setImageUrls((currentUrls) => currentUrls.filter((_, currentIndex) => currentIndex !== index))
                }>
                <Image source={{ uri: imageUrl }} style={styles.imageThumb} />
                {index === 0 ? (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>Cover</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.helperText, { color: theme.accent }]}>
            Tap a thumbnail to remove it. The first image stays the event cover.
          </Text>
        </>
      ) : null}

      <Pressable style={styles.publishButton} onPress={() => void handlePublish()}>
        <Text style={styles.publishButtonText}>Publish Event</Text>
      </Pressable>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    formCard: {
      padding: 20,
      borderRadius: 24,
      backgroundColor: 'rgba(44,44,46,0.58)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      gap: 12,
    },
    label: {
      color: 'rgba(245,247,251,0.76)',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: 'rgba(58,58,60,0.55)',
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
      fontWeight: '500',
    },
    textarea: {
      minHeight: 108,
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
      backgroundColor: 'rgba(18,19,24,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    helperText: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -2,
    },
    readOnlyField: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: 'rgba(58,58,60,0.4)',
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 13,
      minHeight: 48,
      justifyContent: 'center',
    },
    readOnlyFieldText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
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
      backgroundColor: 'rgba(10,132,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(10,132,255,0.26)',
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
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0a84ff',
      paddingHorizontal: 14,
    },
    tagAddButtonText: {
      color: '#ffffff',
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
      backgroundColor: 'rgba(58,58,60,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    suggestedChipSelected: {
      backgroundColor: '#0a84ff',
      borderColor: '#0a84ff',
    },
    suggestedChipText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    suggestedChipTextSelected: {
      color: '#ffffff',
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    segmentedButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 10,
    },
    segmentedButtonActive: {
      backgroundColor: 'rgba(99,99,102,0.5)',
    },
    segmentedText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
    segmentedTextActive: {
      color: theme.text,
    },
    imagePicker: {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderStyle: 'dashed',
      borderRadius: 16,
      overflow: 'hidden',
      height: 244,
    },
    imagePickerUploading: {
      opacity: 0.5,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
    },
    imageCountBadge: {
      position: 'absolute',
      right: 12,
      top: 12,
      minWidth: 34,
      height: 26,
      paddingHorizontal: 8,
      borderRadius: 13,
      backgroundColor: 'rgba(8,11,16,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    imageCountText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    imagePickerPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: 'rgba(44,44,46,0.45)',
    },
    imagePickerText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    imageThumbRow: {
      gap: 10,
      paddingVertical: 2,
    },
    imageThumbWrap: {
      width: 82,
      height: 96,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: 'rgba(44,44,46,0.45)',
    },
    imageThumb: {
      width: '100%',
      height: '100%',
    },
    coverBadge: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(8,11,16,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    coverBadgeText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },
    publishButton: {
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#0a84ff',
    },
    publishButtonText: {
      color: '#ffffff',
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
