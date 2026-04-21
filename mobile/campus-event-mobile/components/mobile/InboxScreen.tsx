import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { MobileInboxTab, useMobileInbox } from '@/providers/mobile-inbox-provider';

import { AppScreen } from './AppScreen';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '＋'];
const MESSAGE_MENU_WIDTH = 300;

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
    getThreadById,
    markNotificationRead,
    clearNotifications,
    deleteNotification,
    openDmThread,
    sendDmMessage,
    deleteDmMessage,
  } = useMobileInbox();
  const [internalTab, setInternalTab] = useState<MobileInboxTab>(lockedTab || initialTab);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [activeMessageMenu, setActiveMessageMenu] = useState<ActiveMessageMenu | null>(null);
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
    setActiveThreadId(threadId);
    openDmThread(threadId);
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
    const top = Math.min(Math.max(72, pageY - 88), height - 360);

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
              {(messagesByThread[activeThread.id] || []).map((message) => (
                <Pressable
                  key={message.id}
                  delayLongPress={360}
                  onLongPress={(event) => openMessageMenu(message, event)}
                  style={[
                    styles.chatBubble,
                    message.sender === 'me' ? styles.chatBubbleMe : styles.chatBubbleThem,
                  ]}>
                  <Text
                    style={[
                      styles.chatBubbleText,
                      message.sender === 'me' && styles.chatBubbleTextMe,
                    ]}>
                    {message.text}
                  </Text>
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
              ))}
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
                        <Ionicons name="arrow-undo-outline" size={23} color={theme.text} />
                        <Text style={styles.messageActionText}>Reply</Text>
                      </Pressable>
                      <Pressable style={styles.messageActionRow} onPress={handleAddSticker}>
                        <Ionicons name="images-outline" size={23} color={theme.text} />
                        <Text style={styles.messageActionText}>Add sticker</Text>
                      </Pressable>
                      <Pressable style={styles.messageActionRow} onPress={handleDeleteMessage}>
                        <Ionicons name="trash-outline" size={23} color="#ff6b8a" />
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
                <Pressable
                  key={thread.id}
                  style={styles.threadCard}
                  onPress={() => handleOpenThread(thread.id)}>
                  <View style={styles.threadAvatar}>
                    <Ionicons name="paper-plane-outline" size={18} color={theme.text} />
                  </View>
                  <View style={styles.threadCopy}>
                    <Text style={styles.threadName}>{thread.name}</Text>
                    <Text style={styles.threadPreview} numberOfLines={1}>
                      {thread.preview}
                    </Text>
                  </View>
                  <Text style={styles.threadTime}>{thread.time}</Text>
                </Pressable>
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
    threadAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
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
    threadTime: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
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
      backgroundColor: 'rgba(0, 0, 0, 0.32)',
    },
    messageMenuShell: {
      position: 'absolute',
      width: MESSAGE_MENU_WIDTH,
      gap: 12,
    },
    reactionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 999,
      padding: 8,
      backgroundColor: 'rgba(18, 22, 29, 0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    reactionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionText: {
      fontSize: 24,
      lineHeight: 28,
    },
    messageActionMenu: {
      borderRadius: 24,
      padding: 8,
      backgroundColor: 'rgba(24, 22, 34, 0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 14,
    },
    messageActionRow: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 16,
      paddingHorizontal: 12,
    },
    messageActionText: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
    },
    messageActionDanger: {
      color: '#ff6b8a',
    },
  });
