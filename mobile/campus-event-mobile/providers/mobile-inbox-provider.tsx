import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  formatRelativeTime,
  getDaysUntilDate,
} from '@/lib/mobile-backend';
import { supabase } from '@/lib/supabase';
import { useMobileApp } from '@/providers/mobile-app-provider';

type MobileInboxTab = 'notifications' | 'dms';

type MobileNotification = {
  id: string;
  type: 'follow' | 'event_reminder' | 'dm_received';
  category: 'following' | 'events' | 'messages';
  text: string;
  time: string;
  image: string;
  read: boolean;
  threadId?: string;
  username?: string;
  eventTab?: 'my-events' | 'calendar' | 'create';
};

type MobileDmMessage = {
  id: string;
  sender: 'me' | 'them';
  text: string;
};

type MobileDmThread = {
  id: string;
  name: string;
  username: string;
  image: string;
  preview: string;
  time: string;
};

type MobileInboxContextValue = {
  notifications: MobileNotification[];
  dmThreads: MobileDmThread[];
  messagesByThread: Record<string, MobileDmMessage[]>;
  unreadNotificationCount: number;
  unreadDmCount: number;
  defaultThreadId: string | null;
  getThreadById: (threadId: string) => MobileDmThread | undefined;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  deleteNotification: (notificationId: string) => void;
  openDmThread: (threadId: string) => void;
  sendDmMessage: (threadId: string, text: string) => Promise<void>;
  deleteDmMessage: (threadId: string, messageId: string) => Promise<void>;
};

const MobileInboxContext = createContext<MobileInboxContextValue | null>(null);

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at?: string | null;
};

