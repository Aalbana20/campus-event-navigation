import { formatRelativeTime } from '@/lib/mobile-backend';
import { buildMobileDiscoverStoryItems } from '@/lib/mobile-discover-social';
import { resolveStoryMediaUrl } from '@/lib/mobile-story-composer';
import { supabase } from '@/lib/supabase';
import type {
  EventRecord,
  ProfileRecord,
  StoryRecord,
  StoryViewerRecord,
} from '@/types/models';

type StoryRow = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  event_id?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
};

type StoryViewRow = {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at?: string | null;
};

export type MobileStoryStripItem = {
  id: string;
  profileId?: string;
  routeKey?: string;
  name: string;
  username: string;
  avatar: string;
  kind: 'current' | 'story' | 'suggested';
  meta: string;
  seen: boolean;
  isPlaceholder: boolean;
  stories: StoryRecord[];
  latestStoryAt?: string;
};

const toTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const getProfileIdentity = (
  profile: ProfileRecord | undefined,
  authorId: string,
  currentUser: ProfileRecord
) => {
  if (profile) {
    return {
      name: profile.name || profile.username || 'Campus User',
      username: profile.username || '',
      avatar: profile.avatar || currentUser.avatar,
    };
  }

  if (String(currentUser.id) === String(authorId)) {
    return {
      name: currentUser.name || currentUser.username || 'Campus User',
      username: currentUser.username || '',
      avatar: currentUser.avatar,
    };
  }

  return {
    name: 'Campus User',
    username: '',
    avatar: currentUser.avatar,
  };
};

const normalizeStoryRow = (
  row: StoryRow,
  getProfileById: (profileId: string) => ProfileRecord | undefined,
  currentUser: ProfileRecord
): StoryRecord => {
  const profile = getProfileById(String(row.author_id));
  const identity = getProfileIdentity(profile, String(row.author_id), currentUser);

  return {
    id: String(row.id),
    authorId: String(row.author_id),
    mediaUrl: resolveStoryMediaUrl(toTrimmedString(row.media_url)),
    mediaType: row.media_type,
    caption: toTrimmedString(row.caption),
    eventId: row.event_id || null,
    createdAt: row.created_at || new Date().toISOString(),
    expiresAt: row.expires_at || new Date().toISOString(),
    authorName: identity.name,
    authorUsername: identity.username,
    authorAvatar: identity.avatar,
  };
};

export const loadActiveStoryRecords = async ({
  currentUser,
  getProfileById,
}: {
  currentUser: ProfileRecord;
  getProfileById: (profileId: string) => ProfileRecord | undefined;
}) => {
  if (!supabase || !currentUser.id) return [] as StoryRecord[];

  const { data, error } = await supabase
    .from('stories')
    .select('id, author_id, media_url, media_type, caption, event_id, created_at, expires_at')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load stories:', error);
    return [] as StoryRecord[];
  }

  return ((data || []) as StoryRow[]).map((row) =>
    normalizeStoryRow(row, getProfileById, currentUser)
  );
};

export const loadReactedStoryIds = async ({
  userId,
  storyIds,
}: {
  userId: string;
  storyIds: string[];
}) => {
  if (!supabase || !userId || storyIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from('story_reactions')
    .select('story_id')
    .eq('user_id', userId)
    .eq('reaction_type', 'heart')
    .in('story_id', storyIds);

  if (error) {
    console.error('Unable to load story hearts:', error);
    return new Set<string>();
  }

  return new Set(
    ((data || []) as { story_id: string }[]).map((row) => String(row.story_id))
  );
};

export const buildMobileStoryStripItems = ({
  currentUser,
  storyRecords,
  followingProfiles,
  profiles,
  events,
  seenStoryIds,
}: {
  currentUser: ProfileRecord;
  storyRecords: StoryRecord[];
  followingProfiles: ProfileRecord[];
  profiles: ProfileRecord[];
  events: EventRecord[];
  seenStoryIds: Set<string>;
}): MobileStoryStripItem[] => {
  const groupedByAuthor = storyRecords.reduce<Map<string, StoryRecord[]>>((collection, story) => {
    const key = String(story.authorId);
    const currentStories = collection.get(key) || [];
    currentStories.push(story);
    collection.set(key, currentStories);
    return collection;
  }, new Map());

  const currentUserStories = [...(groupedByAuthor.get(String(currentUser.id)) || [])].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
  const latestCurrentStory = currentUserStories[currentUserStories.length - 1];

  const currentUserItem: MobileStoryStripItem = {
    id: `story-${currentUser.id || 'current-user'}`,
    profileId: currentUser.id,
    routeKey: currentUser.username || currentUser.id,
    name: currentUser.name || currentUser.username || 'Campus User',
    username: currentUser.username || '',
    avatar: currentUser.avatar,
    kind: 'current',
    meta: currentUserStories.length > 0 ? 'Your story' : 'Add story',
    seen: true,
    isPlaceholder: false,
    stories: currentUserStories,
    latestStoryAt: latestCurrentStory?.createdAt,
  };

  const actualItems = [...groupedByAuthor.entries()]
    .filter(([authorId]) => String(authorId) !== String(currentUser.id))
    .map(([authorId, stories]) => {
      const orderedStories = [...stories].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      );
      const latestStory = orderedStories[orderedStories.length - 1];

      return {
        id: `story-${authorId}`,
        profileId: authorId,
        routeKey: latestStory.authorUsername || authorId,
        name: latestStory.authorName,
        username: latestStory.authorUsername,
        avatar: latestStory.authorAvatar,
        kind: 'story' as const,
        meta: formatRelativeTime(latestStory.createdAt),
        seen: orderedStories.every((story) => seenStoryIds.has(String(story.id))),
        isPlaceholder: false,
        stories: orderedStories,
        latestStoryAt: latestStory.createdAt,
      };
    })
    .sort((left, right) => {
      const leftTime = left.latestStoryAt ? new Date(left.latestStoryAt).getTime() : 0;
      const rightTime = right.latestStoryAt ? new Date(right.latestStoryAt).getTime() : 0;

      return rightTime - leftTime;
    });

  const fallbackSuggestions = buildMobileDiscoverStoryItems({
    currentUser,
    followingProfiles,
    profiles,
    events,
  })
    .filter((item) => item.kind === 'suggested')
    .map((item) => ({
      id: item.id,
      profileId: item.profileId,
      routeKey: item.routeKey,
      name: item.name,
      username: item.username,
      avatar: item.avatar,
      kind: item.kind,
      meta: item.meta,
      seen: item.seen,
      isPlaceholder: item.isPlaceholder,
      stories: [],
      latestStoryAt: undefined,
    }));

  return [currentUserItem, ...actualItems, ...fallbackSuggestions];
};

