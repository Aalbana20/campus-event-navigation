import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';

import { EventCardSticker } from '@/components/mobile/EventCardSticker';
import { getEventImageUri } from '@/lib/mobile-media';
import { createEventShareStory } from '@/lib/mobile-story-composer';
import {
  createEventStickerTransform,
  EVENT_CARD_WIDTH_FRACTION,
} from '@/lib/mobile-story-stickers';
import { useMobileApp } from '@/providers/mobile-app-provider';

const WINDOW = Dimensions.get('window');

const TOOL_RAIL: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'text', label: 'Text', icon: 'text-outline' },
  { key: 'stickers', label: 'Stickers', icon: 'happy-outline' },
  { key: 'audio', label: 'Audio', icon: 'musical-notes-outline' },
  { key: 'mention', label: 'Mention', icon: 'at-outline' },
  { key: 'draw', label: 'Draw', icon: 'brush-outline' },
  { key: 'download', label: 'Download', icon: 'download-outline' },
  { key: 'more', label: 'More', icon: 'ellipsis-horizontal' },
];

const CENTER_SNAP_THRESHOLD_PX = 8;

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

const angleBetween = (ax: number, ay: number, bx: number, by: number) =>
  Math.atan2(by - ay, bx - ax);

export default function StoryShareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sharedEventId?: string }>();
  const { currentUser, getEventById } = useMobileApp();

  const sharedEventId = typeof params.sharedEventId === 'string' ? params.sharedEventId : null;
  const event = sharedEventId ? getEventById(sharedEventId) : undefined;

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isInteracting, setIsInteracting] = useState(false);
  const [showVerticalGuide, setShowVerticalGuide] = useState(false);
  const [showHorizontalGuide, setShowHorizontalGuide] = useState(false);
  const [toolToast, setToolToast] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Absolute transform state in layout pixels, kept in refs for gesture math.
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  // Refs that always hold the "committed" latest values for saving the
  // transform. Updated on every gesture move so publish can read synchronously.
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const currentScaleRef = useRef(1);
  const currentRotationRef = useRef(0);

  const offsetRef = useRef({ x: 0, y: 0 });
  const baseScaleRef = useRef(1);
  const baseRotationRef = useRef(0);
  const pinchStartDistanceRef = useRef(0);
  const pinchStartAngleRef = useRef(0);
  const activeTouchesRef = useRef(0);

  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashToolToast = useCallback((label: string) => {
    if (toolToastTimerRef.current) clearTimeout(toolToastTimerRef.current);
    setToolToast(`${label} coming soon`);
    toolToastTimerRef.current = setTimeout(() => setToolToast(null), 1400);
  }, []);

  const cardWidth = useMemo(() => {
    const baseWidth = canvasSize.width > 0 ? canvasSize.width : WINDOW.width;
    return baseWidth * EVENT_CARD_WIDTH_FRACTION;
  }, [canvasSize.width]);

  const handleCanvasLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      setCanvasSize({ width, height });
    },
    []
  );

  const updateGuides = useCallback(
    (xPx: number, yPx: number) => {
      if (canvasSize.width === 0 || canvasSize.height === 0) return;
      const centerX = 0;
      const centerY = 0;
      setShowVerticalGuide(Math.abs(xPx - centerX) < CENTER_SNAP_THRESHOLD_PX);
      setShowHorizontalGuide(Math.abs(yPx - centerY) < CENTER_SNAP_THRESHOLD_PX);
    },
    [canvasSize.height, canvasSize.width]
  );

  const endInteraction = useCallback(() => {
    setIsInteracting(false);
    setShowVerticalGuide(false);
    setShowHorizontalGuide(false);
    activeTouchesRef.current = 0;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          setIsInteracting(true);
          translateX.stopAnimation((value) => {
            offsetRef.current.x = value;
          });
          translateY.stopAnimation((value) => {
            offsetRef.current.y = value;
          });
          scale.stopAnimation((value) => {
            baseScaleRef.current = value;
          });
          rotation.stopAnimation((value) => {
            baseRotationRef.current = value;
          });

          const touches = event.nativeEvent.touches;
          activeTouchesRef.current = touches.length;
          if (touches.length >= 2) {
            const [a, b] = touches;
            pinchStartDistanceRef.current = distance(
              a.pageX,
              a.pageY,
              b.pageX,
              b.pageY
            );
            pinchStartAngleRef.current = angleBetween(
              a.pageX,
              a.pageY,
              b.pageX,
              b.pageY
            );
          }
        },
        onPanResponderMove: (
          event: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const [a, b] = touches;
            const currentDistance = distance(a.pageX, a.pageY, b.pageX, b.pageY);
            const currentAngle = angleBetween(a.pageX, a.pageY, b.pageX, b.pageY);

            if (activeTouchesRef.current < 2) {
              // Upgraded from 1 to 2 fingers mid-gesture.
              activeTouchesRef.current = 2;
              pinchStartDistanceRef.current = currentDistance || 1;
              pinchStartAngleRef.current = currentAngle;
            } else {
              const ratio =
                pinchStartDistanceRef.current > 0
                  ? currentDistance / pinchStartDistanceRef.current
                  : 1;
              const nextScale = Math.max(
                0.4,
                Math.min(3.2, baseScaleRef.current * ratio)
              );
              scale.setValue(nextScale);
              currentScaleRef.current = nextScale;

              const angleDelta = currentAngle - pinchStartAngleRef.current;
              const nextRotation = baseRotationRef.current + angleDelta;
              rotation.setValue(nextRotation);
              currentRotationRef.current = nextRotation;
            }
            return;
          }

          activeTouchesRef.current = 1;
          const nextX = offsetRef.current.x + gestureState.dx;
          const nextY = offsetRef.current.y + gestureState.dy;
          translateX.setValue(nextX);
          translateY.setValue(nextY);
          currentXRef.current = nextX;
          currentYRef.current = nextY;
          updateGuides(nextX, nextY);
        },
        onPanResponderRelease: () => {
          // Snap to center if within threshold on either axis.
          const xValue = currentXRef.current;
          const yValue = currentYRef.current;

          if (Math.abs(xValue) < CENTER_SNAP_THRESHOLD_PX) {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              stiffness: 260,
              damping: 22,
            }).start();
            offsetRef.current.x = 0;
            currentXRef.current = 0;
          } else {
            offsetRef.current.x = xValue;
          }

          if (Math.abs(yValue) < CENTER_SNAP_THRESHOLD_PX) {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              stiffness: 260,
              damping: 22,
            }).start();
            offsetRef.current.y = 0;
            currentYRef.current = 0;
          } else {
            offsetRef.current.y = yValue;
          }

          baseScaleRef.current = currentScaleRef.current;
          baseRotationRef.current = currentRotationRef.current;
          endInteraction();
        },
        onPanResponderTerminate: endInteraction,
      }),
    [endInteraction, rotation, scale, translateX, translateY, updateGuides]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const readTransformForSave = useCallback(() => {
    const w = canvasSize.width || WINDOW.width;
    const h = canvasSize.height || WINDOW.height;

    return {
      x: 0.5 + currentXRef.current / w,
      y: 0.46 + currentYRef.current / h,
      scale: currentScaleRef.current,
      rotation: currentRotationRef.current,
    };
  }, [canvasSize.height, canvasSize.width]);

  const handlePost = useCallback(async () => {
    if (!event || !sharedEventId || isPublishing) return;

    setIsPublishing(true);
    try {
      const transform = readTransformForSave();
      await createEventShareStory({
        authorId: currentUser.id,
        eventId: sharedEventId,
        eventImageUrl: event.image || '',
        stickers: [
          {
            type: 'event_card',
            eventId: sharedEventId,
            transform,
          },
        ],
      });
      router.back();
    } catch (error) {
      Alert.alert(
        'Story',
        error instanceof Error ? error.message : 'Could not post your story right now.'
      );
    } finally {
      setIsPublishing(false);
    }
  }, [currentUser.id, event, isPublishing, readTransformForSave, router, sharedEventId]);

  if (!sharedEventId || !event) {
    return (
      <View style={styles.missingScreen}>
        <Text style={styles.missingTitle}>No event selected</Text>
        <Text style={styles.missingCopy}>
          Open the share sheet from an event and tap Add to story.
        </Text>
        <Pressable style={styles.missingButton} onPress={handleClose}>
          <Text style={styles.missingButtonText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const defaultTransform = createEventStickerTransform();
  const backgroundUri = getEventImageUri(event.image);

  return (
    <View style={styles.screen}>
      <View style={styles.canvas} onLayout={handleCanvasLayout}>
        <ExpoImage
          source={{ uri: backgroundUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={60}
        />
        <View style={styles.canvasDim} pointerEvents="none" />

        {canvasSize.width > 0 && canvasSize.height > 0 ? (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.stickerLayer,
              {
                left: canvasSize.width * defaultTransform.x - cardWidth / 2,
                top: canvasSize.height * defaultTransform.y - (cardWidth * 1.2) / 2,
                width: cardWidth,
                height: cardWidth * 1.2,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  {
                    rotate: rotation.interpolate({
                      inputRange: [-Math.PI, Math.PI],
                      outputRange: ['-180deg', '180deg'],
                    }),
                  },
                ],
              },
            ]}>
            <EventCardSticker event={event} width={cardWidth} />
          </Animated.View>
        ) : null}

        {isInteracting && showVerticalGuide ? (
          <View
            pointerEvents="none"
            style={[
              styles.guideVertical,
              { left: canvasSize.width / 2 - 0.5 },
            ]}
          />
        ) : null}

        {isInteracting && showHorizontalGuide ? (
          <View
            pointerEvents="none"
            style={[
              styles.guideHorizontal,
              { top: canvasSize.height / 2 - 0.5 },
            ]}
          />
        ) : null}

        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable style={styles.topIconButton} onPress={handleClose}>
            <Ionicons name="close" size={22} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.toolRail} pointerEvents="box-none">
          {TOOL_RAIL.map((tool) => (
            <Pressable
              key={tool.key}
              style={styles.toolCell}
              onPress={() => flashToolToast(tool.label)}>
              <View style={styles.toolCircle}>
                <Ionicons name={tool.icon} size={18} color="#ffffff" />
              </View>
            </Pressable>
          ))}
        </View>

        {toolToast ? (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>{toolToast}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.postButton, isPublishing && styles.postButtonDisabled]}
          disabled={isPublishing}
          onPress={() => void handlePost()}>
          <Text style={styles.postButtonText}>
            {isPublishing ? 'Posting…' : 'Post to story'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#000000" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#04060a',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#04060a',
  },
  canvasDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  stickerLayer: {
    position: 'absolute',
  },
  guideVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#5ab1ff',
    shadowColor: '#5ab1ff',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  guideHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#5ab1ff',
    shadowColor: '#5ab1ff',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  topBar: {
    position: 'absolute',
    top: 52,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  toolRail: {
    position: 'absolute',
    top: 100,
    right: 10,
    gap: 12,
  },
  toolCell: {
    alignItems: 'center',
  },
  toolCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
    backgroundColor: '#04060a',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  missingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 10,
    backgroundColor: '#04060a',
  },
  missingTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  missingCopy: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  missingButton: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  missingButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