export function MobileInboxProvider({ children }: { children: React.ReactNode }) {
  const {
    session,
    currentUser,
    events,
    savedEventIds,
    recentDmPeople,
    followRelationships,
    getProfileById,
  } = useMobileApp();
  const [messageRows, setMessageRows] = useState<MessageRow[]>([]);
  const [unreadDmThreadIds, setUnreadDmThreadIds] = useState<Set<string>>(new Set());
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<Set<string>>(new Set());
  const hasInitializedUnreadThreads = useRef(false);

  useEffect(() => {
    const client = supabase;

    if (!client || !session?.user?.id) {
      setMessageRows([]);
      setUnreadDmThreadIds(new Set());
      setReadNotificationIds(new Set());
      setDeletedNotificationIds(new Set());
      hasInitializedUnreadThreads.current = false;
      return;
    }

    let isActive = true;

    const loadMessages = async () => {
      const { data, error } = await client
        .from('messages')
        .select('id, sender_id, recipient_id, content, created_at, read')
        .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
        .order('created_at', { ascending: true });

      if (!isActive) return;

      if (error) {
        console.error('Unable to load mobile DMs:', error);
        return;
      }

      const nextRows = (data || []) as MessageRow[];
      setMessageRows(nextRows);

      if (!hasInitializedUnreadThreads.current) {
        const nextUnread = new Set<string>();

        nextRows.forEach((message: MessageRow & { read?: boolean }) => {
          if (message.recipient_id === session.user.id && !message.read) {
            nextUnread.add(message.sender_id);
          }
        });

        setUnreadDmThreadIds(nextUnread);
        hasInitializedUnreadThreads.current = true;
      }
    };

    void loadMessages();

    const channel = client
      .channel(`mobile-messages-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${session.user.id}`,
        },
        (payload) => {
          const nextMessage = payload.new as MessageRow;

          setMessageRows((currentRows) => {
            if (currentRows.some((message) => message.id === nextMessage.id)) {
              return currentRows;
            }

            return [...currentRows, nextMessage];
          });

          setUnreadDmThreadIds((currentIds) => {
            const nextIds = new Set(currentIds);
            nextIds.add(String(nextMessage.sender_id));
            return nextIds;
          });
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void client.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const dmThreads = useMemo(() => {
    if (!currentUser.id) return [];

    const threadsById = new Map<string, MobileDmThread>();

    [...messageRows]
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
        return rightTime - leftTime;
      })
      .forEach((message) => {
        const threadId =
          message.sender_id === currentUser.id
            ? String(message.recipient_id)
            : String(message.sender_id);

        if (threadsById.has(threadId)) return;

        const profile = getProfileById(threadId);

        threadsById.set(threadId, {
          id: threadId,
          name: profile?.name || 'Campus User',
          username: profile?.username || '',
          image: profile?.avatar || currentUser.avatar,
          preview: message.content,
          time: formatRelativeTime(message.created_at),
        });
      });

    if (threadsById.size === 0) {
      recentDmPeople.forEach((profile) => {
        if (threadsById.has(profile.id)) return;
        threadsById.set(profile.id, {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          image: profile.avatar,
          preview: 'Start a conversation',
          time: 'new',
        });
      });
    }

    return [...threadsById.values()];
  }, [currentUser.avatar, currentUser.id, getProfileById, messageRows, recentDmPeople]);

  const messagesByThread = useMemo(
    () =>
      messageRows.reduce<Record<string, MobileDmMessage[]>>((collection, message) => {
        const threadId =
          message.sender_id === currentUser.id
            ? String(message.recipient_id)
            : String(message.sender_id);

        if (!collection[threadId]) {
          collection[threadId] = [];
        }

        collection[threadId].push({
          id: String(message.id),
          sender: message.sender_id === currentUser.id ? 'me' : 'them',
          text: message.content,
        });

        return collection;
      }, {}),
    [currentUser.id, messageRows]
  );

  const derivedNotifications = useMemo(() => {
    const notifications: MobileNotification[] = [];

    const followerNotifications = followRelationships
      .filter((relationship) => relationship.followingId === currentUser.id)
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 6)
      .map((relationship) => {
        const follower = getProfileById(relationship.followerId);

        return {
          id: `follow-${relationship.followerId}-${relationship.createdAt || 'recent'}`,
          type: 'follow' as const,
          category: 'following' as const,
          text: `${follower?.name || follower?.username || 'Someone'} followed you`,
          time: formatRelativeTime(relationship.createdAt),
          image: follower?.avatar || currentUser.avatar,
          read: false,
          username: follower?.username,
        };
      });

    notifications.push(...followerNotifications);

    const latestIncomingByThread = new Map<string, MessageRow>();

    [...messageRows]
      .filter((message) => String(message.recipient_id) === String(currentUser.id))
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
        return rightTime - leftTime;
      })
      .forEach((message) => {
        const threadId = String(message.sender_id);
        if (!latestIncomingByThread.has(threadId)) {
          latestIncomingByThread.set(threadId, message);
        }
      });

    latestIncomingByThread.forEach((message, threadId) => {
      const profile =
        getProfileById(threadId) ||
        recentDmPeople.find((person) => person.id === threadId);

      notifications.push({
        id: `message-${message.id}`,
        type: 'dm_received',
        category: 'messages',
        text: `${profile?.name || profile?.username || 'Someone'} sent you a message`,
        time: formatRelativeTime(message.created_at),
        image: profile?.avatar || currentUser.avatar,
        read: false,
        threadId,
      });
    });

    events
      .filter((event) => savedEventIds.includes(event.id))
      .forEach((event) => {
        const diffDays = getDaysUntilDate(event.eventDate);
        if (diffDays === null || diffDays < 0 || diffDays > 7) return;

        notifications.push({
          id: `event-${event.id}`,
          type: 'event_reminder',
          category: 'events',
          text:
            diffDays === 0
              ? `${event.title} is happening today`
              : `${event.title} is coming up in ${diffDays}d`,
          time: `${Math.max(diffDays, 0)}d`,
          image: event.image,
          read: false,
          eventTab: 'calendar',
        });
      });

    return notifications
      .filter((notification) => !deletedNotificationIds.has(notification.id))
      .map((notification) => ({
        ...notification,
        read: Boolean(
          readNotificationIds.has(notification.id) ||
          (notification.type === 'dm_received' &&
            notification.threadId &&
            !unreadDmThreadIds.has(notification.threadId))
        ),
      }))
      .sort((left, right) => {
        const categoryWeight = {
          messages: 0,
          following: 1,
          events: 2,
        };

        return categoryWeight[left.category] - categoryWeight[right.category];
      });
  }, [
    currentUser.avatar,
    currentUser.id,
    deletedNotificationIds,
    events,
    followRelationships,
    getProfileById,
    messageRows,
    readNotificationIds,
    recentDmPeople,
    savedEventIds,
    unreadDmThreadIds,
  ]);

  const unreadNotificationCount = derivedNotifications.filter(
    (notification) => !notification.read
  ).length;
  const unreadDmCount = unreadDmThreadIds.size;

  const markNotificationRead = (notificationId: string) => {
    setReadNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(notificationId);
      return nextIds;
    });
  };

  const clearNotifications = () => {
    setReadNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);

      derivedNotifications.forEach((notification) => {
        nextIds.add(notification.id);
      });

      return nextIds;
    });
  };

  const deleteNotification = (notificationId: string) => {
    setDeletedNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(notificationId);
      return nextIds;
    });
  };

  const openDmThread = (threadId: string) => {
    setUnreadDmThreadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(threadId);
      return nextIds;
    });

    if (supabase && session?.user?.id) {
      void supabase
        .from('messages')
        .update({ read: true })
        .eq('recipient_id', session.user.id)
        .eq('sender_id', threadId)
        .eq('read', false);
    }
  };

  const sendDmMessage = async (threadId: string, text: string) => {
    if (!supabase || !currentUser.id) return;

    const trimmedText = text.trim();
    if (!trimmedText) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageRow = {
      id: tempId,
      sender_id: currentUser.id,
      recipient_id: threadId,
      content: trimmedText,
      created_at: new Date().toISOString(),
    };

    setMessageRows((currentRows) => [...currentRows, optimisticMessage]);
    openDmThread(threadId);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        recipient_id: threadId,
        content: trimmedText,
      })
      .select('id, sender_id, recipient_id, content, created_at')
      .single();

    if (error) {
      console.error('Unable to send mobile DM:', error);
      setMessageRows((currentRows) =>
        currentRows.filter((message) => message.id !== tempId)
      );
      return;
    }

    setMessageRows((currentRows) =>
      currentRows.map((message) =>
        message.id === tempId ? ((data as MessageRow) || message) : message
      )
    );
  };

  const deleteDmMessage = async (threadId: string, messageId: string) => {
    if (!messageId) return;

    const previousRows = messageRows;
    setMessageRows((currentRows) =>
      currentRows.filter((message) => String(message.id) !== String(messageId))
    );

    if (String(messageId).startsWith('temp-')) return;

    if (!supabase || !currentUser.id) return;

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`);

    if (error) {
      console.error('Unable to delete mobile DM:', error);
      setMessageRows(previousRows);
      openDmThread(threadId);
    }
  };

  const getThreadById = (threadId: string) =>
    dmThreads.find((thread) => String(thread.id) === String(threadId));

  const value: MobileInboxContextValue = {
    notifications: derivedNotifications,
    dmThreads,
    messagesByThread,
    unreadNotificationCount,
    unreadDmCount,
    defaultThreadId: dmThreads[0]?.id || null,
    getThreadById,
    markNotificationRead,
    clearNotifications,
    deleteNotification,
    openDmThread,
    sendDmMessage,
    deleteDmMessage,
  };

  return <MobileInboxContext.Provider value={value}>{children}</MobileInboxContext.Provider>;
}

export function useMobileInbox() {
  const context = useContext(MobileInboxContext);

  if (!context) {
    throw new Error('useMobileInbox must be used within a MobileInboxProvider');
  }

  return context;
}

export type { MobileDmThread, MobileInboxTab, MobileNotification };
