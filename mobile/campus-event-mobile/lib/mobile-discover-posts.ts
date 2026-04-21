import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

import {
  invalidate as invalidateFeedCache,
  loadWithBackgroundRefresh,
} from '@/lib/feed-cache';
import {
  compressImageMedia,
  extractVideoPoster,
} from '@/lib/mobile-media-compression';
import { supabase } from '@/lib/supabase';
import type { SelectedStoryMedia } from '@/lib/mobile-story-composer';

export const DISCOVER_POST_BUCKET = 'stories';
export const DISCOVER_POST_FOLDER = 'posts';
const DISCOVER_POST_THUMBNAIL_FOLDER = 'post-thumbs';
const MAX_POST_MEDIA_BYTES = 120 * 1024 * 1024;
const DISCOVER_FEED_CACHE_KEY = 'discover-posts:global';
const DISCOVER_FEED_CACHE_TTL_MS = 60_000;

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

export type DiscoverPostMediaType = 'image' | 'video';

export type DiscoverPostRecord = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: DiscoverPostMediaType;
  thumbnailUrl: string;
  durationSeconds: number | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  caption: string;
  createdAt: string;
  onGrid: boolean;
  eventId: string | null;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
};

type DiscoverPostRow = {
  id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  created_at?: string | null;
  on_grid?: boolean | null;
  event_id?: string | null;
  thumbnail_url?: string | null;
  duration?: number | string | null;
  width?: number | null;
  height?: number | null;
};

const POST_SELECT_COLUMNS =
  'id, author_id, media_url, media_type, caption, created_at, on_grid, event_id, thumbnail_url, duration, width, height';

type ProfileRow = {
  id: string;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

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

const normalizeStoragePath = (value: string) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return '';
  if (trimmed.startsWith(`${DISCOVER_POST_BUCKET}/`)) {
    return trimmed.slice(DISCOVER_POST_BUCKET.length + 1);
  }
  return trimmed;
};

export const resolveDiscoverPostMediaUrl = (
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

  if (!supabase) return fallback;

  const storagePath = normalizeStoragePath(trimmed);
  const { data } = supabase.storage
    .from(DISCOVER_POST_BUCKET)
    .getPublicUrl(storagePath);

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

const normalizePostRow = (
  row: DiscoverPostRow,
  profile?: ProfileRow
): DiscoverPostRecord => ({
  id: String(row.id),
  authorId: String(row.author_id),
  mediaUrl: resolveDiscoverPostMediaUrl(row.media_url),
  mediaType: row.media_type === 'video' ? 'video' : 'image',
  thumbnailUrl: resolveDiscoverPostMediaUrl(row.thumbnail_url, ''),
  durationSeconds:
    row.duration == null ? null : Number(row.duration) || null,
  mediaWidth: row.width ? Number(row.width) || null : null,
  mediaHeight: row.height ? Number(row.height) || null : null,
  caption: toTrimmedString(row.caption),
  createdAt: row.created_at || new Date().toISOString(),
  onGrid: row.on_grid !== false,
  eventId: row.event_id ? String(row.event_id) : null,
  authorName:
    toTrimmedString(profile?.name) ||
    toTrimmedString(profile?.username) ||
    'Campus User',
  authorUsername: toTrimmedString(profile?.username) || '',
  authorAvatar: toTrimmedString(profile?.avatar_url) || '',
});

const loadAuthorProfiles = async (authorIds: string[]) => {
  if (!supabase || !authorIds.length) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .in('id', authorIds);

  if (error) {
    console.error('Unable to load discover post authors:', error);
    return new Map<string, ProfileRow>();
  }

  return new Map(
    ((data || []) as ProfileRow[]).map((profile) => [String(profile.id), profile])
  );
};

const fetchDiscoverPostsFromNetwork = async (): Promise<DiscoverPostRecord[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('discover_posts')
    .select(POST_SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Unable to load discover posts:', error);
    return [];
  }

  const rows = (data || []) as DiscoverPostRow[];
  const authorIds = [
    ...new Set(rows.map((row) => String(row.author_id || '')).filter(Boolean)),
  ];
  const profileLookup = await loadAuthorProfiles(authorIds);

  return rows.map((row) =>
    normalizePostRow(row, profileLookup.get(String(row.author_id || '')))
  );
};

export type LoadDiscoverPostsOptions = {
  forceRefresh?: boolean;
  onData?: (
    posts: DiscoverPostRecord[],
    meta: { fromCache: boolean }
  ) => void;
};

/**
 * Load the discover feed.
 *
 * Returns cached data instantly when fresh and refreshes in the background.
 * Pass `{ forceRefresh: true }` from pull-to-refresh to bypass the cache.
 */
export const loadDiscoverPosts = async (
  options: LoadDiscoverPostsOptions = {}
): Promise<DiscoverPostRecord[]> => {
  const { forceRefresh = false, onData } = options;
  try {
    return await loadWithBackgroundRefresh<DiscoverPostRecord[]>(
      DISCOVER_FEED_CACHE_KEY,
      fetchDiscoverPostsFromNetwork,
      {
        ttlMs: DISCOVER_FEED_CACHE_TTL_MS,
        forceRefresh,
        refreshFresh: true,
        onData,
      }
    );
  } catch (error) {
    console.error('Unable to load discover posts:', error);
    return [];
  }
};

export const invalidateDiscoverFeedCache = () => {
  invalidateFeedCache((key) => key.startsWith('discover-posts:'));
};

export type LoadDiscoverPostsForAuthorOptions = {
  onlyGrid?: boolean;
};

export const loadDiscoverPostsForAuthor = async (
  authorId: string,
  options: LoadDiscoverPostsForAuthorOptions = {}
): Promise<DiscoverPostRecord[]> => {
  if (!supabase || !authorId) return [];

  let query = supabase
    .from('discover_posts')
    .select(POST_SELECT_COLUMNS)
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });

  if (options.onlyGrid) {
    query = query.eq('on_grid', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Unable to load author discover posts:', error);
    return [];
  }

  const rows = (data || []) as DiscoverPostRow[];
  const profileLookup = await loadAuthorProfiles([authorId]);

  return rows.map((row) =>
    normalizePostRow(row, profileLookup.get(String(authorId)))
  );
};

