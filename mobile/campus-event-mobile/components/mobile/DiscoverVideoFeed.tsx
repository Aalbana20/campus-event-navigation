import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import {
  getEventImageSource,
  getEventImageUri,
  isVideoMediaUrl,
} from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DiscoverVideoFeedProps = {
  events: EventRecord[];
  savedIds: Set<string>;
  onPressHeart: (event: EventRecord) => void;
  onPressComment: (event: EventRecord) => void;
  onPressRepost: (event: EventRecord) => void;
  onPressShare: (event: EventRecord) => void;
  onPressCreator?: (event: EventRecord) => void;
};

export function DiscoverVideoFeed({
  events,
  savedIds,
  onPressHeart,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressCreator,
}: DiscoverVideoFeedProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [feedHeight, setFeedHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!events || events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No videos right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={(e) => setFeedHeight(e.nativeEvent.layout.height)}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          if (feedHeight <= 0) return;
          const nextIndex = Math.round(e.nativeEvent.contentOffset.y / feedHeight);
          setActiveIndex(nextIndex);
        }}
        renderItem={({ item, index }) => (
          <DiscoverVideoItem
            event={item}
            height={feedHeight}
            isSaved={savedIds.has(String(item.id))}
            isActive={index === activeIndex}
            onPressHeart={onPressHeart}
            onPressComment={onPressComment}
            onPressRepost={onPressRepost}
            onPressShare={onPressShare}
            onPressCreator={onPressCreator}
            styles={styles}
          />
        )}
      />
    </View>
  );
}

function DiscoverVideoItem({
  event,
  height,
  isSaved,
  isActive,
  onPressHeart,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressCreator,
  styles,
}: {
  event: EventRecord;
  height: number;
  isSaved: boolean;
  isActive: boolean;
  onPressHeart: (event: EventRecord) => void;
  onPressComment: (event: EventRecord) => void;
  onPressRepost: (event: EventRecord) => void;
  onPressShare: (event: EventRecord) => void;
  onPressCreator?: (event: EventRecord) => void;
  styles: any;
}) {
  const rawUri = getEventImageUri(event.image);
  const isVideo = isVideoMediaUrl(event.image);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const videoSource = isVideo ? rawUri : null;
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  React.useEffect(() => {
    if (!isVideo || !player) return;
    if (isActive && !isManuallyPaused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, isManuallyPaused, isVideo, player]);

  const handleTogglePlayback = () => {
    if (!isActive) return;
    setIsManuallyPaused((paused) => !paused);
  };

  return (
    <View style={[{ height, width: '100%' }]}>
      {isVideo ? (
        <View style={styles.media}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            pointerEvents="none"
          />
          <View style={styles.playbackLayer} pointerEvents="box-none">
            <Pressable
              accessibilityLabel={isManuallyPaused ? 'Play video' : 'Pause video'}
              accessibilityRole="button"
              disabled={!isActive}
              onPress={handleTogglePlayback}
              style={styles.playbackHitArea}>
              {isManuallyPaused ? (
                <View style={styles.playbackCenterButton}>
                  <Ionicons name="play" size={34} color="rgba(255,255,255,0.9)" />
                </View>
              ) : null}
            </Pressable>
          </View>
          <View style={styles.gradientOverlay} pointerEvents="none" />
          <DiscoverVideoItemOverlay
            event={event}
            isSaved={isSaved}
            onPressHeart={onPressHeart}
            onPressComment={onPressComment}
            onPressRepost={onPressRepost}
            onPressShare={onPressShare}
          onPressCreator={onPressCreator}
          styles={styles}
        />
        <Pressable
          style={styles.shareHitTarget}
          onPress={() => onPressShare(event)}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Share video"
        />
      </View>
      ) : (
        <ImageBackground
          source={getEventImageSource(event.image)}
          style={styles.media}
          imageStyle={styles.mediaImage}
        >
          <View style={styles.gradientOverlay} />
          <DiscoverVideoItemOverlay
            event={event}
            isSaved={isSaved}
            onPressHeart={onPressHeart}
            onPressComment={onPressComment}
            onPressRepost={onPressRepost}
            onPressShare={onPressShare}
            onPressCreator={onPressCreator}
            styles={styles}
          />
        </ImageBackground>
      )}
    </View>
  );
}

function DiscoverVideoItemOverlay({
  event,
  isSaved,
  onPressHeart,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressCreator,
  styles,
}: {
  event: EventRecord;
  isSaved: boolean;
  onPressHeart: (event: EventRecord) => void;
  onPressComment: (event: EventRecord) => void;
  onPressRepost: (event: EventRecord) => void;
  onPressShare: (event: EventRecord) => void;
  onPressCreator?: (event: EventRecord) => void;
  styles: any;
}) {
  return (
    <>
      {/* Right Social Rail */}
      <View style={styles.rightRail} pointerEvents="box-none">
        <Pressable style={styles.actionButton} onPress={() => onPressHeart(event)}>
          <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={32} color={isSaved ? '#ff3b30' : '#ffffff'} />
          <Text style={styles.actionText}>{isSaved ? '1' : '0'}</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onPressComment(event)}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#ffffff" />
          <Text style={styles.actionText}>0</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onPressRepost(event)}>
          <Ionicons name="repeat" size={32} color="#ffffff" />
          <Text style={styles.actionText}>0</Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => onPressShare(event)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Share video">
          <Ionicons name="paper-plane-outline" size={30} color="#ffffff" />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>

      {/* Bottom Content/Meta Zone */}
      <View style={styles.bottomArea}>
        <Pressable
          style={styles.profileRow}
          onPress={() => onPressCreator?.(event)}
        >
          <View style={styles.avatarContainer}>
            <ProfileAvatarLink
              profile={{
                id: event.createdBy,
                username: event.creatorUsername,
                name: getEventCreatorLabel(event),
                avatar: event.creatorAvatar,
              }}
              style={styles.avatar}
            />
            <View style={styles.followBadge}>
              <Ionicons name="add" size={12} color="#ffffff" />
            </View>
          </View>
          <Text style={styles.creatorName}>{getEventCreatorLabel(event)}</Text>
        </Pressable>

        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
        ) : null}

        <View style={styles.audioRow}>
          <Ionicons name="musical-note" size={14} color="#ffffff" />
          <Text style={styles.audioText} numberOfLines={1}>
            Original Audio - {getEventCreatorLabel(event)}
          </Text>
        </View>
      </View>
    </>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    emptyContainer: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 16,
      fontWeight: '600',
    },
    media: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    mediaImage: {
      resizeMode: 'cover',
    },
    gradientOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playbackLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      right: 92,
    },
    playbackHitArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playbackCenterButton: {
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    rightRail: {
      position: 'absolute',
      right: 12,
      bottom: 90,
      alignItems: 'center',
      gap: 22,
      zIndex: 10,
      elevation: 10,
    },
    actionButton: {
      alignItems: 'center',
      gap: 4,
      zIndex: 20,
      elevation: 20,
    },
    shareHitTarget: {
      position: 'absolute',
      right: 0,
      bottom: 120,
      width: 116,
      height: 156,
      zIndex: 100,
      elevation: 100,
    },
    actionText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    bottomArea: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingRight: 70,
      gap: 12,
      zIndex: 10,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#ffffff',
    },
    followBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: '#ff3b30',
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#ffffff',
    },
    creatorName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    title: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 22,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    description: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      lineHeight: 20,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    audioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      marginTop: 4,
    },
    audioText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
  });
