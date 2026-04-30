import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  formatRelativeTime,
  getDaysUntilDate,
} from '@/lib/mobile-backend';
import { formatDmMessagePreview } from '@/lib/mobile-dm-content';
import { supabase } from '@/lib/supabase';
import { useMobileApp } from '@/providers/mobile-app-provider';

type MobileInboxTab = 'notifications' | 'dms';

type MobileNotification = {
  id: string;
  type:
    | 'follow'
    | 'event_reminder'
    | 'dm_received'
    | 'story_like'
    | 'post_like'
    | 'comment'
    | 'mention'
    | 'system';
  category: 'following' | 'events' | 'messages' | 'comments' | 'mentions' | 'system';
  text: string;
  time: string;
  createdAt?: string;
  image: string;
  previewImage?: string;
  read: boolean;
  actorId?: string;
  threadId?: string;
  username?: string;
  eventId?: string;
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
  isMuted: boolean;
  isPinned: boolean;
};

type MobileDmThreadPreferences = {
  muted: string[];
  pinned: string[];
  deleted: string[];
};

type MobileInboxContextValue = {
  notifications: MobileNotification[];
  dmThreads: MobileDmThread[];
  messagesByThread: Record<string, MobileDmMessage[]>;
  unreadNotificationCount: number;
  unreadDmCount: number;
  unreadDmThreadIds: Set<string>;
  defaultThreadId: string | null;
  getThreadById: (threadId: string) => MobileDmThread | undefined;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  deleteNotification: (notificationId: string) => void;
  markDmThreadRead: (threadId: string) => void;
  toggleDmThreadMuted: (threadId: string) => void;
  toggleDmThreadPinned: (threadId: string) => void;
  deleteDmThread: (threadId: string) => void;
  openDmThread: (threadId: string) => void;
  sendDmMessage: (threadId: string, text: string) => Promise<boolean>;
  deleteDmMessage: (threadId: string, messageId: string) => Promise<void>;
  unsendDmMessage: (threadId: string, messageId: string) => Promise<void>;
};

const MobileInboxContext = createContext<MobileInboxContextValue | null>(null);

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at?: string | null;
  read?: boolean | null;
  deleted_for_sender_at?: string | null;
  deleted_for_recipient_at?: string | null;
  unsent_at?: string | null;
};

type NotificationStateRow = {
  notification_id: string;
  read_at?: string | null;
  deleted_at?: string | null;
};

type DmThreadPreferenceRow = {
  thread_user_id: string;
  muted_at?: string | null;
  pinned_at?: string | null;
  deleted_at?: string | null;
};

const BASE_MESSAGE_SELECT = 'id, sender_id, recipient_id, content, created_at, read';
const VISIBILITY_MESSAGE_SELECT =
  `${BASE_MESSAGE_SELECT}, deleted_for_sender_at, deleted_for_recipient_at, unsent_at`;

const isMissingMessageVisibilityColumnError = (error: { code?: string; message?: string } | null) => {
  const message = error?.message || '';

  return (
    Boolean(error) &&
    /(deleted_for_sender_at|deleted_for_recipient_at|unsent_at)/i.test(message) &&
    (error?.code === '42703' ||
      error?.code === 'PGRST204' ||
      /does not exist|schema cache|column/i.test(message))
  );
};

const createEmptyDmThreadPreferences = (): MobileDmThreadPreferences => ({
  muted: [],
  pinned: [],
  deleted: [],
});

const normalizeDmThreadPreferences = (value: unknown): MobileDmThreadPreferences => {
  if (!value || typeof value !== 'object') {
    return createEmptyDmThreadPreferences();
  }

  const readIds = (key: keyof MobileDmThreadPreferences) =>
    Array.isArray((value as MobileDmThreadPreferences)[key])
      ? [...new Set((value as MobileDmThreadPreferences)[key].map((id) => String(id)).filter(Boolean))]
      : [];

  return {
    muted: readIds('muted'),
    pinned: readIds('pinned'),
    deleted: readIds('deleted'),
  };
};

