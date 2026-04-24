import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
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
import { getAvatarImageSource } from '@/lib/mobile-media';
import {
  MobileDmThread,
  MobileInboxTab,
  useMobileInbox,
} from '@/providers/mobile-inbox-provider';
import { useMobileApp } from '@/providers/mobile-app-provider';

import { AppScreen } from './AppScreen';
import { DmEventPreviewCard } from './DmEventPreviewCard';
import { IconSymbol } from '@/components/ui/icon-symbol';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '＋'];
const MESSAGE_MENU_WIDTH = 260;
const THREAD_ACTION_SWIPE_WIDTH = 166;

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
            <Text style={styles.threadPreview} numberOfLines={1}>
              {thread.preview}
            </Text>
            <View style={styles.threadMetaRow}>
              <Text style={styles.threadTime}>{thread.time}</Text>
              <View style={styles.threadStateRow}>
                {thread.isPinned ? (
                  <View style={styles.threadStatePill}>
                    <Ionicons name="pin" size={11} color={theme.textMuted} />
                  </View>
                ) : null}
                {thread.isMuted ? (
                  <View style={styles.threadStatePill}>
                    <Ionicons name="volume-mute" size={11} color={theme.textMuted} />
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.threadAside}>
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
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
    unreadNotificationCount,
    unreadDmThreadIds,
    getThreadById,
    markNotificationRead,
    clearNotifications,
    deleteNotification,
    markDmThreadRead,
    toggleDmThreadMuted,
    toggleDmThreadPinned,
    deleteDmThread,
    openDmThread,
    sendDmMessage,
    deleteDmMessage,
  } = useMobileInbox();
  const { getEventById } = useMobileApp();
  const [internalTab, setInternalTab] = useState<MobileInboxTab>(lockedTab || initialTab);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [activeMessageMenu, setActiveMessageMenu] = useState<ActiveMessageMenu | null>(null);
  const [activeThreadMenu, setActiveThreadMenu] = useState<MobileDmThread | null>(null);
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
      router.push({
        pathname: '/(tabs)/events',
        params: { tab: notification.eventTab || 'calendar' },
      });
      return;
    }

    if (notification.type === 'follow' && notification.username) {
      router.push({
        pathname: '/profile/[username]',
        params: { username: notification.username },
      });
    }
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

        {!lockedTab ? (
          <View style={styles.segmentedRow}>
            <Pressable
              style={[styles.segmentedButton, activeTab === 'notifications' && styles.segmentedButtonActive]}
              onPress={() => setInternalTab('notifications')}>
              <Text
                style={[styles.segmentedText, activeTab === 'notifications' && styles.segmentedTextActive]}>
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

        {activeTab === 'notifications' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.utilityRow}>
              <Text style={styles.utilityText}>{unreadNotificationCount} unread</Text>
              <Pressable
                style={[styles.utilityButton, unreadNotificationCount === 0 && styles.utilityButtonDisabled]}
                onPress={clearNotifications}
                disabled={unreadNotificationCount === 0}>
                <Text style={styles.utilityButtonText}>Clear all</Text>
              </Pressable>
            </View>

            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <Pressable
                  key={notification.id}
                  style={[styles.notificationCard, notification.read && styles.notificationReadCard]}
                  onPress={() => handleNotificationPress(notification.id, notification)}>
                  <View style={styles.notificationAvatar}>
                    <Ionicons
                      name={
                        notification.type === 'dm_received'
                          ? 'paper-plane-outline'
                          : notification.type === 'event_reminder'
                            ? 'calendar-outline'
                            : 'person-add-outline'
                      }
                      size={18}
                      color={theme.text}
                    />
                  </View>
                  <View style={styles.notificationCopy}>
                    <Text style={styles.notificationText}>{notification.text}</Text>
                    <Text style={styles.notificationMeta}>{notification.time}</Text>
                  </View>
                  <View style={styles.notificationActions}>
                    {!notification.read ? <View style={styles.unreadDot} /> : null}
                    <Pressable
                      style={styles.deleteButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        deleteNotification(notification.id);
                      }}>
                      <Ionicons name="close" size={16} color={theme.textMuted} />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No notifications right now.</Text>
                <Text style={styles.emptyCopy}>Fresh updates will land here as people and events move.</Text>
              </View>
            )}
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
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {dmThreads.length > 0 ? (
              dmThreads.map((thread) => (
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No DM threads yet.</Text>
                <Text style={styles.emptyCopy}>
                  Message people from profiles and event shares to start conversations.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

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
      gap: 12,
      paddingBottom: 120,
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
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
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
      paddingVertical: 10,
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
      padding: 16,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    threadCardOpen: {
      borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    threadAvatarImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.surfaceAlt,
    },
    threadCopy: {
      flex: 1,
      gap: 3,
    },
    threadName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    threadPreview: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    threadMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
      minWidth: 10,
      alignItems: 'flex-end',
      justifyContent: 'center',
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
