import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import { router } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Share } from 'react-native';

import type { DiscoverPostRecord } from '@/lib/mobile-discover-posts';
import { buildEventShareMessage } from '@/lib/mobile-event-share';
import type { EventRecord, ProfileRecord } from '@/types/models';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';

import {
  MobileShareSheet,
  type ShareSheetActionKey,
  type ShareSheetSendMode,
} from '@/components/mobile/MobileShareSheet';

export type SharePayload =
  | { kind: 'post'; post: DiscoverPostRecord }
  | { kind: 'video'; post: DiscoverPostRecord }
  | { kind: 'event'; event: EventRecord };

type MobileShareContextValue = {
  openShareSheet: (payload: SharePayload) => void;
  closeShareSheet: () => void;
};

const MobileShareContext = createContext<MobileShareContextValue | null>(null);

const buildPostShareMessage = (post: DiscoverPostRecord) => {
  const postLink = ExpoLinking.createURL(`/post/${post.id}`);
  const byline = post.authorUsername
    ? `@${post.authorUsername}`
    : post.authorName || 'Campus';
  const caption = (post.caption || '').trim();
  const body = [
    `Check this out from ${byline}`,
    caption,
    postLink,
  ]
    .filter(Boolean)
    .join('\n');

  return { body, link: postLink };
};

