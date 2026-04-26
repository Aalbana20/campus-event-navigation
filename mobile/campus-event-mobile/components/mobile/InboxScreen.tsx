import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { parseDmMessageForEventShare } from '@/lib/mobile-dm-content';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { loadActiveStoryRecords } from '@/lib/mobile-stories';
import {
  MobileDmThread,
  MobileInboxTab,
  MobileNotification,
  useMobileInbox,
} from '@/providers/mobile-inbox-provider';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord, ProfileRecord } from '@/types/models';

import { AppScreen } from './AppScreen';
import { DmEventPreviewCard } from './DmEventPreviewCard';
import { ExploreEventDetailModal } from './ExploreEventDetailModal';
import { IconSymbol } from '@/components/ui/icon-symbol';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '＋'];
const MESSAGE_MENU_WIDTH = 260;
const THREAD_ACTION_SWIPE_WIDTH = 166;
const NOTIFICATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'following', label: 'People you follow' },
  { key: 'events', label: 'Events' },
  { key: 'comments', label: 'Comments' },
  { key: 'mentions', label: 'Tags & mentions' },
  { key: 'professional', label: 'Professional' },
  { key: 'verified', label: 'Verified' },
] as const;
const DM_FILTERS = ['Primary', 'General', 'Requests'] as const;

type InboxScreenProps = {
  initialTab?: MobileInboxTab;
  lockedTab?: MobileInboxTab;
  showBackButton?: boolean;
  title?: string;
  subtitle?: string;
};

type MenuMessage = {
  id: string;
  sender: 'me' | 'them';
  text: string;
};

type ActiveMessageMenu = {
  message: MenuMessage;
  left: number;
  top: number;
};

type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number]['key'];
type NotificationSection = {
  title: string;
  data: MobileNotification[];
};
type DmFilter = (typeof DM_FILTERS)[number];

