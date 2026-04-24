import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { EventCommentsSheet } from '@/components/mobile/EventCommentsSheet';
import { SegmentedToggle } from '@/components/mobile/SegmentedToggle';
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

type VideoPostsView = 'video' | 'posts';

const VIDEO_POSTS_VIEWS: { id: VideoPostsView; label: string }[] = [
  { id: 'video', label: 'Video' },
  { id: 'posts', label: 'Posts' },
];

export default function VideoPostsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const router = useRouter();
  const { currentUser, repostPost } = useMobileApp();
  const { openShareSheet } = useShareSheet();

  const [activeView, setActiveView] = useState<VideoPostsView>('video');
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [activeCommentPost, setActiveCommentPost] = useState<DiscoverPostRecord | null>(null);
  const [postCommentDraft, setPostCommentDraft] = useState('');
  const [postCommentsByPostId, setPostCommentsByPostId] = useState<Record<string, DiscoverPostComment[]>>({});
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

  const visiblePosts = activeView === 'video' ? videoPosts : imagePosts;

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
      isLiked ? next.delete(post.id) : next.add(post.id);
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
      isSaved ? next.delete(post.id) : next.add(post.id);
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
    const postId = activeCommentPost.id;
    const currentlyLiked = (postCommentsByPostId[postId] || []).find((c) => c.id === commentId)?.likedByMe ?? false;
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
    await togglePostCommentLike({ commentId, userId: currentUser.id, isLiked: currentlyLiked });
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
