import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { DiscoverPostRecord } from '@/lib/mobile-discover-posts';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DiscoverPostsImmersiveFeedProps = {
  posts: DiscoverPostRecord[];
  onPressLike: (post: DiscoverPostRecord) => void;
  onPressComment: (post: DiscoverPostRecord) => void;
  onPressRepost: (post: DiscoverPostRecord) => void;
  onPressShare: (post: DiscoverPostRecord) => void;
  onPressSave?: (post: DiscoverPostRecord) => void;
  onPressCreator?: (post: DiscoverPostRecord) => void;
  currentUserId?: string;
  onDeletePost?: (post: DiscoverPostRecord) => void | Promise<void>;
  likedPostIds?: Set<string>;
  savedPostIds?: Set<string>;
  isScreenFocused?: boolean;
};

export function DiscoverPostsImmersiveFeed({
  posts,
  onPressLike,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressSave,
  onPressCreator,
  currentUserId,
  onDeletePost,
  likedPostIds,
  savedPostIds,
  isScreenFocused = true,
}: DiscoverPostsImmersiveFeedProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [feedHeight, setFeedHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!posts || posts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No videos right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={(e) => setFeedHeight(e.nativeEvent.layout.height)}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={({ viewableItems }) => {
          if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            setActiveIndex(viewableItems[0].index);
          }
        }}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        renderItem={({ item, index }) => (
          <DiscoverPostItem
            post={item}
            height={feedHeight}
            isActive={index === activeIndex}
            onPressLike={onPressLike}
            onPressComment={onPressComment}
            onPressRepost={onPressRepost}
            onPressShare={onPressShare}
            onPressSave={onPressSave}
            onPressCreator={onPressCreator}
            currentUserId={currentUserId}
            onDeletePost={onDeletePost}
            isLiked={likedPostIds?.has(item.id) ?? false}
            isSaved={savedPostIds?.has(item.id) ?? false}
            isScreenFocused={isScreenFocused}
            styles={styles}
          />
        )}
      />
    </View>
  );
}

