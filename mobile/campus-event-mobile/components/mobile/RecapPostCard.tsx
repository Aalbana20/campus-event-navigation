import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import type { RecapComposerPhoto } from '@/providers/mobile-recap-composer';

type RecapCardTaggedEvent = {
  id: string;
  title: string;
  image: string;
  date?: string;
  time?: string;
};

type RecapPostCardProps = {
  width: number;
  creatorName: string;
  creatorUsername?: string;
  creatorAvatar?: string;
  caption: string;
  photos: RecapComposerPhoto[];
  taggedEvent?: RecapCardTaggedEvent | null;
  showTagEventButton?: boolean;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  onPressTagEvent?: () => void;
  onPressCreator?: () => void;
  onPressEvent?: () => void;
  onRemoveTaggedEvent?: () => void;
  onPressLike?: () => void;
  onPressComment?: () => void;
  onPressRepost?: () => void;
  onPressShare?: () => void;
};

const FULLSCREEN_DISMISS_THRESHOLD = 120;

const getPhotoAspectRatio = (
  photo: RecapComposerPhoto | undefined,
  loadedAspectRatios: Record<string, number>
) => {
  if (!photo) return 0.75;
  if (photo.width && photo.height && photo.width > 0 && photo.height > 0) {
    return photo.width / photo.height;
  }
  return loadedAspectRatios[photo.uri] || 0.75;
};

const getFittedMediaSize = (maxWidth: number, maxHeight: number, aspectRatio: number) => {
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 0.75;
  const heightAtMaxWidth = maxWidth / safeAspectRatio;

  if (heightAtMaxWidth <= maxHeight) {
    return {
      width: Math.round(maxWidth),
      height: Math.round(heightAtMaxWidth),
    };
  }

  return {
    width: Math.round(maxHeight * safeAspectRatio),
    height: Math.round(maxHeight),
  };
};

const isVideoMedia = (photo: RecapComposerPhoto | undefined) =>
  photo?.mediaType === 'video' || photo?.mimeType?.startsWith('video/');

