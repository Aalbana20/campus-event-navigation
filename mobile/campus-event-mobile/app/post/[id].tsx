import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { EventCommentsSheet } from '@/components/mobile/EventCommentsSheet';
import { useAppTheme } from '@/lib/app-theme';
import {
  addPostComment,
  deleteDiscoverPost,
  deletePostComment,
  loadDiscoverPostsByIds,
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

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id ? String(id) : '';
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { currentUser, repostPost } = useMobileApp();
  const { openShareSheet } = useShareSheet();

  const [post, setPost] = useState<DiscoverPostRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [activeCommentPost, setActiveCommentPost] = useState<DiscoverPostRecord | null>(null);
  const [postCommentDraft, setPostCommentDraft] = useState('');
  const [postComments, setPostComments] = useState<DiscoverPostComment[]>([]);
  const isSubmittingCommentRef = useRef(false);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      loadDiscoverPostsByIds([postId], { currentUserId: currentUser.id }),
      loadLikedPostIds(currentUser.id),
      loadSavedPostIds(currentUser.id),
    ])
      .then(([posts, nextLikedIds, nextSavedIds]) => {
        if (cancelled) return;
        setPost(posts[0] || null);
        setLikedPostIds(nextLikedIds);
        setSavedPostIds(nextSavedIds);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser.id, postId]);

  const handleOpenAuthor = useCallback(
    (target: DiscoverPostRecord) => {
      if (!target.authorUsername) return;
      if (target.authorUsername === currentUser.username) {
        router.push('/(tabs)/profile');
        return;
      }
      router.push({
        pathname: '/profile/[username]',
        params: { username: target.authorUsername },
      });
    },
    [currentUser.username, router]
  );

  const handleLike = useCallback(
    (target: DiscoverPostRecord) => {
      const isLiked = likedPostIds.has(target.id);
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(target.id);
        else next.add(target.id);
        return next;
      });
      setPost((prev) =>
        prev && prev.id === target.id
          ? { ...prev, likeCount: Math.max(0, prev.likeCount + (isLiked ? -1 : 1)) }
          : prev
      );
      void togglePostLike({ postId: target.id, userId: currentUser.id, isLiked });
    },
    [currentUser.id, likedPostIds]
  );

  const handleSave = useCallback(
    (target: DiscoverPostRecord) => {
      if (!currentUser.id || currentUser.id === 'current-user') return;
      const isSaved = savedPostIds.has(target.id);
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(target.id);
        else next.add(target.id);
        return next;
      });
      void togglePostSave({ postId: target.id, userId: currentUser.id, isSaved });
    },
    [currentUser.id, savedPostIds]
  );

  const handleOpenComments = useCallback(
    async (target: DiscoverPostRecord) => {
      setActiveCommentPost(target);
      const comments = await loadPostComments(target.id, currentUser.id);
      setPostComments(comments);
    },
    [currentUser.id]
  );

  const handleCloseComments = useCallback(() => {
    setActiveCommentPost(null);
    setPostCommentDraft('');
  }, []);

  const handleSubmitComment = useCallback(
    async (parentId: string | null = null) => {
      if (!activeCommentPost || !postCommentDraft.trim() || isSubmittingCommentRef.current) return;
      if (!currentUser.id || currentUser.id === 'current-user') return;
      isSubmittingCommentRef.current = true;

      const targetPostId = activeCommentPost.id;
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

      setPostComments((prev) => [...prev, optimistic]);
      setPostCommentDraft('');

      const realId = await addPostComment({ postId: targetPostId, userId: currentUser.id, body, parentId });
      isSubmittingCommentRef.current = false;

      if (!realId) {
        setPostComments((prev) => prev.filter((c) => c.id !== tempId));
        return;
      }

      setPostComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, id: realId } : c))
      );
    },
    [activeCommentPost, currentUser.avatar, currentUser.id, currentUser.name, currentUser.username, postCommentDraft]
  );

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!activeCommentPost || !currentUser.id || currentUser.id === 'current-user') return;
      if (commentId.startsWith('temp-')) return;
      const currentlyLiked = postComments.find((c) => c.id === commentId)?.likedByMe ?? false;

      setPostComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          const nextLiked = !c.likedByMe;
          return { ...c, likedByMe: nextLiked, likeCount: Math.max(0, c.likeCount + (nextLiked ? 1 : -1)) };
        })
      );

      const ok = await togglePostCommentLike({ commentId, userId: currentUser.id, isLiked: currentlyLiked });
      if (ok) return;

      setPostComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          return { ...c, likedByMe: currentlyLiked, likeCount: Math.max(0, c.likeCount + (currentlyLiked ? 1 : -1)) };
        })
      );
    },
    [activeCommentPost, currentUser.id, postComments]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!activeCommentPost || !currentUser.id || currentUser.id === 'current-user') return;
      setPostComments((prev) =>
        prev.filter((c) => c.id !== commentId && c.parentId !== commentId)
      );
      if (!commentId.startsWith('temp-')) {
        await deletePostComment({ commentId, userId: currentUser.id });
      }
    },
    [activeCommentPost, currentUser.id]
  );

  const handleDeletePost = useCallback(
    async (target: DiscoverPostRecord) => {
      try {
        await deleteDiscoverPost(target.id);
        router.back();
      } catch (error) {
        Alert.alert(
          'Could not delete',
          error instanceof Error ? error.message : 'Please try again in a moment.'
        );
      }
    },
    [router]
  );

  const posts = useMemo(() => (post ? [post] : []), [post]);

  return (
    <AppScreen style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {post?.mediaType === 'video' ? 'Video' : 'Post'}
        </Text>
        <View style={styles.backButtonSpacer} />
      </View>

      <View style={styles.feedContainer}>
        {isLoading ? (
          <View style={styles.centeredState}>
            <Text style={styles.centeredText}>Loading...</Text>
          </View>
        ) : !post ? (
          <View style={styles.centeredState}>
            <Text style={styles.centeredText}>This post is no longer available.</Text>
          </View>
        ) : (
          <DiscoverPostsImmersiveFeed
            posts={posts}
            likedPostIds={likedPostIds}
            savedPostIds={savedPostIds}
            onPressCreator={handleOpenAuthor}
            onPressLike={handleLike}
            onPressSave={handleSave}
            onPressComment={handleOpenComments}
            onPressRepost={(target) =>
              void repostPost(String(target.id)).catch(() =>
                Alert.alert('Repost', 'Could not repost right now.')
              )
            }
            onPressShare={(target) =>
              openShareSheet({
                kind: target.mediaType === 'video' ? 'video' : 'post',
                post: target,
              })
            }
            currentUserId={currentUser.id}
            onDeletePost={handleDeletePost}
          />
        )}
      </View>

      <EventCommentsSheet
        visible={Boolean(activeCommentPost)}
        event={null}
        title={
          activeCommentPost?.caption?.trim() ||
          `Post by @${activeCommentPost?.authorUsername || 'campus'}`
        }
        comments={postComments}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: theme.background,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonSpacer: {
      width: 40,
      height: 40,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    feedContainer: {
      flex: 1,
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    centeredText: {
      color: theme.textMuted,
      fontSize: 15,
      textAlign: 'center',
    },
  });