export const recordStoryView = async ({
  storyId,
  viewerId,
}: {
  storyId: string;
  viewerId: string;
}) => {
  if (!supabase || !storyId || !viewerId) return;

  const { error } = await supabase
    .from('story_views')
    .upsert(
      {
        story_id: storyId,
        viewer_id: viewerId,
      },
      {
        onConflict: 'story_id,viewer_id',
        ignoreDuplicates: true,
      }
    );

  if (error) {
    console.error('Unable to record story view:', error);
  }
};

export const fetchStoryViewers = async ({
  storyId,
  getProfileById,
}: {
  storyId: string;
  getProfileById: (profileId: string) => ProfileRecord | undefined;
}) => {
  if (!supabase || !storyId) return [] as StoryViewerRecord[];

  const { data, error } = await supabase
    .from('story_views')
    .select('id, story_id, viewer_id, viewed_at')
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false });

  if (error) {
    console.error('Unable to load story viewers:', error);
    return [] as StoryViewerRecord[];
  }

  return ((data || []) as StoryViewRow[]).map((row) => {
    const profile = getProfileById(String(row.viewer_id));

    return {
      id: String(row.id),
      storyId: String(row.story_id),
      viewerId: String(row.viewer_id),
      viewedAt: row.viewed_at || '',
      name: profile?.name || profile?.username || 'Campus User',
      username: profile?.username || '',
      avatar: profile?.avatar || '',
    };
  });
};

export const toggleStoryHeart = async ({
  storyId,
  userId,
  nextActive,
}: {
  storyId: string;
  userId: string;
  nextActive: boolean;
}) => {
  if (!supabase || !storyId || !userId) return;

  if (nextActive) {
    const { error } = await supabase.from('story_reactions').insert({
      story_id: storyId,
      user_id: userId,
      reaction_type: 'heart',
    });

    if (error) {
      console.error('Unable to like story:', error);
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('story_reactions')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', userId)
    .eq('reaction_type', 'heart');

  if (error) {
    console.error('Unable to unlike story:', error);
    throw error;
  }
};

export const createStoryShare = async ({
  storyId,
  senderId,
  recipientId,
}: {
  storyId: string;
  senderId: string;
  recipientId: string;
}) => {
  if (!supabase || !storyId || !senderId || !recipientId) return;

  const { error } = await supabase.from('story_shares').insert({
    story_id: storyId,
    sender_id: senderId,
    recipient_id: recipientId,
  });

  if (error) {
    console.error('Unable to share story:', error);
    throw error;
  }
};

export const buildStoryShareMessage = (story: StoryRecord) => {
  const caption = toTrimmedString(story.caption);

  if (caption) {
    return `Shared a story from ${story.authorName}: "${caption}"`;
  }

  return `Shared a story from ${story.authorName}.`;
};

export const buildStoryReplyMessage = (story: StoryRecord, replyText: string) => {
  const trimmedReply = toTrimmedString(replyText);
  return trimmedReply
    ? `Reply to your story: ${trimmedReply}`
    : `Reacted to your story from ${story.authorName}.`;
};
