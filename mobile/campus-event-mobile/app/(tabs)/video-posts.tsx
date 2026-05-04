import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { EventCommentsSheet } from '@/components/mobile/EventCommentsSheet';
import { GlobalCreateMenu, type GlobalCreateOptionKey } from '@/components/mobile/GlobalCreateMenu';
import { RecapPostCard } from '@/components/mobile/RecapPostCard';
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
import {
  addRecapComment,
  deleteRecapComment,
  loadRecapComments,
  loadRecapFeed,
  toggleRecapLike,
  toggleRecapRepost,
  type BackendRecapComment,
  type BackendRecapPost,
} from '@/lib/mobile-recaps-backend';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useShareSheet } from '@/providers/mobile-share-provider';

type VideoPostsView = 'discover' | 'posts' | 'recaps';
type RecapCategory = 'for-you' | 'trending' | 'umes';

const VIDEO_POSTS_VIEWS: { id: VideoPostsView; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'posts', label: 'Posts' },
  { id: 'recaps', label: 'Recaps' },
];

const RECAP_CATEGORIES: { id: RecapCategory; label: string; emptyText: string }[] = [
  {
    id: 'for-you',
    label: 'For You',
    emptyText: 'No recaps yet.',
  },
  {
    id: 'trending',
    label: 'Trending',
    emptyText: 'No recaps yet.',
  },
  {
    id: 'umes',
    label: 'UMES',
    emptyText: 'No recaps yet.',
  },
];

