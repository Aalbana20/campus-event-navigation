import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { sendPushToUser } from '@/lib/mobile-push';
import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { DiscoverStoriesRow } from '@/components/mobile/DiscoverStoriesRow';
import { DiscoverModeSwitch } from '@/components/mobile/DiscoverModeSwitch';
import { EventCommentsSheet, type EventCommentRecord } from '@/components/mobile/EventCommentsSheet';
import { EventMutualsSheet } from '@/components/mobile/EventMutualsSheet';
import { EventStackCard } from '@/components/mobile/EventStackCard';
import { StoryViewerModal } from '@/components/mobile/StoryViewerModal';
import { useAppTheme } from '@/lib/app-theme';
import {
  deleteDiscoverPost,
  loadDiscoverPosts,
  loadLikedPostIds,
  togglePostLike,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import {
  buildMobileStoryStripItems,
  buildStoryReplyMessage,
  buildStoryShareMessage,
  createStoryShare,
  fetchStoryViewers,
  loadActiveStoryRecords,
  loadAuthenticatedStoryUserId,
  loadReactedStoryIds,
  recordStoryView,
  toggleStoryHeart,
} from '@/lib/mobile-stories';
import { supabase } from '@/lib/supabase';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';
import { useShareSheet } from '@/providers/mobile-share-provider';
import type { EventRecord, ProfileRecord, StoryRecord } from '@/types/models';

type DiscoverScreenProps = {
  hideModeSwitch?: boolean;
  initialMode?: 'events' | 'friends';
  embedded?: boolean;
};

export default function DiscoverScreen({
  hideModeSwitch = false,
  initialMode = 'events',
  embedded = false,
}: DiscoverScreenProps = {}) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { width, height } = useWindowDimensions();
  const {
    currentUser,
    followingProfiles,
    profiles,
    events,
    savedEventIds,
    discoverDismissedIds,
    acceptDiscoverEvent,
    rejectDiscoverEvent,
    resetDiscoverDeck,
    refreshData,
    getProfileById,
    recentDmPeople,
    repostEvent,
    toggleSaveEvent,
  } = useMobileApp();
  const { sendDmMessage, unreadNotificationCount } = useMobileInbox();

  const translate = useRef(new Animated.ValueXY()).current;
  const storiesScrollY = useRef(new Animated.Value(0)).current;
  const isSubmittingCommentRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'friends'>(initialMode || 'events');
  const [storyRecords, setStoryRecords] = useState<StoryRecord[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<DiscoverPostRecord[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [seenStoryIds, setSeenStoryIds] = useState<Set<string>>(new Set());
  const [reactedStoryIds, setReactedStoryIds] = useState<Set<string>>(new Set());
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);
  const [activeStoryItemId, setActiveStoryItemId] = useState<string | null>(null);
  const [authenticatedStoryUserId, setAuthenticatedStoryUserId] = useState('');
  const [activeCommentEvent, setActiveCommentEvent] = useState<EventRecord | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsByEventId, setCommentsByEventId] = useState<Record<string, EventCommentRecord[]>>(
    {}
  );
  const [isMutualsSheetVisible, setIsMutualsSheetVisible] = useState(false);
  const [mutualSheetTitle, setMutualSheetTitle] = useState('');
  const [mutualSheetProfiles, setMutualSheetProfiles] = useState<ProfileRecord[]>([]);
  const [storiesMeasuredHeight, setStoriesMeasuredHeight] = useState(112);

  const loadPosts = useCallback(async () => {
    const [nextPosts, nextLikedIds] = await Promise.all([
      loadDiscoverPosts({ onData: (posts) => setDiscoverPosts(posts) }),
      loadLikedPostIds(currentUser.id),
    ]);
    setDiscoverPosts(nextPosts);
    setLikedPostIds(nextLikedIds);
  }, [currentUser.id]);

  const loadStories = useCallback(async () => {
    const nextStories = await loadActiveStoryRecords({
      currentUser,
      getProfileById,
    });
    const storyUserId = (await loadAuthenticatedStoryUserId()) || currentUser.id;

    setStoryRecords(nextStories);
    setAuthenticatedStoryUserId(storyUserId);

    const nextReactionIds = await loadReactedStoryIds({
      userId: storyUserId,
      storyIds: nextStories.map((story) => story.id),
    });

    setReactedStoryIds(nextReactionIds);
  }, [currentUser, getProfileById]);

  useFocusEffect(
    useCallback(() => {
      void loadStories();
      void loadPosts();
    }, [loadPosts, loadStories])
  );

  const handleOpenCreateStory = useCallback(() => {
    router.push('/story/create');
  }, [router]);

  const storyItems = useMemo(
    () =>
      buildMobileStoryStripItems({
        currentUser,
        storyRecords,
        followingProfiles,
        profiles,
        events,
        seenStoryIds,
      }),
    [currentUser, events, followingProfiles, profiles, seenStoryIds, storyRecords]
  );

  const discoverEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          !savedEventIds.includes(event.id) &&
          !discoverDismissedIds.includes(event.id)
      ),
    [discoverDismissedIds, events, savedEventIds]
  );

  const currentEvent = discoverEvents[0];
  const cardHeight = Math.max(540, Math.min(height * 0.76, 760));
  const isCurrentEventRsvped = Boolean(currentEvent && savedEventIds.includes(currentEvent.id));
  const savedEventIdSet = useMemo(() => new Set(savedEventIds), [savedEventIds]);
  const isCurrentEventSavedForLater = Boolean(
    currentEvent && savedEventIdSet.has(String(currentEvent.id))
  );
  const activeCommentEventId = activeCommentEvent?.id || '';
  const activeComments = activeCommentEventId
    ? commentsByEventId[activeCommentEventId] || []
    : [];

  useEffect(() => {
    translate.setValue({ x: 0, y: 0 });
  }, [currentEvent?.id, translate]);

  const animateDismiss = useCallback((direction: 'left' | 'right') => {
    if (!currentEvent) return;

    Animated.timing(translate, {
      toValue: { x: direction === 'right' ? width * 1.18 : -width * 1.18, y: 0 },
      duration: 210,
      useNativeDriver: false,
    }).start(() => {
      if (direction === 'right') {
        acceptDiscoverEvent(currentEvent.id);
      } else {
        rejectDiscoverEvent(currentEvent.id);
      }

      translate.setValue({ x: 0, y: 0 });
    });
  }, [acceptDiscoverEvent, currentEvent, rejectDiscoverEvent, translate, width]);

  const handleCardRsvp = useCallback(
    (event: EventRecord) => {
      if (!currentEvent || String(event.id) !== String(currentEvent.id)) return;
      animateDismiss('right');
    },
    [animateDismiss, currentEvent]
  );

  const handleCardSaveForLater = useCallback(
    (event: EventRecord) => {
      void toggleSaveEvent(String(event.id));
    },
    [toggleSaveEvent]
  );

  const { openShareSheet } = useShareSheet();

  const handleCardShare = useCallback(
    (event: EventRecord) => {
      openShareSheet({ kind: 'event', event });
    },
    [openShareSheet]
  );

  const handleOpenMutuals = useCallback((event: EventRecord, mutualProfiles: ProfileRecord[]) => {
    setMutualSheetTitle(event.title || 'Campus Event');
    setMutualSheetProfiles(mutualProfiles);
    setIsMutualsSheetVisible(true);
  }, []);

  const handleCloseMutuals = useCallback(() => {
    setIsMutualsSheetVisible(false);
  }, []);

  const loadComments = useCallback(async (eventId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('event_comments')
      .select('id, body, created_at, user_id, parent_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Unable to load comments:', error);
      return;
    }

    const rows = data || [];
    const commentIds = rows.map((row: any) => String(row.id));
    const authorIds = [
      ...new Set(
        rows
          .map((row: any) => row.user_id)
          .filter(Boolean)
          .map((v: any) => String(v))
      ),
    ];

    const profileById = new Map<string, any>();
    if (authorIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', authorIds);

      if (profileError) {
        console.warn('Unable to load comment author profiles:', profileError);
      } else {
        (profileRows || []).forEach((row: any) => {
          profileById.set(String(row.id), row);
        });
      }
    }

    const likeCountByComment = new Map<string, number>();
    const likedByMe = new Set<string>();

    if (commentIds.length > 0) {
      const { data: likeRows, error: likeError } = await supabase
        .from('event_comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds);

      if (likeError) {
        console.warn('Unable to load comment likes:', likeError);
      } else {
        (likeRows || []).forEach((row: any) => {
          const cid = String(row.comment_id);
          likeCountByComment.set(cid, (likeCountByComment.get(cid) || 0) + 1);
          if (String(row.user_id) === String(currentUser.id)) {
            likedByMe.add(cid);
          }
        });
      }
    }

    setCommentsByEventId((current) => {
      const normalized: EventCommentRecord[] = rows.map((row: any) => {
        const id = String(row.id);
        const authorId = row.user_id ? String(row.user_id) : undefined;
        const profile = authorId ? profileById.get(authorId) : undefined;
        return {
          id,
          authorName: profile?.name || profile?.username || 'Campus User',
          authorUsername: profile?.username || '',
          authorAvatar: profile?.avatar_url || '',
          authorId,
          body: row.body,
          createdAt: row.created_at,
          likeCount: likeCountByComment.get(id) || 0,
          likedByMe: likedByMe.has(id),
          parentId: row.parent_id || null,
        };
      });

      const pendingOptimistic = (current[eventId] || []).filter((c) =>
        c.id.startsWith('temp-')
      );

      return { ...current, [eventId]: [...normalized, ...pendingOptimistic] };
    });
  }, [currentUser.id]);

  const handleToggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!activeCommentEvent || !supabase || !currentUser.id || currentUser.id === 'current-user') return;
      const eventId = String(activeCommentEvent.id);

      let nextLikedState = false;

      setCommentsByEventId((current) => {
        const forEvent = current[eventId] || [];
        return {
          ...current,
          [eventId]: forEvent.map((comment) => {
            if (comment.id !== commentId) return comment;
            const nextLiked = !comment.likedByMe;
            nextLikedState = nextLiked;
            return {
              ...comment,
              likedByMe: nextLiked,
              likeCount: Math.max((comment.likeCount ?? 0) + (nextLiked ? 1 : -1), 0),
            };
          }),
        };
      });

      if (commentId.startsWith('temp-')) return;

      const { error } = nextLikedState
        ? await supabase
            .from('event_comment_likes')
            .insert({ comment_id: commentId, user_id: currentUser.id })
        : await supabase
            .from('event_comment_likes')
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', currentUser.id);

      if (error && error.code !== '23505') {
        console.warn('Unable to persist comment like:', error);
        setCommentsByEventId((current) => {
          const forEvent = current[eventId] || [];
          return {
            ...current,
            [eventId]: forEvent.map((comment) => {
              if (comment.id !== commentId) return comment;
              if (comment.likedByMe !== nextLikedState) return comment;
              const revertLiked = !nextLikedState;
              return {
                ...comment,
                likedByMe: revertLiked,
                likeCount: Math.max((comment.likeCount ?? 0) + (revertLiked ? 1 : -1), 0),
              };
            }),
          };
        });
      }
    },
    [activeCommentEvent, currentUser.id]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!activeCommentEvent || !supabase) return;
      const eventId = String(activeCommentEvent.id);

      setCommentsByEventId((current) => ({
        ...current,
        [eventId]: (current[eventId] || []).filter(
          (c) => c.id !== commentId && c.parentId !== commentId
        ),
      }));

      if (commentId.startsWith('temp-')) return;

      const { error } = await supabase
        .from('event_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUser.id);

      if (error) {
        console.warn('Unable to delete comment:', error);
        void loadComments(eventId);
      }
    },
    [activeCommentEvent, currentUser.id, loadComments]
  );

  const handleCloseComments = useCallback(() => {
    setActiveCommentEvent(null);
    setCommentDraft('');
  }, []);

  const handleCardComment = useCallback((event: EventRecord) => {
    setActiveCommentEvent(event);
    void loadComments(String(event.id));
  }, [loadComments]);

  const handleSubmitComment = useCallback(async (parentId: string | null = null) => {
    if (!supabase || !activeCommentEvent || !commentDraft.trim() || isSubmittingCommentRef.current) return;
    if (!currentUser.id || currentUser.id === 'current-user') return;
    isSubmittingCommentRef.current = true;

    const eventId = String(activeCommentEvent.id);
    const body = commentDraft.trim();
    const tempId = `temp-${Date.now()}`;

    const optimistic: EventCommentRecord = {
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

    setCommentsByEventId((current) => ({
      ...current,
      [eventId]: [...(current[eventId] || []), optimistic],
    }));
    setCommentDraft('');

    const { data, error } = await supabase
      .from('event_comments')
      .insert({ event_id: eventId, user_id: currentUser.id, body, parent_id: parentId })
      .select('id')
      .single();

    if (error) {
      console.error('Unable to save comment:', error);
      setCommentsByEventId((current) => ({
        ...current,
        [eventId]: (current[eventId] || []).filter((c) => c.id !== tempId),
      }));
      isSubmittingCommentRef.current = false;
      return;
    }

    setCommentsByEventId((current) => {
      const list = current[eventId] || [];
      const realId = String(data.id);
      const hasOptimistic = list.some((c) => c.id === tempId);
      const alreadyHasReal = list.some((c) => c.id === realId);

      let nextList: EventCommentRecord[];
      if (hasOptimistic) {
        nextList = list.map((c) =>
          c.id === tempId ? { ...c, id: realId } : c
        );
      } else if (alreadyHasReal) {
        nextList = list;
      } else {
        nextList = [...list, { ...optimistic, id: realId }];
      }

      return { ...current, [eventId]: nextList };
    });
    isSubmittingCommentRef.current = false;

    // Notify the event creator
    if (activeCommentEvent.createdBy && activeCommentEvent.createdBy !== currentUser.id) {
      void sendPushToUser(
        activeCommentEvent.createdBy,
        'New comment',
        `${currentUser.name || currentUser.username} commented on ${activeCommentEvent.title}`
      );
    }
  }, [activeCommentEvent, commentDraft, currentUser.id, currentUser.name, currentUser.username]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => setScrollEnabled(false),
        onPanResponderMove: (_, gestureState) => {
          translate.setValue({ x: gestureState.dx, y: gestureState.dy * 0.08 });
        },
        onPanResponderRelease: (_, gestureState) => {
          setScrollEnabled(true);
          if (gestureState.dx > 92) {
            animateDismiss('right');
            return;
          }

          if (gestureState.dx < -92) {
            animateDismiss('left');
            return;
          }

          Animated.spring(translate, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 7,
          }).start();
        },
        onPanResponderTerminate: () => setScrollEnabled(true),
      }),
    [animateDismiss, translate]
  );

  const rotation = translate.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  const storiesCollapseDistance = 78;
  const storySectionHeight = storiesScrollY.interpolate({
    inputRange: [-56, 0, storiesCollapseDistance],
    outputRange: [storiesMeasuredHeight + 18, storiesMeasuredHeight, 0],
    extrapolate: 'clamp',
  });
  const storySectionTranslateY = storiesScrollY.interpolate({
    inputRange: [-56, 0, storiesCollapseDistance],
    outputRange: [10, 0, -18],
    extrapolate: 'clamp',
  });
  const storySectionOpacity = storiesScrollY.interpolate({
    inputRange: [0, storiesCollapseDistance * 0.58, storiesCollapseDistance],
    outputRange: [1, 0.45, 0],
    extrapolate: 'clamp',
  });
  const storySectionMarginBottom = storiesScrollY.interpolate({
    inputRange: [0, storiesCollapseDistance],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });
  const handleStoriesLayout = useCallback(({ nativeEvent }: { nativeEvent: { layout: { height: number } } }) => {
    const nextHeight = Math.ceil(nativeEvent.layout.height);
    if (nextHeight > 0 && Math.abs(nextHeight - storiesMeasuredHeight) > 1) {
      setStoriesMeasuredHeight(nextHeight);
    }
  }, [storiesMeasuredHeight]);

  const openNotifications = () => {
    router.push('/inbox');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    await loadStories();
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts, loadStories, refreshData]);

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

  const handleOpenStory = useCallback((item: { id: string; stories: StoryRecord[] }) => {
    if (!item.stories.length) return;
    setActiveStoryItemId(item.id);
    setIsStoryViewerVisible(true);
  }, []);

  const handleCloseStoryViewer = useCallback(() => {
    setIsStoryViewerVisible(false);
    setActiveStoryItemId(null);
  }, []);

  const effectiveStoryUserId = authenticatedStoryUserId || currentUser.id;

  const handleStoryOpen = useCallback(
    (story: StoryRecord) => {
      if (!story || !effectiveStoryUserId || String(story.authorId) === String(effectiveStoryUserId)) {
        return;
      }

      console.log('[Discover.handleStoryOpen] currentUser.id:', currentUser.id);

      setSeenStoryIds((currentIds) => {
        if (currentIds.has(String(story.id))) return currentIds;

        const nextIds = new Set(currentIds);
        nextIds.add(String(story.id));
        return nextIds;
      });

      void recordStoryView({
        storyId: story.id,
      });
    },
    [effectiveStoryUserId]
  );

  const handleToggleStoryHeart = useCallback(
    async (story: StoryRecord) => {
      if (!effectiveStoryUserId) return;

      const isActive = reactedStoryIds.has(String(story.id));

      setReactedStoryIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (isActive) {
          nextIds.delete(String(story.id));
        } else {
          nextIds.add(String(story.id));
        }

        return nextIds;
      });

      try {
        await toggleStoryHeart({
          storyId: story.id,
          userId: effectiveStoryUserId,
          nextActive: !isActive,
        });
      } catch {
        setReactedStoryIds((currentIds) => {
          const nextIds = new Set(currentIds);

          if (isActive) {
            nextIds.add(String(story.id));
          } else {
            nextIds.delete(String(story.id));
          }

          return nextIds;
        });

        throw new Error('Unable to update story heart');
      }
    },
    [effectiveStoryUserId, reactedStoryIds]
  );

  const handleReplyToStory = useCallback(
    async (story: StoryRecord, message: string) => {
      await sendDmMessage(story.authorId, buildStoryReplyMessage(story, message));
    },
    [sendDmMessage]
  );

  const handleShareStory = useCallback(
    async (story: StoryRecord, recipient: ProfileRecord) => {
      if (!effectiveStoryUserId) return;

      await createStoryShare({
        storyId: story.id,
        senderId: effectiveStoryUserId,
        recipientId: recipient.id,
      });

      await sendDmMessage(recipient.id, buildStoryShareMessage(story));
    },
    [effectiveStoryUserId, sendDmMessage]
  );

  const handleLoadViewers = useCallback(
    async (story: StoryRecord) =>
      fetchStoryViewers({
        storyId: story.id,
        getProfileById,
      }),
    [getProfileById]
  );

  return (
    <AppScreen
      style={[styles.safeArea, activeTab === 'friends' && { backgroundColor: '#000' }]}
      edges={embedded ? [] : ['top']}
    >
      {activeTab === 'friends' && !hideModeSwitch ? (
        <View style={[styles.headerBar, styles.headerBarAbsolute]}>
          <View style={styles.headerActionsLeft}>
            <Pressable style={[styles.headerIconButton, styles.glassyIconButton]} onPress={() => router.push('/story/create')}>
              <Ionicons name="add-outline" size={20} color="#ffffff" />
            </Pressable>
          </View>

          <DiscoverModeSwitch activeMode={activeTab} onChange={setActiveTab} isDark={true} />

          <View style={styles.headerActions}>
            <Pressable style={[styles.headerIconButton, styles.glassyIconButton]} onPress={openNotifications}>
              <Ionicons name="notifications-outline" size={18} color="#ffffff" />
              {unreadNotificationCount > 0 ? <View style={styles.headerBadge} /> : null}
            </Pressable>
          </View>
        </View>
      ) : null}
      {activeTab === 'events' ? (
        <Animated.ScrollView
          scrollEnabled={scrollEnabled}
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textMuted} />}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: storiesScrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {!(embedded && hideModeSwitch) ? (
            <View style={styles.headerBar}>
              <View style={styles.headerActionsLeft}>
                <Pressable style={styles.headerIconButton} onPress={() => router.push('/story/create')}>
                  <Ionicons name="add-outline" size={20} color={theme.text} />
                </Pressable>
              </View>

              {!hideModeSwitch ? (
                <DiscoverModeSwitch activeMode={activeTab} onChange={setActiveTab} isDark={false} />
              ) : (
                <View style={{ flex: 1 }} />
              )}

              <View style={styles.headerActions}>
                <Pressable style={styles.headerIconButton} onPress={openNotifications}>
                  <Ionicons name="notifications-outline" size={18} color={theme.text} />
                  {unreadNotificationCount > 0 ? <View style={styles.headerBadge} /> : null}
                </Pressable>
              </View>
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.storiesReveal,
              {
                height: storySectionHeight,
                marginBottom: storySectionMarginBottom,
                opacity: storySectionOpacity,
                transform: [{ translateY: storySectionTranslateY }],
              },
            ]}>
            <View onLayout={handleStoriesLayout}>
              <DiscoverStoriesRow
                items={storyItems}
                onOpenStory={handleOpenStory}
                onOpenSuggestion={() => setActiveTab('friends')}
                onOpenCreateStory={handleOpenCreateStory}
              />
            </View>
          </Animated.View>

          <View style={styles.cardStage}>
          {currentEvent ? (
            <View style={[styles.cardDeck, { minHeight: cardHeight + 22 }]}>
              <View style={[styles.cardBackdrop, { height: cardHeight - 18 }]} />

              <Animated.View
                style={[
                  styles.animatedCard,
                  {
                    transform: [
                      { translateX: translate.x },
                      { translateY: translate.y },
                      { rotate: rotation },
                    ],
                  },
                ]}
                {...panResponder.panHandlers}>
                <EventStackCard
                  event={currentEvent}
                  height={cardHeight}
                  isRsvped={isCurrentEventRsvped}
                  isSavedForLater={isCurrentEventSavedForLater}
                  onPressRsvp={handleCardRsvp}
                  onPressComment={handleCardComment}
                  onPressSave={handleCardSaveForLater}
                  onPressShare={handleCardShare}
                  onPressMutuals={handleOpenMutuals}
                  onPress={() =>
                    router.push({
                      pathname: '/event/[id]',
                      params: { id: currentEvent.id },
                    })
                  }
                />
              </Animated.View>
            </View>
          ) : (
            <View style={[styles.endState, { minHeight: cardHeight - 12 }]}>
              <Text style={styles.endTitle}>You made it to the end.</Text>
              <Text style={styles.endCopy}>
                Accepted and rejected events have moved out of your stack for now.
              </Text>
              <Pressable style={styles.resetButton} onPress={resetDiscoverDeck}>
                <Text style={styles.resetButtonText}>Reload Discover</Text>
              </Pressable>
            </View>
          )}
          </View>

        </Animated.ScrollView>
      ) : (
        <View style={styles.videoFeedContainer}>
          <DiscoverPostsImmersiveFeed
            posts={discoverPosts}
            likedPostIds={likedPostIds}
            onPressCreator={handleOpenPostAuthor}
            onPressLike={(post) => {
              const isLiked = likedPostIds.has(post.id);
              setLikedPostIds((prev) => {
                const next = new Set(prev);
                isLiked ? next.delete(post.id) : next.add(post.id);
                return next;
              });
              setDiscoverPosts((prev) =>
                prev.map((p) =>
                  p.id === post.id
                    ? { ...p, likeCount: Math.max(0, p.likeCount + (isLiked ? -1 : 1)) }
                    : p
                )
              );
              void togglePostLike({ postId: post.id, userId: currentUser.id, isLiked });
            }}
            onPressComment={(post) => Alert.alert('Comment', `Comment on ${post.id}`)}
            onPressRepost={(post) => Alert.alert('Repost', `Reposted ${post.id}`)}
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
                setDiscoverPosts((prev) => prev.filter((p) => p.id !== post.id));
              } catch (error) {
                Alert.alert(
                  'Could not delete',
                  error instanceof Error
                    ? error.message
                    : 'Please try again in a moment.'
                );
              }
            }}
          />
        </View>
      )}

      <EventCommentsSheet
        visible={Boolean(activeCommentEvent)}
        event={activeCommentEvent}
        comments={activeComments}
        draft={commentDraft}
        currentUserId={currentUser.id}
        onChangeDraft={setCommentDraft}
        onClose={handleCloseComments}
        onSubmit={handleSubmitComment}
        onToggleLike={handleToggleCommentLike}
        onDeleteComment={handleDeleteComment}
      />

      <EventMutualsSheet
        visible={isMutualsSheetVisible}
        title={mutualSheetTitle}
        profiles={mutualSheetProfiles}
        onClose={handleCloseMutuals}
      />

      <StoryViewerModal
        visible={isStoryViewerVisible}
        items={storyItems}
        initialItemId={activeStoryItemId}
        currentUserId={effectiveStoryUserId}
        followingProfiles={followingProfiles}
        recentDmPeople={recentDmPeople}
        reactedStoryIds={reactedStoryIds}
        onClose={handleCloseStoryViewer}
        onStoryOpen={handleStoryOpen}
        onToggleHeart={handleToggleStoryHeart}
        onReplyToStory={handleReplyToStory}
        onShareStory={handleShareStory}
        onLoadViewers={handleLoadViewers}
      />
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 12,
      backgroundColor: theme.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
    },
  headerActionsLeft: {
      width: 40,
    alignItems: 'flex-start',
    },
    headerActions: {
      width: 40,
      alignItems: 'flex-end',
    },
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerBadge: {
      position: 'absolute',
      top: 11,
      right: 11,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.success,
    },
    headerBarAbsolute: {
      position: 'absolute',
      top: 54,
      left: 16,
      right: 16,
      zIndex: 100,
    },
    glassyIconButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    cardStage: {
      justifyContent: 'flex-start',
      paddingTop: 10,
    },
    storiesReveal: {
      overflow: 'hidden',
    },
    cardDeck: {
      justifyContent: 'flex-start',
    },
    cardBackdrop: {
      position: 'absolute',
      left: 10,
      right: 10,
      top: 16,
      borderRadius: 30,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      opacity: 0.9,
      transform: [{ scale: 0.985 }],
    },
    animatedCard: {
      width: '100%',
    },
    endState: {
      padding: 24,
      borderRadius: 30,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    endTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    endCopy: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    resetButton: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    resetButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    videoFeedContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
  });
