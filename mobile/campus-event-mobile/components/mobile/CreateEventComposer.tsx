import { Ionicons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { supabase } from '@/lib/supabase';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { CreateEventInput, EventPrivacy, EventRecord } from '@/types/models';

import { EventDetailView } from './EventDetailView';
import { EventStackCard } from './EventStackCard';
import { GeminiFlyerGenerator } from './GeminiFlyerGenerator';

const BASE_TAGS = ['campus', 'community', 'students'];
const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80';

type ComposerStep = 'image' | 'edit' | 'details' | 'review';
type EditPanel = 'title' | 'date' | 'time' | null;

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

const formatUsDateInput = (value: string) => {
  if (!value) return '';

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;

  return `${month}/${day}/${year}`;
};

const parseUsDateInput = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';

  const [, monthValue, dayValue, yearValue] = match;
  const month = Number(monthValue);
  const day = Number(dayValue);
  const year = Number(yearValue);

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return '';

  return `${yearValue}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const extractDescriptionTags = (value: string) =>
  [...value.matchAll(/#([a-z0-9_-]+)/gi)]
    .map((match) => normalizeTag(match[1]))
    .filter(Boolean);

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

export function CreateEventComposer({
  initialDate = '',
  initialPrivacy = 'public',
  inviteeIds = [],
  onExit,
  onPublished,
}: {
  initialDate?: string;
  initialPrivacy?: EventPrivacy;
  inviteeIds?: string[];
  onExit?: () => void;
  onPublished?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { createEvent, currentUser } = useMobileApp();
  const titleInputRef = useRef<TextInput>(null);
  const dateInputRef = useRef<TextInput>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [privacy, setPrivacy] = useState<EventPrivacy>(initialPrivacy);
  const [eventType, setEventType] = useState<'Free' | 'Paid'>('Free');
  const [capacity, setCapacity] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedFlyerAsset, setSelectedFlyerAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedFlyerUri, setSelectedFlyerUri] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [step, setStep] = useState<ComposerStep>('image');
  const [activeEditPanel, setActiveEditPanel] = useState<EditPanel>(null);
  const [dateInput, setDateInput] = useState(formatUsDateInput(initialDate));
  const [previewDetailVisible, setPreviewDetailVisible] = useState(false);
  const [geminiFlyerVisible, setGeminiFlyerVisible] = useState(false);
  const hostName = currentUser.name || currentUser.username || 'Campus Host';
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (initialDate && !date) {
      setDate(initialDate);
      setDateInput(formatUsDateInput(initialDate));
    }
  }, [date, initialDate]);

  useEffect(() => {
    setPrivacy(initialPrivacy);
  }, [initialPrivacy]);

  useEffect(() => {
    if (step !== 'edit') return;
    if (activeEditPanel === 'title') {
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
    if (activeEditPanel === 'date') {
      requestAnimationFrame(() => dateInputRef.current?.focus());
    }
    if (activeEditPanel === 'time') {
      Keyboard.dismiss();
    }
  }, [activeEditPanel, step]);

  const setSelectedFlyer = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.uri) {
      Alert.alert('Flyer unavailable', 'We could not read the selected image.');
      return;
    }

    setSelectedFlyerAsset(asset);
    setSelectedFlyerUri(asset.uri);
    setImageUrls([]);

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

  const handleUseGeneratedFlyer = (
    imageUri: string,
    generatedAsset?: ImagePicker.ImagePickerAsset
  ) => {
    if (generatedAsset) {
      setSelectedFlyerAsset(generatedAsset);
      setImageUrls([]);
    } else {
      setSelectedFlyerAsset(null);
      setImageUrls([imageUri]);
    }
    setSelectedFlyerUri(imageUri);
    setGeminiFlyerVisible(false);
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

  const derivedTags = useMemo(() => {
    const manualTags = extractDescriptionTags(description);
    return manualTags.length ? manualTags : suggestedTags.slice(0, 4);
  }, [description, suggestedTags]);

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    const parsedDate = parseUsDateInput(value);
    if (parsedDate) {
      setDate(parsedDate);
    }
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
      tags: derivedTags,
      privacy,
      eventType,
      capacity,
      image: uploadedImageUrls[0],
      imageUrls: uploadedImageUrls,
      inviteeIds: privacy === 'private' ? inviteeIds : [],
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
    setEventType('Free');
    setCapacity('');
    setImageUrls([]);
    setSelectedFlyerAsset(null);
    setSelectedFlyerUri('');
    setIsPublishing(false);
    setStep('image');
    setActiveEditPanel(null);
    setDateInput('');
    setPreviewDetailVisible(false);

    Alert.alert('Event Published', `"${createdEvent.title}" is now live in your Events flow.`);
    onPublished?.();
  };

  const handleComposerBack = () => {
    if (step === 'image') {
      onExit?.();
      return;
    }
    if (step === 'edit') {
      setStep('image');
      return;
    }
    if (step === 'details') {
      setStep('edit');
      return;
    }
    if (previewDetailVisible) {
      setPreviewDetailVisible(false);
      return;
    }
    setStep('details');
  };

  const goToStep = (nextStep: ComposerStep) => {
    setPreviewDetailVisible(false);
    if (nextStep === 'edit') {
      setActiveEditPanel(null);
    }
    setStep(nextStep);
  };

  const formattedStartTime = formatTimeLabel(startTime);
  const formattedEndTime = formatTimeLabel(endTime);
  const displayTime = [formattedStartTime, formattedEndTime].filter(Boolean).join(' - ');
  const previewImageSource = { uri: selectedFlyerUri || DEFAULT_EVENT_IMAGE };
  const timeOptions = ['09:00', '12:00', '15:00', '18:00', '19:30', '21:00', '23:00'];
  const stepTitle =
    step === 'image'
      ? 'Event Card'
      : step === 'edit'
        ? 'Edit Card'
        : step === 'details'
          ? 'Event Details'
          : 'Review Event';

  const cardTitle = title.trim();
  const cardDate = dateInput.trim();

  const cardOverlays = step === 'image' ? (
    <View style={styles.uploadPlaceholder}>
      <Ionicons name="cloud-upload-outline" size={26} color={theme.text} />
      <Text style={styles.uploadPlaceholderText}>Upload Event Card</Text>
    </View>
  ) : (
    <>
      {step === 'edit' ? (
        <View style={styles.cardCreatorBadge}>
          <Image source={{ uri: currentUser.avatar || DEFAULT_EVENT_IMAGE }} style={styles.cardCreatorAvatar} />
          <Text style={styles.cardCreatorName} numberOfLines={1}>
            {(currentUser.name || currentUser.username || 'You').split(' ')[0]}
          </Text>
        </View>
      ) : null}
      <Pressable
        style={[
          styles.cardOverlayBlock,
          styles.cardTitleBlock,
          activeEditPanel === 'title' && styles.cardOverlayBlockActive,
        ]}
        onPress={() => setActiveEditPanel('title')}>
        <Ionicons name="text-outline" size={18} color="#ffffff" />
        {step === 'edit' && activeEditPanel === 'title' ? (
          <TextInput
            ref={titleInputRef}
            value={title}
            onChangeText={setTitle}
            placeholder="Add Title"
            placeholderTextColor="rgba(255,255,255,0.72)"
            style={[styles.cardOverlayInput, styles.cardTitleInput]}
          />
        ) : (
          <Text style={styles.cardOverlayTitleText} numberOfLines={2}>
            {cardTitle || 'Add Title'}
          </Text>
        )}
      </Pressable>

      <Pressable
        style={[
          styles.cardOverlayBlock,
          styles.cardDateBlock,
          activeEditPanel === 'date' && styles.cardOverlayBlockActive,
        ]}
        onPress={() => setActiveEditPanel('date')}>
        <Ionicons name="calendar-outline" size={18} color="#ffffff" />
        {step === 'edit' && activeEditPanel === 'date' ? (
          <TextInput
            ref={dateInputRef}
            value={dateInput}
            onChangeText={handleDateInputChange}
            placeholder="MM/DD/YYYY"
            placeholderTextColor="rgba(255,255,255,0.72)"
            keyboardType="numbers-and-punctuation"
            style={styles.cardOverlayInput}
          />
        ) : (
          <Text style={styles.cardOverlayText}>{cardDate || 'Add Date'}</Text>
        )}
      </Pressable>

      <Pressable
        style={[
          styles.cardOverlayBlock,
          styles.cardTimeBlock,
          activeEditPanel === 'time' && styles.cardOverlayBlockActive,
        ]}
        onPress={() => setActiveEditPanel('time')}>
        <Ionicons name="time-outline" size={18} color="#ffffff" />
        <Text style={styles.cardOverlayText}>{displayTime || 'Add Time'}</Text>
      </Pressable>
    </>
  );

  const eventCardPreview = (
    <View
      style={[
        styles.eventCardPreview,
        step === 'image' && styles.eventCardPreviewLarge,
        step === 'edit' && [
          styles.eventCardPreviewEdit,
          { height: Math.max(520, Math.round(windowHeight * 0.62)) },
        ],
        step === 'review' && styles.eventCardPreviewReview,
        step === 'edit' && (activeEditPanel === 'title' || activeEditPanel === 'date') && styles.eventCardPreviewEditing,
      ]}>
      <Image source={previewImageSource} style={styles.eventCardImage} resizeMode="cover" />
      <View style={styles.eventCardShade} />
      {cardOverlays}
    </View>
  );

  const draftEventImage = selectedFlyerUri || imageUrls[0] || DEFAULT_EVENT_IMAGE;
  const draftEvent: EventRecord = {
    id: 'review-draft',
    title: cardTitle || 'Untitled Event',
    description,
    date: cardDate || formatDateLabel(date) || 'Date TBA',
    eventDate: date,
    startTime,
    endTime,
    time: displayTime || 'Time TBA',
    location: locationName || locationAddress,
    locationName,
    locationAddress,
    locationCoordinates: null,
    host: hostName,
    organizer: hostName,
    dressCode: '',
    image: draftEventImage,
    imageUrls: imageUrls.length > 0 ? imageUrls : [draftEventImage],
    price: eventType,
    capacity: capacity ? Number(capacity) : null,
    tags: derivedTags,
    createdBy: currentUser.id,
    creatorUsername: currentUser.username,
    creatorName: currentUser.name,
    creatorAvatar: currentUser.avatar,
    goingCount: 0,
    commentCount: 0,
    privacy,
    isPrivate: privacy === 'private',
    attendees: [],
    repostedByIds: [],
  };

  return (
    <View style={styles.formCard}>
      <View style={styles.composerHeader}>
        <Pressable style={styles.composerBackButton} onPress={handleComposerBack}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.composerHeaderTitle}>{stepTitle}</Text>
        <View style={styles.composerHeaderSpacer} />
      </View>

      {step === 'image' ? (
        <View style={[styles.stepBlock, styles.imageStepBlock]}>
          {eventCardPreview}
          <View style={styles.uploadRow}>
            <Pressable style={styles.uploadButton} onPress={() => void handlePickImage()} disabled={isUploadingImage}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.text} />
              <Text style={styles.uploadButtonText}>{isUploadingImage ? 'Uploading...' : 'Upload'}</Text>
            </Pressable>
            <Pressable
              style={styles.uploadButton}
              onPress={() => setGeminiFlyerVisible(true)}>
              <Ionicons name="sparkles-outline" size={18} color={theme.text} />
              <Text style={styles.uploadButtonText}>Generate</Text>
            </Pressable>
          </View>
          <Pressable style={styles.publishButton} onPress={() => goToStep('edit')}>
            <Text style={styles.publishButtonText}>Next</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'edit' ? (
        <View
          style={[
            styles.stepBlock,
            styles.editStepBlock,
            { minHeight: Math.max(640, Math.round(windowHeight * 0.84)) },
          ]}>
          {eventCardPreview}
          <View style={[styles.editToolRow, styles.editFooterRow]}>
            {([
              ['title', 'text-outline', 'Title'],
              ['date', 'calendar-outline', 'Date'],
              ['time', 'time-outline', 'Time'],
            ] as const).map(([key, icon, label]) => (
              <Pressable
                key={key}
                style={[styles.editToolButton, activeEditPanel === key && styles.editToolButtonActive]}
                onPress={() => setActiveEditPanel(key)}>
                <Ionicons name={icon} size={16} color={activeEditPanel === key ? '#ffffff' : theme.text} />
                <Text style={[styles.editToolText, activeEditPanel === key && styles.editToolTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeEditPanel === 'time' ? (
            <View style={styles.editorPanel}>
              <Text style={styles.label}>Start Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                {timeOptions.map((option) => (
                  <Pressable
                    key={`start-${option}`}
                    style={[styles.pickerChip, startTime === option && styles.pickerChipActive]}
                    onPress={() => setStartTime(option)}>
                    <Text style={[styles.pickerChipText, startTime === option && styles.pickerChipTextActive]}>
                      {formatTimeLabel(option)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>End Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                {timeOptions.map((option) => (
                  <Pressable
                    key={`end-${option}`}
                    style={[styles.pickerChip, endTime === option && styles.pickerChipActive]}
                    onPress={() => setEndTime(option)}>
                    <Text style={[styles.pickerChipText, endTime === option && styles.pickerChipTextActive]}>
                      {formatTimeLabel(option)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <Pressable style={styles.editNextButton} onPress={() => goToStep('details')}>
            <Text style={styles.editNextButtonText}>Next</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'details' ? (
        <View style={[styles.stepBlock, styles.detailsStepBlock]}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the event..."
            placeholderTextColor={theme.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.textarea]}
          />
          <Text style={styles.label}>Address</Text>
          <View style={styles.addressInputWrap}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              value={locationAddress}
              onChangeText={setLocationAddress}
              placeholder="Search address..."
              placeholderTextColor={theme.textMuted}
              style={styles.addressInput}
            />
          </View>
          {locationAddress.trim() || locationName.trim() ? (
            <>
              <Text style={styles.label}>Location Name</Text>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Location name will appear here"
                placeholderTextColor={theme.textMuted}
                style={styles.input}
              />
            </>
          ) : null}
          <Text style={styles.label}>Price</Text>
          <View style={styles.priceSwitch}>
            {(['Free', 'Paid'] as const).map((option) => (
              <Pressable
                key={option}
                style={[styles.priceSwitchOption, eventType === option && styles.priceSwitchOptionActive]}
                onPress={() => setEventType(option)}>
                <Text style={[styles.priceSwitchText, eventType === option && styles.priceSwitchTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.publishButton} onPress={() => goToStep('review')}>
            <Text style={styles.publishButtonText}>Review</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'review' ? (
        <View
          style={[
            styles.stepBlock,
            styles.reviewStepBlock,
            { minHeight: Math.max(560, Math.round(windowHeight * 0.84)) },
          ]}>
          <View
            style={[
              styles.reviewCardSlot,
              { height: Math.max(420, Math.round(windowHeight * 0.68)) },
            ]}>
            <EventStackCard
              event={draftEvent}
              height={Math.max(420, Math.round(windowHeight * 0.68))}
              onPress={() => setPreviewDetailVisible(true)}
            />
          </View>

          <Pressable
            style={styles.shareEventButton}
            disabled={isPublishing || isUploadingImage}
            onPress={() => void handlePublish()}>
            <Text style={styles.shareEventButtonText}>
              {isPublishing || isUploadingImage ? 'Sharing...' : 'Share Event'}
            </Text>
          </Pressable>

          <Modal
            visible={previewDetailVisible}
            animationType="slide"
            onRequestClose={() => setPreviewDetailVisible(false)}>
            <EventDetailView
              event={draftEvent}
              onBack={() => setPreviewDetailVisible(false)}
              primaryActionLabel="Going"
              showGoingIcon
              showActionTrigger={false}
            />
          </Modal>
        </View>
      ) : null}

      <Modal
        visible={geminiFlyerVisible}
        animationType="slide"
        onRequestClose={() => setGeminiFlyerVisible(false)}>
        <GeminiFlyerGenerator
          eventTitle={title}
          eventDescription={description}
          eventDate={dateInput || formatDateLabel(date)}
          eventTime={displayTime}
          eventLocation={locationName || locationAddress}
          onClose={() => setGeminiFlyerVisible(false)}
          onSelectFlyer={handleUseGeneratedFlyer}
        />
      </Modal>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    formCard: {
      gap: 16,
    },
    composerHeader: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 8,
    },
    composerBackButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(18,21,28,0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    composerHeaderTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    composerHeaderSpacer: {
      width: 42,
      height: 42,
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
      gap: 14,
    },
    imageStepBlock: {
      flex: 1,
    },
    detailsStepBlock: {
      paddingTop: 28,
    },
    reviewStepBlock: {
      flex: 1,
    },
    stepTitle: {
      color: theme.text,
      fontSize: 16,
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
      borderColor: 'rgba(255,255,255,0.11)',
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
      fontWeight: '500',
    },
    textarea: {
      minHeight: 112,
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
    eventCardPreview: {
      alignSelf: 'center',
      width: '100%',
      aspectRatio: 0.72,
      maxHeight: 430,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: 'rgba(18,21,28,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      shadowColor: theme.accent,
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
      elevation: 14,
    },
    eventCardPreviewLarge: {
      aspectRatio: 0.62,
      maxHeight: 560,
    },
    eventCardPreviewEdit: {
      width: '100%',
      aspectRatio: undefined,
      maxHeight: undefined,
      borderRadius: 28,
    },
    eventCardPreviewEditing: {
      marginTop: -14,
    },
    eventCardPreviewReview: {
      aspectRatio: 0.82,
      maxHeight: 520,
    },
    eventCardImage: {
      width: '100%',
      height: '100%',
    },
    eventCardShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    uploadPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    uploadPlaceholderText: {
      color: '#ffffff',
      fontSize: 22,
      fontWeight: '900',
    },
    cardOverlayBlock: {
      position: 'absolute',
      minHeight: 34,
      minWidth: 110,
      maxWidth: '74%',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardOverlayBlockActive: {
      borderColor: theme.accent,
      backgroundColor: 'rgba(6,8,12,0.7)',
    },
    cardTitleBlock: {
      left: 14,
      bottom: 92,
      minWidth: 168,
      borderRadius: 14,
      paddingVertical: 9,
      paddingHorizontal: 13,
    },
    cardDateBlock: {
      left: 14,
      bottom: 50,
    },
    cardTimeBlock: {
      left: 14,
      bottom: 12,
    },
    cardOverlayInput: {
      flex: 1,
      minWidth: 80,
      padding: 0,
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    cardTitleInput: {
      fontSize: 16,
      fontWeight: '800',
    },
    cardOverlayTitleText: {
      flex: 1,
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 20,
    },
    cardOverlayText: {
      color: 'rgba(255, 255, 255, 0.95)',
      fontSize: 13,
      fontWeight: '700',
    },
    cardCreatorBadge: {
      position: 'absolute',
      top: 14,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 5,
      paddingHorizontal: 6,
      paddingRight: 11,
      borderRadius: 999,
      backgroundColor: 'rgba(8, 11, 16, 0.48)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      maxWidth: '72%',
    },
    cardCreatorAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
    },
    cardCreatorName: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
      flexShrink: 1,
    },
    eventCardTextLayer: {
      position: 'absolute',
      left: 22,
      right: 22,
      alignItems: 'center',
      gap: 8,
    },
    eventCardTextTop: {
      top: 42,
    },
    eventCardTextCenter: {
      top: '42%',
    },
    eventCardTextBottom: {
      bottom: 46,
    },
    previewTitle: {
      color: '#ffffff',
      fontWeight: '900',
      lineHeight: 34,
      textAlign: 'center',
      letterSpacing: 0,
    },
    previewMeta: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
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
      minHeight: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
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
    editToolRow: {
      flexDirection: 'row',
      gap: 8,
    },
    editFooterRow: {
      marginTop: 'auto',
    },
    editToolButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 10,
    },
    editToolButtonActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    editToolText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    editStepBlock: {
      flex: 1,
    },
    editNextButton: {
      marginTop: 8,
      marginBottom: 4,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    editNextButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    editToolTextActive: {
      color: '#ffffff',
    },
    editorPanel: {
      gap: 10,
      borderRadius: 18,
      padding: 12,
      backgroundColor: 'rgba(18,21,28,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    miniControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    miniChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    miniChipActive: {
      backgroundColor: theme.accentSoft,
      borderColor: theme.accent,
    },
    miniChipText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    miniChipTextActive: {
      color: '#ffffff',
    },
    sizeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    sizeButtonText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    pickerRow: {
      gap: 8,
      paddingRight: 12,
    },
    pickerChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    pickerChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    pickerChipText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    pickerChipTextActive: {
      color: '#ffffff',
    },
    addressInputWrap: {
      minHeight: 48,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.11)',
    },
    addressInput: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 12,
    },
    priceSwitch: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 24,
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.11)',
      overflow: 'hidden',
    },
    priceSwitchOption: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    priceSwitchOptionActive: {
      backgroundColor: theme.accent,
    },
    priceSwitchText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
    priceSwitchTextActive: {
      color: '#ffffff',
    },
    reviewList: {
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: 'rgba(18,21,28,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    reviewCopy: {
      flex: 1,
      gap: 2,
    },
    reviewLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
    },
    reviewValue: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
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
      borderRadius: 18,
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.32,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    publishButtonText: {
      color: '#ffffff',
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
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(18,21,28,0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    backButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    buttonRowPrimary: {
      flex: 1,
    },
    reviewCardSlot: {
      width: '100%',
    },
    shareEventButton: {
      marginTop: 'auto',
      marginBottom: 8,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    shareEventButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    previewText: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 8,
    },
  });