export default function VideoPostsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const router = useRouter();
  const routeParams = useLocalSearchParams<{ view?: string; recapCategory?: string }>();
  const isScreenFocused = useIsFocused();
  const { currentUser, repostPost } = useMobileApp();
  const { openShareSheet } = useShareSheet();
  const { width: windowWidth } = useWindowDimensions();

  const [activeView, setActiveView] = useState<VideoPostsView>('discover');
  const [activeRecapCategory, setActiveRecapCategory] = useState<RecapCategory>('for-you');
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [recapPosts, setRecapPosts] = useState<BackendRecapPost[]>([]);
  const [isLoadingRecaps, setIsLoadingRecaps] = useState(false);
  const [recapLoadError, setRecapLoadError] = useState<string | null>(null);
  const [activeCommentPost, setActiveCommentPost] = useState<DiscoverPostRecord | null>(null);
  const [activeCommentRecap, setActiveCommentRecap] = useState<BackendRecapPost | null>(null);
  const [postCommentDraft, setPostCommentDraft] = useState('');
  const [recapCommentDraft, setRecapCommentDraft] = useState('');
  const [postCommentsByPostId, setPostCommentsByPostId] = useState<Record<string, DiscoverPostComment[]>>({});
  const [recapCommentsByRecapId, setRecapCommentsByRecapId] = useState<Record<string, BackendRecapComment[]>>({});
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
  const isSubmittingCommentRef = useRef(false);
  const isSubmittingRecapCommentRef = useRef(false);
  const recapCardWidth = Math.max(260, windowWidth - 28);

  useEffect(() => {
    const viewParam = Array.isArray(routeParams.view) ? routeParams.view[0] : routeParams.view;
    const recapCategoryParam = Array.isArray(routeParams.recapCategory)
      ? routeParams.recapCategory[0]
      : routeParams.recapCategory;

    if (viewParam === 'recaps') {
      setActiveView('recaps');
    }

    if (recapCategoryParam === 'for-you' || recapCategoryParam === 'umes') {
      setActiveRecapCategory(recapCategoryParam);
    }
  }, [routeParams.recapCategory, routeParams.view]);

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

  const refreshRecapFeed = useCallback(async () => {
    if (activeView !== 'recaps') return;
    setIsLoadingRecaps(true);
    setRecapLoadError(null);
    try {
      const nextRecaps = await loadRecapFeed({
        category: activeRecapCategory,
        currentUserId: currentUser.id,
      });
      setRecapPosts(nextRecaps);
    } catch (error) {
      console.error('Unable to refresh recap feed:', error);
      setRecapLoadError('Could not load recaps.');
    } finally {
      setIsLoadingRecaps(false);
    }
  }, [activeRecapCategory, activeView, currentUser.id]);

  useEffect(() => {
    if (activeView !== 'recaps' || !isScreenFocused) return;
    void refreshRecapFeed();
  }, [activeView, isScreenFocused, refreshRecapFeed]);

  const videoPosts = useMemo(
    () => posts.filter((post) => post.mediaType === 'video'),
    [posts]
  );
  const imagePosts = useMemo(
    () => posts.filter((post) => post.mediaType !== 'video'),
    [posts]
  );

  const visiblePosts = activeView === 'discover' ? videoPosts : imagePosts;
  const activeRecapCopy =
    RECAP_CATEGORIES.find((category) => category.id === activeRecapCategory)?.emptyText ||
    RECAP_CATEGORIES[0].emptyText;

  const handleToggleRecapLike = useCallback(
    async (recap: BackendRecapPost) => {
      if (!currentUser.id || currentUser.id === 'current-user') return;
      const wasLiked = recap.likedByMe;
      setRecapPosts((prev) =>
        prev.map((item) =>
          item.id === recap.id
            ? {
                ...item,
                likedByMe: !wasLiked,
                likeCount: Math.max(0, item.likeCount + (wasLiked ? -1 : 1)),
              }
            : item
        )
      );

      const ok = await toggleRecapLike({
        recapId: recap.id,
        userId: currentUser.id,
        isLiked: wasLiked,
      });
      if (!ok) {
        console.warn('[recaps] Like kept locally because recap_likes is unavailable.');
      }
    },
    [currentUser.id]
  );

  const handleToggleRecapRepost = useCallback(
    async (recap: BackendRecapPost) => {
      if (!currentUser.id || currentUser.id === 'current-user') return;
      const wasReposted = recap.repostedByMe;
      setRecapPosts((prev) =>
        prev.map((item) =>
          item.id === recap.id
            ? {
                ...item,
                repostedByMe: !wasReposted,
                repostCount: Math.max(0, item.repostCount + (wasReposted ? -1 : 1)),
              }
            : item
        )
      );

      const ok = await toggleRecapRepost({
        recapId: recap.id,
        userId: currentUser.id,
        isReposted: wasReposted,
      });
      if (!ok) {
        console.warn('[recaps] Repost kept locally because recap_reposts is unavailable.');
      }
    },
    [currentUser.id]
  );

  const handleOpenRecapComments = useCallback(
    async (recap: BackendRecapPost) => {
      setActiveCommentRecap(recap);
      const comments = await loadRecapComments(recap.id);
      setRecapCommentsByRecapId((prev) => ({ ...prev, [recap.id]: comments }));
    },
    []
  );

  const handleCloseRecapComments = useCallback(() => {
    setActiveCommentRecap(null);
    setRecapCommentDraft('');
  }, []);

  const handleShareRecap = useCallback((recap: BackendRecapPost) => {
    openShareSheet({ kind: 'recap', recap });
  }, [openShareSheet]);

  const renderBackendRecap = useCallback(
    (recap: BackendRecapPost) => {
      return (
        <RecapPostCard
          key={recap.id}
          width={recapCardWidth}
          creatorName={recap.creatorName}
          creatorUsername={recap.creatorUsername}
          creatorAvatar={recap.creatorAvatar}
          caption={recap.caption}
          photos={recap.photos}
          taggedEvent={recap.taggedEvent}
          likedByMe={recap.likedByMe}
          repostedByMe={recap.repostedByMe}
          onPressCreator={() =>
            router.push({
              pathname: '/recap-profile/[userId]',
              params: { userId: recap.creatorId },
            })
          }
          onPressEvent={
            recap.taggedEvent
              ? () =>
                  router.push({
                    pathname: '/event/[id]',
                    params: { id: recap.taggedEvent?.id || '' },
                  })
              : undefined
          }
          onPressLike={() => void handleToggleRecapLike(recap)}
          onPressComment={() => void handleOpenRecapComments(recap)}
          onPressRepost={() => void handleToggleRecapRepost(recap)}
          onPressShare={() => void handleShareRecap(recap)}
        />
      );
    },
    [
      handleOpenRecapComments,
      handleShareRecap,
      handleToggleRecapLike,
      handleToggleRecapRepost,
      recapCardWidth,
      router,
    ]
  );

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

  const handleSubmitRecapComment = useCallback(async (parentId: string | null = null) => {
    if (!activeCommentRecap || !recapCommentDraft.trim() || isSubmittingRecapCommentRef.current) return;
    if (!currentUser.id || currentUser.id === 'current-user') return;
    isSubmittingRecapCommentRef.current = true;

    const recapId = activeCommentRecap.id;
    const body = recapCommentDraft.trim();
    const tempId = `temp-${Date.now()}`;

    const optimistic: BackendRecapComment = {
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

    setRecapCommentsByRecapId((prev) => ({
      ...prev,
      [recapId]: [...(prev[recapId] || []), optimistic],
    }));
    setRecapPosts((prev) =>
      prev.map((recap) =>
        recap.id === recapId
          ? { ...recap, commentCount: recap.commentCount + 1 }
          : recap
      )
    );
    setRecapCommentDraft('');

    const realId = await addRecapComment({
      recapId,
      userId: currentUser.id,
      body,
      parentId,
    });
    isSubmittingRecapCommentRef.current = false;

    if (!realId) {
      console.warn('[recaps] Comment kept locally because recap_comments is unavailable.');
      return;
    }

    setRecapCommentsByRecapId((prev) => {
      const list = prev[recapId] || [];
      return {
        ...prev,
        [recapId]: list.map((comment) =>
          comment.id === tempId ? { ...comment, id: realId } : comment
        ),
      };
    });
  }, [
    activeCommentRecap,
    currentUser.avatar,
    currentUser.id,
    currentUser.name,
    currentUser.username,
    recapCommentDraft,
  ]);

  const handleDeleteRecapComment = useCallback(async (commentId: string) => {
    if (!activeCommentRecap || !currentUser.id || currentUser.id === 'current-user') return;
    const recapId = activeCommentRecap.id;

    setRecapCommentsByRecapId((prev) => ({
      ...prev,
      [recapId]: (prev[recapId] || []).filter(
        (comment) => comment.id !== commentId && comment.parentId !== commentId
      ),
    }));
    setRecapPosts((prev) =>
      prev.map((recap) =>
        recap.id === recapId
          ? { ...recap, commentCount: Math.max(0, recap.commentCount - 1) }
          : recap
      )
    );

    if (!commentId.startsWith('temp-')) {
      const ok = await deleteRecapComment({ commentId, userId: currentUser.id });
      if (!ok) {
        console.warn('[recaps] Comment delete kept locally because recap_comments is unavailable.');
      }
    }
  }, [activeCommentRecap, currentUser.id]);

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
              onPress={() => router.push('/search')}
              accessibilityLabel="Search"
              accessibilityRole="button">
              <Ionicons name="search-outline" size={26} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {activeView === 'recaps' ? (
          <View style={styles.recapCategoryTabs}>
            <View style={styles.recapCategoryTabsLeft}>
              {RECAP_CATEGORIES.map((category) => {
                const isActive = activeRecapCategory === category.id;
                return (
                  <Pressable
                    key={category.id}
                    style={styles.recapCategoryTab}
                    onPress={() => setActiveRecapCategory(category.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}>
                    <Text
                      style={[
                        styles.recapCategoryTabText,
                        isActive && styles.recapCategoryTabTextActive,
                      ]}>
                      {category.label}
                    </Text>
                    <View
                      style={[
                        styles.recapCategoryUnderline,
                        isActive && styles.recapCategoryUnderlineActive,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={styles.recapAddCommunityButton}
              onPress={() =>
                Alert.alert('Add community', 'Add community coming soon.')
              }
              accessibilityLabel="Add community"
              accessibilityRole="button">
              <Ionicons name="add" size={18} color={theme.text} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.feedContainer}>
        {activeView === 'recaps' ? (
          <>
            <ScrollView
              style={styles.recapsFeed}
              contentContainerStyle={[
                styles.recapsFeedContent,
                recapPosts.length > 0 && styles.recapsFeedContentWithCards,
              ]}
              showsVerticalScrollIndicator={false}>
              {isLoadingRecaps ? (
                <View style={styles.recapsEmptyState}>
                  <Text style={styles.recapsCopy}>Loading recaps...</Text>
                </View>
              ) : recapLoadError ? (
                <View style={styles.recapsEmptyState}>
                  <Ionicons name="alert-circle-outline" size={30} color={theme.textMuted} />
                  <Text style={styles.recapsCopy}>{recapLoadError}</Text>
                </View>
              ) : recapPosts.length > 0 ? (
                recapPosts.map(renderBackendRecap)
              ) : (
                <View style={styles.recapsEmptyState}>
                  <Ionicons name="images-outline" size={30} color={theme.textMuted} />
                  <Text style={styles.recapsCopy}>{activeRecapCopy}</Text>
                </View>
              )}
            </ScrollView>

            <Pressable
              style={styles.recapCreateFab}
              onPress={() => router.push('/recaps/create')}
              accessibilityLabel="Create recap"
              accessibilityRole="button">
              <Ionicons name="add" size={26} color="#ffffff" />
            </Pressable>
          </>
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

      <EventCommentsSheet
        visible={Boolean(activeCommentRecap)}
        event={null}
        title={activeCommentRecap?.caption?.trim() || `Recap by @${activeCommentRecap?.creatorUsername || 'campus'}`}
        comments={activeCommentRecap ? (recapCommentsByRecapId[activeCommentRecap.id] || []) : []}
        draft={recapCommentDraft}
        currentUserId={currentUser.id}
        onChangeDraft={setRecapCommentDraft}
        onClose={handleCloseRecapComments}
        onSubmit={handleSubmitRecapComment}
        onDeleteComment={handleDeleteRecapComment}
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
      paddingBottom: 0,
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
      fontSize: 16,
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
    recapCategoryTabs: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingTop: 2,
      paddingBottom: 0,
      paddingHorizontal: 2,
    },
    recapCategoryTabsLeft: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 18,
    },
    recapCategoryTab: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      paddingHorizontal: 2,
    },
    recapAddCommunityButton: {
      width: 32,
      height: 32,
      marginBottom: 2,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    recapCategoryTabText: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 13,
      fontWeight: '500',
    },
    recapCategoryTabTextActive: {
      color: theme.text,
    },
    recapCategoryUnderline: {
      width: 28,
      height: 2,
      borderRadius: 999,
      backgroundColor: 'transparent',
    },
    recapCategoryUnderlineActive: {
      backgroundColor: theme.accent,
    },
    feedContainer: {
      flex: 1,
    },
    recapsFeed: {
      flex: 1,
      backgroundColor: theme.background,
    },
    recapsFeedContent: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 38,
      paddingBottom: 120,
    },
    recapsFeedContentWithCards: {
      paddingHorizontal: 14,
      paddingTop: 14,
      gap: 14,
    },
    recapsEmptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 14,
    },
    recapsCopy: {
      color: theme.textMuted,
      fontSize: 16,
      lineHeight: 23,
      fontWeight: '800',
      textAlign: 'center',
    },
    recapCreateFab: {
      position: 'absolute',
      right: 18,
      bottom: 24,
      width: 52,
      height: 52,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 6,
    },
  });