export function RecapPostCard({
  width,
  creatorName,
  creatorUsername,
  creatorAvatar,
  caption,
  photos,
  taggedEvent,
  showTagEventButton = false,
  likedByMe = false,
  repostedByMe = false,
  onPressTagEvent,
  onPressCreator,
  onPressEvent,
  onRemoveTaggedEvent,
  onPressLike,
  onPressComment,
  onPressRepost,
  onPressShare,
}: RecapPostCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState<number | null>(null);
  const [isFullscreenChromeVisible, setIsFullscreenChromeVisible] = useState(true);
  const [loadedAspectRatios, setLoadedAspectRatios] = useState<Record<string, number>>({});
  const fullscreenTranslateY = useRef(new Animated.Value(0)).current;
  const hasPhotos = photos.length > 0;
  const activePhoto = photos[activePhotoIndex] || photos[0];
  const contentWidth = width - 28;
  const maxMediaHeight = Math.round(
    Math.max(280, Math.min(430, contentWidth * 1.12))
  );
  const activeAspectRatio = getPhotoAspectRatio(activePhoto, loadedAspectRatios);
  const mediaSize = getFittedMediaSize(
    contentWidth,
    maxMediaHeight,
    activeAspectRatio
  );
  const fullscreenPhoto =
    fullscreenPhotoIndex !== null ? photos[fullscreenPhotoIndex] : null;
  const cleanCaption = caption.trim();
  const displayName = creatorName || creatorUsername || 'You';

  const handleOpenFullscreen = useCallback((index: number) => {
    fullscreenTranslateY.setValue(0);
    setFullscreenPhotoIndex(index);
    setIsFullscreenChromeVisible(true);
  }, [fullscreenTranslateY]);

  const handleCloseFullscreen = useCallback(() => {
    fullscreenTranslateY.setValue(0);
    setFullscreenPhotoIndex(null);
    setIsFullscreenChromeVisible(true);
  }, [fullscreenTranslateY]);

  const fullscreenPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const verticalIntent =
            gestureState.dy > 10 &&
            gestureState.dy > Math.abs(gestureState.dx) * 1.35;
          return verticalIntent;
        },
        onPanResponderMove: (_, gestureState) => {
          fullscreenTranslateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldDismiss =
            gestureState.dy > FULLSCREEN_DISMISS_THRESHOLD ||
            gestureState.vy > 1.05;

          if (shouldDismiss) {
            handleCloseFullscreen();
            return;
          }

          Animated.spring(fullscreenTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 90,
            friction: 10,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(fullscreenTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 90,
            friction: 10,
          }).start();
        },
      }),
    [fullscreenTranslateY, handleCloseFullscreen]
  );

  const handlePhotoLoad = (
    uri: string,
    widthValue: number | undefined,
    heightValue: number | undefined
  ) => {
    if (!widthValue || !heightValue || widthValue <= 0 || heightValue <= 0) return;
    const nextAspectRatio = widthValue / heightValue;
    setLoadedAspectRatios((prev) =>
      prev[uri] === nextAspectRatio ? prev : { ...prev, [uri]: nextAspectRatio }
    );
  };

  const onViewableItemsChanged = useRef<
    ((info: { viewableItems: ViewToken[] }) => void) | null
  >(({ viewableItems }) => {
    if (viewableItems.length > 0 && typeof viewableItems[0].index === 'number') {
      setActivePhotoIndex(viewableItems[0].index);
    }
  }).current;

  const renderIdentity = () => (
    <View style={styles.identityRow}>
      <Pressable
        style={styles.creatorCluster}
        onPress={onPressCreator}
        disabled={!onPressCreator}
        accessibilityRole="button"
        accessibilityLabel="Open creator profile">
        <Image
          source={getAvatarImageSource(creatorAvatar)}
          style={styles.avatar}
        />
        <View style={styles.creatorCopy}>
          <Text style={styles.creatorName} numberOfLines={1}>
            {displayName}
          </Text>
          {taggedEvent ? (
            <Text
              style={styles.eventTitle}
              numberOfLines={1}
              onPress={onPressEvent}>
              {taggedEvent.title}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {taggedEvent ? (
        <View style={styles.eventPreviewWrap}>
          <Pressable
            style={styles.eventPreview}
            onPress={onPressEvent}
            disabled={!onPressEvent}
            accessibilityLabel="Tagged event"
            accessibilityRole="button">
            <Image
              source={getEventImageSource(taggedEvent.image)}
              style={styles.eventPreviewImage}
              resizeMode="cover"
            />
          </Pressable>
          {onRemoveTaggedEvent ? (
            <Pressable
              style={styles.eventRemoveButton}
              onPress={onRemoveTaggedEvent}
              accessibilityLabel="Remove event tag"
              accessibilityRole="button">
              <Ionicons name="close" size={11} color="#ffffff" />
            </Pressable>
          ) : null}
        </View>
      ) : showTagEventButton ? (
        <Pressable
          style={styles.tagEventButton}
          onPress={onPressTagEvent}
          accessibilityRole="button">
          <Ionicons name="pricetag-outline" size={14} color="#ffffff" />
          <Text style={styles.tagEventButtonText}>Tag Event</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderActions = () => (
    <View style={styles.actionRow}>
      <Pressable
        style={styles.actionItem}
        onPress={onPressLike}
        disabled={!onPressLike}
        accessibilityRole="button"
        accessibilityLabel={likedByMe ? 'Unlike recap' : 'Like recap'}>
        <Ionicons
          name={likedByMe ? 'heart' : 'heart-outline'}
          size={22}
          color={likedByMe ? theme.accent : theme.text}
        />
      </Pressable>
      <Pressable
        style={styles.actionItem}
        onPress={onPressComment}
        disabled={!onPressComment}
        accessibilityRole="button"
        accessibilityLabel="Comment on recap">
        <Ionicons name="chatbubble-outline" size={22} color={theme.text} />
      </Pressable>
      <Pressable
        style={styles.actionItem}
        onPress={onPressRepost}
        disabled={!onPressRepost}
        accessibilityRole="button"
        accessibilityLabel={repostedByMe ? 'Remove repost' : 'Repost recap'}>
        <Ionicons
          name="repeat-outline"
          size={22}
          color={repostedByMe ? theme.accent : theme.text}
        />
      </Pressable>
      <Pressable
        style={styles.actionItem}
        onPress={onPressShare}
        disabled={!onPressShare}
        accessibilityRole="button"
        accessibilityLabel="Share recap">
        <Ionicons name="paper-plane-outline" size={22} color={theme.text} />
      </Pressable>
    </View>
  );

  if (!hasPhotos) {
    return (
      <View style={[styles.recapCard, { width }]}>
        {renderIdentity()}
        {cleanCaption ? (
          <View style={styles.textOnlyBubble}>
            <Text style={styles.textOnlyCaption}>{cleanCaption}</Text>
          </View>
        ) : null}
        {renderActions()}
      </View>
    );
  }

  return (
    <View style={[styles.recapCard, { width }]}>
      {renderIdentity()}

      <View
        style={[
          styles.mediaWindow,
          { width: mediaSize.width, height: mediaSize.height },
        ]}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 65 }}
          style={{ width: mediaSize.width, height: mediaSize.height }}
          renderItem={({ item, index }) => (
            <Pressable
              style={{ width: mediaSize.width, height: mediaSize.height }}
              onPress={() => handleOpenFullscreen(index)}
              accessibilityRole="button"
              accessibilityLabel="Open recap media fullscreen">
              {isVideoMedia(item) ? (
                <View style={styles.videoPreview}>
                  {item.thumbnailUrl ? (
                    <Image
                      source={{ uri: item.thumbnailUrl }}
                      style={styles.photo}
                      resizeMode="contain"
                    />
                  ) : null}
                  <View style={styles.videoOverlay}>
                    <Ionicons name="play" size={28} color="#ffffff" />
                  </View>
                </View>
              ) : (
                <Image
                  source={{ uri: item.uri }}
                  style={styles.photo}
                  resizeMode="contain"
                  onLoad={(event) =>
                    handlePhotoLoad(
                      item.uri,
                      event.nativeEvent.source.width,
                      event.nativeEvent.source.height
                    )
                  }
                />
              )}
            </Pressable>
          )}
        />

        {photos.length > 1 ? (
          <View style={styles.mediaDotsOverlay}>
            {photos.map((photo, index) => (
              <View
                key={`${photo.uri}-${index}-media-dot`}
                style={[
                  styles.dot,
                  index === activePhotoIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.photoFooter}>
        <View style={styles.bottomPanel}>
          {cleanCaption ? (
            <View style={styles.captionBubble}>
              <Text style={styles.captionText}>{cleanCaption}</Text>
            </View>
          ) : null}
          {renderActions()}
        </View>
      </View>

      <Modal
        transparent
        visible={fullscreenPhotoIndex !== null}
        animationType="fade"
        onRequestClose={handleCloseFullscreen}>
        <Pressable
          style={[
            styles.fullscreenBackdrop,
            { width: windowWidth, height: windowHeight },
          ]}
          onPress={() =>
            setIsFullscreenChromeVisible((isVisible) => !isVisible)
          }>
          <Animated.View
            {...fullscreenPanResponder.panHandlers}
            style={[
              styles.fullscreenMediaLayer,
              { transform: [{ translateY: fullscreenTranslateY }] },
            ]}>
            {fullscreenPhoto && isVideoMedia(fullscreenPhoto) ? (
              <View style={styles.fullscreenVideoPreview}>
                {fullscreenPhoto.thumbnailUrl ? (
                  <Image
                    source={{ uri: fullscreenPhoto.thumbnailUrl }}
                    style={styles.fullscreenImage}
                    resizeMode="contain"
                  />
                ) : null}
                <View style={styles.fullscreenVideoBadge}>
                  <Ionicons name="play" size={34} color="#ffffff" />
                </View>
              </View>
            ) : fullscreenPhoto ? (
              <Image
                source={{ uri: fullscreenPhoto.uri }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            ) : null}
          </Animated.View>

          {isFullscreenChromeVisible ? (
            <>
              <Pressable
                style={styles.fullscreenClose}
                onPress={handleCloseFullscreen}
                accessibilityRole="button"
                accessibilityLabel="Close fullscreen photo">
                <Ionicons name="close" size={22} color="#ffffff" />
              </Pressable>
              <View style={styles.fullscreenBottomPanel}>
                {photos.length > 1 ? (
                  <View style={styles.dotsRow}>
                    {photos.map((photo, index) => (
                      <View
                        key={`${photo.uri}-${index}-fullscreen-dot`}
                        style={[
                          styles.dot,
                          index === fullscreenPhotoIndex && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
                {cleanCaption ? (
                  <View style={styles.captionBubble}>
                    <Text style={styles.captionText}>{cleanCaption}</Text>
                  </View>
                ) : null}
                {renderActions()}
              </View>
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    recapCard: {
      alignSelf: 'center',
      gap: 9,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 8,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    mediaWindow: {
      alignSelf: 'flex-start',
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.09)',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    videoPreview: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    videoOverlay: {
      position: 'absolute',
      width: 58,
      height: 58,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    mediaDotsOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 9,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
      pointerEvents: 'none',
    },
    photoFooter: {
      gap: 4,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    creatorCluster: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surfaceAlt,
    },
    creatorCopy: {
      flex: 1,
      minWidth: 0,
    },
    creatorName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '900',
    },
    eventTitle: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 1,
    },
    eventPreviewWrap: {
      width: 46,
      height: 64,
    },
    eventPreview: {
      flex: 1,
      borderRadius: 13,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    eventPreviewImage: {
      width: '100%',
      height: '100%',
    },
    eventRemoveButton: {
      position: 'absolute',
      top: -7,
      right: -7,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.74)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
    },
    tagEventButton: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    tagEventButtonText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.42)',
    },
    dotActive: {
      width: 18,
      backgroundColor: theme.accent,
    },
    bottomPanel: {
      gap: 6,
    },
    captionBubble: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    captionText: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      gap: 12,
    },
    actionItem: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 26,
    },
    textOnlyBubble: {
      alignSelf: 'stretch',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    textOnlyCaption: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 21,
    },
    fullscreenBackdrop: {
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullscreenImage: {
      width: '100%',
      height: '100%',
    },
    fullscreenVideoPreview: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },
    fullscreenVideoBadge: {
      position: 'absolute',
      width: 70,
      height: 70,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(26,26,28,0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    fullscreenMediaLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullscreenClose: {
      position: 'absolute',
      top: 54,
      right: 20,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(26,26,28,0.78)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    fullscreenBottomPanel: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 34,
      gap: 10,
      padding: 12,
      borderRadius: 18,
      backgroundColor: 'rgba(26,26,28,0.82)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
  });
