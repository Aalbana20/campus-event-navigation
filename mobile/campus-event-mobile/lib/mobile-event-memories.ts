import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import type { SelectedStoryMedia } from '@/lib/mobile-story-composer';

export const EVENT_MEMORY_BUCKET = 'event-memories';
const MAX_MEMORY_MEDIA_BYTES = 120 * 1024 * 1024;

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

export type EventMemoryMediaType = 'image' | 'video';

export type EventMemoryRecord = {
  id: string;
  eventId: string;
  authorId: string;
  mediaUrl: string;
  mediaType: EventMemoryMediaType;
  caption: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
};

type EventMemoryRow = {
  id: string;
  event_id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

const MEMORY_SELECT_COLUMNS =
  'id, event_id, author_id, media_url, media_type, caption, metadata, created_at';

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
  if (trimmed.startsWith(`${EVENT_MEMORY_BUCKET}/`)) {
    return trimmed.slice(EVENT_MEMORY_BUCKET.length + 1);
  }
  return trimmed;
};

const warnedMissingMemoryPaths = new Set<string>();

const warnMemoryMediaFallback = ({
  storagePath,
  message,
  statusCode,
}: {
  storagePath: string;
  message?: string;
  statusCode?: string | number;
}) => {
  const warningKey = `${storagePath}:${message || ''}:${statusCode || ''}`;
  if (warnedMissingMemoryPaths.has(warningKey)) return;
  warnedMissingMemoryPaths.add(warningKey);
  console.warn('[event-memories] Skipping unavailable media object', {
    bucket: EVENT_MEMORY_BUCKET,
    path: storagePath,
    statusCode,
    message,
  });
};

export const resolveEventMemoryMediaUrl = async (
  value: string | null | undefined,
  fallback = ''
): Promise<string> => {
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
  if (!storagePath) return fallback;

  const { data, error } = await supabase.storage
    .from(EVENT_MEMORY_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) {
    const storageError = error as { message?: string; statusCode?: string | number };
    warnMemoryMediaFallback({
      storagePath,
      message: storageError.message || 'Could not sign media URL',
      statusCode: storageError.statusCode,
    });
    return fallback;
  }

  return data.signedUrl || fallback;
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

const normalizeMemoryRow = async (
  row: EventMemoryRow,
  profile?: ProfileRow
): Promise<EventMemoryRecord> => ({
  id: String(row.id),
  eventId: String(row.event_id),
  authorId: String(row.author_id),
  mediaUrl: await resolveEventMemoryMediaUrl(row.media_url),
  mediaType: row.media_type === 'video' ? 'video' : 'image',
  caption: toTrimmedString(row.caption),
  metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  createdAt: row.created_at || new Date().toISOString(),
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
    console.error('Unable to load event memory authors:', error);
    return new Map<string, ProfileRow>();
  }

  return new Map(
    ((data || []) as ProfileRow[]).map((profile) => [
      String(profile.id),
      profile,
    ])
  );
};

export const loadEventMemoriesForEvent = async (
  eventId: string
): Promise<EventMemoryRecord[]> => {
  if (!supabase || !eventId) return [];

  const { data, error } = await supabase
    .from('event_memories')
    .select(MEMORY_SELECT_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load event memories:', error);
    return [];
  }

  const rows = (data || []) as EventMemoryRow[];
  const authorIds = [
    ...new Set(rows.map((row) => String(row.author_id || '')).filter(Boolean)),
  ];
  const profileLookup = await loadAuthorProfiles(authorIds);

  const memories = await Promise.all(
    rows.map((row) =>
      normalizeMemoryRow(row, profileLookup.get(String(row.author_id || '')))
    )
  );
  return memories.filter((memory) => Boolean(memory.mediaUrl));
};

export const loadEventMemoriesForUser = async (
  userId: string
): Promise<EventMemoryRecord[]> => {
  if (!supabase || !userId) return [];

  const { data, error } = await supabase
    .from('event_memories')
    .select(MEMORY_SELECT_COLUMNS)
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Unable to load user event memories:', error);
    return [];
  }

  const rows = (data || []) as EventMemoryRow[];
  const profileLookup = await loadAuthorProfiles([userId]);

  const memories = await Promise.all(
    rows.map((row) => normalizeMemoryRow(row, profileLookup.get(String(userId))))
  );
  return memories.filter((memory) => Boolean(memory.mediaUrl));
};