export const loadGridPostsForAuthor = (authorId: string) =>
  loadDiscoverPostsForAuthor(authorId, { onlyGrid: true });

export const loadDiscoverPostsByIds = async (
  postIds: string[] = []
): Promise<DiscoverPostRecord[]> => {
  if (!supabase) return [];

  const ids = [
    ...new Set(postIds.map((id) => String(id || '')).filter(Boolean)),
  ];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('discover_posts')
    .select(POST_SELECT_COLUMNS)
    .in('id', ids);

  if (error) {
    console.error('Unable to load discover posts by id:', error);
    return [];
  }

  const rows = (data || []) as DiscoverPostRow[];
  const authorIds = [
    ...new Set(rows.map((row) => String(row.author_id || '')).filter(Boolean)),
  ];
  const profileLookup = await loadAuthorProfiles(authorIds);

  return rows.map((row) =>
    normalizePostRow(row, profileLookup.get(String(row.author_id || '')))
  );
};

export const setDiscoverPostGridVisibility = async (
  postId: string,
  onGrid: boolean
): Promise<DiscoverPostRecord | null> => {
  if (!supabase || !postId) return null;

  const { data, error } = await supabase
    .from('discover_posts')
    .update({ on_grid: Boolean(onGrid) })
    .eq('id', postId)
    .select(POST_SELECT_COLUMNS)
    .single();

  if (error) {
    console.error('Unable to update post grid visibility:', error);
    throw new Error('Could not update grid visibility. Please try again.');
  }

  const row = data as DiscoverPostRow | null;
  if (!row) return null;

  invalidateDiscoverFeedCache();

  const profileLookup = await loadAuthorProfiles([String(row.author_id)]);
  return normalizePostRow(row, profileLookup.get(String(row.author_id)));
};

export const deleteDiscoverPost = async (postId: string) => {
  if (!supabase) {
    throw new Error('Posts are unavailable right now. Please try again later.');
  }

  if (!postId) {
    throw new Error('Missing post id.');
  }

  const { data: existing, error: fetchError } = await supabase
    .from('discover_posts')
    .select('id, media_url, thumbnail_url')
    .eq('id', postId)
    .maybeSingle();

  if (fetchError) {
    console.error('Unable to load post before delete:', fetchError);
    throw new Error('Could not delete this post right now. Please try again.');
  }

  const { error: deleteError } = await supabase
    .from('discover_posts')
    .delete()
    .eq('id', postId);

  if (deleteError) {
    console.error('Unable to delete discover post:', deleteError);
    throw new Error('Could not delete this post right now. Please try again.');
  }

  const existingPaths = existing as {
    media_url?: string | null;
    thumbnail_url?: string | null;
  } | null;
  const storagePaths = [existingPaths?.media_url, existingPaths?.thumbnail_url]
    .map((value) => toTrimmedString(value))
    .filter(Boolean)
    .filter((value) => {
      return !(
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('file://') ||
        value.startsWith('data:')
      );
    })
    .map(normalizeStoragePath)
    .filter(Boolean);

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(DISCOVER_POST_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      console.warn('Post row deleted but storage cleanup failed:', storageError);
    }
  }

  invalidateDiscoverFeedCache();

  return { id: String(postId) };
};