const getNotificationCreatedTime = (notification: MobileNotification) => {
  if (!notification.createdAt) return 0;
  const time = new Date(notification.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
};

const getNotificationSectionTitle = (notification: MobileNotification) => {
  const timestamp = getNotificationCreatedTime(notification);
  if (!timestamp) return 'Older';

  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfNotificationDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
  const diffDays = Math.floor((startOfToday - startOfNotificationDay) / 86400000);

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Last 7 days';
  if (diffDays <= 30) return 'Last 30 days';
  return 'Older';
};

const getFilteredNotifications = (
  notifications: MobileNotification[],
  filter: NotificationFilter
) => {
  if (filter === 'all') return notifications;
  if (filter === 'following') {
    return notifications.filter((notification) => notification.category === 'following');
  }
  if (filter === 'events') {
    return notifications.filter((notification) => notification.category === 'events');
  }
  if (filter === 'comments') {
    return notifications.filter((notification) => notification.category === 'comments');
  }
  if (filter === 'mentions') {
    return notifications.filter((notification) => notification.category === 'mentions');
  }

  return [];
};

const isCentralNotification = (notification: MobileNotification) => {
  if (notification.category === 'messages' || notification.type === 'dm_received') {
    return false;
  }

  return !/\b(sent you a message|dm'?d you|messaged you)\b/i.test(notification.text);
};

const buildNotificationSections = (notifications: MobileNotification[]): NotificationSection[] => {
  const orderedTitles = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Older'];
  const grouped = notifications.reduce<Record<string, MobileNotification[]>>((sections, notification) => {
    const title = getNotificationSectionTitle(notification);
    sections[title] = sections[title] || [];
    sections[title].push(notification);
    return sections;
  }, {});

  return orderedTitles
    .map((title) => ({
      title,
      data: (grouped[title] || []).sort(
        (left, right) => getNotificationCreatedTime(right) - getNotificationCreatedTime(left)
      ),
    }))
    .filter((section) => section.data.length > 0);
};

const getActorNameFromText = (notification: MobileNotification) => {
  const splitters = [
    ' followed you',
    ' sent you a message',
    ' liked your story',
    ' liked your post',
    ' commented',
    ' mentioned you',
  ];
  const match = splitters
    .map((splitter) => notification.text.split(splitter)[0])
    .find((value) => value && value !== notification.text);

  return match || notification.username || notification.text;
};

type InboxThreadRowProps = {
  thread: MobileDmThread;
  isUnread: boolean;
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
  isSwipeOpen: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onMute: () => void;
  onDelete: () => void;
};

function InboxThreadRow({
  thread,
  isUnread,
  styles,
  theme,
  isSwipeOpen,
  onPress,
  onLongPress,
  onSwipeOpen,
  onSwipeClose,
  onMute,
  onDelete,
}: InboxThreadRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);

  const animateTo = useCallback((toValue: number, onComplete?: () => void) => {
    offsetRef.current = toValue;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      tension: 180,
      friction: 22,
    }).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  }, [translateX]);

  useEffect(() => {
    animateTo(isSwipeOpen ? -THREAD_ACTION_SWIPE_WIDTH : 0);
  }, [animateTo, isSwipeOpen]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 14 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          translateX.stopAnimation((value) => {
            offsetRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = Math.max(
            -THREAD_ACTION_SWIPE_WIDTH,
            Math.min(0, offsetRef.current + gestureState.dx)
          );
          translateX.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentOffset = offsetRef.current + gestureState.dx;
          const openThreshold = -THREAD_ACTION_SWIPE_WIDTH * 0.4;
          const shouldOpen =
            gestureState.vx < -0.25 ||
            (currentOffset < openThreshold && gestureState.vx < 0.25);

          if (shouldOpen) {
            onSwipeOpen();
            animateTo(-THREAD_ACTION_SWIPE_WIDTH);
            return;
          }

          onSwipeClose();
          animateTo(0);
        },
        onPanResponderTerminate: (_, gestureState) => {
          const currentOffset = offsetRef.current + (gestureState?.dx ?? 0);
          if (currentOffset < -THREAD_ACTION_SWIPE_WIDTH * 0.4) {
            onSwipeOpen();
            animateTo(-THREAD_ACTION_SWIPE_WIDTH);
            return;
          }

          onSwipeClose();
          animateTo(0);
        },
      }),
    [animateTo, onSwipeClose, onSwipeOpen, translateX]
  );

  return (
    <View style={styles.threadSwipeShell}>
      {isSwipeOpen ? (
        <View style={styles.threadQuickActions}>
          <Pressable
            style={[styles.threadQuickActionButton, styles.threadQuickMuteButton]}
            onPress={() => {
              onSwipeClose();
              animateTo(0, onMute);
            }}>
            <Ionicons name="volume-mute-outline" size={20} color="#ffffff" />
            <Text style={styles.threadQuickActionLabel}>Mute</Text>
          </Pressable>
          <Pressable
            style={[styles.threadQuickActionButton, styles.threadQuickDeleteButton]}
            onPress={() => {
              onSwipeClose();
              animateTo(0, onDelete);
            }}>
            <IconSymbol name="trash" size={20} color="#ffffff" />
            <Text style={styles.threadQuickActionLabel}>Delete</Text>
          </Pressable>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.threadSwipeCard,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}>
        <Pressable
          style={[styles.threadCard, isSwipeOpen && styles.threadCardOpen]}
          delayLongPress={240}
          onLongPress={onLongPress}
          onPress={() => {
            if (isSwipeOpen) {
              onSwipeClose();
              animateTo(0);
              return;
            }

            onPress();
          }}>
          <Image source={getAvatarImageSource(thread.image)} style={styles.threadAvatarImage} />
          <View style={styles.threadCopy}>
            <Text style={styles.threadName} numberOfLines={1}>
              {thread.name}
            </Text>
            <View style={styles.threadMetaRow}>
              <Text style={styles.threadPreview} numberOfLines={1}>
                {thread.preview}
              </Text>
              <Text style={styles.threadTime}>{thread.time}</Text>
            </View>
          </View>
          <View style={styles.threadAside}>
            <Ionicons
              name="camera-outline"
              size={25}
              color={isUnread ? theme.text : theme.textMuted}
            />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function NotificationAvatar({
  notification,
  hasActiveStory,
  styles,
  theme,
}: {
  notification: MobileNotification;
  hasActiveStory: boolean;
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
}) {
  if (notification.category === 'events' && !notification.image) {
    return (
      <View style={styles.notificationIconAvatar}>
        <Ionicons name="calendar-outline" size={23} color={theme.text} />
      </View>
    );
  }

  if (notification.type === 'system') {
    return (
      <View style={styles.notificationIconAvatar}>
        <Ionicons name="sparkles-outline" size={23} color={theme.text} />
      </View>
    );
  }

  return (
    <View style={[styles.feedAvatarShell, hasActiveStory && styles.feedAvatarRing]}>
      <Image source={getAvatarImageSource(notification.image)} style={styles.feedAvatarImage} />
    </View>
  );
}

function EventNotificationPreview({
  event,
  styles,
}: {
  event?: EventRecord;
  styles: ReturnType<typeof buildStyles>;
}) {
  if (!event) return null;

  return (
    <View style={styles.notificationEventMiniCard}>
      <Image source={getEventImageSource(event.image)} style={styles.notificationEventMiniImage} />
      <View style={styles.notificationEventMiniScrim} />
      <Text style={styles.notificationEventMiniTitle} numberOfLines={2}>
        {event.title || 'Campus event'}
      </Text>
    </View>
  );
}

function NotificationPreview({
  notification,
  event,
  styles,
  theme,
  onMessage,
}: {
  notification: MobileNotification;
  event?: EventRecord;
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
  onMessage: () => void;
}) {
  if (notification.category === 'events') {
    return <EventNotificationPreview event={event} styles={styles} />;
  }

  if (notification.type === 'follow') {
    return (
      <Pressable
        style={styles.notificationMessageButton}
        onPress={(eventPress) => {
          eventPress.stopPropagation();
          onMessage();
        }}>
        <Text style={styles.notificationMessageText}>Message</Text>
      </Pressable>
    );
  }

  if (
    (notification.type === 'story_like' || notification.type === 'post_like') &&
    notification.previewImage
  ) {
    return (
      <Image
        source={getEventImageSource(notification.previewImage)}
        style={styles.notificationMediaPreview}
      />
    );
  }

  if (notification.type === 'dm_received') {
    return <Ionicons name="paper-plane-outline" size={22} color={theme.textMuted} />;
  }

  return null;
}

function NotificationFeedRow({
  notification,
  event,
  styles,
  theme,
  onPress,
  onMessage,
  hasActiveStory,
}: {
  notification: MobileNotification;
  event?: EventRecord;
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
  onPress: () => void;
  onMessage: () => void;
  hasActiveStory: boolean;
}) {
  const actorName = getActorNameFromText(notification);
  const shouldHighlightActor =
    notification.type === 'follow' ||
    notification.type === 'dm_received' ||
    notification.type === 'story_like' ||
    notification.type === 'post_like' ||
    notification.type === 'comment' ||
    notification.type === 'mention';
  const actionText =
    shouldHighlightActor && notification.text.startsWith(actorName)
      ? notification.text.slice(actorName.length).trim()
      : notification.text;

  return (
    <Pressable
      style={[styles.notificationFeedRow, notification.read && styles.notificationFeedRowRead]}
      onPress={onPress}>
      <NotificationAvatar
        notification={notification}
        hasActiveStory={hasActiveStory}
        styles={styles}
        theme={theme}
      />

      <View style={styles.notificationFeedCopy}>
        <Text style={styles.notificationFeedText}>
          {shouldHighlightActor ? (
            <>
              <Text style={styles.notificationFeedActor}>{actorName}</Text>
              {actionText ? ` ${actionText}` : ''}
            </>
          ) : (
            notification.text
          )}
          <Text style={styles.notificationFeedTime}> · {notification.time || 'now'}</Text>
        </Text>
      </View>

      <View style={styles.notificationFeedAside}>
        <NotificationPreview
          notification={notification}
          event={event}
          styles={styles}
          theme={theme}
          onMessage={onMessage}
        />
      </View>
    </Pressable>
  );
}

function SuggestedProfileRow({
  profile,
  index,
  styles,
  onFollow,
  onDismiss,
  hasActiveStory,
}: {
  profile: ProfileRecord;
  index: number;
  styles: ReturnType<typeof buildStyles>;
  onFollow: () => void;
  onDismiss: () => void;
  hasActiveStory: boolean;
}) {
  const mutualText =
    index % 3 === 0
      ? 'Suggested for you'
      : `${index * 3 + 2} mutual${index === 0 ? '' : 's'}`;

  return (
    <View style={styles.suggestionRow}>
      <View style={[styles.suggestionAvatarShell, hasActiveStory && styles.suggestionAvatarRing]}>
        <Image source={getAvatarImageSource(profile.avatar)} style={styles.suggestionAvatar} />
      </View>
      <View style={styles.suggestionCopy}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {profile.name || profile.username || 'Campus User'}
        </Text>
        <Text style={styles.suggestionMeta} numberOfLines={1}>
          {mutualText}
        </Text>
      </View>
      <Pressable style={styles.followButton} onPress={onFollow}>
        <Text style={styles.followButtonText}>Follow</Text>
      </Pressable>
      <Pressable style={styles.dismissSuggestionButton} onPress={onDismiss}>
        <Ionicons name="close" size={22} color="rgba(255, 255, 255, 0.66)" />
      </Pressable>
    </View>
  );
}

function DmExploreEventsCard({
  styles,
  theme,
  onPress,
}: {
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dmExploreCard} onPress={onPress}>
      <View style={styles.dmMiniMapGrid} />
      <View style={[styles.dmMapGridLine, styles.dmMapGridLineVerticalOne]} />
      <View style={[styles.dmMapGridLine, styles.dmMapGridLineVerticalTwo]} />
      <View style={[styles.dmMapGridLine, styles.dmMapGridLineHorizontalOne]} />
      <View style={[styles.dmMapGridLine, styles.dmMapGridLineHorizontalTwo]} />
      <View style={styles.dmRadarOuter} />
      <View style={styles.dmRadarMiddle} />
      <View style={styles.dmRadarDot}>
        <Ionicons name="location" size={25} color={theme.accentText} />
      </View>
      <Text style={styles.dmExploreTitle}>Explore Events</Text>
      <Text style={styles.dmExploreSubtitle}>Map</Text>
    </Pressable>
  );
}

function DmYourNoteCard({
  image,
  styles,
  theme,
  onPress,
}: {
  image?: string;
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dmYourNoteCard} onPress={onPress}>
      <View style={styles.dmYourNoteAvatarShell}>
        <Image source={getAvatarImageSource(image)} style={styles.dmYourNoteAvatar} />
        <View style={styles.dmNotePlusButton}>
          <Ionicons name="add" size={15} color={theme.accentText} />
        </View>
      </View>

      <Text style={styles.dmYourNoteTitle}>Your note</Text>
      <Text style={styles.dmYourNoteSubtitle} numberOfLines={1}>
        Share a thought...
      </Text>
    </Pressable>
  );
}

