import { Ionicons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
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

const EVENT_IMAGE_BUCKET_CANDIDATES = ['event-flyers', 'event-images'];

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

const getFileExtension = (
  fileName?: string | null,
  mimeType?: string | null,
  uri?: string | null
) => {
  const normalizedFileName = (fileName || '').trim().toLowerCase();
  const normalizedUri = (uri || '').trim().toLowerCase();

  const fileNameMatch = normalizedFileName.match(/\.([a-z0-9]+)$/);
  if (fileNameMatch?.[1]) return fileNameMatch[1];

  if (mimeType && MIME_EXTENSION_MAP[mimeType]) return MIME_EXTENSION_MAP[mimeType];

  const uriMatch = normalizedUri.match(/\.([a-z0-9]+)(?:\?|$)/);
  if (uriMatch?.[1]) return uriMatch[1];

  return 'jpg';
};

const readFileAsArrayBuffer = async (fileUri: string) => {
  const base64Value = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = Buffer.from(base64Value, 'base64');

  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
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
  initialPrivacy = 'public',
  onPublished,
}: {
  initialDate?: string;
  initialPrivacy?: EventPrivacy;
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
  const [privacy, setPrivacy] = useState<EventPrivacy>(initialPrivacy);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [eventType, setEventType] = useState<'Free' | 'Paid'>('Free');
  const [capacity, setCapacity] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedFlyerAsset, setSelectedFlyerAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedFlyerUri, setSelectedFlyerUri] = useState('');
  const [flyerAspectRatio, setFlyerAspectRatio] = useState(0.75);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const hostName = currentUser.name || currentUser.username || 'Campus Host';

  useEffect(() => {
    if (initialDate && !date) {
      setDate(initialDate);
    }
  }, [date, initialDate]);

  useEffect(() => {
    setPrivacy(initialPrivacy);
  }, [initialPrivacy]);

  const setSelectedFlyer = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.uri) {
      Alert.alert('Flyer unavailable', 'We could not read the selected image.');
      return;
    }

    setSelectedFlyerAsset(asset);
    setSelectedFlyerUri(asset.uri);
    setImageUrls([]);

    if (asset.width && asset.height) {
      setFlyerAspectRatio(asset.width / asset.height);
    }
  };

  const uploadSelectedFlyer = async () => {
    if (!selectedFlyerAsset) return imageUrls;
    if (!supabase) {
      Alert.alert('Upload unavailable', 'Event flyer upload is unavailable right now.');
      return null;
    }

    setIsUploadingImage(true);

    try {
      const fileExt = getFileExtension(
        selectedFlyerAsset.fileName,
        selectedFlyerAsset.mimeType,
        selectedFlyerAsset.uri
      );
      const mimeType =
        selectedFlyerAsset.mimeType || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      const fileName = `event-${Date.now()}.${fileExt}`;
      const filePath = `events/${fileName}`;
      const fileBody = await readFileAsArrayBuffer(selectedFlyerAsset.uri);
      let uploadErrorMessage = 'Could not upload the flyer. Try again.';

      for (const bucketName of EVENT_IMAGE_BUCKET_CANDIDATES) {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, fileBody, {
            cacheControl: '3600',
            contentType: mimeType,
            upsert: false,
          });

        if (!uploadError) {
          const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
          if (!data?.publicUrl) {
            Alert.alert('Upload failed', 'The flyer uploaded, but no public URL was returned.');
            return null;
          }
          setImageUrls([data.publicUrl]);
          return [data.publicUrl];
        }

        uploadErrorMessage = uploadError.message || uploadErrorMessage;
      }

      Alert.alert('Upload failed', uploadErrorMessage);
      return null;
    } catch {
      Alert.alert('Upload failed', 'Something went wrong while uploading the selected flyer.');
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow access to your photo library to upload a flyer.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;

    setSelectedFlyer(result.assets[0]);
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow camera access to capture a flyer.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets.length) return;

    setSelectedFlyer(result.assets[0]);
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

    setIsPublishing(true);
    const uploadedImageUrls = await uploadSelectedFlyer();

    if (!uploadedImageUrls) {
      setIsPublishing(false);
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
      dressCode: 'Open',
      tags,
      privacy,
      eventType,
      capacity,
      image: uploadedImageUrls[0],
      imageUrls: uploadedImageUrls,
    };

    const createdEvent = await createEvent(payload);

    if (!createdEvent) {
      setIsPublishing(false);
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
    setEventType('Free');
    setCapacity('');
    setImageUrls([]);
    setSelectedFlyerAsset(null);
    setSelectedFlyerUri('');
    setFlyerAspectRatio(0.75);
    setIsPublishing(false);
    setStep(1);

    Alert.alert('Event Published', `"${createdEvent.title}" is now live in your Events flow.`);
    onPublished?.();
  };

  const previewMeta = [formatDateLabel(date), formatTimeLabel(startTime), formatTimeLabel(endTime)]
    .filter(Boolean)
    .join(' • ');

  const flyerPreview = (
    <View style={[styles.flyerPreviewFrame, { aspectRatio: flyerAspectRatio || 0.75 }]}>
      {selectedFlyerUri ? (
        <Image source={{ uri: selectedFlyerUri }} style={styles.flyerPreviewImage} resizeMode="contain" />
      ) : (
        <View style={styles.flyerEmpty}>
          <Ionicons name="image-outline" size={34} color={theme.textMuted} />
          <Text style={styles.imagePickerText}>Choose a flyer</Text>
        </View>
      )}
      {step === 2 && selectedFlyerUri ? (
        <View style={styles.flyerOverlayText}>
          {title ? <Text style={styles.flyerOverlayTitle} numberOfLines={2}>{title}</Text> : null}
          {previewMeta ? <Text style={styles.flyerOverlayMeta}>{previewMeta}</Text> : null}
        </View>
      ) : null}
    </View>
  );

  const progressBar = (
    <View style={styles.progressRow}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.progressSegment, item <= step && styles.progressSegmentActive]} />
      ))}
    </View>
  );

  return (
    <View style={styles.formCard}>
      {progressBar}

      {step === 1 ? (
        <View style={styles.stepBlock}>
          <Text style={styles.stepTitle}>Add Flyer</Text>
          <Text style={styles.stepSubtitle}>Upload a flyer for your event. We’ll use it as the main image.</Text>
          {flyerPreview}
          <View style={styles.uploadRow}>
            <Pressable style={styles.uploadButton} onPress={() => void handlePickImage()} disabled={isUploadingImage}>
              <Ionicons name="images-outline" size={20} color={theme.text} />
              <Text style={styles.uploadButtonText}>{isUploadingImage ? 'Uploading...' : 'Gallery'}</Text>
            </Pressable>
            <Pressable style={styles.uploadButton} onPress={() => void handleTakePhoto()} disabled={isUploadingImage}>
              <Ionicons name="camera-outline" size={20} color={theme.text} />
              <Text style={styles.uploadButtonText}>Camera</Text>
            </Pressable>
          </View>
          <Pressable style={styles.publishButton} onPress={() => setStep(2)}>
            <Text style={styles.publishButtonText}>Next</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.stepBlock}>
          <Text style={styles.stepTitle}>Event Preview</Text>
          <Text style={styles.stepSubtitle}>Adjust your event details. This is what people will see first.</Text>
          {flyerPreview}
          <Text style={styles.label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Spring Kickoff Party" placeholderTextColor={theme.textMuted} style={styles.input} />
          <Text style={styles.label}>Date</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="2026-05-01" placeholderTextColor={theme.textMuted} style={styles.input} />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Start Time</Text>
              <TextInput value={startTime} onChangeText={setStartTime} placeholder="21:00" placeholderTextColor={theme.textMuted} style={styles.input} />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>End Time</Text>
              <TextInput value={endTime} onChangeText={setEndTime} placeholder="01:00" placeholderTextColor={theme.textMuted} style={styles.input} />
            </View>
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(1)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable style={[styles.publishButton, styles.buttonRowPrimary]} onPress={() => setStep(3)}>
              <Text style={styles.publishButtonText}>Next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.stepBlock}>
          <Text style={styles.stepTitle}>Event Details</Text>
          <Text style={styles.stepSubtitle}>Add more information about your event.</Text>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the vibe, audience, and what people should expect. Add hashtags at the bottom."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.textarea]}
          />
          <View style={styles.tagsWrap}>
            {tags.map((tag) => (
              <Pressable key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                <Text style={styles.tagChipText}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.tagInputRow}>
            <TextInput value={tagInput} onChangeText={setTagInput} placeholder="Add hashtag" placeholderTextColor={theme.textMuted} style={[styles.input, styles.tagInput]} />
            <Pressable style={styles.tagAddButton} onPress={() => addTag(tagInput)}>
              <Text style={styles.tagAddButtonText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.suggestedWrap}>
            {suggestedTags.slice(0, 6).map((tag) => (
              <Pressable
                key={tag}
                style={[styles.suggestedChip, tags.includes(tag) && styles.suggestedChipSelected]}
                onPress={() => (tags.includes(tag) ? removeTag(tag) : addTag(tag))}>
                <Text style={[styles.suggestedChipText, tags.includes(tag) && styles.suggestedChipTextSelected]}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Location Name</Text>
          <TextInput value={locationName} onChangeText={setLocationName} placeholder="SSC Ballroom" placeholderTextColor={theme.textMuted} style={styles.input} />
          <Text style={styles.label}>Address</Text>
          <TextInput value={locationAddress} onChangeText={setLocationAddress} placeholder="30665 Student Services Center Dr" placeholderTextColor={theme.textMuted} style={styles.input} />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Price</Text>
              <View style={styles.segmentedRow}>
                {(['Free', 'Paid'] as const).map((option) => (
                  <Pressable key={option} style={[styles.segmentedButton, eventType === option && styles.segmentedButtonActive]} onPress={() => setEventType(option)}>
                    <Text style={[styles.segmentedText, eventType === option && styles.segmentedTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Capacity</Text>
            <TextInput value={capacity} onChangeText={setCapacity} placeholder="100" placeholderTextColor={theme.textMuted} keyboardType="number-pad" style={styles.input} />
            </View>
          </View>
          <View style={styles.buttonRow}>
            <Pressable style={styles.backButton} onPress={() => setStep(2)}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.publishButton, styles.buttonRowPrimary]}
              disabled={isPublishing || isUploadingImage}
              onPress={() => void handlePublish()}>
              <Text style={styles.publishButtonText}>
                {isPublishing || isUploadingImage ? 'Publishing...' : 'Publish Event'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    formCard: {
      gap: 18,
    },
    progressRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 28,
      marginBottom: 8,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    progressSegmentActive: {
      backgroundColor: theme.accent,
    },
    stepBlock: {
      gap: 12,
    },
    stepTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
    },
    stepSubtitle: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 8,
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
    flyerPreviewFrame: {
      alignSelf: 'center',
      width: '86%',
      maxHeight: 430,
      minHeight: 220,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: 'rgba(44,44,46,0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    flyerPreviewImage: {
      width: '100%',
      height: '100%',
    },
    flyerEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    flyerOverlayText: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      borderRadius: 18,
      padding: 12,
      backgroundColor: 'rgba(0,0,0,0.48)',
      gap: 4,
    },
    flyerOverlayTitle: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '900',
      lineHeight: 27,
      textTransform: 'uppercase',
    },
    flyerOverlayMeta: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 12,
      fontWeight: '800',
    },
    uploadRow: {
      flexDirection: 'row',
      gap: 10,
    },
    uploadButton: {
      flex: 1,
      minHeight: 58,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(44,44,46,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    uploadButtonText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
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
      backgroundColor: theme.accent,
    },
    publishButtonText: {
      color: theme.background,
      fontSize: 15,
      fontWeight: '800',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    backButton: {
      flex: 0.42,
      minHeight: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(44,44,46,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    backButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    buttonRowPrimary: {
      flex: 1,
    },
    previewText: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 8,
    },
  });