export function MobileShareSheetProvider({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    followingProfiles,
    recentDmPeople,
    repostEvent,
    repostPost,
  } = useMobileApp();
  const { sendDmMessage } = useMobileInbox();

  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = payload !== null;

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const flashToast = useCallback(
    (message: string) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      setToast(message);
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 1600);
    },
    []
  );

  const openShareSheet = useCallback(
    (nextPayload: SharePayload) => {
      clearToast();
      setPayload(nextPayload);
    },
    [clearToast]
  );

  const closeShareSheet = useCallback(() => {
    setPayload(null);
    clearToast();
  }, [clearToast]);

  const people = useMemo<ProfileRecord[]>(
    () => [...recentDmPeople, ...followingProfiles],
    [followingProfiles, recentDmPeople]
  );

  const preview = useMemo(() => {
    if (!payload) return null;
    if (payload.kind === 'event') {
      const event = payload.event;
      const metaParts = [event.date, event.time, event.host || event.organizer].filter(
        Boolean
      );
      return {
        title: event.title || 'Campus Event',
        subtitle: metaParts.join(' • ') || undefined,
        image: event.image || undefined,
      };
    }

    const post = payload.post;
    const byline = post.authorUsername
      ? `@${post.authorUsername}`
      : post.authorName || 'Campus';
    return {
      title: post.caption?.trim() || byline,
      subtitle: payload.kind === 'video' ? `Video • ${byline}` : byline,
      image: post.thumbnailUrl || post.mediaUrl || undefined,
    };
  }, [payload]);

  const sheetTitle = useMemo(() => {
    if (!payload) return 'Share';
    if (payload.kind === 'event') return 'Share event';
    if (payload.kind === 'video') return 'Share video';
    return 'Share post';
  }, [payload]);

  const buildMessageForPayload = useCallback(() => {
    if (!payload) return { body: '', link: '' };
    if (payload.kind === 'event') {
      const built = buildEventShareMessage(payload.event);
      return { body: built.body, link: built.eventLink };
    }
    return buildPostShareMessage(payload.post);
  }, [payload]);

  const handleSendToRecipients = useCallback(
    async (
      recipients: ProfileRecord[],
      customMessage: string,
      mode: ShareSheetSendMode
    ) => {
      if (!payload || recipients.length === 0) return;

      if (mode === 'group') {
        // Group DM infrastructure isn't wired yet — don't invent a send that
        // doesn't actually deliver. Surface it and keep the sheet open.
        flashToast('Group chat — coming soon');
        return;
      }

      const { body } = buildMessageForPayload();
      const trimmedCustom = customMessage.trim();
      const composedBody = trimmedCustom ? `${trimmedCustom}\n\n${body}` : body;

      try {
        await Promise.all(
          recipients.map((profile) =>
            sendDmMessage(String(profile.id), composedBody)
          )
        );

        if (recipients.length === 1) {
          const only = recipients[0];
          flashToast(
            `Sent to ${only.username ? '@' + only.username : only.name || 'recipient'}`
          );
        } else {
          flashToast(`Sent to ${recipients.length} people`);
        }

        setTimeout(() => {
          closeShareSheet();
        }, 500);
      } catch {
        Alert.alert('Share', 'Could not send that right now.');
      }
    },
    [buildMessageForPayload, closeShareSheet, flashToast, payload, sendDmMessage]
  );

  const handleAddToStory = useCallback(() => {
    if (!payload) return;

    closeShareSheet();

    if (payload.kind === 'event') {
      router.push({
        pathname: '/story/share',
        params: { sharedEventId: String(payload.event.id) },
      });
      return;
    }

    // Post / video share-to-story editors aren't built out yet — fall back to the
    // camera-first composer with the shared id on the URL so the follow-up pass
    // can render them there.
    const params: Record<string, string> =
      payload.kind === 'video'
        ? { sharedVideoId: String(payload.post.id) }
        : { sharedPostId: String(payload.post.id) };

    router.push({ pathname: '/story/create', params });
  }, [closeShareSheet, payload]);

  const handleRepost = useCallback(async () => {
    if (!payload) return;

    try {
      if (payload.kind === 'event') {
        await repostEvent(String(payload.event.id));
        flashToast('Reposted to your profile');
      } else {
        await repostPost(String(payload.post.id));
        flashToast('Reposted to your profile');
      }
    } catch {
      Alert.alert('Repost', 'Could not repost right now.');
    }
  }, [flashToast, payload, repostEvent, repostPost]);

  const handleCopyLink = useCallback(async () => {
    if (!payload) return;

    const { link } = buildMessageForPayload();
    if (!link) {
      Alert.alert('Copy link', 'No link is available yet.');
      return;
    }

    try {
      await Clipboard.setStringAsync(link);
      flashToast('Link copied');
    } catch {
      Alert.alert('Copy link', 'Could not copy the link right now.');
    }
  }, [buildMessageForPayload, flashToast, payload]);

  const handleShareToNative = useCallback(async () => {
    if (!payload) return;

    const { body, link } = buildMessageForPayload();
    const title = payload.kind === 'event' ? payload.event.title : 'Share';

    try {
      await Share.share({
        title,
        message: body,
        url: link,
      });
      closeShareSheet();
    } catch {
      Alert.alert('Share', 'The native share sheet is not available right now.');
    }
  }, [buildMessageForPayload, closeShareSheet, payload]);

  const handlePressAction = useCallback(
    (key: ShareSheetActionKey) => {
      if (key === 'add_to_story') return handleAddToStory();
      if (key === 'repost') return void handleRepost();
      if (key === 'copy_link') return void handleCopyLink();
      if (key === 'share_to_native') return void handleShareToNative();
    },
    [handleAddToStory, handleCopyLink, handleRepost, handleShareToNative]
  );

  const handleNewGroup = useCallback(() => {
    flashToast('Group chat — coming soon');
  }, [flashToast]);

  const actions = useMemo(
    () => [
      {
        key: 'add_to_story' as const,
        label: 'Add to story',
        icon: 'add-outline' as const,
        available: true,
      },
      {
        key: 'repost' as const,
        label: 'Repost',
        icon: 'repeat-outline' as const,
        available: payload !== null,
      },
      {
        key: 'copy_link' as const,
        label: 'Copy link',
        icon: 'link-outline' as const,
        available: payload !== null,
      },
      {
        key: 'share_to_native' as const,
        label: 'Share to...',
        icon: 'share-outline' as const,
        available: payload !== null,
      },
    ],
    [payload]
  );

  const value = useMemo<MobileShareContextValue>(
    () => ({
      openShareSheet,
      closeShareSheet,
    }),
    [closeShareSheet, openShareSheet]
  );

  return (
    <MobileShareContext.Provider value={value}>
      {children}
      <MobileShareSheet
        visible={visible}
        title={sheetTitle}
        preview={preview}
        people={people}
        currentUserId={String(currentUser.id)}
        actions={actions}
        toast={toast}
        onClose={closeShareSheet}
        onSendToRecipients={(recipients, customMessage, mode) =>
          void handleSendToRecipients(recipients, customMessage, mode)
        }
        onPressAction={handlePressAction}
        onPressNewGroup={handleNewGroup}
      />
    </MobileShareContext.Provider>
  );
}

export function useShareSheet() {
  const context = useContext(MobileShareContext);
  if (!context) {
    throw new Error('useShareSheet must be used within a MobileShareSheetProvider');
  }
  return context;
}
