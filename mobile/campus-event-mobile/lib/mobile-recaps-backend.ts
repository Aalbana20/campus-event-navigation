import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

import { resolveEventMemoryMediaUrl } from '@/lib/mobile-event-memories';
import { supabase } from '@/lib/supabase';
import type {
  RecapComposerDestination,
  RecapComposerPhoto,
} from '@/providers/mobile-recap-composer';

export const RECAP_MEDIA_BUCKET = 'stories';
const RECAP_MEDIA_FOLDER = 'social-recaps';

const MAX_RECAP_MEDIA_ITEMS = 10;
const MAX_RECAP_MEDIA_BYTES = 120 * 1024 * 1024;
const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export type BackendRecapTaggedEvent = {
  id: string;
  title: string;
  image: string;
  date?: string;
  time?: string;
};

export type BackendRecapMediaItem = RecapComposerPhoto & {
  id?: string;
  mediaType?: 'image' | 'video';
  thumbnailUrl?: string;
  sortOrder?: number;
};

export type BackendRecapPost = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string;
  destination: RecapComposerDestination;
  caption: string;
  photos: BackendRecapMediaItem[];
  taggedEvent: BackendRecapTaggedEvent | null;
  createdAt: string;
  updatedAt: string;
  contentType: 'text' | 'photo' | 'video' | 'mixed';
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByMe: boolean;
  repostedByMe: boolean;
};

export type BackendRecapComment = {
  id: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  authorId: string;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  parentId: string | null;
};

export type BackendRecapProfileComment = {
  id: string;
  recapId: string;
  body: string;
  createdAt: string;
  recapAuthorName: string;
  recapAuthorUsername: string;
};

type RecapPostRow = {
  id: string;
  event_id?: string | null;
  user_id: string;
  body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RecapMediaRow = {
  id: string;
  recap_post_id: string;
  user_id?: string | null;
  media_url: string;
  media_type?: string | null;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  sort_order?: number | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type EventRow = {
  id: string;
  title?: string | null;
  image?: string | null;
  date?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  time?: string | null;
};

type RecapEngagementSummary = {
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByMe: boolean;
  repostedByMe: boolean;
};

const POST_SELECT_COLUMNS =
  'id, event_id, user_id, body, created_at, updated_at';

const toTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const getFileExtension = (
  fileName?: string | null,
  mimeType?: string | null,
  uri?: string | null
) => {
  const normalizedFileName = toTrimmedString(fileName).toLowerCase();
  const normalizedUri = toTrimmedString(uri).toLowerCase();

  const fileNameMatch = normalizedFileName.match(/\.([a-z0-9]+)$/);
  if (fileNameMatch?.[1]) return fileNameMatch[1];

  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  const uriMatch = normalizedUri.match(/\.([a-z0-9]+)(?:\?|$)/);
  if (uriMatch?.[1]) return uriMatch[1];

  return mimeType?.startsWith('video/') ? 'mp4' : 'jpg';
};

const getRecapMediaType = (photo: RecapComposerPhoto): 'image' | 'video' => {
  if (photo.mediaType === 'video') return 'video';
  if (photo.mimeType?.startsWith('video/')) return 'video';
  const lower = (photo.uri || '').toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
    return 'video';
  }
  return 'image';
};

const normalizeStoragePath = (value: string) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return '';
  if (trimmed.startsWith(`${RECAP_MEDIA_BUCKET}/`)) {
    return trimmed.slice(RECAP_MEDIA_BUCKET.length + 1);
  }
  return trimmed;
};

const looksLikeEventMemoryRecapPath = (value: string) => {
  const parts = value.split('/').filter(Boolean);
  if (parts[0] === 'recaps' && UUID_SEGMENT_PATTERN.test(parts[1] || '')) {
    return true;
  }
  return (
    UUID_SEGMENT_PATTERN.test(parts[0] || '') &&
    UUID_SEGMENT_PATTERN.test(parts[1] || '')
  );
};

export const resolveRecapMediaUrl = async (
  value: string | null | undefined,
  fallback = ''
) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return fallback;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  if (looksLikeEventMemoryRecapPath(trimmed)) {
    return resolveEventMemoryMediaUrl(trimmed, fallback);
  }

  if (!supabase) return fallback;

  const { data } = supabase.storage
    .from(RECAP_MEDIA_BUCKET)
    .getPublicUrl(normalizeStoragePath(trimmed));

  return data.publicUrl || fallback;
};

const readFileAsArrayBuffer = async (fileUri: string) => {
  const base64Value = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = Buffer.from(base64Value, 'base64');

  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
};

