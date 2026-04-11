import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import type { StoryMediaType } from '@/types/models';

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
}: {
  authorId: string;
  media: SelectedStoryMedia;
  caption?: string;
}) => {
  if (!supabase) {
    throw new Error('Stories are unavailable right now. Please try again later.');
  }

  const extension = getFileExtension(media.fileName, media.mimeType, media.uri);
  const filePath = `${STORY_MEDIA_FOLDER}/${authorId}/${Date.now()}.${extension}`;
  const fileBody = await readFileAsArrayBuffer(media.uri);

  const { error: uploadError } = await supabase.storage
    .from(STORY_MEDIA_BUCKET)
    .upload(filePath, fileBody, {
      cacheControl: '3600',
      contentType: media.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Story media upload failed:', uploadError);
    throw new Error('Could not upload your story media. Please try again.');
  }

  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: authorId,
      media_url: filePath,
      media_type: media.mediaType,
      caption: toTrimmedString(caption) || null,
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