export function InboxScreen({
  initialTab = 'notifications',
  lockedTab,
  showBackButton = true,
  title,
  subtitle,
}: InboxScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; dm?: string }>();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    notifications,
    dmThreads,
    messagesByThread,
    unreadDmThreadIds,
    getThreadById,
    markNotificationRead,
    markDmThreadRead,
    toggleDmThreadMuted,
    toggleDmThreadPinned,
    deleteDmThread,
    openDmThread,
    sendDmMessage,
    deleteDmMessage,
  } = useMobileInbox();
  const {
    currentUser,
    profiles,
    savedEventIds,
    getEventById,
    getProfileById,
    followProfile,
    isFollowingProfile,
    signOut,
    toggleSaveEvent,
  } = useMobileApp();
  const [internalTab, setInternalTab] = useState<MobileInboxTab>(lockedTab || initialTab);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [activeMessageMenu, setActiveMessageMenu] = useState<ActiveMessageMenu | null>(null);
  const [activeThreadMenu, setActiveThreadMenu] = useState<MobileDmThread | null>(null);
  const [activeNotificationFilter, setActiveNotificationFilter] =
    useState<NotificationFilter>('all');
  const [dmSearchQuery, setDmSearchQuery] = useState('');
  const [activeDmFilter, setActiveDmFilter] = useState<DmFilter>('Primary');
  const [accountSwitcherVisible, setAccountSwitcherVisible] = useState(false);
  const [selectedNotificationEvent, setSelectedNotificationEvent] = useState<EventRecord | null>(null);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const [activeStoryAuthorIds, setActiveStoryAuthorIds] = useState<Set<string>>(new Set());
  const [openSwipeThreadId, setOpenSwipeThreadId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [messageStickers, setMessageStickers] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<MenuMessage | null>(null);
  const activeTab = lockedTab || internalTab;
  const resolvedTitle = title || (activeTab === 'dms' ? 'DMs' : 'Notifications');
  const resolvedSubtitle =
    subtitle ||
    (activeTab === 'dms'
      ? 'Conversations around your campus plans stay here.'
      : 'Fresh updates from people and events live here.');
  const centralNotifications = useMemo(
    () => notifications.filter(isCentralNotification),
    [notifications]
  );
  const centralUnreadNotificationCount = useMemo(
    () => centralNotifications.filter((notification) => !notification.read).length,
    [centralNotifications]
  );
  const filteredNotifications = useMemo(
    () => getFilteredNotifications(centralNotifications, activeNotificationFilter),
    [activeNotificationFilter, centralNotifications]
  );
  const notificationSections = useMemo(
    () => buildNotificationSections(filteredNotifications),
    [filteredNotifications]
  );
  const suggestedProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => String(profile.id) !== String(currentUser.id))
        .filter((profile) => !isFollowingProfile(profile.id))
        .filter((profile) => !dismissedSuggestionIds.has(String(profile.id)))
        .slice(0, 5),
    [currentUser.id, dismissedSuggestionIds, isFollowingProfile, profiles]
  );
  const accountOptions = useMemo(
    () => [
      {
        profile: currentUser,
        count: centralUnreadNotificationCount,
        active: true,
      },
    ],
    [centralUnreadNotificationCount, currentUser]
  );
  const filteredDmThreads = useMemo(() => {
    const normalizedQuery = dmSearchQuery.trim().toLowerCase();
    const byFilter = dmThreads.filter((thread) => {
      if (activeDmFilter === 'Primary') return !thread.isMuted;
      if (activeDmFilter === 'General') return thread.isMuted;
      return false;
    });

    if (!normalizedQuery) return byFilter;

    return byFilter.filter((thread) =>
      `${thread.name} ${thread.username} ${thread.preview}`.toLowerCase().includes(normalizedQuery)
    );
  }, [activeDmFilter, dmSearchQuery, dmThreads]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadNotificationStories = async () => {
        const activeStories = await loadActiveStoryRecords({
          currentUser,
          getProfileById,
        });

        if (!isActive) return;

        setActiveStoryAuthorIds(
          new Set(activeStories.map((story) => String(story.authorId)))
        );
      };

      void loadNotificationStories();

      return () => {
        isActive = false;
      };
    }, [currentUser, getProfileById])
  );

  useEffect(() => {
    if (!lockedTab) return;
    setInternalTab(lockedTab);
  }, [lockedTab]);

  useEffect(() => {
    if (lockedTab) return;

    if (params.tab === 'dms' || params.tab === 'notifications') {
      setInternalTab(params.tab);
    }
  }, [lockedTab, params.tab]);

  useEffect(() => {
    if (!params.dm || Array.isArray(params.dm)) return;

    setInternalTab('dms');
    setActiveThreadId(params.dm);
    openDmThread(params.dm);
  }, [openDmThread, params.dm]);

  useEffect(() => {
    if (activeThreadId && !getThreadById(activeThreadId)) {
      setActiveThreadId(null);
    }
  }, [activeThreadId, getThreadById, dmThreads]);

  const activeThread = activeThreadId ? getThreadById(activeThreadId) : null;

  const handleNotificationPress = (notificationId: string, notification: typeof notifications[number]) => {
    markNotificationRead(notificationId);

    if (notification.type === 'dm_received' && notification.threadId) {
      openDmThread(notification.threadId);
      router.push({
        pathname: '/(tabs)/messages',
        params: { dm: notification.threadId },
      });
      return;
    }

    if (notification.type === 'event_reminder') {
      const event = notification.eventId ? getEventById(notification.eventId) : undefined;
      if (event) {
        setSelectedNotificationEvent(event);
      } else {
        router.push({
          pathname: '/(tabs)/events',
          params: { tab: notification.eventTab || 'calendar' },
        });
      }
      return;
    }

    if (notification.type === 'follow' && notification.username) {
      router.push({
        pathname: '/profile/[username]',
        params: { username: notification.username },
      });
    }
  };

  const handleMessageNotificationActor = (notification: MobileNotification) => {
    const threadId = notification.threadId || notification.actorId;
    if (!threadId) return;

    openDmThread(threadId);
    router.push({
      pathname: '/(tabs)/messages',
      params: { dm: threadId },
    });
  };

  const handleFollowSuggestion = (profileId: string) => {
    void followProfile(profileId);
  };

  const handleCreateNotePlaceholder = () => {
    Alert.alert('Notes coming soon', 'Short 24-hour DM notes are ready for backend wiring.');
  };

  const handleCreateMessagePlaceholder = () => {
    Alert.alert('New message', 'Message composer shortcuts are coming soon.');
  };

  const handleAddAccount = () => {
    setAccountSwitcherVisible(false);
    // TODO: Replace sign-out handoff with persistent multi-account switching.
    void signOut().finally(() => {
      router.replace('/auth/sign-in');
    });
  };

  const handleOpenThread = (threadId: string) => {
    setOpenSwipeThreadId(null);
    setActiveThreadId(threadId);
    openDmThread(threadId);
  };

  const handleOpenThreadMenu = (thread: MobileDmThread) => {
    setOpenSwipeThreadId(null);
    setActiveThreadMenu(thread);
  };

  const handleMarkThreadRead = () => {
    if (!activeThreadMenu) return;
    markDmThreadRead(activeThreadMenu.id);
    setActiveThreadMenu(null);
  };

  const handleToggleThreadPinned = () => {
    if (!activeThreadMenu) return;
    toggleDmThreadPinned(activeThreadMenu.id);
    setActiveThreadMenu(null);
  };

  const handleToggleThreadMuted = () => {
    if (!activeThreadMenu) return;
    toggleDmThreadMuted(activeThreadMenu.id);
    setActiveThreadMenu(null);
  };

  const handleDeleteThread = (threadId?: string) => {
    const resolvedThreadId = threadId || activeThreadMenu?.id;
    if (!resolvedThreadId) return;

    if (activeThreadId === resolvedThreadId) {
      setActiveThreadId(null);
    }

    setOpenSwipeThreadId((currentThreadId) =>
      currentThreadId === resolvedThreadId ? null : currentThreadId
    );
    deleteDmThread(resolvedThreadId);
    setActiveThreadMenu(null);
  };

  const handleSend = () => {
    if (!activeThreadId || !draftMessage.trim()) return;

    sendDmMessage(activeThreadId, draftMessage);
    setDraftMessage('');
    setReplyingTo(null);
  };

  const openMessageMenu = (message: MenuMessage, event: GestureResponderEvent) => {
    const { height, width } = Dimensions.get('window');
    const pageX = event.nativeEvent.pageX || width / 2;
    const pageY = event.nativeEvent.pageY || height / 2;
    const left = Math.min(
      Math.max(16, pageX - MESSAGE_MENU_WIDTH / 2),
      width - MESSAGE_MENU_WIDTH - 16
    );
    const top = Math.min(Math.max(72, pageY - 80), height - 220);

    setActiveMessageMenu({ message, left, top });
  };

  const handleReaction = (emoji: string) => {
    if (!activeMessageMenu) return;
    setMessageReactions((currentReactions) => ({
      ...currentReactions,
      [activeMessageMenu.message.id]: emoji,
    }));
    setActiveMessageMenu(null);
  };

  const handleReply = () => {
    setReplyingTo(activeMessageMenu?.message || null);
    setActiveMessageMenu(null);
  };

  const handleAddSticker = () => {
    if (!activeMessageMenu) return;
    setMessageStickers((currentStickers) => ({
      ...currentStickers,
      [activeMessageMenu.message.id]: '✨',
    }));
    setActiveMessageMenu(null);
  };

  const handleDeleteMessage = () => {
    if (!activeThreadId || !activeMessageMenu) return;
    void deleteDmMessage(activeThreadId, activeMessageMenu.message.id);
    if (replyingTo?.id === activeMessageMenu.message.id) {
      setReplyingTo(null);
    }
    setActiveMessageMenu(null);
  };

  return (
    <AppScreen>
      <View style={styles.page}>
        {activeTab === 'notifications' ? (
          <View style={styles.notificationHeader}>
            {showBackButton ? (
              <Pressable style={styles.notificationBackButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={30} color={theme.text} />
              </Pressable>
            ) : (
              <View style={styles.notificationHeaderSide} />
            )}

            <Pressable
              style={styles.accountTitleButton}
              onPress={() => setAccountSwitcherVisible(true)}>
              <Text style={styles.accountTitle} numberOfLines={1}>
                {currentUser.username || currentUser.name || 'campus'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </Pressable>

            <View style={styles.notificationHeaderSide} />
          </View>
        ) : activeTab === 'dms' && !activeThread ? (
          <View style={styles.dmTopHeader}>
            {showBackButton ? (
              <Pressable style={styles.dmHeaderIconButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={30} color={theme.text} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.dmHeaderAvatarButton}
                onPress={() => router.push('/(tabs)/profile')}>
                <Image source={getAvatarImageSource(currentUser.avatar)} style={styles.dmHeaderAvatar} />
                <View style={styles.dmHeaderActivityDot} />
              </Pressable>
            )}

            <Pressable
              style={styles.dmAccountButton}
              onPress={() => setAccountSwitcherVisible(true)}>
              <Text style={styles.dmAccountTitle} numberOfLines={1}>
                {currentUser.username || currentUser.name || 'campus'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </Pressable>

            <Pressable style={styles.dmHeaderIconButton} onPress={handleCreateMessagePlaceholder}>
              <Ionicons name="create-outline" size={27} color={theme.text} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.header}>
            {showBackButton ? (
              <Pressable style={styles.iconButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}

            <View style={styles.headerCopy}>
              <Text style={styles.title}>{resolvedTitle}</Text>
              <Text style={styles.subtitle}>{resolvedSubtitle}</Text>
            </View>
          </View>
        )}

        {!lockedTab && activeTab !== 'notifications' && activeTab !== 'dms' ? (
          <View style={styles.segmentedRow}>
            <Pressable
              style={styles.segmentedButton}
              onPress={() => setInternalTab('notifications')}>
              <Text style={styles.segmentedText}>
                Notifications
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentedButton, activeTab === 'dms' && styles.segmentedButtonActive]}
              onPress={() => setInternalTab('dms')}>
              <Text style={[styles.segmentedText, activeTab === 'dms' && styles.segmentedTextActive]}>
                DMs
              </Text>
            </Pressable>
          </View>
        ) : null}

        {activeTab === 'dms' && !activeThread ? (
          <View style={styles.dmListChrome}>
            <View style={styles.dmSearchBar}>
              <Ionicons name="search" size={19} color={theme.textMuted} />
              <TextInput
                value={dmSearchQuery}
                onChangeText={setDmSearchQuery}
                placeholder="Search people, events"
                placeholderTextColor={theme.textMuted}
                style={styles.dmSearchInput}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dmNotesRow}>
              <DmExploreEventsCard
                styles={styles}
                theme={theme}
                onPress={() => router.push('/map')}
              />
              <DmYourNoteCard
                image={currentUser.avatar}
                styles={styles}
                theme={theme}
                onPress={handleCreateNotePlaceholder}
              />
            </ScrollView>

            <View style={styles.dmFilterRow}>
              {DM_FILTERS.map((filter) => {
                const isActive = activeDmFilter === filter;
                const requestCount = filter === 'Requests' ? 0 : null;
                return (
                  <Pressable
                    key={filter}
                    style={[styles.dmFilterPill, isActive && styles.dmFilterPillActive]}
                    onPress={() => setActiveDmFilter(filter)}>
                    <Text style={[styles.dmFilterText, isActive && styles.dmFilterTextActive]}>
                      {filter}
                      {filter === 'Primary' && unreadDmThreadIds.size > 0
                        ? ` ${unreadDmThreadIds.size}`
                        : requestCount
                          ? ` ${requestCount}`
                          : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeTab === 'notifications' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.notificationFilterRow}>
            {NOTIFICATION_FILTERS.map((filter) => {
              const isActive = activeNotificationFilter === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  style={[
                    styles.notificationFilterPill,
                    isActive && styles.notificationFilterPillActive,
                  ]}
                  onPress={() => setActiveNotificationFilter(filter.key)}>
                  <Text
                    style={[
                      styles.notificationFilterText,
                      isActive && styles.notificationFilterTextActive,
                    ]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {activeTab === 'notifications' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {notificationSections.length > 0 ? (
              notificationSections.map((section) => (
                <View key={section.title} style={styles.notificationSection}>
                  <Text style={styles.notificationSectionTitle}>{section.title}</Text>
                  {section.data.map((notification) => {
                    const event =
                      notification.eventId && notification.category === 'events'
                        ? getEventById(notification.eventId)
                        : undefined;

                    return (
                      <NotificationFeedRow
                        key={notification.id}
                        notification={notification}
                        event={event}
                        styles={styles}
                        theme={theme}
                        onPress={() => handleNotificationPress(notification.id, notification)}
                        onMessage={() => handleMessageNotificationActor(notification)}
                        hasActiveStory={Boolean(
                          notification.actorId &&
                            activeStoryAuthorIds.has(String(notification.actorId))
                        )}
                      />
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.notificationEmptyState}>
                <Text style={styles.emptyTitle}>No notifications right now.</Text>
                <Text style={styles.emptyCopy}>
                  {activeNotificationFilter === 'all'
                    ? 'Fresh updates will land here as people and events move.'
                    : 'Nothing new in this filter yet.'}
                </Text>
              </View>
            )}

            {activeNotificationFilter === 'all' && suggestedProfiles.length > 0 ? (
              <View style={styles.suggestedSection}>
                <View style={styles.suggestedHeader}>
                  <Text style={styles.suggestedTitle}>Suggested for you</Text>
                  <Pressable>
                    <Text style={styles.seeAllText}>See all</Text>
                  </Pressable>
                </View>

                {suggestedProfiles.map((profile, index) => (
                  <SuggestedProfileRow
                    key={profile.id}
                    profile={profile}
                    index={index}
                    styles={styles}
                    onFollow={() => handleFollowSuggestion(profile.id)}
                    hasActiveStory={activeStoryAuthorIds.has(String(profile.id))}
                    onDismiss={() =>
                      setDismissedSuggestionIds((currentIds) => {
                        const nextIds = new Set(currentIds);
                        nextIds.add(String(profile.id));
                        return nextIds;
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : activeThread ? (
          <View style={styles.chatShell}>
            <View style={styles.chatHeader}>
              <Pressable style={styles.iconButton} onPress={() => setActiveThreadId(null)}>
                <Ionicons name="chevron-back" size={18} color={theme.text} />
              </Pressable>
              <View style={styles.chatHeaderCopy}>
                <Text style={styles.chatTitle}>{activeThread.name}</Text>
                <Text style={styles.chatSubtitle}>Direct messages</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.chatMessages} showsVerticalScrollIndicator={false}>
              {(messagesByThread[activeThread.id] || []).map((message) => {
                const eventShare = parseDmMessageForEventShare(message.text);
                const sharedEvent = eventShare ? getEventById(eventShare.eventId) : undefined;
                const showEventPreview = Boolean(eventShare && sharedEvent);
                const textToRender = showEventPreview
                  ? (eventShare?.trimmedBody || '').trim()
                  : message.text;

                return (
                  <Pressable
                    key={message.id}
                    delayLongPress={360}
                    onLongPress={(event) => openMessageMenu(message, event)}
                    style={[
                      styles.chatBubble,
                      message.sender === 'me' ? styles.chatBubbleMe : styles.chatBubbleThem,
                      showEventPreview && styles.chatBubbleWithPreview,
                    ]}>
                    {showEventPreview && sharedEvent && eventShare ? (
                      <DmEventPreviewCard
                        event={sharedEvent}
                        onPress={() => {
                          router.push({
                            pathname: '/event/[id]',
                            params: { id: eventShare.eventId },
                          });
                        }}
                      />
                    ) : null}

                    {textToRender ? (
                      <Text
                        style={[
                          styles.chatBubbleText,
                          message.sender === 'me' && styles.chatBubbleTextMe,
                          showEventPreview && styles.chatBubbleTextWithPreview,
                        ]}>
                        {textToRender}
                      </Text>
                    ) : null}

                    {messageReactions[message.id] || messageStickers[message.id] ? (
                      <View
                        style={[
                          styles.messageBadge,
                          message.sender === 'them' && styles.messageBadgeThem,
                        ]}>
                        {messageReactions[message.id] ? (
                          <Text style={styles.messageBadgeText}>{messageReactions[message.id]}</Text>
                        ) : null}
                        {messageStickers[message.id] ? (
                          <Text style={styles.messageBadgeText}>{messageStickers[message.id]}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            {replyingTo ? (
              <View style={styles.replyingBanner}>
                <View style={styles.replyingCopy}>
                  <Text style={styles.replyingLabel}>
                    Replying to {replyingTo.sender === 'me' ? 'your message' : activeThread.name}
                  </Text>
                  <Text style={styles.replyingText} numberOfLines={1}>
                    {replyingTo.text}
                  </Text>
                </View>
                <Pressable style={styles.replyingClose} onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close" size={16} color={theme.text} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.chatComposer}>
              <TextInput
                value={draftMessage}
                onChangeText={setDraftMessage}
                placeholder={`Message ${activeThread.name}`}
                placeholderTextColor={theme.textMuted}
                style={styles.chatInput}
              />
              <Pressable style={styles.sendButton} onPress={handleSend}>
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>

            <Modal
              transparent
              visible={Boolean(activeMessageMenu)}
              animationType="fade"
              onRequestClose={() => setActiveMessageMenu(null)}>
              <Pressable style={styles.messageMenuBackdrop} onPress={() => setActiveMessageMenu(null)}>
                {activeMessageMenu ? (
                  <Pressable
                    style={[
                      styles.messageMenuShell,
                      { left: activeMessageMenu.left, top: activeMessageMenu.top },
                    ]}
                    onPress={(event) => event.stopPropagation()}>
                    <View style={styles.reactionBar}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <Pressable
                          key={emoji}
                          style={styles.reactionButton}
                          onPress={() => handleReaction(emoji)}>
                          <Text style={styles.reactionText}>{emoji}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={styles.messageActionMenu}>
                      <Pressable style={styles.messageActionRow} onPress={handleReply}>
                        <Ionicons name="arrow-undo-outline" size={18} color={theme.text} />
                        <Text style={styles.messageActionText}>Reply</Text>
                      </Pressable>
                      <Pressable style={styles.messageActionRow} onPress={handleAddSticker}>
                        <Ionicons name="images-outline" size={18} color={theme.text} />
                        <Text style={styles.messageActionText}>Add sticker</Text>
                      </Pressable>
                      <Pressable style={styles.messageActionRow} onPress={handleDeleteMessage}>
                        <Ionicons name="trash-outline" size={18} color="#ff5d73" />
                        <Text style={[styles.messageActionText, styles.messageActionDanger]}>
                          Delete message
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ) : null}
              </Pressable>
            </Modal>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.dmThreadListContent} showsVerticalScrollIndicator={false}>
            {filteredDmThreads.length > 0 ? (
              filteredDmThreads.map((thread) => (
                <InboxThreadRow
                  key={thread.id}
                  thread={thread}
                  isUnread={unreadDmThreadIds.has(thread.id)}
                  styles={styles}
                  theme={theme}
                  isSwipeOpen={openSwipeThreadId === thread.id}
                  onPress={() => handleOpenThread(thread.id)}
                  onLongPress={() => handleOpenThreadMenu(thread)}
                  onSwipeOpen={() => setOpenSwipeThreadId(thread.id)}
                  onSwipeClose={() => setOpenSwipeThreadId((currentId) => (currentId === thread.id ? null : currentId))}
                  onMute={() => toggleDmThreadMuted(thread.id)}
                  onDelete={() => handleDeleteThread(thread.id)}
                />
              ))
            ) : (
              <View style={styles.dmEmptyState}>
                <Text style={styles.emptyTitle}>
                  {activeDmFilter === 'Requests' ? 'No message requests.' : 'No DM threads yet.'}
                </Text>
                <Text style={styles.emptyCopy}>
                  {dmSearchQuery.trim()
                    ? 'Try searching by name, username, or message preview.'
                    : activeDmFilter === 'Requests'
                      ? 'People requesting to DM you will appear here.'
                      : 'Message people from profiles and event shares to start conversations.'}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <Modal
          transparent
          visible={accountSwitcherVisible}
          animationType="slide"
          onRequestClose={() => setAccountSwitcherVisible(false)}>
          <Pressable
            style={styles.accountModalBackdrop}
            onPress={() => setAccountSwitcherVisible(false)}>
            <Pressable
              style={styles.accountModalSheet}
              onPress={(event) => event.stopPropagation()}>
              <View style={styles.accountModalHandle} />
              <View style={styles.accountModalList}>
                {accountOptions.map(({ profile, count, active }) => (
                  <Pressable
                    key={profile.id}
                    style={styles.accountModalRow}
                    onPress={() => setAccountSwitcherVisible(false)}>
                    <View
                      style={[
                        styles.accountModalAvatarShell,
                        activeStoryAuthorIds.has(String(profile.id)) && styles.accountModalAvatarRing,
                      ]}>
                      <Image source={getAvatarImageSource(profile.avatar)} style={styles.accountModalAvatar} />
                    </View>
                    <View style={styles.accountModalCopy}>
                      <Text style={styles.accountModalName} numberOfLines={1}>
                        {profile.username || profile.name || 'campus'}
                      </Text>
                      <Text style={styles.accountModalMeta}>
                        {count === 0
                          ? 'No notifications'
                          : `${count} notification${count === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                    {active ? (
                      <View style={styles.accountModalCheck}>
                        <Ionicons name="checkmark" size={18} color={theme.accentText} />
                      </View>
                    ) : null}
                  </Pressable>
                ))}

                <Pressable
                  style={styles.accountModalRow}
                  onPress={handleAddAccount}>
                  <View style={styles.accountAddIcon}>
                    <Ionicons name="add" size={28} color="#ffffff" />
                  </View>
                  <View style={styles.accountModalCopy}>
                    <Text style={styles.accountModalName}>Add account</Text>
                    <Text style={styles.accountModalMeta}>Sign in with another account.</Text>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <ExploreEventDetailModal
          visible={Boolean(selectedNotificationEvent)}
          event={selectedNotificationEvent}
          actionLabel={
            selectedNotificationEvent && savedEventIds.includes(String(selectedNotificationEvent.id))
              ? 'Going'
              : "I'm Going"
          }
          actionActive={Boolean(
            selectedNotificationEvent && savedEventIds.includes(String(selectedNotificationEvent.id))
          )}
          onClose={() => setSelectedNotificationEvent(null)}
          onActionPress={() => {
            if (!selectedNotificationEvent) return;
            void toggleSaveEvent(String(selectedNotificationEvent.id));
          }}
        />

        <Modal
          transparent
          visible={Boolean(activeThreadMenu)}
          animationType="fade"
          onRequestClose={() => setActiveThreadMenu(null)}>
          <Pressable style={styles.threadMenuBackdrop} onPress={() => setActiveThreadMenu(null)}>
            {activeThreadMenu ? (
              <Pressable style={styles.threadMenuCard} onPress={(event) => event.stopPropagation()}>
                <View style={styles.threadMenuHandle} />
                <View style={styles.threadMenuHeader}>
                  <Image
                    source={getAvatarImageSource(activeThreadMenu.image)}
                    style={styles.threadMenuAvatar}
                  />
                  <View style={styles.threadMenuCopy}>
                    <Text style={styles.threadMenuTitle} numberOfLines={1}>
                      {activeThreadMenu.name}
                    </Text>
                    <Text style={styles.threadMenuSubtitle}>Conversation actions</Text>
                  </View>
                </View>

                <View style={styles.threadActionMenu}>
                  <Pressable style={styles.threadActionRow} onPress={handleMarkThreadRead}>
                    <Ionicons name="mail-open-outline" size={18} color={theme.text} />
                    <Text style={styles.threadActionText}>Mark as read</Text>
                  </Pressable>
                  <View style={[styles.threadActionRow, styles.threadActionRowDisabled]}>
                    <Ionicons name="folder-open-outline" size={18} color={theme.textMuted} />
                    <Text style={[styles.threadActionText, styles.threadActionTextDisabled]}>Move</Text>
                    <Text style={styles.threadActionBadge}>Soon</Text>
                  </View>
                  <View style={[styles.threadActionRow, styles.threadActionRowDisabled]}>
                    <Ionicons name="pricetag-outline" size={18} color={theme.textMuted} />
                    <Text style={[styles.threadActionText, styles.threadActionTextDisabled]}>Add label</Text>
                    <Text style={styles.threadActionBadge}>Soon</Text>
                  </View>
                  <Pressable style={styles.threadActionRow} onPress={handleToggleThreadPinned}>
                    <Ionicons name="pin-outline" size={18} color={theme.text} />
                    <Text style={styles.threadActionText}>
                      {activeThreadMenu.isPinned ? 'Unpin' : 'Pin'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.threadActionRow} onPress={handleToggleThreadMuted}>
                    <Ionicons name="volume-mute-outline" size={18} color={theme.text} />
                    <Text style={styles.threadActionText}>
                      {activeThreadMenu.isMuted ? 'Unmute' : 'Mute'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.threadActionRow} onPress={() => handleDeleteThread()}>
                    <IconSymbol name="trash" size={18} color="#ff5d73" />
                    <Text style={[styles.threadActionText, styles.threadActionDanger]}>Delete</Text>
                  </Pressable>
                </View>
              </Pressable>
            ) : null}
          </Pressable>
        </Modal>
      </View>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    page: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 18,
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 6,
      borderRadius: 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentedButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 16,
    },
    segmentedButtonActive: {
      backgroundColor: theme.accent,
    },
    segmentedText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
    segmentedTextActive: {
      color: theme.background,
    },
    scrollContent: {
      gap: 18,
      paddingBottom: 120,
    },
    notificationHeader: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    notificationBackButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationHeaderSide: {
      width: 42,
      height: 42,
    },
    accountTitleButton: {
      flex: 1,
      maxWidth: '78%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    accountTitle: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 0,
    },
    notificationFilterRow: {
      gap: 8,
      paddingRight: 18,
      paddingBottom: 2,
    },
    notificationFilterPill: {
      minHeight: 34,
      justifyContent: 'center',
      borderRadius: 999,
      paddingHorizontal: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    notificationFilterPillActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    notificationFilterText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    notificationFilterTextActive: {
      color: theme.accentText,
    },
    notificationSection: {
      gap: 14,
    },
    notificationSectionTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 0,
      marginTop: 4,
    },
    notificationFeedRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 5,
    },
    notificationFeedRowRead: {
      opacity: 0.74,
    },
    feedAvatarShell: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    feedAvatarRing: {
      borderWidth: 3,
      borderColor: '#ffffff',
    },
    feedAvatarImage: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: theme.surfaceAlt,
    },
    notificationIconAvatar: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    notificationFeedCopy: {
      flex: 1,
      minWidth: 0,
    },
    notificationFeedText: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '500',
    },
    notificationFeedActor: {
      fontWeight: '900',
    },
    notificationFeedTime: {
      color: theme.textMuted,
      fontWeight: '700',
    },
    notificationFeedAside: {
      width: 96,
      minHeight: 58,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    notificationMessageButton: {
      minWidth: 88,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 14,
      backgroundColor: '#2a3037',
    },
    notificationMessageText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
    notificationMediaPreview: {
      width: 48,
      height: 58,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
    },
    notificationEventMiniCard: {
      width: 58,
      height: 76,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#111216',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      shadowColor: '#000',
      shadowOpacity: 0.34,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    notificationEventMiniImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    notificationEventMiniScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.28)',
    },
    notificationEventMiniTitle: {
      position: 'absolute',
      left: 5,
      right: 5,
      bottom: 5,
      color: '#ffffff',
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '900',
    },
    notificationEmptyState: {
      paddingVertical: 42,
      gap: 8,
      alignItems: 'center',
    },
    suggestedSection: {
      gap: 18,
      marginTop: 2,
    },
    suggestedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    suggestedTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '900',
    },
    seeAllText: {
      color: '#5d7cff',
      fontSize: 16,
      fontWeight: '900',
    },
    suggestionRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    suggestionAvatarShell: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    suggestionAvatarRing: {
      borderWidth: 3,
      borderColor: '#ffffff',
    },
    suggestionAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.surfaceAlt,
    },
    suggestionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    suggestionName: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    suggestionMeta: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    followButton: {
      minWidth: 104,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.accent,
    },
    followButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
    },
    dismissSuggestionButton: {
      width: 28,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountModalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.58)',
    },
    accountModalSheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 26,
      backgroundColor: '#1d1d21',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    accountModalHandle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.38)',
      marginBottom: 16,
    },
    accountModalList: {
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    accountModalRow: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 11,
      backgroundColor: '#1d1d21',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    accountModalAvatarShell: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    accountModalAvatarRing: {
      borderWidth: 2,
      borderColor: '#ffffff',
    },
    accountModalAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surfaceAlt,
    },
    accountModalCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    accountModalName: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '900',
    },
    accountModalMeta: {
      color: 'rgba(255, 255, 255, 0.58)',
      fontSize: 13,
      fontWeight: '700',
    },
    accountModalCheck: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    accountAddIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#071013',
    },
    dmTopHeader: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dmHeaderIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dmHeaderSide: {
      width: 44,
      height: 44,
    },
    dmHeaderAvatarButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dmHeaderAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.surfaceAlt,
    },
    dmHeaderActivityDot: {
      position: 'absolute',
      right: 3,
      bottom: 5,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.accent,
      borderWidth: 2,
      borderColor: theme.background,
    },
    dmAccountButton: {
      flex: 1,
      maxWidth: '72%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    dmAccountTitle: {
      color: theme.text,
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: 0,
    },
    dmListChrome: {
      gap: 12,
    },
    dmSearchBar: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 26,
      paddingHorizontal: 17,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dmSearchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 17,
      fontWeight: '600',
      paddingVertical: 0,
    },
    dmNotesRow: {
      gap: 12,
      paddingHorizontal: 2,
      paddingTop: 4,
      paddingBottom: 3,
    },
    dmExploreCard: {
      width: 92,
      height: 132,
      borderRadius: 16,
      overflow: 'hidden',
      padding: 10,
      justifyContent: 'flex-end',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.28,
      shadowRadius: 11,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
    dmMiniMapGrid: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.surfaceAlt,
      opacity: 0.7,
    },
    dmMapGridLine: {
      position: 'absolute',
      backgroundColor: theme.accent,
      opacity: 0.11,
    },
    dmMapGridLineVerticalOne: {
      top: -16,
      bottom: -16,
      left: 27,
      width: 1,
      transform: [{ rotate: '24deg' }],
    },
    dmMapGridLineVerticalTwo: {
      top: -16,
      bottom: -16,
      right: 21,
      width: 1,
      transform: [{ rotate: '-18deg' }],
    },
    dmMapGridLineHorizontalOne: {
      left: -14,
      right: -14,
      top: 35,
      height: 1,
      transform: [{ rotate: '-10deg' }],
    },
    dmMapGridLineHorizontalTwo: {
      left: -14,
      right: -14,
      top: 71,
      height: 1,
      transform: [{ rotate: '12deg' }],
    },
    dmRadarOuter: {
      position: 'absolute',
      top: 32,
      alignSelf: 'center',
      width: 70,
      height: 70,
      borderRadius: 35,
      borderWidth: 1,
      borderColor: theme.accent,
      opacity: 0.32,
    },
    dmRadarMiddle: {
      position: 'absolute',
      top: 47,
      alignSelf: 'center',
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.accent,
      opacity: 0.56,
    },
    dmRadarDot: {
      position: 'absolute',
      top: 36,
      alignSelf: 'center',
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.46,
      shadowRadius: 13,
      shadowOffset: { width: 0, height: 0 },
      elevation: 12,
    },
    dmExploreTitle: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '900',
      lineHeight: 14,
    },
    dmExploreSubtitle: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: '900',
      marginTop: 3,
    },
    dmYourNoteCard: {
      width: 78,
      height: 132,
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 8,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    dmYourNoteAvatarShell: {
      position: 'absolute',
      top: 18,
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.accent,
      backgroundColor: theme.surfaceAlt,
    },
    dmYourNoteAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.surfaceAlt,
    },
    dmNotePlusButton: {
      position: 'absolute',
      right: -2,
      bottom: 1,
      width: 23,
      height: 23,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      borderWidth: 2,
      borderColor: theme.background,
    },
    dmYourNoteTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
    },
    dmYourNoteSubtitle: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 3,
    },
    dmFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      padding: 3,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    dmFilterPill: {
      flex: 1,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      paddingHorizontal: 8,
      backgroundColor: 'transparent',
    },
    dmFilterPillActive: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    dmFilterText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
    },
    dmFilterTextActive: {
      color: theme.text,
    },
    dmThreadListContent: {
      gap: 6,
      paddingBottom: 120,
    },
    dmEmptyState: {
      paddingVertical: 38,
      gap: 8,
      alignItems: 'center',
    },
    utilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    utilityText: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    utilityButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    utilityButtonDisabled: {
      opacity: 0.5,
    },
    utilityButtonText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    notificationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    notificationReadCard: {
      opacity: 0.74,
    },
    notificationAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    notificationCopy: {
      flex: 1,
      gap: 4,
    },
    notificationText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 19,
    },
    notificationMeta: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    notificationActions: {
      alignItems: 'center',
      gap: 8,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
    },
    deleteButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    emptyState: {
      padding: 22,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
      alignItems: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    threadSwipeShell: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    threadQuickActions: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: THREAD_ACTION_SWIPE_WIDTH,
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    threadQuickActionButton: {
      width: 72,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    threadQuickMuteButton: {
      backgroundColor: '#5d6bff',
    },
    threadQuickDeleteButton: {
      backgroundColor: '#ff4f62',
    },
    threadQuickActionLabel: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
    },
    threadSwipeCard: {
      zIndex: 1,
    },
    threadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 66,
      paddingHorizontal: 0,
      paddingVertical: 6,
      borderRadius: 18,
      backgroundColor: 'transparent',
    },
    threadCardOpen: {
      backgroundColor: theme.surface,
    },
    threadAvatarImage: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.surfaceAlt,
    },
    threadCopy: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    threadName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    threadPreview: {
      flexShrink: 1,
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 17,
    },
    threadMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    threadTime: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    threadStateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    threadStatePill: {
      width: 18,
      height: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    threadAside: {
      width: 36,
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 9,
    },
    chatShell: {
      flex: 1,
      gap: 12,
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    chatHeaderCopy: {
      gap: 3,
    },
    chatTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    chatSubtitle: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    chatMessages: {
      paddingVertical: 8,
      gap: 10,
    },
    chatBubble: {
      position: 'relative',
      maxWidth: '82%',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
    },
    chatBubbleMe: {
      alignSelf: 'flex-end',
      backgroundColor: theme.accent,
    },
    chatBubbleThem: {
      alignSelf: 'flex-start',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chatBubbleText: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 19,
    },
    chatBubbleTextMe: {
      color: theme.background,
    },
    chatBubbleWithPreview: {
      padding: 6,
      borderRadius: 22,
      gap: 8,
    },
    chatBubbleTextWithPreview: {
      paddingHorizontal: 6,
      paddingBottom: 2,
    },
    messageBadge: {
      position: 'absolute',
      right: 8,
      bottom: -17,
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    messageBadgeThem: {
      right: undefined,
      left: 8,
    },
    messageBadgeText: {
      fontSize: 13,
      lineHeight: 17,
    },
    replyingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    replyingCopy: {
      flex: 1,
      gap: 3,
    },
    replyingLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    replyingText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    replyingClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    chatComposer: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      paddingTop: 4,
    },
    chatInput: {
      flex: 1,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 14,
    },
    sendButton: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 13,
      backgroundColor: theme.accent,
    },
    sendButtonText: {
      color: theme.background,
      fontSize: 13,
      fontWeight: '800',
    },
    messageMenuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    messageMenuShell: {
      position: 'absolute',
      width: MESSAGE_MENU_WIDTH,
      gap: 8,
    },
    reactionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 999,
      padding: 6,
      backgroundColor: '#0b0b0d',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    reactionButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionText: {
      fontSize: 20,
      lineHeight: 24,
    },
    messageActionMenu: {
      borderRadius: 16,
      paddingVertical: 4,
      backgroundColor: '#0b0b0d',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 14,
    },
    messageActionRow: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    messageActionText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    messageActionDanger: {
      color: '#ff5d73',
    },
    threadMenuBackdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    threadMenuCard: {
      width: '100%',
      maxWidth: 300,
      borderRadius: 18,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: '#0b0b0d',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: 18,
      gap: 6,
    },
    threadMenuHandle: {
      alignSelf: 'center',
      width: 34,
      height: 3,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      marginTop: 2,
    },
    threadMenuHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    threadMenuAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#141417',
    },
    threadMenuCopy: {
      flex: 1,
      gap: 2,
    },
    threadMenuTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
    },
    threadMenuSubtitle: {
      color: 'rgba(255, 255, 255, 0.52)',
      fontSize: 11,
      fontWeight: '600',
    },
    threadActionMenu: {
      borderRadius: 12,
      overflow: 'hidden',
      paddingVertical: 2,
    },
    threadActionRow: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
    },
    threadActionRowDisabled: {
      opacity: 0.55,
    },
    threadActionText: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    threadActionTextDisabled: {
      color: 'rgba(255, 255, 255, 0.46)',
    },
    threadActionBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 10,
      fontWeight: '700',
      overflow: 'hidden',
    },
    threadActionDanger: {
      color: '#ff5d73',
    },
  });