const getAuthenticatedUserId = async (fallbackUserId = '') => {
  if (!supabase) return '';
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('[mobile-recaps] auth.getUser failed:', error);
    }
    if (data?.user?.id) return String(data.user.id);
  } catch (error) {
    console.warn('[mobile-recaps] auth.getUser threw:', error);
  }
  return fallbackUserId && fallbackUserId !== 'current-user' ? fallbackUserId : '';
};

const loadProfiles = async (profileIds: string[]) => {
  if (!supabase || profileIds.length === 0) return new Map<string, ProfileRow>();
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .in('id', uniqueIds);

  if (error) {
    console.error('Could not load recap profiles:', error);
    return new Map<string, ProfileRow>();
  }

  return new Map(
    ((data || []) as ProfileRow[]).map((profile) => [String(profile.id), profile])
  );
};

const loadTaggedEvents = async (eventIds: string[]) => {
  if (!supabase || eventIds.length === 0) return new Map<string, EventRow>();
  const uniqueIds = [...new Set(eventIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, EventRow>();

  const { data, error } = await supabase
    .from('events')
    .select('id, title, image, date, event_date, start_time')
    .in('id', uniqueIds);

  if (error) {
    console.error('Could not load tagged recap events:', error);
    return new Map<string, EventRow>();
  }

  return new Map(((data || []) as EventRow[]).map((event) => [String(event.id), event]));
};

const emptyEngagementSummary = (): RecapEngagementSummary => ({
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  likedByMe: false,
  repostedByMe: false,
});

const ensureEngagementSummary = (
  summaryByRecapId: Map<string, RecapEngagementSummary>,
  recapId: string
) => {
  if (!summaryByRecapId.has(recapId)) {
    summaryByRecapId.set(recapId, emptyEngagementSummary());
  }
  return summaryByRecapId.get(recapId) as RecapEngagementSummary;
};

export const loadRecapEngagementSummary = async ({
  recapIds,
  currentUserId = '',
}: {
  recapIds: string[];
  currentUserId?: string;
}) => {
  const ids = [...new Set(recapIds.map((id) => String(id || '')).filter(Boolean))];
  const summaryByRecapId = new Map(
    ids.map((id) => [id, emptyEngagementSummary()])
  );

  if (!supabase || ids.length === 0) return summaryByRecapId;

  const [likesResult, commentsResult, repostsResult] = await Promise.all([
    supabase.from('recap_likes').select('recap_id, user_id').in('recap_id', ids),
    supabase.from('recap_comments').select('id, recap_id').in('recap_id', ids),
    supabase.from('recap_reposts').select('recap_id, user_id').in('recap_id', ids),
  ]);

  if (likesResult.error) {
    console.error('Could not load recap likes:', likesResult.error);
  } else {
    (likesResult.data || []).forEach((row: { recap_id: string; user_id: string }) => {
      const summary = ensureEngagementSummary(summaryByRecapId, String(row.recap_id));
      summary.likeCount += 1;
      if (currentUserId && String(row.user_id) === String(currentUserId)) {
        summary.likedByMe = true;
      }
    });
  }

  if (commentsResult.error) {
    console.error('Could not load recap comments:', commentsResult.error);
  } else {
    (commentsResult.data || []).forEach((row: { recap_id: string }) => {
      ensureEngagementSummary(summaryByRecapId, String(row.recap_id)).commentCount += 1;
    });
  }

  if (repostsResult.error) {
    console.error('Could not load recap reposts:', repostsResult.error);
  } else {
    (repostsResult.data || []).forEach((row: { recap_id: string; user_id: string }) => {
      const summary = ensureEngagementSummary(summaryByRecapId, String(row.recap_id));
      summary.repostCount += 1;
      if (currentUserId && String(row.user_id) === String(currentUserId)) {
        summary.repostedByMe = true;
      }
    });
  }

  return summaryByRecapId;
};

const buildMediaByRecapId = async (mediaRows: RecapMediaRow[]) => {
  const resolved = await Promise.all(
    mediaRows.map(async (media) => {
      const mediaType = media.media_type === 'video' ? 'video' : 'image';
      const mediaUrl = await resolveRecapMediaUrl(media.media_url);
      const thumbnailUrl = await resolveRecapMediaUrl(media.thumbnail_url, '');
      return {
        recapId: String(media.recap_post_id),
        item: {
          id: String(media.id),
          uri: thumbnailUrl || mediaUrl,
          mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          width: media.width ?? null,
          height: media.height ?? null,
          mediaType,
          thumbnailUrl,
          sortOrder: Number(media.sort_order || 0),
        } as BackendRecapMediaItem,
      };
    })
  );

  return resolved.reduce((lookup, { recapId, item }) => {
    const next = [...(lookup.get(recapId) || []), item].sort(
      (left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
    );
    lookup.set(recapId, next);
    return lookup;
  }, new Map<string, BackendRecapMediaItem[]>());
};

const normalizeRecapRows = async ({
  posts,
  currentUserId = '',
  mediaType,
}: {
  posts: RecapPostRow[];
  currentUserId?: string;
  mediaType?: 'image' | 'video';
}) => {
  if (!supabase || posts.length === 0) return [];

  const recapIds = posts.map((post) => String(post.id));
  const authorIds = posts.map((post) => String(post.user_id || '')).filter(Boolean);
  const taggedEventIds = posts
    .map((post) => String(post.event_id || ''))
    .filter(Boolean);

  const [profiles, taggedEvents, engagement, mediaResult] = await Promise.all([
    loadProfiles(authorIds),
    loadTaggedEvents(taggedEventIds),
    loadRecapEngagementSummary({ recapIds, currentUserId }),
    supabase
      .from('recap_media')
      .select('id, recap_post_id, media_url, media_type, sort_order, created_at')
      .in('recap_post_id', recapIds)
      .order('sort_order', { ascending: true }),
  ]);

  if (mediaResult.error) {
    console.error('Could not load recap media:', mediaResult.error);
  }

  const mediaByRecapId = await buildMediaByRecapId(
    (mediaResult.data || []) as RecapMediaRow[]
  );

  return posts
    .map((post): BackendRecapPost => {
      const authorId = String(post.user_id || '');
      const profile = profiles.get(authorId);
      const media = mediaByRecapId.get(String(post.id)) || [];
      const taggedEventRow = post.event_id
        ? taggedEvents.get(String(post.event_id))
        : null;
      const summary =
        engagement.get(String(post.id)) || emptyEngagementSummary();
      const caption = toTrimmedString(post.body);
      const hasImage = media.some((item) => item.mediaType !== 'video');
      const hasVideo = media.some((item) => item.mediaType === 'video');

      return {
        id: String(post.id),
        creatorId: authorId,
        creatorName:
          toTrimmedString(profile?.name) ||
          toTrimmedString(profile?.username) ||
          'Campus User',
        creatorUsername: toTrimmedString(profile?.username),
        creatorAvatar: toTrimmedString(profile?.avatar_url),
        destination: 'for-you',
        caption,
        photos: media,
        taggedEvent: taggedEventRow
          ? {
              id: String(taggedEventRow.id),
              title: toTrimmedString(taggedEventRow.title) || 'Tagged event',
              image: toTrimmedString(taggedEventRow.image),
              date:
                toTrimmedString(taggedEventRow.date) ||
                toTrimmedString(taggedEventRow.event_date),
              time:
                toTrimmedString(taggedEventRow.time) ||
                toTrimmedString(taggedEventRow.start_time),
            }
          : null,
        createdAt: post.created_at || new Date().toISOString(),
        updatedAt: post.updated_at || post.created_at || new Date().toISOString(),
        contentType:
          (caption && media.length > 0) || (hasImage && hasVideo)
            ? 'mixed'
            : hasVideo
              ? 'video'
              : hasImage
                ? 'photo'
                : 'text',
        likeCount: summary.likeCount,
        commentCount: summary.commentCount,
        repostCount: summary.repostCount,
        likedByMe: summary.likedByMe,
        repostedByMe: summary.repostedByMe,
      };
    })
    .filter((recap) =>
      mediaType ? recap.photos.some((item) => item.mediaType === mediaType) : true
    );
};

export const loadRecapFeed = async ({
  category,
  currentUserId = '',
}: {
  category: RecapComposerDestination | 'trending';
  currentUserId?: string;
}): Promise<BackendRecapPost[]> => {
  if (!supabase) return [];

  const query = supabase
    .from('recap_posts')
    .select(POST_SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data, error } = await query;
  if (error) {
    console.error('Could not load recaps:', error);
    throw new Error('Could not load recaps.');
  }

  const recaps = await normalizeRecapRows({
    posts: (data || []) as RecapPostRow[],
    currentUserId,
  });

  if (category !== 'trending') return recaps;

  return [...recaps].sort((left, right) => {
    const leftScore = left.likeCount + left.commentCount * 2 + left.repostCount * 3;
    const rightScore = right.likeCount + right.commentCount * 2 + right.repostCount * 3;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
};

export const loadRecapPostsForUser = async ({
  userId,
  currentUserId = '',
  mediaType,
}: {
  userId: string;
  currentUserId?: string;
  mediaType?: 'image' | 'video';
}): Promise<BackendRecapPost[]> => {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('recap_posts')
    .select(POST_SELECT_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.error('Could not load profile recaps:', error);
    throw new Error('Could not load recaps.');
  }

  return normalizeRecapRows({
    posts: (data || []) as RecapPostRow[],
    currentUserId,
    mediaType,
  });
};

const uploadRecapMedia = async ({
  userId,
  recapId,
  photo,
  index,
}: {
  userId: string;
  recapId: string;
  photo: RecapComposerPhoto;
  index: number;
}) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (photo.fileSize && photo.fileSize > MAX_RECAP_MEDIA_BYTES) {
    throw new Error('Choose images smaller than 120 MB for recaps.');
  }

  const extension = getFileExtension(photo.fileName, photo.mimeType, photo.uri);
  const storagePath = `${RECAP_MEDIA_FOLDER}/${userId}/${recapId}-${index}.${extension}`;
  const fileBody = await readFileAsArrayBuffer(photo.uri);

  const { error } = await supabase.storage
    .from(RECAP_MEDIA_BUCKET)
    .upload(storagePath, fileBody, {
      cacheControl: '3600',
      contentType:
        photo.mimeType || (getRecapMediaType(photo) === 'video' ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    });

  if (error) {
    console.error('Could not upload recap media:', error);
    throw new Error('Could not upload recap media.');
  }

  return storagePath;
};

export const createBackendRecap = async ({
  authorId,
  caption,
  photos,
  taggedEventId,
}: {
  authorId: string;
  caption: string;
  photos: RecapComposerPhoto[];
  destination: RecapComposerDestination;
  taggedEventId?: string | null;
}) => {
  if (!supabase) {
    throw new Error('Recaps are unavailable because Supabase is not configured.');
  }

  const userId = await getAuthenticatedUserId(authorId);
  if (!userId) throw new Error('You need to be signed in to share a recap.');

  const trimmedCaption = caption.trim();
  const selectedPhotos = photos.slice(0, MAX_RECAP_MEDIA_ITEMS);
  if (!trimmedCaption && selectedPhotos.length === 0) {
    throw new Error('Add text or media to create a recap.');
  }

  const { data: post, error: postError } = await supabase
    .from('recap_posts')
    .insert({
      user_id: userId,
      event_id: taggedEventId || null,
      body: trimmedCaption || null,
    })
    .select('id')
    .single();

  if (postError) {
    console.error('Could not create recap row:', postError);
    throw new Error(postError.message || 'Could not post recap.');
  }

  const recapId = String((post as { id: string }).id);
  const uploadedPaths: string[] = [];

  try {
    const mediaRows = [];
    for (let index = 0; index < selectedPhotos.length; index += 1) {
      const photo = selectedPhotos[index];
      const mediaUrl = await uploadRecapMedia({
        userId,
        recapId,
        photo,
        index,
      });
      uploadedPaths.push(mediaUrl);
      mediaRows.push({
        recap_post_id: recapId,
        media_url: mediaUrl,
        media_type: getRecapMediaType(photo),
        sort_order: index,
      });
    }

    if (mediaRows.length > 0) {
      const { error: mediaError } = await supabase
        .from('recap_media')
        .insert(mediaRows);
      if (mediaError) throw mediaError;
    }

    return recapId;
  } catch (error) {
    await supabase.from('recap_posts').delete().eq('id', recapId);
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(RECAP_MEDIA_BUCKET).remove(uploadedPaths);
    }
    console.error('Could not finish recap publish:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Could not post recap.'
    );
  }
};

export const toggleRecapLike = async ({
  recapId,
  userId,
  isLiked,
}: {
  recapId: string;
  userId: string;
  isLiked: boolean;
}) => {
  if (!supabase || !recapId) return false;
  const authId = await getAuthenticatedUserId(userId);
  if (!authId) return false;

  if (isLiked) {
    const { error } = await supabase
      .from('recap_likes')
      .delete()
      .eq('recap_id', recapId)
      .eq('user_id', authId);
    if (error) {
      console.error('Could not unlike recap:', error);
      return false;
    }
    return true;
  }

  const { error } = await supabase
    .from('recap_likes')
    .insert({ recap_id: recapId, user_id: authId });

  if (error && error.code !== '23505') {
    console.error('Could not like recap:', error);
    return false;
  }
  return true;
};

export const toggleRecapRepost = async ({
  recapId,
  userId,
  isReposted,
}: {
  recapId: string;
  userId: string;
  isReposted: boolean;
}) => {
  if (!supabase || !recapId) return false;
  const authId = await getAuthenticatedUserId(userId);
  if (!authId) return false;

  if (isReposted) {
    const { error } = await supabase
      .from('recap_reposts')
      .delete()
      .eq('recap_id', recapId)
      .eq('user_id', authId);
    if (error) {
      console.error('Could not remove recap repost:', error);
      return false;
    }
    return true;
  }

  const { error } = await supabase
    .from('recap_reposts')
    .insert({ recap_id: recapId, user_id: authId });

  if (error && error.code !== '23505') {
    console.error('Could not repost recap:', error);
    return false;
  }
  return true;
};

export const loadRecapComments = async (
  recapId: string
): Promise<BackendRecapComment[]> => {
  if (!supabase || !recapId) return [];

  const { data, error } = await supabase
    .from('recap_comments')
    .select('id, body, created_at, user_id, parent_comment_id')
    .eq('recap_id', recapId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Could not load recap comments:', error);
    return [];
  }

  const rows = (data || []) as {
    id: string;
    body: string;
    created_at?: string | null;
    user_id: string;
    parent_comment_id?: string | null;
  }[];
  const profileLookup = await loadProfiles(rows.map((row) => row.user_id));

  return rows.map((row) => {
    const profile = profileLookup.get(String(row.user_id));
    return {
      id: String(row.id),
      authorName:
        toTrimmedString(profile?.name) ||
        toTrimmedString(profile?.username) ||
        'Campus User',
      authorUsername: toTrimmedString(profile?.username),
      authorAvatar: toTrimmedString(profile?.avatar_url),
      authorId: String(row.user_id),
      body: toTrimmedString(row.body),
      createdAt: row.created_at || new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
      parentId: row.parent_comment_id || null,
    };
  });
};

export const addRecapComment = async ({
  recapId,
  userId,
  body,
  parentId = null,
}: {
  recapId: string;
  userId: string;
  body: string;
  parentId?: string | null;
}) => {
  if (!supabase || !recapId) return null;
  const authId = await getAuthenticatedUserId(userId);
  const trimmed = body.trim();
  if (!authId || !trimmed) return null;

  const { data, error } = await supabase
    .from('recap_comments')
    .insert({
      recap_id: recapId,
      user_id: authId,
      body: trimmed,
      parent_comment_id: parentId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Could not add recap comment:', error);
    return null;
  }

  return String((data as { id: string }).id);
};

export const deleteRecapComment = async ({
  commentId,
  userId,
}: {
  commentId: string;
  userId: string;
}) => {
  if (!supabase || !commentId) return false;
  const authId = await getAuthenticatedUserId(userId);
  if (!authId) return false;

  const { error } = await supabase
    .from('recap_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', authId);

  if (error) {
    console.error('Could not delete recap comment:', error);
    return false;
  }

  return true;
};

export const loadRecapCommentsForUser = async (
  userId: string
): Promise<BackendRecapProfileComment[]> => {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('recap_comments')
    .select('id, recap_id, body, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.error('Could not load profile recap comments:', error);
    throw new Error('Could not load comments.');
  }

  const rows = (data || []) as {
    id: string;
    recap_id: string;
    body: string;
    created_at?: string | null;
  }[];
  const recapIds = rows.map((row) => String(row.recap_id)).filter(Boolean);

  if (recapIds.length === 0) return [];

  const { data: postRows, error: postsError } = await supabase
    .from('recap_posts')
    .select('id, user_id')
    .in('id', recapIds);

  if (postsError) {
    console.error('Could not load comment recap context:', postsError);
  }

  const posts = (postRows || []) as { id: string; user_id: string }[];
  const postLookup = new Map(posts.map((post) => [String(post.id), post]));
  const profileLookup = await loadProfiles(posts.map((post) => String(post.user_id)));

  return rows.map((row) => {
    const post = postLookup.get(String(row.recap_id));
    const profile = post ? profileLookup.get(String(post.user_id)) : undefined;
    return {
      id: String(row.id),
      recapId: String(row.recap_id),
      body: toTrimmedString(row.body),
      createdAt: row.created_at || new Date().toISOString(),
      recapAuthorName:
        toTrimmedString(profile?.name) ||
        toTrimmedString(profile?.username) ||
        'Campus User',
      recapAuthorUsername: toTrimmedString(profile?.username),
    };
  });
};