const normalizeStringList = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.map((id) => String(id)).filter(Boolean))]
    : [];

const toggleDmThreadPreferenceEntry = (
  preferences: MobileDmThreadPreferences,
  key: keyof MobileDmThreadPreferences,
  threadId: string
): MobileDmThreadPreferences => {
  const nextIds = new Set(preferences[key]);
  const normalizedThreadId = String(threadId);

  if (nextIds.has(normalizedThreadId)) {
    nextIds.delete(normalizedThreadId);
  } else {
    nextIds.add(normalizedThreadId);
  }

  return {
    ...preferences,
    [key]: [...nextIds],
  };
};

const removeDmThreadPreferenceEntry = (
  preferences: MobileDmThreadPreferences,
  key: keyof MobileDmThreadPreferences,
  threadId: string
): MobileDmThreadPreferences => ({
  ...preferences,
  [key]: preferences[key].filter((id) => String(id) !== String(threadId)),
});

const normalizeDmThreadPreferencesFromRows = (
  rows: DmThreadPreferenceRow[]
): MobileDmThreadPreferences => ({
  muted: rows.filter((row) => row.muted_at).map((row) => String(row.thread_user_id)),
  pinned: rows.filter((row) => row.pinned_at).map((row) => String(row.thread_user_id)),
  deleted: rows.filter((row) => row.deleted_at).map((row) => String(row.thread_user_id)),
});

const isMessageVisibleForUser = (message: MessageRow, userId: string) => {
  if (!userId || message.unsent_at) return false;
  if (String(message.sender_id) === String(userId)) return !message.deleted_for_sender_at;
  if (String(message.recipient_id) === String(userId)) return !message.deleted_for_recipient_at;
  return false;
};

