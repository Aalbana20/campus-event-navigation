import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { compressImageMedia } from '@/lib/mobile-media-compression';
import { supabase } from '@/lib/supabase';
import type { StoryMediaType, StoryStickerRecord, StoryType } from '@/types/models';

export const STORY_MEDIA_BUCKET = 'stories';
export const STORY_MEDIA_FOLDER = 'media';

const MAX_STORY_MEDIA_BYTES = 80 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export type SelectedStoryMedia = {
  uri: string;
  mediaType: StoryMediaType;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
};

const toTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const buildSelectionError = (message: string) => new Error(message);

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
  if (trimmed.startsWith(`${STORY_MEDIA_BUCKET}/`)) {
    return trimmed.slice(STORY_MEDIA_BUCKET.length + 1);
  }

  return trimmed;
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

export const resolveStoryMediaUrl = (
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
    .from(STORY_MEDIA_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl || fallback;
};

export const pickStoryMediaFromLibrary = async (): Promise<SelectedStoryMedia | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw buildSelectionError(
      'Allow photo library access to choose a story photo or video.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 1,
    videoMaxDuration: 60,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];

  if (!asset?.uri) {
    throw buildSelectionError('We could not read the selected media.');
  }

  if (asset.fileSize && asset.fileSize > MAX_STORY_MEDIA_BYTES) {
    throw buildSelectionError('Please choose media smaller than 80 MB.');
  }

  const mediaType: StoryMediaType = asset.type === 'video' ? 'video' : 'image';
  const extension = getFileExtension(asset.fileName, asset.mimeType, asset.uri);
  const mimeType =
    asset.mimeType ||
    (mediaType === 'video'
      ? `video/${extension === 'mov' ? 'quicktime' : 'mp4'}`
      : `image/${extension === 'jpg' ? 'jpeg' : extension}`);

  return {
    uri: asset.uri,
    mediaType,
    fileName:
      asset.fileName ||
      `story-${Date.now()}.${extension}`,
    mimeType,
    fileSize: asset.fileSize,
  };
};

export const createSelectedStoryMedia = ({
  uri,
  mediaType,
  fileName,
  mimeType,
  fileSize,
}: SelectedStoryMedia) => ({
  uri,
  mediaType,
  fileName,
  mimeType,
  fileSize,
});

export const uploadStoryMedia = async ({
  authorId,
  media,
  caption,
  storyType,
  stickers,
}: {
  authorId: string;
  media: SelectedStoryMedia;
  caption?: string;
  storyType?: StoryType;
  stickers?: StoryStickerRecord[];
}) => {
  if (!supabase) {
    throw new Error('Stories are unavailable right now. Please try again later.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Unable to resolve authenticated story author:', authError);
  }

  const effectiveAuthorId = user?.id || authorId;

  if (!effectiveAuthorId || effectiveAuthorId === 'current-user') {
    throw new Error('You need to be signed in to publish a story.');
  }

  const compressed = media.mediaType === 'image' ? await compressImageMedia(media) : null;
  const uploadUri = compressed?.uri ?? media.uri;
  const uploadMimeType = compressed?.mimeType ?? media.mimeType;
  const uploadFileName = compressed?.fileName ?? media.fileName;

  const extension = getFileExtension(uploadFileName, uploadMimeType, uploadUri);
  const filePath = `${STORY_MEDIA_FOLDER}/${effectiveAuthorId}/${Date.now()}.${extension}`;
  const fileBody = await readFileAsArrayBuffer(uploadUri);

  const { error: uploadError } = await supabase.storage
    .from(STORY_MEDIA_BUCKET)
    .upload(filePath, fileBody, {
      cacheControl: '3600',
      contentType: uploadMimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Story media upload failed:', uploadError);
    throw new Error('Could not upload your story media. Please try again.');
  }

  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: effectiveAuthorId,
      media_url: filePath,
      media_type: media.mediaType,
      caption: toTrimmedString(caption) || null,
      story_type: storyType || 'standard',
      stickers: stickers ?? [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('Story row insert failed:', error);
    throw new Error('Could not publish your story. Please try again.');
  }

  return {
    storyId: String(data.id),
    storagePath: filePath,
  };
};

export const createEventShareStory = async ({
  authorId,
  eventId,
  eventImageUrl,
  caption,
  stickers,
}: {
  authorId: string;
  eventId: string;
  eventImageUrl: string;
  caption?: string;
  stickers: StoryStickerRecord[];
}) => {
  if (!supabase) {
    throw new Error('Stories are unavailable right now. Please try again later.');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('Unable to resolve authenticated story author:', authError);
  }

  const effectiveAuthorId = user?.id || authorId;
  if (!effectiveAuthorId || effectiveAuthorId === 'current-user') {
    throw new Error('You need to be signed in to publish a story.');
  }

  const trimmedImageUrl = toTrimmedString(eventImageUrl);
  if (!trimmedImageUrl) {
    throw new Error('This event does not have a flyer image to share yet.');
  }

  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: effectiveAuthorId,
      media_url: trimmedImageUrl,
      media_type: 'image',
      caption: toTrimmedString(caption) || null,
      story_type: 'event_share' as StoryType,
      stickers,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Event share story insert failed:', error);
    const message = typeof error.message === 'string' ? error.message : '';
    if (
      error.code === 'PGRST204' ||
      /column.*(stickers|story_type).*schema cache/i.test(message) ||
      /Could not find the .*(stickers|story_type). column/i.test(message)
    ) {
      throw new Error(
        "Stories can't save sticker data yet. Run the latest Supabase migration " +
          "(adds stories.story_type and stories.stickers) and try again."
      );
    }
    throw new Error('Could not publish your story. Please try again.');
  }

  return {
    storyId: String(data.id),
    eventId: String(eventId),
  };
};
