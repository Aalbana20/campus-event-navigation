import React, { createContext, useContext, useMemo, useState } from 'react';

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
  sendDmMessage: (threadId: string, text: string) => void;
};

const MobileInboxContext = createContext<MobileInboxContextValue | null>(null);

const timeAgo = (offsetHours: number) => {
  if (offsetHours < 24) return `${offsetHours}h`;
  return `${Math.floor(offsetHours / 24)}d`;
};

export function MobileInboxProvider({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    recentDmPeople,
    events,
    savedEventIds,
    getFollowingForProfile,
  } = useMobileApp();

  const fallbackDmPeople = recentDmPeople.length > 0 ? recentDmPeople : getFollowingForProfile(currentUser.id);
  const defaultDmPerson = fallbackDmPeople[0] || null;
  const reminderEvent =
    events.find((event) => savedEventIds.includes(event.id) && Boolean(event.eventDate)) || events[0] || null;

  const initialThreads = useMemo<MobileDmThread[]>(
    () =>
      fallbackDmPeople.slice(0, 6).map((person, index) => ({
        id: person.id,
        name: person.name,
        username: person.username,
        image: person.avatar,
        preview:
          index === 0
            ? 'You coming to the next event?'
            : 'Tap to keep the conversation going.',
        time: index === 0 ? '2h' : timeAgo(index + 5),
      })),
    [fallbackDmPeople]
  );

  const [notifications, setNotifications] = useState<MobileNotification[]>(() => {
    const seed: MobileNotification[] = [];

    if (defaultDmPerson) {
      seed.push({
        id: `notif-dm-${defaultDmPerson.id}`,
        type: 'dm_received',
        category: 'messages',
        text: `${defaultDmPerson.name} sent you a message`,
        time: '2h',
        image: defaultDmPerson.avatar,
        threadId: defaultDmPerson.id,
        read: false,
      });
    }

    if (reminderEvent) {
      seed.push({
        id: `notif-event-${reminderEvent.id}`,
        type: 'event_reminder',
        category: 'events',
        text: `${reminderEvent.title} is coming up soon`,
        time: '1d',
        image: reminderEvent.image,
        eventTab: 'calendar',
        read: false,
      });
    }

    const followPerson = fallbackDmPeople[1] || defaultDmPerson
    if (followPerson) {
      seed.push({
        id: `notif-follow-${followPerson.id}`,
        type: 'follow',
        category: 'following',
        text: `${followPerson.name} is worth keeping an eye on`,
        time: '3d',
        image: followPerson.avatar,
        username: followPerson.username,
        read: false,
      });
    }

    return seed;
  });

  const [messagesByThread, setMessagesByThread] = useState<Record<string, MobileDmMessage[]>>(() =>
    initialThreads.reduce<Record<string, MobileDmMessage[]>>((collection, thread, index) => {
      collection[thread.id] =
        index === 0
          ? [
              {
                id: `message-${thread.id}-1`,
                sender: 'them',
                text: 'You coming to the next event?',
              },
            ]
          : [
              {
                id: `message-${thread.id}-1`,
                sender: 'them',
                text: 'We should link at the next campus event.',
              },
            ];
      return collection;
    }, {})
  );

  const [unreadDmThreadIds, setUnreadDmThreadIds] = useState<Set<string>>(
    () => new Set(defaultDmPerson ? [defaultDmPerson.id] : [])
  );

  const markNotificationRead = (notificationId: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    );
  };

  const clearNotifications = () => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== notificationId)
    );
  };

  const openDmThread = (threadId: string) => {
    setUnreadDmThreadIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(threadId);
      return nextIds;
    });

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.threadId === threadId ? { ...notification, read: true } : notification
      )
    );
  };

  const sendDmMessage = (threadId: string, text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setMessagesByThread((currentMessages) => ({
      ...currentMessages,
      [threadId]: [
        ...(currentMessages[threadId] || []),
        {
          id: `message-${threadId}-${Date.now()}`,
          sender: 'me',
          text: trimmedText,
        },
      ],
    }));
  };

  const dmThreads = useMemo(
    () =>
      initialThreads.map((thread) => {
        const messages = messagesByThread[thread.id] || [];
        const latestMessage = messages[messages.length - 1];

        return latestMessage
          ? {
              ...thread,
              preview: latestMessage.text,
            }
          : thread;
      }),
    [initialThreads, messagesByThread]
  );

  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;
  const unreadDmCount = unreadDmThreadIds.size;

  const getThreadById = (threadId: string) =>
    dmThreads.find((thread) => String(thread.id) === String(threadId));

  const value = useMemo<MobileInboxContextValue>(
    () => ({
      notifications,
      dmThreads,
      messagesByThread,
      unreadNotificationCount,
      unreadDmCount,
      defaultThreadId: defaultDmPerson?.id || null,
      getThreadById,
      markNotificationRead,
      clearNotifications,
      deleteNotification,
      openDmThread,
      sendDmMessage,
    }),
    [
      notifications,
      dmThreads,
      messagesByThread,
      unreadNotificationCount,
      unreadDmCount,
      defaultDmPerson?.id,
    ]
  );

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
