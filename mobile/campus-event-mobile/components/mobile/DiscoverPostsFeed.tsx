import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { formatRelativeTime } from '@/lib/mobile-backend';
import type { DiscoverPostRecord } from '@/lib/mobile-discover-posts';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DiscoverPostsFeedProps = {
  posts: DiscoverPostRecord[];
  onPressAuthor: (post: DiscoverPostRecord) => void;
  onPressShare?: (post: DiscoverPostRecord) => void;
};

export function DiscoverPostsFeed({
  posts,
  onPressAuthor,
  onPressShare,
}: DiscoverPostsFeedProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  if (!posts || posts.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No posts in Discover yet.</Text>
        <Text style={styles.emptyCopy}>
          Share a photo or video from the create screen to start the feed.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.feedContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Posts</Text>
        <Text style={styles.sectionCopy}>Latest from people on campus</Text>
      </View>

      {posts.map((post) => (
        <DiscoverPostCard
          key={post.id}
          post={post}
          onPressAuthor={onPressAuthor}
          onPressShare={onPressShare}
          styles={styles}
        />
      ))}
    </View>
  );
}

function DiscoverPostCard({
  post,
  onPressAuthor,
  onPressShare,
  styles,
}: {
  post: DiscoverPostRecord;
  onPressAuthor: (post: DiscoverPostRecord) => void;
  onPressShare?: (post: DiscoverPostRecord) => void;
  styles: ReturnType<typeof buildStyles>;
}) {
  const isVideo = post.mediaType === 'video';
  const player = useVideoPlayer(isVideo ? post.mediaUrl : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  const relativeTime = formatRelativeTime(post.createdAt);

  return (
    <View style={styles.postCard}>
      <Pressable style={styles.authorRow} onPress={() => onPressAuthor(post)}>
        <ProfileAvatarLink
          profile={{
            id: post.authorId,
            username: post.authorUsername,
            name: post.authorName,
            avatar: post.authorAvatar,
          }}
          style={styles.authorAvatar}
        />
        <View style={styles.authorCopy}>
          <Text style={styles.authorName} numberOfLines={1}>
            {post.authorName}
          </Text>
          {post.authorUsername ? (
            <Text style={styles.authorUsername} numberOfLines={1}>
              @{post.authorUsername}
              {relativeTime ? ` · ${relativeTime}` : ''}
            </Text>
          ) : relativeTime ? (
            <Text style={styles.authorUsername}>{relativeTime}</Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.mediaWrap}>
        {isVideo ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
          />
        ) : (
          <Image
            source={{ uri: post.mediaUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}
      </View>

      {post.caption ? (
        <Text style={styles.caption} numberOfLines={3}>
          {post.caption}
        </Text>
      ) : null}

      {onPressShare ? (
        <View style={styles.actionRow}>
          <Pressable
            style={styles.shareButton}
            onPress={() => onPressShare(post)}
            accessibilityRole="button"
            accessibilityLabel="Share post">
            <Ionicons name="paper-plane-outline" size={18} color="#ffffff" />
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    feedContainer: {
      marginTop: 18,
      gap: 18,
    },
    sectionHeader: {
      gap: 2,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    sectionCopy: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    postCard: {
      borderRadius: 26,
      padding: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    authorAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    authorCopy: {
      flex: 1,
      minWidth: 0,
    },
    authorName: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    authorUsername: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    mediaWrap: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
    },
    caption: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 19,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    shareButtonText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    emptyCard: {
      marginTop: 18,
      padding: 22,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
