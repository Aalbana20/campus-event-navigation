import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverStoriesRow } from '@/components/mobile/DiscoverStoriesRow';
import { DiscoverModeSwitch } from '@/components/mobile/DiscoverModeSwitch';
import { EventCommentsSheet, type EventCommentRecord } from '@/components/mobile/EventCommentsSheet';
import { EventMutualsSheet } from '@/components/mobile/EventMutualsSheet';
import { EventStackCard } from '@/components/mobile/EventStackCard';
import { StoryViewerModal } from '@/components/mobile/StoryViewerModal';
import { useAppTheme } from '@/lib/app-theme';
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
import type { EventRecord, ProfileRecord, StoryRecord } from '@/types/models';

export default function DiscoverScreen() {
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
  } = useMobileApp();
  const { sendDmMessage, unreadNotificationCount } = useMobileInbox();

  const translate = useRef(new Animated.ValueXY()).current;
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'friends'>('events');
  const [storyRecords, setStoryRecords] = useState<StoryRecord[]>([]);
  const [seenStoryIds, setSeenStoryIds] = useState<Set<string>>(new Set());
  const [reactedStoryIds, setReactedStoryIds] = useState<Set<string>>(new Set());
  const [isStoryViewerVisible, setIsStoryViewerVisible] = useState(false);
  const [activeStoryItemId, setActiveStoryItemId] = useState<string | null>(null);
  const [authenticatedStoryUserId, setAuthenticatedStoryUserId] = useState('');
  const [savedForLaterIds, setSavedForLaterIds] = useState<Set<string>>(new Set());
  const [activeCommentEvent, setActiveCommentEvent] = useState<EventRecord | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsByEventId, setCommentsByEventId] = useState<Record<string, EventCommentRecord[]>>(
    {}
  );
  const [isMutualsSheetVisible, setIsMutualsSheetVisible] = useState(false);
  const [mutualSheetTitle, setMutualSheetTitle] = useState('');
  const [mutualSheetProfiles, setMutualSheetProfiles] = useState<ProfileRecord[]>([]);

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
    }, [loadStories])
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
  const isCurrentEventSavedForLater = Boolean(
    currentEvent && savedForLaterIds.has(String(currentEvent.id))
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

  const handleCardSaveForLater = useCallback((event: EventRecord) => {
    const eventId = String(event.id);
    setSavedForLaterIds((currentValue) => {
      const nextValue = new Set(currentValue);
      if (nextValue.has(eventId)) {
        nextValue.delete(eventId);
      } else {
        nextValue.add(eventId);
      }
      return nextValue;
    });
  }, []);

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
      .select('id, body, created_at, user_id, profiles(name, username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Unable to load comments:', error);
      return;
    }

    const normalized: EventCommentRecord[] = (data || []).map((row: any) => ({
      id: String(row.id),
      authorName: row.profiles?.name || row.profiles?.username || 'Campus User',
      authorUsername: row.profiles?.username || '',
      body: row.body,
      createdAt: row.created_at,
    }));

    setCommentsByEventId((current) => ({ ...current, [eventId]: normalized }));
  }, []);

  const handleCloseComments = useCallback(() => {
    setActiveCommentEvent(null);
    setCommentDraft('');
  }, []);

  const handleCardComment = useCallback((event: EventRecord) => {
    setActiveCommentEvent(event);
    void loadComments(String(event.id));
  }, [loadComments]);

  const handleSubmitComment = useCallback(async () => {
    if (!supabase || !activeCommentEvent || !commentDraft.trim()) return;

    const eventId = String(activeCommentEvent.id);
    const body = commentDraft.trim();
    const tempId = `temp-${Date.now()}`;

    const optimistic: EventCommentRecord = {
      id: tempId,
      authorName: currentUser.name || currentUser.username || 'Campus User',
      authorUsername: currentUser.username || '',
      body,
      createdAt: new Date().toISOString(),
    };

    setCommentsByEventId((current) => ({
      ...current,
      [eventId]: [...(current[eventId] || []), optimistic],
    }));
    setCommentDraft('');

    const { data, error } = await supabase
      .from('event_comments')
      .insert({ event_id: eventId, user_id: currentUser.id, body })
      .select('id')
      .single();

    if (error) {
      console.error('Unable to save comment:', error);
      setCommentsByEventId((current) => ({
        ...current,
        [eventId]: (current[eventId] || []).filter((c) => c.id !== tempId),
      }));
      return;
    }

    setCommentsByEventId((current) => ({
      ...current,
      [eventId]: (current[eventId] || []).map((c) =>
        c.id === tempId ? { ...c, id: String(data.id) } : c
      ),
    }));
  }, [activeCommentEvent, commentDraft, currentUser.id, currentUser.name, currentUser.username]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          translate.setValue({ x: gestureState.dx, y: gestureState.dy * 0.08 });
        },
        onPanResponderRelease: (_, gestureState) => {
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
      }),
    [animateDismiss, translate]
  );

  const rotation = translate.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  const openNotifications = () => {
    router.push('/inbox');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    await loadStories();
    setRefreshing(false);
  }, [loadStories, refreshData]);

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
    <AppScreen style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textMuted} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <View style={styles.headerActionsLeft}>
            <Pressable style={styles.headerIconButton} onPress={() => router.push('/(tabs)/events?tab=create')}>
              <Ionicons name="add-outline" size={20} color={theme.text} />
            </Pressable>
          </View>

          <DiscoverModeSwitch activeMode={activeTab} onChange={setActiveTab} />

          <View style={styles.headerActions}>
            <Pressable style={styles.headerIconButton} onPress={openNotifications}>
              <Ionicons name="notifications-outline" size={18} color={theme.text} />
              {unreadNotificationCount > 0 ? <View style={styles.headerBadge} /> : null}
            </Pressable>
          </View>
        </View>

        <DiscoverStoriesRow
          items={storyItems}
          onOpenStory={handleOpenStory}
          onOpenSuggestion={() => setActiveTab('friends')}
          onOpenCreateStory={handleOpenCreateStory}
        />

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

        {currentEvent ? (
          <View style={styles.swipeHint}>
            <Ionicons name="swap-horizontal-outline" size={16} color={theme.textMuted} />
            <Text style={styles.swipeHintText}>Swipe left to pass or right to save</Text>
          </View>
        ) : null}
      </ScrollView>

      <EventCommentsSheet
        visible={Boolean(activeCommentEvent)}
        event={activeCommentEvent}
        comments={activeComments}
        draft={commentDraft}
        onChangeDraft={setCommentDraft}
        onClose={handleCloseComments}
        onSubmit={handleSubmitComment}
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
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 2,
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
    cardStage: {
      flex: 1,
      justifyContent: 'flex-start',
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
    swipeHint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 12,
      paddingBottom: 4,
    },
    swipeHintText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
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
  });
