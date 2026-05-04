import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { pickRecapMediaFromLibrary } from '@/lib/mobile-recap-photos';
import {
  MAX_RECAP_PHOTOS,
  useRecapComposer,
  type RecapComposerDestination,
} from '@/providers/mobile-recap-composer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DESTINATIONS: { id: RecapComposerDestination; label: string }[] = [
  { id: 'for-you', label: 'For You (All)' },
  { id: 'umes', label: 'UMES' },
];

export default function CreateRecapRoute() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const composer = useRecapComposer();
  const insets = useSafeAreaInsets();

  const [isPickerBusy, setIsPickerBusy] = useState(false);

  const mediaCount = composer.photos.length;
  const hasContent = composer.text.trim().length > 0 || mediaCount > 0;
  const remainingSlots = Math.max(0, MAX_RECAP_PHOTOS - mediaCount);

  const handlePickMedia = useCallback(async () => {
    if (isPickerBusy) return;
    if (remainingSlots <= 0) {
      Alert.alert('Media limit reached', `You can add up to ${MAX_RECAP_PHOTOS} media items.`);
      return;
    }
    setIsPickerBusy(true);
    try {
      const media = await pickRecapMediaFromLibrary(remainingSlots);
      if (media.length > 0) {
        composer.addPhotos(media);
      }
    } catch (error) {
      Alert.alert(
        'Add media',
        error instanceof Error
          ? error.message
          : 'Could not open the media library right now.'
      );
    } finally {
      setIsPickerBusy(false);
    }
  }, [composer, isPickerBusy, remainingSlots]);

  const handleRemovePhoto = useCallback(
    (index: number) => {
      composer.removePhotoAt(index);
    },
    [composer]
  );

  const handleNext = useCallback(() => {
    if (!hasContent) {
      Alert.alert('Add text or media to create a recap.');
      return;
    }
    router.push('/recaps/preview');
  }, [hasContent, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <AppScreen style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 22 }]}>
          <Pressable
            style={styles.headerSideButton}
            onPress={handleBack}
            accessibilityLabel="Back"
            accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Recap</Text>
          <Pressable
            style={[
              styles.headerNextButton,
              !hasContent && styles.headerNextButtonDisabled,
            ]}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next"
            accessibilityState={{ disabled: !hasContent }}>
            <Text
              style={[
                styles.headerNextText,
                !hasContent && styles.headerNextTextDisabled,
              ]}>
              Next
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.destinationRow}
            keyboardShouldPersistTaps="handled">
            {DESTINATIONS.map((destination) => {
              const isActive = composer.destination === destination.id;
              return (
                <Pressable
                  key={destination.id}
                  style={[
                    styles.destinationChip,
                    isActive && styles.destinationChipActive,
                  ]}
                  onPress={() => composer.setDestination(destination.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}>
                  <Text
                    style={[
                      styles.destinationChipText,
                      isActive && styles.destinationChipTextActive,
                    ]}>
                    {destination.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.textCard}>
            <TextInput
              value={composer.text}
              onChangeText={composer.setText}
              placeholder="What do you want to recap?"
              placeholderTextColor={theme.textMuted}
              style={styles.textInput}
              multiline
              maxLength={4000}
            />
          </View>

          {mediaCount === 0 ? (
            <Pressable
              style={styles.addPhotosCard}
              onPress={handlePickMedia}
              disabled={isPickerBusy}
              accessibilityRole="button"
              accessibilityLabel="Add media">
              <Text style={styles.addPhotosTitle}>Add Media</Text>
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}
              keyboardShouldPersistTaps="handled">
              {composer.photos.map((item, index) => {
                const aspectRatio =
                  item.width && item.height ? item.width / item.height : 1;
                const tileWidth = Math.max(76, Math.min(190, 132 * aspectRatio));

                return (
                  <View
                    key={`${item.uri}-${index}`}
                    style={[styles.photoTile, { width: tileWidth }]}>
                    {item.mediaType === 'video' ? (
                      <View style={styles.videoTile}>
                        <Ionicons name="play" size={26} color="#ffffff" />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                    )}
                    {item.mediaType === 'video' ? (
                      <View style={styles.mediaTypePill}>
                        <Ionicons name="videocam" size={11} color="#ffffff" />
                      </View>
                    ) : null}
                    <Pressable
                      style={styles.photoRemove}
                      onPress={() => handleRemovePhoto(index)}
                      accessibilityLabel="Remove media"
                      accessibilityRole="button">
                      <Ionicons name="close" size={14} color="#ffffff" />
                    </Pressable>
                  </View>
                );
              })}
              {remainingSlots > 0 ? (
                <Pressable
                  style={styles.addPhotosCard}
                  onPress={handlePickMedia}
                  disabled={isPickerBusy}
                  accessibilityLabel="Add media"
                  accessibilityRole="button">
                  <Text style={styles.addPhotosTitle}>Add Media</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    fill: {
      flex: 1,
    },
    header: {
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    headerSideButton: {
      minWidth: 56,
      height: 38,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    headerNextButton: {
      minWidth: 64,
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerNextButtonDisabled: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      opacity: 0.62,
    },
    headerNextText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    headerNextTextDisabled: {
      color: theme.textMuted,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingBottom: 32,
      gap: 16,
    },
    destinationRow: {
      gap: 8,
      paddingTop: 4,
      paddingBottom: 8,
    },
    destinationChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    destinationChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    destinationChipText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    destinationChipTextActive: {
      color: theme.accentText,
    },
    textCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 56,
    },
    textInput: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 19,
      minHeight: 40,
      maxHeight: 110,
      paddingVertical: 0,
      textAlignVertical: 'top',
    },
    addPhotosCard: {
      alignSelf: 'flex-start',
      width: 92,
      height: 132,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPhotosTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    photoStrip: {
      gap: 10,
      paddingRight: 14,
    },
    photoTile: {
      height: 132,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    videoTile: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    mediaTypePill: {
      position: 'absolute',
      left: 7,
      bottom: 7,
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.62)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    photoRemove: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
  });
