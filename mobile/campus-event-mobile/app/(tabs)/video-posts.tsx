import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { SegmentedToggle } from '@/components/mobile/SegmentedToggle';
import { useAppTheme } from '@/lib/app-theme';
import {
  loadDiscoverPosts,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import { useMobileApp } from '@/providers/mobile-app-provider';

// TODO(db follow-up): when the backend separates videos from image posts
// into distinct tables (e.g. `discover_videos` vs `discover_posts`), replace
// the frontend `mediaType` filter below with targeted queries per view.
type VideoPostsView = 'video' | 'posts';

const VIDEO_POSTS_VIEWS: { id: VideoPostsView; label: string }[] = [
  { id: 'video', label: 'Video' },
  { id: 'posts', label: 'Posts' },
];

export default function VideoPostsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const router = useRouter();
  const { currentUser } = useMobileApp();

  const [activeView, setActiveView] = useState<VideoPostsView>('video');
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadDiscoverPosts().then((next) => {
      if (!cancelled) setPosts(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const videoPosts = useMemo(
    () => posts.filter((post) => post.mediaType === 'video'),
    [posts]
  );
  const imagePosts = useMemo(
    () => posts.filter((post) => post.mediaType !== 'video'),
    [posts]
  );

  const visiblePosts = activeView === 'video' ? videoPosts : imagePosts;

  const handleOpenPostAuthor = useCallback(
    (post: DiscoverPostRecord) => {
      if (!post.authorUsername) return;
      if (post.authorUsername === currentUser.username) {
        router.push('/(tabs)/profile');
        return;
      }
      router.push({
        pathname: '/profile/[username]',
        params: { username: post.authorUsername },
      });
    },
    [currentUser.username, router]
  );

  return (
    <AppScreen style={styles.root}>
      <View style={styles.toggleBar}>
        <SegmentedToggle
          options={VIDEO_POSTS_VIEWS}
          value={activeView}
          onChange={setActiveView}
          width={220}
        />
      </View>

      <View style={styles.feedContainer}>
        <DiscoverPostsImmersiveFeed
          posts={visiblePosts}
          onPressCreator={handleOpenPostAuthor}
          onPressLike={(post) => Alert.alert('Like', `Liked ${post.id}`)}
          onPressComment={(post) => Alert.alert('Comment', `Comment on ${post.id}`)}
          onPressRepost={(post) => Alert.alert('Repost', `Reposted ${post.id}`)}
          onPressShare={(post) => Alert.alert('Share', `Shared ${post.id}`)}
        />
      </View>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    toggleBar: {
      paddingTop: 8,
      paddingBottom: 8,
      paddingHorizontal: 16,
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    feedContainer: {
      flex: 1,
    },
  });
