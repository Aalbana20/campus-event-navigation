import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CameraType,
  CameraView,
  FlashMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';

import { useAppTheme } from '@/lib/app-theme';
import { uploadDiscoverPost } from '@/lib/mobile-discover-posts';
import {
  createSelectedStoryMedia,
  pickStoryMediaFromLibrary,
  type SelectedStoryMedia,
  uploadStoryMedia,
} from '@/lib/mobile-story-composer';
import { useMobileApp } from '@/providers/mobile-app-provider';

type ComposerStage = 'camera' | 'preview';
type ComposerMode = 'Post' | 'Story' | 'Event' | 'Live';

const HOLD_TO_RECORD_DELAY_MS = 220;

const MODES: ComposerMode[] = ['Post', 'Story', 'Event', 'Live'];

const resolveInitialMode = (value?: string | string[] | null): ComposerMode => {
  const normalizedValue = String(Array.isArray(value) ? value[0] : value || '').toLowerCase();
  if (normalizedValue === 'post') return 'Post';
  if (normalizedValue === 'event') return 'Event';
  return 'Story';
};

export function StoryComposerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser } = useMobileApp();
  const cameraRef = useRef<CameraView | null>(null);
  const recordHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTriggeredRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [stage, setStage] = useState<ComposerStage>('camera');
  const [activeMode, setActiveMode] = useState<ComposerMode>(() =>
    resolveInitialMode(params.mode)
  );
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [selectedMedia, setSelectedMedia] = useState<SelectedStoryMedia | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [postToGrid, setPostToGrid] = useState(true);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!cameraPermission?.granted && cameraPermission?.canAskAgain) {
      void requestCameraPermission();
    }
  }, [cameraPermission?.canAskAgain, cameraPermission?.granted, requestCameraPermission]);

  useEffect(
    () => () => {
      if (recordHoldTimeoutRef.current) {
        clearTimeout(recordHoldTimeoutRef.current);
      }
    },
    []
  );

  const handleClose = () => {
    router.back();
  };

  const modeLabel = activeMode === 'Post' ? 'Post' : 'Story';

  const handleSwitchMode = (nextMode: ComposerMode) => {
    if (nextMode === activeMode) return;

    if (nextMode === 'Event') {
      router.replace({ pathname: '/(tabs)/events', params: { tab: 'create' } });
      return;
    }

    if (nextMode === 'Live') {
      Alert.alert('Live', 'Live broadcasting is coming soon. Stay tuned.');
      return;
    }

    setActiveMode(nextMode);
  };

  const handleSelectFromLibrary = async () => {
    try {
      const media = await pickStoryMediaFromLibrary();
      if (!media) return;

      setSelectedMedia(media);
      setStage('preview');
      setIsTextEditing(false);
    } catch (error) {
      Alert.alert(
        modeLabel,
        error instanceof Error
          ? error.message
          : 'Could not open your media library right now.'
      );
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      setCameraMode('picture');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: false,
      });

      if (!photo?.uri) return;

      setSelectedMedia(
        createSelectedStoryMedia({
          uri: photo.uri,
          mediaType: 'image',
          fileName: `story-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        })
      );
      setStage('preview');
      setIsTextEditing(false);
    } catch {
      Alert.alert(modeLabel, 'Could not capture a photo right now.');
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      if (!microphonePermission?.granted) {
        const nextPermission = await requestMicrophonePermission();
        if (!nextPermission.granted) {
          Alert.alert(
            'Microphone Access',
            'Allow microphone access to record a story video.'
          );
          recordTriggeredRef.current = false;
          return;
        }
      }

      setCameraMode('video');
      setIsRecording(true);

      const recording = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      if (recording?.uri) {
        setSelectedMedia(
          createSelectedStoryMedia({
            uri: recording.uri,
            mediaType: 'video',
            fileName: `story-${Date.now()}.mp4`,
            mimeType: 'video/mp4',
          })
        );
        setStage('preview');
        setIsTextEditing(false);
      }
    } catch {
      Alert.alert(modeLabel, 'Could not record a video right now.');
    } finally {
      recordTriggeredRef.current = false;
      setIsRecording(false);
      setCameraMode('picture');
    }
  };

  const handleShutterPressIn = () => {
    if (stage !== 'camera') return;

    recordTriggeredRef.current = false;

    if (recordHoldTimeoutRef.current) {
      clearTimeout(recordHoldTimeoutRef.current);
    }

    recordHoldTimeoutRef.current = setTimeout(() => {
      recordTriggeredRef.current = true;
      void handleStartRecording();
    }, HOLD_TO_RECORD_DELAY_MS);
  };

  const handleShutterPressOut = () => {
    if (stage !== 'camera') return;

    if (recordHoldTimeoutRef.current) {
      clearTimeout(recordHoldTimeoutRef.current);
      recordHoldTimeoutRef.current = null;
    }

    if (recordTriggeredRef.current || isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }

    void handleTakePhoto();
  };

  const handleToggleFlash = () => {
    setFlashMode((currentValue) => (currentValue === 'off' ? 'on' : 'off'));
  };

  const handleFlipCamera = () => {
    setCameraFacing((currentValue) => (currentValue === 'back' ? 'front' : 'back'));
  };

  const handleOpenTextTool = () => {
    if (stage !== 'preview') {
      Alert.alert('Text', 'Capture or choose media first, then add text.');
      return;
    }

    setIsTextEditing(true);
  };

  const handleDiscardPreview = () => {
    setStage('camera');
    setSelectedMedia(null);
    setOverlayText('');
    setPostToGrid(true);
    setIsTextEditing(false);
  };

  const handlePublish = async () => {
    if (!selectedMedia || isPublishing) return;

    setIsPublishing(true);

    try {
      if (activeMode === 'Post') {
        await uploadDiscoverPost({
          authorId: currentUser.id,
          media: selectedMedia,
          caption: overlayText,
          onGrid: postToGrid,
        });
      } else {
        await uploadStoryMedia({
          authorId: currentUser.id,
          media: selectedMedia,
          caption: overlayText,
        });
      }

      router.back();
    } catch (error) {
      Alert.alert(
        modeLabel,
        error instanceof Error
          ? error.message
          : `Could not publish your ${modeLabel.toLowerCase()} right now.`
      );
    } finally {
      setIsPublishing(false);
    }
  };

  if (!cameraPermission) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Preparing your camera...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionTitle}>Camera access is needed for stories</Text>
        <Text style={styles.permissionCopy}>
          Allow camera access to capture a photo or record a story video.
        </Text>
        <Pressable style={styles.permissionButton} onPress={() => void requestCameraPermission()}>
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </Pressable>
        <Pressable style={styles.permissionSecondaryButton} onPress={handleSelectFromLibrary}>
          <Text style={styles.permissionSecondaryButtonText}>Choose From Library</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {stage === 'camera' ? (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
            flash={flashMode}
            mode={cameraMode}
            mute={false}
          />

          <View style={styles.topBar}>
            <Pressable style={styles.topIconButton} onPress={handleClose}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </Pressable>

            <View style={styles.topActions}>
              <Pressable style={styles.topIconButton} onPress={handleToggleFlash}>
                <Ionicons
                  name={flashMode === 'off' ? 'flash-off-outline' : 'flash-outline'}
                  size={18}
                  color="#ffffff"
                />
              </Pressable>
              <Pressable
                style={styles.topIconButton}
                onPress={() => Alert.alert('Story', 'More camera settings can come next.')}>
                <Ionicons name="ellipsis-horizontal" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.textToolButton} onPress={handleOpenTextTool}>
            <Text style={styles.textToolLabel}>Aa</Text>
          </Pressable>

          <View style={styles.bottomComposer}>
            <View style={styles.modeBar}>
              {MODES.map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => handleSwitchMode(mode)}
                  style={[
                    styles.modePill,
                    mode === activeMode && styles.modePillActive,
                  ]}>
                  <Text
                    style={[
                      styles.modePillText,
                      mode === activeMode && styles.modePillTextActive,
                    ]}>
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.captureBar}>
              <Pressable style={styles.libraryButton} onPress={() => void handleSelectFromLibrary()}>
                <Ionicons name="images-outline" size={22} color="#ffffff" />
              </Pressable>

              <Pressable
                onPressIn={handleShutterPressIn}
                onPressOut={handleShutterPressOut}
                style={[styles.shutterOuter, isRecording && styles.shutterOuterRecording]}>
                <View style={[styles.shutterInner, isRecording && styles.shutterInnerRecording]} />
              </Pressable>

              <Pressable style={styles.flipButton} onPress={handleFlipCamera}>
                <Ionicons name="camera-reverse-outline" size={22} color="#ffffff" />
              </Pressable>
            </View>

            <Text style={styles.captureHint}>
              Tap for photo. Hold for video.
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.previewStage}>
          {selectedMedia?.mediaType === 'image' ? (
            <Image source={{ uri: selectedMedia.uri }} style={styles.previewMedia} />
          ) : selectedMedia ? (
            <View style={styles.previewVideoFallback}>
              <Ionicons name="videocam" size={48} color="#ffffff" />
              <Text style={styles.previewVideoFallbackText}>Video selected</Text>
            </View>
          ) : null}

          <View style={styles.previewTopBar}>
            <Pressable style={styles.topIconButton} onPress={handleDiscardPreview}>
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
            </Pressable>

            <Pressable
              style={[styles.publishButton, isPublishing && styles.publishButtonDisabled]}
              disabled={isPublishing}
              onPress={() => void handlePublish()}>
              <Text style={styles.publishButtonText}>
                {isPublishing
                  ? activeMode === 'Post'
                    ? 'Posting...'
                    : 'Sharing...'
                  : activeMode === 'Post'
                    ? 'Post'
                    : 'Share'}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.textToolButton} onPress={handleOpenTextTool}>
            <Text style={styles.textToolLabel}>Aa</Text>
          </Pressable>

          {overlayText ? (
            <View style={styles.overlayTextWrap}>
              <Text style={styles.overlayText}>{overlayText}</Text>
            </View>
          ) : null}

          {isTextEditing ? (
            <View style={styles.textInputOverlay}>
              <TextInput
                value={overlayText}
                onChangeText={setOverlayText}
                placeholder="Add text"
                placeholderTextColor="rgba(255,255,255,0.58)"
                style={styles.overlayInput}
                autoFocus
                multiline
                onBlur={() => setIsTextEditing(false)}
              />
            </View>
          ) : null}

          <View style={styles.previewBottomBar}>
            {activeMode === 'Post' ? (
              <Pressable
                style={styles.postToGridToggle}
                onPress={() => setPostToGrid((value) => !value)}>
                <View style={[styles.postToGridCheck, postToGrid && styles.postToGridCheckActive]}>
                  {postToGrid ? (
                    <Ionicons name="checkmark" size={13} color="#04060a" />
                  ) : null}
                </View>
                <View>
                  <Text style={styles.postToGridTitle}>Post to Grid</Text>
                  <Text style={styles.postToGridCopy}>Show this on your profile canvas.</Text>
                </View>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.previewSecondaryButton}
              onPress={() => void handleSelectFromLibrary()}>
              <Ionicons name="images-outline" size={18} color="#ffffff" />
              <Text style={styles.previewSecondaryButtonText}>Replace</Text>
            </Pressable>

            <Pressable
              style={styles.previewPrimaryButton}
              onPress={() => void handlePublish()}>
              <Text style={styles.previewPrimaryButtonText}>
                {activeMode === 'Post' ? 'Publish Post' : 'Post to Story'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#04060a',
    },
    permissionScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      paddingHorizontal: 28,
      gap: 12,
    },
    permissionTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    permissionCopy: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    permissionButton: {
      minWidth: 170,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    permissionButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    permissionSecondaryButton: {
      minWidth: 170,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    permissionSecondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    topBar: {
      position: 'absolute',
      top: 62,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 5,
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    topIconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 7, 12, 0.34)',
    },
    textToolButton: {
      position: 'absolute',
      left: 16,
      top: '36%',
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 7, 12, 0.34)',
      zIndex: 5,
    },
    textToolLabel: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '800',
    },
    bottomComposer: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 26,
      gap: 18,
      zIndex: 5,
    },
    modeBar: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(5, 7, 12, 0.3)',
    },
    modePill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    modePillActive: {
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    modePillText: {
      color: 'rgba(255,255,255,0.62)',
      fontSize: 13,
      fontWeight: '700',
    },
    modePillTextActive: {
      color: '#ffffff',
    },
    captureBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    libraryButton: {
      width: 50,
      height: 50,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 7, 12, 0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    shutterOuter: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 4,
      borderColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    shutterOuterRecording: {
      borderColor: '#ff5a7a',
      backgroundColor: 'rgba(255,90,122,0.18)',
    },
    shutterInner: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: '#ffffff',
    },
    shutterInnerRecording: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#ff5a7a',
    },
    flipButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 7, 12, 0.38)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    captureHint: {
      color: 'rgba(255,255,255,0.76)',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    previewStage: {
      flex: 1,
      backgroundColor: '#04060a',
    },
    previewMedia: {
      width: '100%',
      height: '100%',
    },
    previewVideoFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10141e',
      gap: 12,
    },
    previewVideoFallbackText: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '700',
    },
    previewTopBar: {
      position: 'absolute',
      top: 62,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 6,
    },
    publishButton: {
      minHeight: 42,
      paddingHorizontal: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    publishButtonDisabled: {
      opacity: 0.6,
    },
    publishButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    overlayTextWrap: {
      position: 'absolute',
      left: 24,
      right: 24,
      top: '38%',
      zIndex: 6,
      alignItems: 'center',
    },
    overlayText: {
      color: '#ffffff',
      fontSize: 30,
      fontWeight: '800',
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 10,
    },
    textInputOverlay: {
      position: 'absolute',
      left: 24,
      right: 24,
      top: '34%',
      zIndex: 7,
      alignItems: 'center',
    },
    overlayInput: {
      minHeight: 56,
      maxWidth: '100%',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: 'rgba(5, 7, 12, 0.38)',
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center',
    },
    previewBottomBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 34,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      zIndex: 6,
    },
    postToGridToggle: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: 'rgba(5, 7, 12, 0.48)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    postToGridCheck: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    postToGridCheckActive: {
      backgroundColor: '#ffffff',
      borderColor: '#ffffff',
    },
    postToGridTitle: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },
    postToGridCopy: {
      color: 'rgba(255,255,255,0.64)',
      fontSize: 11,
      marginTop: 2,
    },
    previewSecondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: 'rgba(5, 7, 12, 0.34)',
    },
    previewSecondaryButtonText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    previewPrimaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    },
    previewPrimaryButtonText: {
      color: '#111318',
      fontSize: 14,
      fontWeight: '800',
    },
  });
