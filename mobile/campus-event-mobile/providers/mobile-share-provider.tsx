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

import { recordDiscoverPostShare, type DiscoverPostRecord } from '@/lib/mobile-discover-posts';
import {
  createDmEventAttachmentPayload,
  createDmPostAttachmentPayload,
  createDmRecapAttachmentPayload,
} from '@/lib/mobile-dm-content';
import { buildEventShareMessage } from '@/lib/mobile-event-share';
import { toggleRecapRepost, type BackendRecapPost } from '@/lib/mobile-recaps-backend';
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
  | { kind: 'event'; event: EventRecord }
  | { kind: 'recap'; recap: BackendRecapPost };

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

const buildRecapShareMessage = (recap: BackendRecapPost) => {
  const recapLink = ExpoLinking.createURL(`/recap/${recap.id}`);
  const byline = recap.creatorUsername
    ? `@${recap.creatorUsername}`
    : recap.creatorName || 'Campus';
  const caption = (recap.caption || '').trim();
  const body = [
    `Check out this recap from ${byline}`,
    caption,
    recapLink,
  ]
    .filter(Boolean)
    .join('\n');

  return { body, link: recapLink };
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

    if (payload.kind === 'recap') {
      const recap = payload.recap;
      const byline = recap.creatorUsername
        ? `@${recap.creatorUsername}`
        : recap.creatorName || 'Campus';
      const firstPhoto = recap.photos[0];
      return {
        title: recap.caption?.trim() || 'Recap',
        subtitle: `Recap • ${byline}`,
        image:
          firstPhoto?.thumbnailUrl ||
          firstPhoto?.uri ||
          recap.taggedEvent?.image ||
          undefined,
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
    if (payload.kind === 'recap') return 'Share recap';
    if (payload.kind === 'video') return 'Share video';
    return 'Share post';
  }, [payload]);

  const buildMessageForPayload = useCallback(() => {
    if (!payload) return { body: '', link: '' };
    if (payload.kind === 'event') {
      const built = buildEventShareMessage(payload.event);
      return { body: built.body, link: built.eventLink };
    }
    if (payload.kind === 'recap') return buildRecapShareMessage(payload.recap);
    return buildPostShareMessage(payload.post);
  }, [payload]);

  const buildDmAttachmentBody = useCallback(
    (customMessage: string) => {
      if (!payload) return '';
      const trimmedCustom = customMessage.trim();

      if (payload.kind === 'event') {
        const event = payload.event;
        return createDmEventAttachmentPayload({
          text: trimmedCustom,
          event: {
            id: String(event.id),
            title: event.title,
            image: event.image,
            date: event.date,
            time: event.time,
            location: event.locationName || event.location || event.locationAddress,
          },
        });
      }

      if (payload.kind === 'recap') {
        const recap = payload.recap;
        const firstPhoto = recap.photos[0];
        return createDmRecapAttachmentPayload({
          text: trimmedCustom,
          recap: {
            id: String(recap.id),
            caption: recap.caption,
            mediaUrl: firstPhoto?.uri,
            thumbnailUrl: firstPhoto?.thumbnailUrl,
            mediaType: firstPhoto?.mediaType === 'video' ? 'video' : 'image',
            authorId: recap.creatorId,
            authorName: recap.creatorName,
            authorUsername: recap.creatorUsername,
            authorAvatar: recap.creatorAvatar,
            eventId: recap.taggedEvent?.id,
            eventTitle: recap.taggedEvent?.title,
            eventImage: recap.taggedEvent?.image,
          },
        });
      }

      const post = payload.post;
      return createDmPostAttachmentPayload({
        text: trimmedCustom,
        post: {
          id: String(post.id),
          mediaType: payload.kind === 'video' ? 'video' : 'image',
          mediaUrl: post.mediaUrl,
          thumbnailUrl: post.thumbnailUrl,
          caption: post.caption,
          durationSeconds: post.durationSeconds,
          mediaWidth: post.mediaWidth,
          mediaHeight: post.mediaHeight,
          authorId: post.authorId,
          authorName: post.authorName,
          authorUsername: post.authorUsername,
          authorAvatar: post.authorAvatar,
        },
      });
    },
    [payload]
  );

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

      const composedBody = buildDmAttachmentBody(customMessage);
      if (!composedBody) return;

      try {
        await Promise.all(
          recipients.map((profile) =>
            sendDmMessage(String(profile.id), composedBody)
          )
        );

        if (
          (payload.kind === 'post' || payload.kind === 'video') &&
          !String(payload.post.id).startsWith('mock-')
        ) {
          void recordDiscoverPostShare({
            postId: payload.post.id,
            userId: currentUser.id,
            method: 'message',
          });
        }

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
    [buildDmAttachmentBody, closeShareSheet, currentUser.id, flashToast, payload, sendDmMessage]
  );

  const handleAddToStory = useCallback(() => {
    if (!payload) return;

    if (payload.kind === 'recap') {
      flashToast('Recap stories — coming soon');
      return;
    }

    closeShareSheet();

    if (payload.kind === 'event') {
      router.push({
        pathname: '/story/share',
        params: { sharedEventId: String(payload.event.id) },
      });
      return;
    }

    const aspectRatio =
      payload.post.mediaWidth && payload.post.mediaHeight
        ? payload.post.mediaHeight / payload.post.mediaWidth
        : undefined;

    router.push({
      pathname: '/story/share',
      params: {
        sharedPostId: payload.kind === 'post' ? String(payload.post.id) : undefined,
        sharedVideoId: payload.kind === 'video' ? String(payload.post.id) : undefined,
        sharedMediaUrl: payload.post.mediaUrl,
        sharedThumbnailUrl: payload.post.thumbnailUrl || undefined,
        sharedAspectRatio: aspectRatio ? String(aspectRatio) : undefined,
      },
    });
  }, [closeShareSheet, flashToast, payload]);

  const handleRepost = useCallback(async () => {
    if (!payload) return;

    try {
      if (payload.kind === 'event') {
        await repostEvent(String(payload.event.id));
        flashToast('Reposted to your profile');
      } else if (payload.kind === 'recap') {
        const ok = await toggleRecapRepost({
          recapId: payload.recap.id,
          userId: currentUser.id,
          isReposted: payload.recap.repostedByMe,
        });
        flashToast(ok ? 'Reposted to your profile' : 'Repost saved for now');
      } else {
        await repostPost(String(payload.post.id));
        flashToast('Reposted to your profile');
      }
    } catch {
      Alert.alert('Repost', 'Could not repost right now.');
    }
  }, [currentUser.id, flashToast, payload, repostEvent, repostPost]);

  const handleCopyLink = useCallback(async () => {
    if (!payload) return;

    const { link } = buildMessageForPayload();
    if (!link) {
      Alert.alert('Copy link', 'No link is available yet.');
      return;
    }

    try {
      await Clipboard.setStringAsync(link);
      if (
        (payload.kind === 'post' || payload.kind === 'video') &&
        !String(payload.post.id).startsWith('mock-')
      ) {
        void recordDiscoverPostShare({
          postId: payload.post.id,
          userId: currentUser.id,
          method: 'copy_link',
        });
      }
      flashToast('Link copied');
    } catch {
      Alert.alert('Copy link', 'Could not copy the link right now.');
    }
  }, [buildMessageForPayload, currentUser.id, flashToast, payload]);

  const handleShareToNative = useCallback(async () => {
    if (!payload) return;

    const { body, link } = buildMessageForPayload();
    const title =
      payload.kind === 'event'
        ? payload.event.title
        : payload.kind === 'recap'
          ? 'Share recap'
          : 'Share';

    try {
      await Share.share({ title, message: body, url: link });
      if (
        (payload.kind === 'post' || payload.kind === 'video') &&
        !String(payload.post.id).startsWith('mock-')
      ) {
        void recordDiscoverPostShare({
          postId: payload.post.id,
          userId: currentUser.id,
          method: 'native_share',
        });
      }
      closeShareSheet();
    } catch {
      Alert.alert('Share', 'The native share sheet is not available right now.');
    }
  }, [buildMessageForPayload, closeShareSheet, currentUser.id, payload]);

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