export function MobileInboxProvider({ children }: { children: React.ReactNode }) {
  const {
    session,
    currentUser,
    events,
    savedEventIds,
    followRelationships,
    getProfileById,
  } = useMobileApp();
  const [messageRows, setMessageRows] = useState<MessageRow[]>([]);
  const [unreadDmThreadIds, setUnreadDmThreadIds] = useState<Set<string>>(new Set());
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [deletedNotificationIds, setDeletedNotificationIds] = useState<Set<string>>(new Set());
  const [dmThreadPreferences, setDmThreadPreferences] = useState<MobileDmThreadPreferences>(
    createEmptyDmThreadPreferences()
  );
  const [locallyDeletedDmMessageIds, setLocallyDeletedDmMessageIds] = useState<Set<string>>(
    new Set()
  );
  const hasInitializedUnreadThreads = useRef(false);
  const locallyDeletedDmMessageIdsRef = useRef<Set<string>>(new Set());
  const dmThreadPreferencesStorageKey = currentUser.id
    ? `mobile-dm-thread-preferences-${currentUser.id}`
    : null;
  const dmMessageDeletesStorageKey = currentUser.id
    ? `mobile-dm-message-deletes-${currentUser.id}`
    : null;

  useEffect(() => {
    if (!dmThreadPreferencesStorageKey) {
      setDmThreadPreferences(createEmptyDmThreadPreferences());
      return;
    }

    let isActive = true;

    const loadPreferences = async () => {
      try {
        const stored = await AsyncStorage.getItem(dmThreadPreferencesStorageKey);
        if (!isActive) return;

        setDmThreadPreferences(
          stored
            ? normalizeDmThreadPreferences(JSON.parse(stored))
            : createEmptyDmThreadPreferences()
        );
      } catch (error) {
        console.error('Unable to load mobile DM thread preferences:', error);
        if (isActive) {
          setDmThreadPreferences(createEmptyDmThreadPreferences());
        }
      }
    };

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, [dmThreadPreferencesStorageKey]);

  useEffect(() => {
    if (!dmThreadPreferencesStorageKey) return;

    void AsyncStorage.setItem(
      dmThreadPreferencesStorageKey,
      JSON.stringify(dmThreadPreferences)
    ).catch((error) => {
      console.error('Unable to persist mobile DM thread preferences:', error);
    });
  }, [dmThreadPreferences, dmThreadPreferencesStorageKey]);

  useEffect(() => {
    if (!dmMessageDeletesStorageKey) {
      setLocallyDeletedDmMessageIds(new Set());
      return;
    }

    let isActive = true;

    const loadDeletedMessageIds = async () => {
      try {
        const stored = await AsyncStorage.getItem(dmMessageDeletesStorageKey);
        if (!isActive) return;

        setLocallyDeletedDmMessageIds(
          new Set(stored ? normalizeStringList(JSON.parse(stored)) : [])
        );
      } catch (error) {
        console.error('Unable to load local mobile DM message deletions:', error);
        if (isActive) {
          setLocallyDeletedDmMessageIds(new Set());
        }
      }
    };

    void loadDeletedMessageIds();

    return () => {
      isActive = false;
    };
  }, [dmMessageDeletesStorageKey]);

  useEffect(() => {
    locallyDeletedDmMessageIdsRef.current = locallyDeletedDmMessageIds;

    if (locallyDeletedDmMessageIds.size === 0) return;

    setMessageRows((currentRows) =>
      currentRows.filter((message) => !locallyDeletedDmMessageIds.has(String(message.id)))
    );
  }, [locallyDeletedDmMessageIds]);

  const persistLocallyDeletedDmMessageIds = (nextIds: Set<string>) => {
    if (!dmMessageDeletesStorageKey) return;

    void AsyncStorage.setItem(
      dmMessageDeletesStorageKey,
      JSON.stringify([...nextIds])
    ).catch((error) => {
      console.error('Unable to persist local mobile DM message deletions:', error);
    });
  };

  const addLocallyDeletedDmMessageId = (messageId: string) => {
    setLocallyDeletedDmMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(String(messageId));
      persistLocallyDeletedDmMessageIds(nextIds);
      return nextIds;
    });
  };

  const removeLocallyDeletedDmMessageId = (messageId: string) => {
    setLocallyDeletedDmMessageIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(String(messageId));
      persistLocallyDeletedDmMessageIds(nextIds);
      return nextIds;
    });
  };

  const persistDmThreadPreferencesToSupabase = (
    previousPreferences: MobileDmThreadPreferences,
    nextPreferences: MobileDmThreadPreferences
  ) => {
    if (!supabase || !session?.user?.id) return;

    const affectedThreadIds = [
      ...new Set([
        ...previousPreferences.muted,
        ...previousPreferences.pinned,
        ...previousPreferences.deleted,
        ...nextPreferences.muted,
        ...nextPreferences.pinned,
        ...nextPreferences.deleted,
      ]),
    ];

    if (affectedThreadIds.length === 0) return;

    const now = new Date().toISOString();
    const rows = affectedThreadIds
      .filter((threadId) => threadId && threadId !== session.user.id)
      .map((threadId) => ({
        user_id: session.user.id,
        thread_user_id: threadId,
        muted_at: nextPreferences.muted.includes(threadId) ? now : null,
        pinned_at: nextPreferences.pinned.includes(threadId) ? now : null,
        deleted_at: nextPreferences.deleted.includes(threadId) ? now : null,
        updated_at: now,
      }));

    if (rows.length === 0) return;

    void supabase
      .from('dm_thread_preferences')
      .upsert(rows, { onConflict: 'user_id,thread_user_id' })
      .then(({ error }) => {
        if (error) console.error('Unable to sync mobile DM thread preferences:', error);
      });
  };

  const updateDmThreadPreferences = (
    updater: (currentPreferences: MobileDmThreadPreferences) => MobileDmThreadPreferences
  ) => {
    setDmThreadPreferences((currentPreferences) => {
      const nextPreferences = updater(currentPreferences);
      persistDmThreadPreferencesToSupabase(currentPreferences, nextPreferences);
      return nextPreferences;
    });
  };

  useEffect(() => {
    const client = supabase;

    if (!client || !session?.user?.id) return;

    let isActive = true;

    const loadRemoteInboxState = async () => {
      const [notificationResult, threadPreferenceResult] = await Promise.all([
        client
          .from('notification_states')
          .select('notification_id, read_at, deleted_at')
          .eq('user_id', session.user.id),
        client
          .from('dm_thread_preferences')
          .select('thread_user_id, muted_at, pinned_at, deleted_at')
          .eq('user_id', session.user.id),
      ]);

      if (!isActive) return;

      if (notificationResult.error) {
        console.error('Unable to load mobile notification states:', notificationResult.error);
      } else {
        const rows = (notificationResult.data || []) as NotificationStateRow[];
        setReadNotificationIds(
          new Set(rows.filter((row) => row.read_at).map((row) => String(row.notification_id)))
        );
        setDeletedNotificationIds(
          new Set(rows.filter((row) => row.deleted_at).map((row) => String(row.notification_id)))
        );
      }

      if (threadPreferenceResult.error) {
        console.error('Unable to load mobile DM thread states:', threadPreferenceResult.error);
      } else {
        setDmThreadPreferences(
          normalizeDmThreadPreferencesFromRows(
            (threadPreferenceResult.data || []) as DmThreadPreferenceRow[]
          )
        );
      }
    };

    void loadRemoteInboxState();

    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

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
      let messageResult = await client
        .from('messages')
        .select(VISIBILITY_MESSAGE_SELECT)
        .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
        .is('unsent_at', null)
        .order('created_at', { ascending: true });

      if (isMissingMessageVisibilityColumnError(messageResult.error)) {
        messageResult = await client
          .from('messages')
          .select(BASE_MESSAGE_SELECT)
          .or(`sender_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
          .order('created_at', { ascending: true });
      }

      if (!isActive) return;

      const { data, error } = messageResult;

      if (error) {
        console.error('Unable to load mobile DMs:', error);
        return;
      }

      const nextRows = ((data || []) as MessageRow[]).filter(
        (message) =>
          isMessageVisibleForUser(message, session.user.id) &&
          !locallyDeletedDmMessageIdsRef.current.has(String(message.id))
      );
      setMessageRows(nextRows);

      if (!hasInitializedUnreadThreads.current) {
        const nextUnread = new Set<string>();

        nextRows.forEach((message) => {
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

          updateDmThreadPreferences((currentPreferences) =>
            removeDmThreadPreferenceEntry(
              currentPreferences,
              'deleted',
              String(nextMessage.sender_id)
            )
          );

          setMessageRows((currentRows) => {
            if (locallyDeletedDmMessageIdsRef.current.has(String(nextMessage.id))) {
              return currentRows;
            }

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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${session.user.id}`,
        },
        (payload) => {
          const nextMessage = payload.new as MessageRow;

          setMessageRows((currentRows) => {
            const visible =
              isMessageVisibleForUser(nextMessage, session.user.id) &&
              !locallyDeletedDmMessageIdsRef.current.has(String(nextMessage.id));
            if (!visible) {
              return currentRows.filter((message) => String(message.id) !== String(nextMessage.id));
            }
            if (currentRows.some((message) => String(message.id) === String(nextMessage.id))) {
              return currentRows.map((message) =>
                String(message.id) === String(nextMessage.id) ? nextMessage : message
              );
            }
            return [...currentRows, nextMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${session.user.id}`,
        },
        (payload) => {
          const nextMessage = payload.new as MessageRow;

          setMessageRows((currentRows) => {
            const visible =
              isMessageVisibleForUser(nextMessage, session.user.id) &&
              !locallyDeletedDmMessageIdsRef.current.has(String(nextMessage.id));
            if (!visible) {
              return currentRows.filter((message) => String(message.id) !== String(nextMessage.id));
            }
            if (currentRows.some((message) => String(message.id) === String(nextMessage.id))) {
              return currentRows.map((message) =>
                String(message.id) === String(nextMessage.id) ? nextMessage : message
              );
            }
            return [...currentRows, nextMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const deletedMessageId = String((payload.old as Partial<MessageRow>)?.id || '');
          if (!deletedMessageId) return;

          setMessageRows((currentRows) =>
            currentRows.filter((message) => String(message.id) !== deletedMessageId)
          );
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

    const pinnedIds = new Set(dmThreadPreferences.pinned);
    const mutedIds = new Set(dmThreadPreferences.muted);
    const deletedIds = new Set(dmThreadPreferences.deleted);
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
          image: profile?.avatar || '',
          preview: formatDmMessagePreview(message.content),
          time: formatRelativeTime(message.created_at),
          isMuted: mutedIds.has(threadId),
          isPinned: pinnedIds.has(threadId),
        });
      });

    return [...threadsById.values()]
      .filter((thread) => !deletedIds.has(String(thread.id)))
      .sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
          return left.isPinned ? -1 : 1;
        }

        return 0;
      });
  }, [currentUser.id, dmThreadPreferences.deleted, dmThreadPreferences.muted, dmThreadPreferences.pinned, getProfileById, messageRows]);

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
          createdAt: relationship.createdAt,
          image: follower?.avatar || currentUser.avatar,
          read: false,
          actorId: relationship.followerId,
          username: follower?.username,
        };
      });

    notifications.push(...followerNotifications);

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
          time: diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `${Math.max(diffDays, 0)}d`,
          createdAt: event.createdAt || new Date().toISOString(),
          image: event.creatorAvatar || event.image,
          previewImage: event.image,
          read: false,
          actorId: event.createdBy,
          eventId: event.id,
          eventTab: 'calendar',
        });
      });

    return notifications
      .filter((notification) => !deletedNotificationIds.has(notification.id))
      .map((notification) => ({
        ...notification,
        read: readNotificationIds.has(notification.id),
      }))
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [
    currentUser.avatar,
    currentUser.id,
    deletedNotificationIds,
    events,
    followRelationships,
    getProfileById,
    readNotificationIds,
    savedEventIds,
  ]);

  const unreadNotificationCount = derivedNotifications.filter(
    (notification) => !notification.read
  ).length;
  const unreadDmCount = unreadDmThreadIds.size;

  const persistNotificationState = (
    notificationId: string,
    state: { readAt?: string | null; deletedAt?: string | null }
  ) => {
    if (!supabase || !session?.user?.id || !notificationId) return;

    const now = new Date().toISOString();

    void supabase
      .from('notification_states')
      .upsert(
        {
          user_id: session.user.id,
          notification_id: notificationId,
          read_at: state.readAt,
          deleted_at: state.deletedAt,
          updated_at: now,
        },
        { onConflict: 'user_id,notification_id' }
      )
      .then(({ error }) => {
        if (error) console.error('Unable to sync mobile notification state:', error);
      });
  };

  const markNotificationRead = (notificationId: string) => {
    const now = new Date().toISOString();

    setReadNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(notificationId);
      return nextIds;
    });

    persistNotificationState(notificationId, {
      readAt: now,
      deletedAt: deletedNotificationIds.has(notificationId) ? now : null,
    });
  };

  const clearNotifications = () => {
    const now = new Date().toISOString();

    setReadNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);

      derivedNotifications.forEach((notification) => {
        nextIds.add(notification.id);
        persistNotificationState(notification.id, {
          readAt: now,
          deletedAt: deletedNotificationIds.has(notification.id) ? now : null,
        });
      });

      return nextIds;
    });
  };

  const deleteNotification = (notificationId: string) => {
    const now = new Date().toISOString();

    setDeletedNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(notificationId);
      return nextIds;
    });

    persistNotificationState(notificationId, {
      readAt: readNotificationIds.has(notificationId) ? now : null,
      deletedAt: now,
    });
  };

  const markDmThreadRead = (threadId: string) => {
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

  const openDmThread = (threadId: string) => {
    updateDmThreadPreferences((currentPreferences) =>
      removeDmThreadPreferenceEntry(currentPreferences, 'deleted', threadId)
    );
    markDmThreadRead(threadId);
  };

  const toggleDmThreadMuted = (threadId: string) => {
    updateDmThreadPreferences((currentPreferences) =>
      toggleDmThreadPreferenceEntry(currentPreferences, 'muted', threadId)
    );
  };

  const toggleDmThreadPinned = (threadId: string) => {
    updateDmThreadPreferences((currentPreferences) =>
      toggleDmThreadPreferenceEntry(currentPreferences, 'pinned', threadId)
    );
  };

  const deleteDmThread = (threadId: string) => {
    updateDmThreadPreferences((currentPreferences) =>
      toggleDmThreadPreferenceEntry(
        removeDmThreadPreferenceEntry(currentPreferences, 'pinned', threadId),
        'deleted',
        threadId
      )
    );

    setUnreadDmThreadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(threadId);
      return nextIds;
    });
  };

  const sendDmMessage = async (threadId: string, text: string) => {
    if (!supabase || !currentUser.id) return false;

    const trimmedText = text.trim();
    if (!trimmedText) return false;

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
      return false;
    }

    setMessageRows((currentRows) =>
      currentRows.map((message) =>
        message.id === tempId ? ((data as MessageRow) || message) : message
      )
    );
    return true;
  };

  const deleteDmMessage = async (threadId: string, messageId: string) => {
    if (!messageId) return;

    if (String(messageId).startsWith('temp-')) {
      setMessageRows((currentRows) =>
        currentRows.filter((message) => String(message.id) !== String(messageId))
      );
      return;
    }

    if (!supabase || !currentUser.id) return;

    const previousRows = messageRows;
    addLocallyDeletedDmMessageId(messageId);
    setMessageRows((currentRows) =>
      currentRows.filter((message) => String(message.id) !== String(messageId))
    );

    const targetMessage = messageRows.find(
      (message) => String(message.id) === String(messageId)
    );
    const deletedAtColumn =
      targetMessage?.sender_id === currentUser.id
        ? 'deleted_for_sender_at'
        : 'deleted_for_recipient_at';

    const { data, error } = await supabase
      .from('messages')
      .update({ [deletedAtColumn]: new Date().toISOString() })
      .eq('id', messageId)
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .select('id');

    if (isMissingMessageVisibilityColumnError(error)) {
      return;
    }

    if (error || !data?.length) {
      console.error('Unable to delete mobile DM:', error || 'No message row deleted');
      removeLocallyDeletedDmMessageId(messageId);
      setMessageRows(previousRows);
      openDmThread(threadId);
    }
  };

  const unsendDmMessage = async (threadId: string, messageId: string) => {
    if (!messageId || !supabase || !currentUser.id) return;

    const previousRows = messageRows;
    setMessageRows((currentRows) =>
      currentRows.filter((message) => String(message.id) !== String(messageId))
    );

    const { data, error } = await supabase
      .from('messages')
      .update({ unsent_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', currentUser.id)
      .select('id');

    if (isMissingMessageVisibilityColumnError(error)) {
      const { data: deletedData, error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', currentUser.id)
        .select('id');

      if (!deleteError && deletedData?.length) {
        return;
      }

      console.error('Unable to unsend mobile DM:', deleteError || 'No message row unsent');
      setMessageRows(previousRows);
      openDmThread(threadId);
      return;
    }

    if (error || !data?.length) {
      console.error('Unable to unsend mobile DM:', error || 'No message row unsent');
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
    unreadDmThreadIds,
    defaultThreadId: dmThreads[0]?.id || null,
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
    unsendDmMessage,
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
