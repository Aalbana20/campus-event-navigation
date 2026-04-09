import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
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

export function InboxScreen() {
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
  } = useMobileInbox();
  const [activeTab, setActiveTab] = useState<MobileInboxTab>('notifications');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');

  useEffect(() => {
    if (params.tab === 'dms' || params.tab === 'notifications') {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  useEffect(() => {
    if (!params.dm || Array.isArray(params.dm)) return;

    setActiveTab('dms');
    setActiveThreadId(params.dm);
    openDmThread(params.dm);
  }, [openDmThread, params.dm]);

  const activeThread = activeThreadId ? getThreadById(activeThreadId) : null;

  const handleNotificationPress = (notificationId: string, notification: typeof notifications[number]) => {
    markNotificationRead(notificationId);

    if (notification.type === 'dm_received' && notification.threadId) {
      setActiveTab('dms');
      setActiveThreadId(notification.threadId);
      openDmThread(notification.threadId);
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
  };

  return (
    <AppScreen>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.title}>Activity</Text>
            <Text style={styles.subtitle}>Notifications and DMs stay together here.</Text>
          </View>
        </View>

        <View style={styles.segmentedRow}>
          <Pressable
            style={[styles.segmentedButton, activeTab === 'notifications' && styles.segmentedButtonActive]}
            onPress={() => setActiveTab('notifications')}>
            <Text
              style={[styles.segmentedText, activeTab === 'notifications' && styles.segmentedTextActive]}>
              Notifications
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentedButton, activeTab === 'dms' && styles.segmentedButtonActive]}
            onPress={() => setActiveTab('dms')}>
            <Text style={[styles.segmentedText, activeTab === 'dms' && styles.segmentedTextActive]}>
              DMs
            </Text>
          </Pressable>
        </View>

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
                <View
                  key={message.id}
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
                </View>
              ))}
            </ScrollView>

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
  });
