import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { parseDmMessageForEventShare } from '@/lib/mobile-dm-content';
import { supabase } from '@/lib/supabase';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { loadActiveProfileNotes, type ProfileNoteRecord } from '@/lib/mobile-profile-notes';
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
              <Text
                style={[styles.threadPreview, isUnread && styles.threadPreviewUnread]}
                numberOfLines={1}>
                {thread.preview}
              </Text>
              <Text style={styles.threadTime}>{thread.time}</Text>
            </View>
          </View>
          <View style={styles.threadAside}>
            {isUnread ? <View style={styles.threadUnreadDot} /> : null}
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

function DmMapCircle({
  styles,
  theme,
  onPress,
}: {
  styles: ReturnType<typeof buildStyles>;
  theme: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dmMapCircleCard} onPress={onPress}>
      <View style={styles.dmMapAvatarShell}>
        <View style={styles.dmMapCircleGrid} />
        <View style={styles.dmMapPulseOuter} />
        <View style={styles.dmMapPulseInner} />
        <View style={styles.dmMapPinDot}>
          <Ionicons name="location" size={20} color={theme.accentText} />
        </View>
      </View>
      <Text style={styles.dmMapLabel}>Map</Text>
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

function DmProfileNoteCircle({
  note,
  profile,
  styles,
  onPress,
}: {
  note: ProfileNoteRecord;
  profile?: ProfileRecord;
  styles: ReturnType<typeof buildStyles>;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.dmProfileNoteCard} onPress={onPress}>
      <View style={styles.dmProfileNoteBubble}>
        <Text style={styles.dmProfileNoteText} numberOfLines={2}>
          {note.body}
        </Text>
      </View>
      <Image source={getAvatarImageSource(profile?.avatar)} style={styles.dmProfileNoteAvatar} />
      <Text style={styles.dmProfileNoteName} numberOfLines={1}>
        {profile?.name || profile?.username || 'Campus User'}
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
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ tab?: string; dm?: string }>();
  const theme = useAppTheme();
  const composerInputRef = useRef<TextInput>(null);
  const chatMessagesScrollRef = useRef<ScrollView>(null);
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
    events,
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
  const [activeProfileNotes, setActiveProfileNotes] = useState<ProfileNoteRecord[]>([]);
  const [openSwipeThreadId, setOpenSwipeThreadId] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [messageStickers, setMessageStickers] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<MenuMessage | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [eventsPickerOpen, setEventsPickerOpen] = useState(false);
  const [attachedEvent, setAttachedEvent] = useState<EventRecord | null>(null);
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

  const visibleProfileNotes = useMemo(
    () =>
      activeProfileNotes
        .filter((note) => String(note.userId) !== String(currentUser.id))
        .map((note) => ({ note, profile: getProfileById(note.userId) }))
        .filter(({ profile }) => Boolean(profile))
        .slice(0, 8),
    [activeProfileNotes, currentUser.id, getProfileById]
  );

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

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadNotes = async () => {
        const noteUserIds = [
          currentUser.id,
          ...dmThreads.map((thread) => String(thread.id)),
        ].filter(Boolean);
        const nextNotes = await loadActiveProfileNotes(noteUserIds);

        if (isActive) {
          setActiveProfileNotes(nextNotes);
        }
      };

      void loadNotes();

      return () => {
        isActive = false;
      };
    }, [currentUser.id, dmThreads])
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

  useEffect(() => {
    setAttachedEvent(null);
    setPlusMenuOpen(false);
    setEventsPickerOpen(false);
  }, [activeThreadId]);

  // Load persisted reactions for the active thread
  useEffect(() => {
    if (!activeThreadId || !currentUser?.id || !supabase) return;
    const messageIds = (messagesByThread[activeThreadId] || [])
      .map((m) => m.id)
      .filter((id) => !String(id).startsWith('temp-'));
    if (messageIds.length === 0) return;

    supabase
      .from('message_reactions')
      .select('message_id, emoji')
      .in('message_id', messageIds)
      .eq('user_id', currentUser.id)
      .then(({ data }) => {
        if (!data) return;
        const next: Record<string, string> = {};
        data.forEach((row: { message_id: string; emoji: string }) => { next[row.message_id] = row.emoji; });
        setMessageReactions((prev) => ({ ...prev, ...next }));
      });
  }, [activeThreadId, currentUser?.id, messagesByThread]);

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

  const scrollChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatMessagesScrollRef.current?.scrollToEnd({ animated: true });
    });
    setTimeout(() => {
      chatMessagesScrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const handleSend = () => {
    if (!activeThreadId) return;

    const trimmedDraft = draftMessage.trim();
    const eventLink = attachedEvent ? `campus-event://event/${attachedEvent.id}` : '';
    const messageBody = [trimmedDraft, eventLink].filter(Boolean).join('\n');
    if (!messageBody) return;

    void sendDmMessage(activeThreadId, messageBody).then(() => {
      scrollChatToBottom();
    });
    setDraftMessage('');
    setAttachedEvent(null);
    setReplyingTo(null);
    scrollChatToBottom();
  };

  const focusComposerInput = useCallback(() => {
    composerInputRef.current?.focus();
  }, []);

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
    if (!activeMessageMenu || !currentUser?.id || !supabase) return;
    const messageId = activeMessageMenu.message.id;
    const existing = messageReactions[messageId];
    const isToggleOff = existing === emoji;

    setMessageReactions((prev) => {
      const next = { ...prev };
      if (isToggleOff) { delete next[messageId]; } else { next[messageId] = emoji; }
      return next;
    });
    setActiveMessageMenu(null);

    if (isToggleOff) {
      void supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', currentUser.id);
    } else {
      void supabase.from('message_reactions')
        .upsert({ message_id: messageId, user_id: currentUser.id, emoji }, { onConflict: 'message_id,user_id' });
    }
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

  const chatActive = activeTab === 'dms' && Boolean(activeThread);

  useEffect(() => {
    const defaultTabBarStyle = {
      backgroundColor: theme.tabBar,
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      height: 78,
      paddingTop: 8,
      paddingBottom: 10,
    };
    const hiddenTabBarStyle = { display: 'none' as const };

    const setBoth = (style: typeof defaultTabBarStyle | typeof hiddenTabBarStyle) => {
      navigation.setOptions({ tabBarStyle: style });
      const parent = navigation.getParent?.();
      parent?.setOptions?.({ tabBarStyle: style });
    };

    setBoth(chatActive ? hiddenTabBarStyle : defaultTabBarStyle);

    return () => {
      setBoth(defaultTabBarStyle);
    };
  }, [chatActive, navigation, theme.tabBar]);

  const shareableEvents = useMemo(() => {
    if (!currentUser?.id) return [] as EventRecord[];
    const seen = new Set<string>();
    const list: EventRecord[] = [];
    events.forEach((event) => {
      const id = String(event.id);
      if (seen.has(id)) return;
      const isAttending = Array.isArray(event.attendees)
        ? event.attendees.includes(currentUser.id)
        : false;
      const isCreated = String(event.createdBy) === String(currentUser.id);
      const isSaved = savedEventIds.includes(id);
      if (isAttending || isCreated || isSaved) {
        seen.add(id);
        list.push(event);
      }
    });
    return list;
  }, [currentUser?.id, events, savedEventIds]);

  const handleSelectShareEvent = (event: EventRecord) => {
    setAttachedEvent(event);
    setEventsPickerOpen(false);
    setPlusMenuOpen(false);
  };

  const isComposerTyping = draftMessage.length > 0 || Boolean(attachedEvent);

  return (
    <AppScreen edges={chatActive ? ['top', 'bottom'] : ['top']}>
      <KeyboardAvoidingView
        style={[styles.page, chatActive && styles.pageChatMode]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        enabled={chatActive}>
        {chatActive ? null : activeTab === 'notifications' ? (
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
              <View style={styles.dmHeaderSide} />
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
                placeholder="Search"
                placeholderTextColor={theme.textMuted}
                style={styles.dmSearchInput}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dmNotesRow}>
              <DmYourNoteCard
                image={currentUser.avatar}
                styles={styles}
                theme={theme}
                onPress={handleCreateNotePlaceholder}
              />
              <DmMapCircle
                styles={styles}
                theme={theme}
                onPress={() => router.push('/map')}
              />
              {visibleProfileNotes.map(({ note, profile }) => (
                <DmProfileNoteCircle
                  key={note.id}
                  note={note}
                  profile={profile}
                  styles={styles}
                  onPress={() => handleOpenThread(note.userId)}
                />
              ))}
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
              <Pressable style={styles.chatHeaderBack} onPress={() => setActiveThreadId(null)}>
                <Ionicons name="chevron-back" size={28} color={theme.text} />
              </Pressable>
              <Image
                source={getAvatarImageSource(activeThread.image)}
                style={styles.chatHeaderAvatar}
              />
              <Text style={styles.chatHeaderName} numberOfLines={1}>
                {activeThread.name}
              </Text>
            </View>

            <ScrollView
              ref={chatMessagesScrollRef}
              style={styles.chatMessagesScroll}
              contentContainerStyle={styles.chatMessages}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
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
              {attachedEvent ? (
                <View style={styles.attachedEventPreview}>
                  <Image
                    source={getEventImageSource(attachedEvent.image)}
                    style={styles.attachedEventImage}
                  />
                  <View style={styles.attachedEventCopy}>
                    <Text style={styles.attachedEventTitle} numberOfLines={1}>
                      {attachedEvent.title || 'Campus Event'}
                    </Text>
                    <Text style={styles.attachedEventMeta} numberOfLines={1}>
                      {[attachedEvent.date, attachedEvent.time].filter(Boolean).join(' • ') ||
                        'Date TBA'}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.attachedEventRemove}
                    onPress={() => setAttachedEvent(null)}
                    accessibilityLabel="Remove event attachment">
                    <Ionicons name="close" size={15} color={theme.text} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.chatComposerRow}>
                {!isComposerTyping ? (
                  <Pressable
                    style={styles.composerCameraButton}
                    onPress={() => Alert.alert('Camera', 'Camera capture is coming soon.')}>
                    <Ionicons name="camera" size={20} color="#ffffff" />
                  </Pressable>
                ) : null}

                <View
                  style={[
                    styles.composerPill,
                    isComposerTyping && styles.composerPillTyping,
                  ]}
                  onTouchStart={focusComposerInput}>
                  <TextInput
                    ref={composerInputRef}
                    value={draftMessage}
                    onChangeText={setDraftMessage}
                    placeholder="Message..."
                    placeholderTextColor={theme.textMuted}
                    style={styles.composerInput}
                    editable
                    multiline
                    blurOnSubmit={false}
                  />

                  {isComposerTyping ? (
                    <Pressable
                      style={styles.composerSendButton}
                      onPress={handleSend}
                      accessibilityLabel="Send message">
                      <Ionicons name="paper-plane" size={16} color={theme.accentText} />
                    </Pressable>
                  ) : (
                    <View style={styles.composerActionsRow}>
                      <Pressable
                        style={styles.composerIconButton}
                        onPress={() => Alert.alert('Voice notes', 'Voice messages are coming soon.')}>
                        <Ionicons name="mic-outline" size={19} color={theme.text} />
                      </Pressable>
                      <Pressable
                        style={styles.composerIconButton}
                        onPress={() =>
                          Alert.alert('Gallery', 'Image picker is coming soon.')
                        }>
                        <Ionicons name="image-outline" size={19} color={theme.text} />
                      </Pressable>
                      <Pressable
                        style={styles.composerPlusButton}
                        onPress={() => setPlusMenuOpen((open) => !open)}
                        accessibilityLabel="More attachments">
                        <Ionicons name="add" size={17} color={theme.text} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <Modal
              transparent
              visible={plusMenuOpen}
              animationType="fade"
              onRequestClose={() => setPlusMenuOpen(false)}>
              <Pressable
                style={styles.plusMenuBackdrop}
                onPress={() => setPlusMenuOpen(false)}>
                <Pressable
                  style={styles.plusMenuCard}
                  onPress={(event) => event.stopPropagation()}>
                  {([
                    {
                      key: 'location',
                      icon: 'location-outline' as const,
                      label: 'Location',
                      onPress: () =>
                        Alert.alert('Location', 'Location sharing is coming soon.'),
                    },
                    {
                      key: 'draw',
                      icon: 'brush-outline' as const,
                      label: 'Draw',
                      onPress: () => Alert.alert('Draw', 'Drawing is coming soon.'),
                    },
                    {
                      key: 'gifs',
                      icon: 'film-outline' as const,
                      label: 'GIFs',
                      onPress: () => Alert.alert('GIFs', 'GIF picker is coming soon.'),
                    },
                    {
                      key: 'stickers',
                      icon: 'happy-outline' as const,
                      label: 'Stickers',
                      onPress: () => Alert.alert('Stickers', 'Sticker library is coming soon.'),
                    },
                    {
                      key: 'events',
                      icon: 'calendar-outline' as const,
                      label: 'Events',
                      onPress: () => {
                        setPlusMenuOpen(false);
                        setEventsPickerOpen(true);
                      },
                    },
                  ] as const).map((item) => (
                    <Pressable
                      key={item.key}
                      style={styles.plusMenuRow}
                      onPress={() => {
                        if (item.key !== 'events') {
                          setPlusMenuOpen(false);
                        }
                        item.onPress();
                      }}>
                      <Ionicons name={item.icon} size={20} color={theme.text} />
                      <Text style={styles.plusMenuLabel}>{item.label}</Text>
                    </Pressable>
                  ))}
                </Pressable>
              </Pressable>
            </Modal>

            <Modal
              transparent
              visible={eventsPickerOpen}
              animationType="slide"
              onRequestClose={() => setEventsPickerOpen(false)}>
              <Pressable
                style={styles.eventsPickerBackdrop}
                onPress={() => setEventsPickerOpen(false)}>
                <Pressable
                  style={styles.eventsPickerSheet}
                  onPress={(event) => event.stopPropagation()}>
                  <View style={styles.eventsPickerHandle} />
                  <Text style={styles.eventsPickerTitle}>Share an event</Text>
                  {shareableEvents.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.eventsPickerList}>
                      {shareableEvents.map((event) => (
                        <DmEventPreviewCard
                          key={event.id}
                          event={event}
                          onPress={() => handleSelectShareEvent(event)}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.eventsPickerEmpty}>No events to share yet.</Text>
                  )}
                </Pressable>
              </Pressable>
            </Modal>

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
              ? 'Cancel'
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
      </KeyboardAvoidingView>
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
    pageChatMode: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      gap: 0,
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
      gap: 11,
    },
    dmSearchBar: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 23,
      paddingHorizontal: 16,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dmSearchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
      paddingVertical: 0,
    },
    dmNotesRow: {
      gap: 18,
      paddingHorizontal: 2,
      paddingTop: 4,
      paddingBottom: 3,
    },
    dmYourNoteCard: {
      width: 78,
      height: 104,
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 8,
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    dmYourNoteAvatarShell: {
      position: 'absolute',
      top: 6,
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
    dmMapCircleCard: {
      width: 78,
      height: 104,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 8,
    },
    dmMapAvatarShell: {
      position: 'absolute',
      top: 6,
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dmMapCircleGrid: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.surface,
      opacity: 0.88,
    },
    dmMapPulseOuter: {
      position: 'absolute',
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.accent,
      opacity: 0.26,
    },
    dmMapPulseInner: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.accent,
      opacity: 0.46,
    },
    dmMapPinDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    dmMapLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '900',
    },
    dmProfileNoteCard: {
      width: 78,
      height: 104,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 8,
    },
    dmProfileNoteBubble: {
      position: 'absolute',
      top: 0,
      minWidth: 68,
      maxWidth: 82,
      minHeight: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      zIndex: 2,
    },
    dmProfileNoteText: {
      color: theme.text,
      fontSize: 10,
      fontWeight: '800',
      textAlign: 'center',
      lineHeight: 12,
    },
    dmProfileNoteAvatar: {
      position: 'absolute',
      top: 30,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: theme.surfaceAlt,
    },
    dmProfileNoteName: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '800',
      maxWidth: 76,
    },
    dmFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingTop: 1,
      paddingBottom: 2,
      backgroundColor: 'transparent',
    },
    dmFilterPill: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      paddingHorizontal: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dmFilterPillActive: {
      backgroundColor: theme.accent,
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
      color: theme.accentText,
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
    threadPreviewUnread: {
      color: theme.text,
      fontWeight: '900',
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
      width: 48,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
    },
    threadUnreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
      alignSelf: 'center',
    },
    chatShell: {
      flex: 1,
    },
    chatMessagesScroll: {
      flex: 1,
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    chatHeaderBack: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatHeaderAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.surfaceAlt,
    },
    chatHeaderName: {
      flex: 1,
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
    },
    chatMessages: {
      paddingHorizontal: 18,
      paddingVertical: 10,
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
      marginHorizontal: 12,
      marginBottom: 4,
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
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    attachedEventPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 8,
    },
    attachedEventImage: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
    },
    attachedEventCopy: {
      flex: 1,
      gap: 3,
    },
    attachedEventTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    attachedEventMeta: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    attachedEventRemove: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    chatComposerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    composerCameraButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    composerPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingLeft: 16,
      paddingRight: 6,
      minHeight: 40,
    },
    composerPillTyping: {
      paddingRight: 6,
    },
    composerInput: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      paddingVertical: 8,
      maxHeight: 120,
    },
    composerActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingRight: 4,
    },
    composerIconButton: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerPlusButton: {
      width: 26,
      height: 26,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
    },
    composerSendButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    plusMenuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 80,
    },
    plusMenuCard: {
      minWidth: 200,
      borderRadius: 22,
      paddingVertical: 8,
      paddingHorizontal: 6,
      backgroundColor: 'rgba(20, 20, 24, 0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 18 },
      elevation: 18,
    },
    plusMenuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
    },
    plusMenuLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
    },
    eventsPickerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    eventsPickerSheet: {
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 12,
    },
    eventsPickerHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    eventsPickerTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
      paddingHorizontal: 18,
    },
    eventsPickerList: {
      paddingHorizontal: 18,
      gap: 12,
    },
    eventsPickerEmpty: {
      color: theme.textMuted,
      fontSize: 14,
      paddingHorizontal: 18,
      paddingVertical: 24,
      textAlign: 'center',
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
