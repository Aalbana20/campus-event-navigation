import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

import {
  EVENT_MEMORY_BUCKET,
  resolveEventMemoryMediaUrl,
} from '@/lib/mobile-event-memories';
import type { SelectedStoryMedia } from '@/lib/mobile-story-composer';
import { supabase } from '@/lib/supabase';

const MAX_RECAP_MEDIA_ITEMS = 4;
const MAX_RECAP_MEDIA_BYTES = 120 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type RecapMediaItem = {
  id: string;
  url: string;
  mediaType: 'image' | 'video';
  sortOrder: number;
};

export type RecapPostRecord = {
  id: string;
  eventId: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  caption: string;
  createdAt: string;
  updatedAt: string;
  media: RecapMediaItem[];
};

type RecapPostRow = {
  id: string;
  event_id: string;
  user_id: string;
  body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RecapMediaRow = {
  id: string;
  recap_post_id: string;
  media_url: string;
  media_type?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

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

  return 'jpg';
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

const loadAuthorProfiles = async (authorIds: string[]) => {
  if (!supabase || authorIds.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, username, avatar_url')
    .in('id', authorIds);

  if (error) {
    console.warn('Unable to load recap authors:', error);
    return new Map<string, ProfileRow>();
  }

  return new Map(
    ((data || []) as ProfileRow[]).map((profile) => [String(profile.id), profile])
  );
};

export const loadRecapPostsForEvent = async (
  eventId: string
): Promise<RecapPostRecord[]> => {
  if (!supabase || !eventId) return [];

  const { data: postRows, error: postsError } = await supabase
    .from('recap_posts')
    .select('id, event_id, user_id, body, created_at, updated_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (postsError) {
    console.warn('Unable to load recap posts:', postsError);
    return [];
  }

  const posts = (postRows || []) as RecapPostRow[];
  const postIds = posts.map((post) => String(post.id));
  const authorIds = [
    ...new Set(posts.map((post) => String(post.user_id || '')).filter(Boolean)),
  ];

  const [profileLookup, mediaResult] = await Promise.all([
    loadAuthorProfiles(authorIds),
    postIds.length > 0
      ? supabase
          .from('recap_media')
          .select('id, recap_post_id, media_url, media_type, sort_order, created_at')
          .in('recap_post_id', postIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (mediaResult.error) {
    console.warn('Unable to load recap media:', mediaResult.error);
  }

  const mediaByPostId = new Map<string, RecapMediaItem[]>();
  await Promise.all(
    (((mediaResult.data || []) as RecapMediaRow[]).map(async (media) => {
      const postId = String(media.recap_post_id);
      const item: RecapMediaItem = {
        id: String(media.id),
        url: await resolveEventMemoryMediaUrl(media.media_url),
        mediaType: media.media_type === 'video' ? 'video' : 'image',
        sortOrder: Number(media.sort_order || 0),
      };
      mediaByPostId.set(postId, [...(mediaByPostId.get(postId) || []), item]);
    }))
  );

  return posts.map((post) => {
    const authorId = String(post.user_id || '');
    const profile = profileLookup.get(authorId);
    return {
      id: String(post.id),
      eventId: String(post.event_id),
      authorId,
      authorName:
        toTrimmedString(profile?.name) ||
        toTrimmedString(profile?.username) ||
        'Campus User',
      authorUsername: toTrimmedString(profile?.username),
      authorAvatar: toTrimmedString(profile?.avatar_url),
      caption: toTrimmedString(post.body),
      createdAt: post.created_at || new Date().toISOString(),
      updatedAt: post.updated_at || post.created_at || new Date().toISOString(),
      media: mediaByPostId.get(String(post.id)) || [],
    };
  });
};

export const loadRecapPostsForUser = async (
  userId: string
): Promise<RecapPostRecord[]> => {
  if (!supabase || !userId) return [];

  const { data: postRows, error: postsError } = await supabase
    .from('recap_posts')
    .select('id, event_id, user_id, body, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (postsError) {
    console.warn('Unable to load user recap posts:', postsError);
    return [];
  }

  const posts = (postRows || []) as RecapPostRow[];
  const postIds = posts.map((post) => String(post.id));
  const authorIds = [
    ...new Set(posts.map((post) => String(post.user_id || '')).filter(Boolean)),
  ];

  const [profileLookup, mediaResult] = await Promise.all([
    loadAuthorProfiles(authorIds),
    postIds.length > 0
      ? supabase
          .from('recap_media')
          .select('id, recap_post_id, media_url, media_type, sort_order, created_at')
          .in('recap_post_id', postIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (mediaResult.error) {
    console.warn('Unable to load user recap media:', mediaResult.error);
  }

  const mediaByPostId = new Map<string, RecapMediaItem[]>();
  await Promise.all(
    (((mediaResult.data || []) as RecapMediaRow[]).map(async (media) => {
      const postId = String(media.recap_post_id);
      const item: RecapMediaItem = {
        id: String(media.id),
        url: await resolveEventMemoryMediaUrl(media.media_url),
        mediaType: media.media_type === 'video' ? 'video' : 'image',
        sortOrder: Number(media.sort_order || 0),
      };
      mediaByPostId.set(postId, [...(mediaByPostId.get(postId) || []), item]);
    }))
  );

  return posts.map((post) => {
    const authorId = String(post.user_id || '');
    const profile = profileLookup.get(authorId);
    return {
      id: String(post.id),
      eventId: String(post.event_id),
      authorId,
      authorName:
        toTrimmedString(profile?.name) ||
        toTrimmedString(profile?.username) ||
        'Campus User',
      authorUsername: toTrimmedString(profile?.username),
      authorAvatar: toTrimmedString(profile?.avatar_url),
      caption: toTrimmedString(post.body),
      createdAt: post.created_at || new Date().toISOString(),
      updatedAt: post.updated_at || post.created_at || new Date().toISOString(),
      media: mediaByPostId.get(String(post.id)) || [],
    };
  });
};

const uploadRecapMedia = async ({
  eventId,
  userId,
  postId,
  media,
  index,
}: {
  eventId: string;
  userId: string;
  postId: string;
  media: SelectedStoryMedia;
  index: number;
}) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (media.fileSize && media.fileSize > MAX_RECAP_MEDIA_BYTES) {
    throw new Error('Choose images smaller than 120 MB for recaps.');
  }

  const extension = getFileExtension(media.fileName, media.mimeType, media.uri);
  const storagePath = `recaps/${eventId}/${userId}/${postId}-${index}.${extension}`;
  const fileBody = await readFileAsArrayBuffer(media.uri);

  const { error } = await supabase.storage
    .from(EVENT_MEMORY_BUCKET)
    .upload(storagePath, fileBody, {
      cacheControl: '3600',
      contentType: media.mimeType || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.warn('Unable to upload recap media:', error);
    throw new Error('Could not upload recap images right now.');
  }

  return storagePath;
};

export const createRecapPost = async ({
  eventId,
  userId,
  body,
  media,
}: {
  eventId: string;
  userId: string;
  body: string;
  media: SelectedStoryMedia[];
}) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const trimmedBody = body.trim();
  const selectedMedia = media.slice(0, MAX_RECAP_MEDIA_ITEMS);

  if (!trimmedBody && selectedMedia.length === 0) {
    throw new Error('Write something or add at least one image.');
  }

  const { data: post, error: postError } = await supabase
    .from('recap_posts')
    .insert({
      event_id: eventId,
      user_id: userId,
      body: trimmedBody || null,
    })
    .select('id')
    .single();

  if (postError) {
    console.warn('Unable to create recap post:', postError);
    throw new Error(postError.message || 'Could not create this recap.');
  }

  const postId = String(post.id);
  const uploadedPaths: string[] = [];

  try {
    const mediaRows = [];
    for (let index = 0; index < selectedMedia.length; index += 1) {
      const storagePath = await uploadRecapMedia({
        eventId,
        userId,
        postId,
        media: selectedMedia[index],
        index,
      });
      uploadedPaths.push(storagePath);
      mediaRows.push({
        recap_post_id: postId,
        media_url: storagePath,
        media_type: 'image',
        sort_order: index,
      });
    }

    if (mediaRows.length > 0) {
      const { error: mediaError } = await supabase.from('recap_media').insert(mediaRows);
      if (mediaError) throw mediaError;
    }

    return postId;
  } catch (error) {
    await supabase.from('recap_posts').delete().eq('id', postId);
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(EVENT_MEMORY_BUCKET).remove(uploadedPaths);
    }
    console.warn('Unable to finish recap post:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Could not post this recap right now.'
    );
  }
};