export const userAttendedEvent = async ({
  userId,
  eventId,
}: {
  userId: string;
  eventId: string;
}): Promise<boolean> => {
  if (!supabase || !userId || !eventId) return false;

  const { data, error } = await supabase.rpc('user_attended_event', {
    target_user_id: userId,
    target_event_id: eventId,
  });

  if (error) {
    console.error('Unable to verify event attendance:', error);
    return false;
  }

  return Boolean(data);
};

export const uploadEventMemory = async ({
  authorId,
  eventId,
  media,
  caption,
  metadata,
}: {
  authorId: string;
  eventId: string;
  media: SelectedStoryMedia;
  caption?: string;
  metadata?: Record<string, unknown>;
}) => {
  if (!supabase) {
    throw new Error('Event memories are unavailable right now.');
  }

  if (!authorId || !eventId || !media) {
    throw new Error('Choose media to post to this event.');
  }

  if (media.fileSize && media.fileSize > MAX_MEMORY_MEDIA_BYTES) {
    throw new Error('Choose media smaller than 120 MB for event memories.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Unable to resolve authenticated memory author:', authError);
  }

  const effectiveAuthorId = user?.id || authorId;

  if (!effectiveAuthorId) {
    throw new Error('You need to be signed in to post event memories.');
  }

  const extension = getFileExtension(media.fileName, media.mimeType, media.uri);
  const filePath = `${eventId}/${effectiveAuthorId}/${Date.now()}.${extension}`;
  const fileBody = await readFileAsArrayBuffer(media.uri);

  const { error: uploadError } = await supabase.storage
    .from(EVENT_MEMORY_BUCKET)
    .upload(filePath, fileBody, {
      cacheControl: '3600',
      contentType: media.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Event memory upload failed:', uploadError);
    throw new Error('Could not upload your memory right now. Please try again.');
  }

  const { data, error } = await supabase
    .from('event_memories')
    .insert({
      event_id: eventId,
      author_id: effectiveAuthorId,
      media_url: filePath,
      media_type: media.mediaType,
      caption: toTrimmedString(caption) || null,
      metadata:
        metadata && typeof metadata === 'object' ? metadata : {},
    })
    .select(MEMORY_SELECT_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(EVENT_MEMORY_BUCKET).remove([filePath]);
    console.error('Unable to insert event memory row:', error);
    throw new Error(
      "Could not post this memory. Make sure you've RSVP'd to the event."
    );
  }

  return data;
};

export const deleteEventMemory = async (memoryId: string): Promise<void> => {
  if (!supabase || !memoryId) return;

  const { data: memoryRow, error: loadError } = await supabase
    .from('event_memories')
    .select('media_url')
    .eq('id', memoryId)
    .maybeSingle();

  if (loadError) {
    console.error('Unable to load event memory before delete:', loadError);
  }

  const { error } = await supabase
    .from('event_memories')
    .delete()
    .eq('id', memoryId);

  if (error) {
    console.error('Unable to delete event memory:', error);
    throw new Error('Could not delete this memory. Please try again.');
  }

  const storagePath = normalizeStoragePath(
    typeof memoryRow?.media_url === 'string' ? memoryRow.media_url : ''
  );

  if (storagePath) {
    const { error: removeError } = await supabase.storage
      .from(EVENT_MEMORY_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      console.error('Unable to remove event memory media:', removeError);
    }
  }
};