const uploadThumbnail = async ({
  authorId,
  thumbUri,
  thumbFileName,
  thumbMimeType,
  timestamp,
}: {
  authorId: string;
  thumbUri: string;
  thumbFileName: string;
  thumbMimeType: string;
  timestamp: number;
}): Promise<string> => {
  if (!supabase || !thumbUri) return '';
  const extension = getFileExtension(thumbFileName, thumbMimeType, thumbUri);
  const thumbPath = `${DISCOVER_POST_THUMBNAIL_FOLDER}/${authorId}/${timestamp}-thumb.${extension}`;
  const thumbBody = await readFileAsArrayBuffer(thumbUri);

  const { error: thumbUploadError } = await supabase.storage
    .from(DISCOVER_POST_BUCKET)
    .upload(thumbPath, thumbBody, {
      cacheControl: '3600',
      contentType: thumbMimeType,
      upsert: false,
    });

  if (thumbUploadError) {
    console.warn('Thumbnail upload failed, continuing without poster:', thumbUploadError);
    return '';
  }

  return thumbPath;
};

export const uploadDiscoverPost = async ({
  authorId,
  media,
  caption,
  onGrid = true,
  eventId = null,
}: {
  authorId: string;
  media: SelectedStoryMedia;
  caption?: string;
  onGrid?: boolean;
  eventId?: string | null;
}) => {
  if (!supabase) {
    throw new Error('Posts are unavailable right now. Please try again later.');
  }

  if (media.fileSize && media.fileSize > MAX_POST_MEDIA_BYTES) {
    throw new Error('Choose media smaller than 120 MB for posts.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Unable to resolve authenticated post author:', authError);
  }

  const effectiveAuthorId = user?.id || authorId;

  if (!effectiveAuthorId) {
    throw new Error('You need to be signed in to publish a post.');
  }

  // Compress images before upload. Videos are uploaded as-is since RN video
  // transcoding requires a heavy native module; we generate a poster instead
  // and the feed renders it first with viewport-based playback.
  const isImage = media.mediaType === 'image';
  const compressed = isImage ? await compressImageMedia(media) : null;

  const uploadUri = compressed?.uri || media.uri;
  const uploadMimeType = compressed?.mimeType || media.mimeType;
  const uploadFileName = compressed?.fileName || media.fileName;

  const timestamp = Date.now();
  const extension = getFileExtension(uploadFileName, uploadMimeType, uploadUri);
  const filePath = `${DISCOVER_POST_FOLDER}/${effectiveAuthorId}/${timestamp}.${extension}`;
  const fileBody = await readFileAsArrayBuffer(uploadUri);

  const { error: uploadError } = await supabase.storage
    .from(DISCOVER_POST_BUCKET)
    .upload(filePath, fileBody, {
      cacheControl: '3600',
      contentType: uploadMimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Discover post upload failed:', uploadError);
    throw new Error('Could not upload your post right now. Please try again.');
  }

  let thumbnailPath = '';
  let mediaWidth: number | null = compressed?.width ?? null;
  let mediaHeight: number | null = compressed?.height ?? null;
  let durationSeconds: number | null = null;

  if (media.mediaType === 'video') {
    const poster = await extractVideoPoster(media);
    if (poster) {
      mediaWidth = poster.width ?? null;
      mediaHeight = poster.height ?? null;
      thumbnailPath = await uploadThumbnail({
        authorId: effectiveAuthorId,
        thumbUri: poster.uri,
        thumbFileName: poster.fileName,
        thumbMimeType: poster.mimeType,
        timestamp,
      });
    }
  }

  const { data, error } = await supabase
    .from('discover_posts')
    .insert({
      author_id: effectiveAuthorId,
      media_url: filePath,
      media_type: media.mediaType,
      caption: toTrimmedString(caption) || null,
      on_grid: Boolean(onGrid),
      event_id: eventId || null,
      thumbnail_url: thumbnailPath || null,
      duration: durationSeconds,
      width: mediaWidth,
      height: mediaHeight,
    })
    .select(POST_SELECT_COLUMNS)
    .single();

  if (error) {
    console.error('Unable to insert discover post row:', error);
    throw new Error('Could not publish your post right now. Please try again.');
  }

  invalidateDiscoverFeedCache();

  return data;
};
