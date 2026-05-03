import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { EventCommentsSheet } from '@/components/mobile/EventCommentsSheet';
import { GlobalCreateMenu, type GlobalCreateOptionKey } from '@/components/mobile/GlobalCreateMenu';
import { useAppTheme } from '@/lib/app-theme';
import {
  addPostComment,
  deleteDiscoverPost,
  deletePostComment,
  loadDiscoverPosts,
  loadLikedPostIds,
  loadPostComments,
  loadSavedPostIds,
  togglePostCommentLike,
  togglePostLike,
  togglePostSave,
  type DiscoverPostComment,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useShareSheet } from '@/providers/mobile-share-provider';

type VideoPostsView = 'discover' | 'posts' | 'recaps';

const VIDEO_POSTS_VIEWS: { id: VideoPostsView; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'posts', label: 'Posts' },
  { id: 'recaps', label: 'Recaps' },
];

export default function VideoPostsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const { currentUser, repostPost } = useMobileApp();
  const { openShareSheet } = useShareSheet();

  const [activeView, setActiveView] = useState<VideoPostsView>('discover');
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [activeCommentPost, setActiveCommentPost] = useState<DiscoverPostRecord | null>(null);
  const [postCommentDraft, setPostCommentDraft] = useState('');
  const [postCommentsByPostId, setPostCommentsByPostId] = useState<Record<string, DiscoverPostComment[]>>({});
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const isSubmittingCommentRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadDiscoverPosts({
        currentUserId: currentUser.id,
        onData: (next) => { if (!cancelled) setPosts(next); },
      }),
      loadLikedPostIds(currentUser.id),
      loadSavedPostIds(currentUser.id),
    ]).then(([nextPosts, nextLikedIds, nextSavedIds]) => {
      if (!cancelled) {
        setPosts(nextPosts);
        setLikedPostIds(nextLikedIds);
        setSavedPostIds(nextSavedIds);
      }
    });
    return () => { cancelled = true; };
  }, [currentUser.id]);

  const videoPosts = useMemo(
    () => posts.filter((post) => post.mediaType === 'video'),
    [posts]
  );
  const imagePosts = useMemo(
    () => posts.filter((post) => post.mediaType !== 'video'),
    [posts]
  );

  const visiblePosts = activeView === 'discover' ? videoPosts : imagePosts;

  const handleCreateOption = useCallback((option: GlobalCreateOptionKey) => {
    setIsCreateMenuVisible(false);

    if (option === 'post') {
      router.push({ pathname: '/story/create', params: { mode: 'post' } });
      return;
    }

    if (option === 'story') {
      router.push({ pathname: '/story/create', params: { mode: 'story' } });
      return;
    }

    router.push('/create-event');
  }, [router]);

  const handleOpenPostAuthor = useCallback(
    (post: DiscoverPostRecord) => {
      if (!post.authorUsername) return;
      if (post.authorUsername === currentUser.username) {
        router.push('/(tabs)/profile');
        return;
      }
      router.push({ pathname: '/profile/[username]', params: { username: post.authorUsername } });
    },
    [currentUser.username, router]
  );

  const handleLike = useCallback((post: DiscoverPostRecord) => {
    const isLiked = likedPostIds.has(post.id);
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (isLiked) {
        next.delete(post.id);
      } else {
        next.add(post.id);
      }
      return next;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likeCount: Math.max(0, p.likeCount + (isLiked ? -1 : 1)) }
          : p
      )
    );
    void togglePostLike({ postId: post.id, userId: currentUser.id, isLiked });
  }, [currentUser.id, likedPostIds]);

  const handleSavePost = useCallback((post: DiscoverPostRecord) => {
    if (!currentUser.id || currentUser.id === 'current-user') return;
    const isSaved = savedPostIds.has(post.id);
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(post.id);
      } else {
        next.add(post.id);
      }
      return next;
    });
    void togglePostSave({ postId: post.id, userId: currentUser.id, isSaved });
  }, [currentUser.id, savedPostIds]);

  const handleOpenComments = useCallback(async (post: DiscoverPostRecord) => {
    setActiveCommentPost(post);
    const comments = await loadPostComments(post.id, currentUser.id);
    setPostCommentsByPostId((prev) => ({ ...prev, [post.id]: comments }));
  }, [currentUser.id]);

  const handleCloseComments = useCallback(() => {
    setActiveCommentPost(null);
    setPostCommentDraft('');
  }, []);

  const handleSubmitComment = useCallback(async (parentId: string | null = null) => {
    if (!activeCommentPost || !postCommentDraft.trim() || isSubmittingCommentRef.current) return;
    if (!currentUser.id || currentUser.id === 'current-user') return;
    isSubmittingCommentRef.current = true;

    const postId = activeCommentPost.id;
    const body = postCommentDraft.trim();
    const tempId = `temp-${Date.now()}`;

    const optimistic: DiscoverPostComment = {
      id: tempId,
      authorName: currentUser.name || currentUser.username || 'Campus User',
      authorUsername: currentUser.username || '',
      authorAvatar: currentUser.avatar || '',
      authorId: currentUser.id,
      body,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
      parentId,
    };

    setPostCommentsByPostId((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }));
    setPostCommentDraft('');

    const realId = await addPostComment({ postId, userId: currentUser.id, body, parentId });
    isSubmittingCommentRef.current = false;

    if (!realId) {
      setPostCommentsByPostId((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== tempId),
      }));
      return;
    }

    setPostCommentsByPostId((prev) => {
      const list = prev[postId] || [];
      return { ...prev, [postId]: list.map((c) => (c.id === tempId ? { ...c, id: realId } : c)) };
    });
  }, [activeCommentPost, currentUser.avatar, currentUser.id, currentUser.name, currentUser.username, postCommentDraft]);

  const handleToggleCommentLike = useCallback(async (commentId: string) => {
    if (!activeCommentPost || !currentUser.id || currentUser.id === 'current-user') return;
    if (commentId.startsWith('temp-')) return;
    const postId = activeCommentPost.id;
    const currentlyLiked = (postCommentsByPostId[postId] || []).find((c) => c.id === commentId)?.likedByMe ?? false;

    // Optimistic flip first.
    setPostCommentsByPostId((prev) => {
      const list = prev[postId] || [];
      return {
        ...prev,
        [postId]: list.map((c) => {
          if (c.id !== commentId) return c;
          const nextLiked = !c.likedByMe;
          return { ...c, likedByMe: nextLiked, likeCount: Math.max(0, c.likeCount + (nextLiked ? 1 : -1)) };
        }),
      };
    });

    const ok = await togglePostCommentLike({ commentId, userId: currentUser.id, isLiked: currentlyLiked });
    if (ok) return;

    // Persistence failed — revert the optimistic flip so the UI matches DB.
    setPostCommentsByPostId((prev) => {
      const list = prev[postId] || [];
      return {
        ...prev,
        [postId]: list.map((c) => {
          if (c.id !== commentId) return c;
          return { ...c, likedByMe: currentlyLiked, likeCount: Math.max(0, c.likeCount + (currentlyLiked ? 1 : -1)) };
        }),
      };
    });
  }, [activeCommentPost, currentUser.id, postCommentsByPostId]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!activeCommentPost || !currentUser.id || currentUser.id === 'current-user') return;
    const postId = activeCommentPost.id;
    setPostCommentsByPostId((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId && c.parentId !== commentId),
    }));
    if (!commentId.startsWith('temp-')) {
      await deletePostComment({ commentId, userId: currentUser.id });
    }
  }, [activeCommentPost, currentUser.id]);

  return (
    <AppScreen style={styles.root}>
      <View style={styles.headerBar}>
        <View style={styles.topBarRow}>
          <View style={styles.topActionSlot}>
            <Pressable
              style={styles.topActionButton}
              onPress={() => setIsCreateMenuVisible(true)}
              accessibilityLabel="Create"
              accessibilityRole="button">
              <Ionicons name="add-outline" size={28} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.headerTabs}>
            {VIDEO_POSTS_VIEWS.map((view, index) => {
              const isActive = activeView === view.id;
              return (
                <React.Fragment key={view.id}>
                  <Pressable
                    style={styles.headerTab}
                    onPress={() => setActiveView(view.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}>
                    <Text style={[styles.headerTabText, isActive && styles.headerTabTextActive]}>
                      {view.label}
                    </Text>
                  </Pressable>
                  {index < VIDEO_POSTS_VIEWS.length - 1 ? (
                    <Text style={styles.headerTabSeparator}>|</Text>
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>

          <View style={[styles.topActionSlot, styles.topActionSlotRight]}>
            <Pressable
              style={styles.topActionButton}
              onPress={() => router.push('/(tabs)/explore')}
              accessibilityLabel="Search"
              accessibilityRole="button">
              <Ionicons name="search-outline" size={26} color={theme.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.feedContainer}>
        {activeView === 'recaps' ? (
          <View style={styles.recapsPlaceholder}>
            <Text style={styles.recapsTitle}>Recaps</Text>
            <Text style={styles.recapsCopy}>
              Event recap feeds will appear here. For now, open the Recaps timeline.
            </Text>
            <Pressable
              style={styles.recapsButton}
              onPress={() => router.push('/recaps')}
              accessibilityRole="button">
              <Text style={styles.recapsButtonText}>Open Recaps</Text>
            </Pressable>
          </View>
        ) : (
          <DiscoverPostsImmersiveFeed
            posts={visiblePosts}
            likedPostIds={likedPostIds}
            savedPostIds={savedPostIds}
            onPressCreator={handleOpenPostAuthor}
            onPressLike={handleLike}
            onPressSave={handleSavePost}
            onPressComment={handleOpenComments}
            onPressRepost={(post) =>
              void repostPost(String(post.id)).catch(() =>
                Alert.alert('Repost', 'Could not repost right now.')
              )
            }
            onPressShare={(post) =>
              openShareSheet({
                kind: post.mediaType === 'video' ? 'video' : 'post',
                post,
              })
            }
            currentUserId={currentUser.id}
            isScreenFocused={isScreenFocused}
            onDeletePost={async (post) => {
              try {
                await deleteDiscoverPost(post.id);
                setPosts((prev) => prev.filter((p) => p.id !== post.id));
              } catch (error) {
                Alert.alert(
                  'Could not delete',
                  error instanceof Error ? error.message : 'Please try again in a moment.'
                );
              }
            }}
          />
        )}
      </View>

      <EventCommentsSheet
        visible={Boolean(activeCommentPost)}
        event={null}
        title={activeCommentPost?.caption?.trim() || `Post by @${activeCommentPost?.authorUsername || 'campus'}`}
        comments={activeCommentPost ? (postCommentsByPostId[activeCommentPost.id] || []) : []}
        draft={postCommentDraft}
        currentUserId={currentUser.id}
        onChangeDraft={setPostCommentDraft}
        onClose={handleCloseComments}
        onSubmit={handleSubmitComment}
        onToggleLike={handleToggleCommentLike}
        onDeleteComment={handleDeleteComment}
      />

      <GlobalCreateMenu
        visible={isCreateMenuVisible}
        onClose={() => setIsCreateMenuVisible(false)}
        onSelect={handleCreateOption}
      />
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerBar: {
      paddingBottom: 8,
      paddingHorizontal: 14,
      backgroundColor: theme.background,
    },
    topBarRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    topActionSlot: {
      width: 36,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    topActionSlotRight: {
      alignItems: 'flex-end',
    },
    topActionButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
    },
    headerTabs: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTab: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    headerTabText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
    },
    headerTabTextActive: {
      color: theme.accent,
    },
    headerTabSeparator: {
      color: 'rgba(255,255,255,0.32)',
      fontSize: 18,
      fontWeight: '700',
      marginHorizontal: 5,
    },
    feedContainer: {
      flex: 1,
    },
    recapsPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 12,
      backgroundColor: theme.background,
    },
    recapsTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '900',
    },
    recapsCopy: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      textAlign: 'center',
    },
    recapsButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      paddingHorizontal: 18,
      backgroundColor: theme.accent,
    },
    recapsButtonText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '900',
    },
  });