function DiscoverPostItem({
  post,
  height,
  isActive,
  onPressLike,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressSave,
  onPressCreator,
  currentUserId,
  onDeletePost,
  isLiked,
  isSaved,
  isScreenFocused,
  styles,
}: {
  post: DiscoverPostRecord;
  height: number;
  isActive: boolean;
  onPressLike: (post: DiscoverPostRecord) => void;
  onPressComment: (post: DiscoverPostRecord) => void;
  onPressRepost: (post: DiscoverPostRecord) => void;
  onPressShare: (post: DiscoverPostRecord) => void;
  onPressSave?: (post: DiscoverPostRecord) => void;
  onPressCreator?: (post: DiscoverPostRecord) => void;
  currentUserId?: string;
  onDeletePost?: (post: DiscoverPostRecord) => void | Promise<void>;
  isLiked: boolean;
  isSaved: boolean;
  isScreenFocused: boolean;
  styles: any;
}) {
  const isVideo = post.mediaType === 'video';
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  // Only hand a real source to the player when the item is the active one in
  // the feed; this avoids spinning up video decoders for every card on mount.
  const videoSource = isVideo && isActive && isScreenFocused ? post.mediaUrl : null;
  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  React.useEffect(() => {
    if (!isVideo || !player) return;
    if (isActive && isScreenFocused && !isManuallyPaused) {
      player.play();
    } else {
      player.pause();
      if (!isActive || !isScreenFocused) {
        player.currentTime = 0;
      }
    }
  }, [isActive, isManuallyPaused, isScreenFocused, isVideo, player]);

  const handleTogglePlayback = () => {
    if (!isActive || !isScreenFocused) return;
    setIsManuallyPaused((paused) => !paused);
  };

  const posterUri = post.thumbnailUrl || (isVideo ? undefined : post.mediaUrl);

  return (
    <View style={[{ height, width: '100%' }]}>
      <View style={styles.media}>
        {isVideo ? (
          <>
            {posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}
            {isActive ? (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
                pointerEvents="none"
              />
            ) : null}
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
          </>
        ) : (
          <Image
            source={{ uri: post.mediaUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}
        <View style={styles.gradientOverlay} pointerEvents="none" />
        <DiscoverPostItemOverlay
          post={post}
          onPressLike={onPressLike}
          onPressComment={onPressComment}
          onPressRepost={onPressRepost}
          onPressShare={onPressShare}
          onPressSave={onPressSave}
          onPressCreator={onPressCreator}
          currentUserId={currentUserId}
          onDeletePost={onDeletePost}
          isLiked={isLiked}
          isSaved={isSaved}
          styles={styles}
        />
        <Pressable
          style={styles.shareHitTarget}
          onPress={() => onPressShare(post)}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Share video or post"
        />
      </View>
    </View>
  );
}

function DiscoverPostItemOverlay({
  post,
  onPressLike,
  onPressComment,
  onPressRepost,
  onPressShare,
  onPressSave,
  onPressCreator,
  currentUserId,
  onDeletePost,
  isLiked,
  isSaved,
  styles,
}: {
  post: DiscoverPostRecord;
  onPressLike: (post: DiscoverPostRecord) => void;
  onPressComment: (post: DiscoverPostRecord) => void;
  onPressRepost: (post: DiscoverPostRecord) => void;
  onPressShare: (post: DiscoverPostRecord) => void;
  onPressSave?: (post: DiscoverPostRecord) => void;
  onPressCreator?: (post: DiscoverPostRecord) => void;
  currentUserId?: string;
  onDeletePost?: (post: DiscoverPostRecord) => void | Promise<void>;
  isLiked: boolean;
  isSaved: boolean;
  styles: any;
}) {
  const isOwner =
    Boolean(currentUserId) && String(currentUserId) === String(post.authorId);
  const canShowMenu = isOwner && Boolean(onDeletePost);

  const handleOpenPostMenu = () => {
    if (!canShowMenu) return;
    Alert.alert(
      'Delete post?',
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDeletePost!(post);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handlePressShare = () => {
    onPressShare(post);
  };

  return (
    <>
      {/* Right Social Rail */}
      <View style={styles.rightRail} pointerEvents="box-none">
        <Pressable style={styles.actionButton} onPress={() => onPressLike(post)}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={32} color={isLiked ? '#ff3b30' : '#ffffff'} />
          <Text style={styles.actionText}>{post.likeCount}</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onPressComment(post)}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#ffffff" />
          <Text style={styles.actionText}>0</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => onPressSave?.(post)}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={30} color={isSaved ? '#facc15' : '#ffffff'} />
          <Text style={[styles.actionText, isSaved && styles.actionTextSaved]}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={handlePressShare}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Share video or post">
          <Ionicons name="paper-plane-outline" size={30} color="#ffffff" />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>

        {canShowMenu ? (
          <Pressable
            style={styles.actionButton}
            onPress={handleOpenPostMenu}
            accessibilityLabel="Post options">
            <Ionicons name="ellipsis-horizontal" size={30} color="#ffffff" />
          </Pressable>
        ) : null}
      </View>

      {/* Bottom Content/Meta Zone */}
      <View style={styles.bottomArea}>
        <Pressable
          style={styles.profileRow}
          onPress={() => onPressCreator?.(post)}
        >
          <ProfileAvatarLink
            profile={{
              id: post.authorId,
              username: post.authorUsername,
              name: post.authorName,
              avatar: post.authorAvatar,
            }}
            style={styles.avatar}
          />
          <Text style={styles.creatorName}>{post.authorName}</Text>
        </Pressable>

        {post.caption ? (
          <Text style={styles.description} numberOfLines={3}>{post.caption}</Text>
        ) : null}

        <View style={styles.audioRow}>
          <Ionicons name="musical-note" size={14} color="#ffffff" />
          <Text style={styles.audioText} numberOfLines={1}>
            Original Audio - {post.authorName}
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
    shareHitTarget: {
      position: 'absolute',
      right: 0,
      bottom: 120,
      width: 116,
      height: 156,
      zIndex: 100,
      elevation: 100,
    },
    actionButton: {
      alignItems: 'center',
      gap: 4,
      zIndex: 20,
      elevation: 20,
    },
    actionText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    actionTextSaved: {
      color: '#facc15',
    },
    bottomArea: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingRight: 80,
      gap: 12,
      zIndex: 10,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
