import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import {
  normalizeAvatarStorageValue,
  PROFILE_IMAGE_BUCKET,
  PROFILE_IMAGE_FOLDER,
} from '@/lib/avatar-storage';
import { DEFAULT_AVATAR } from '@/lib/mobile-backend';
import { supabase } from '@/lib/supabase';

const MAX_PROFILE_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type SelectedProfileImage = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
};

const getFileExtension = (
  fileName?: string | null,
  mimeType?: string | null,
  uri?: string | null
) => {
  const normalizedFileName = fileName?.trim().toLowerCase() || '';
  const normalizedUri = uri?.trim().toLowerCase() || '';

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

const buildSelectionError = (message: string) => new Error(message);

export const pickProfileImage = async (): Promise<SelectedProfileImage | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw buildSelectionError(
      'Allow photo library access to choose a profile picture.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled) return null;

  const asset = result.assets?.[0];

  if (!asset?.uri) {
    throw buildSelectionError('We could not read the selected image.');
  }

  if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
    throw buildSelectionError('Please choose a valid image file.');
  }

  if (asset.fileSize && asset.fileSize > MAX_PROFILE_IMAGE_BYTES) {
    throw buildSelectionError('Please choose an image smaller than 8 MB.');
  }

  const extension = getFileExtension(asset.fileName, asset.mimeType, asset.uri);
  const mimeType =
    asset.mimeType && asset.mimeType.startsWith('image/')
      ? asset.mimeType
      : `image/${extension === 'jpg' ? 'jpeg' : extension}`;

  return {
    uri: asset.uri,
    fileName: asset.fileName || `avatar.${extension}`,
    mimeType,
    fileSize: asset.fileSize,
  };
};

export const uploadProfileImage = async ({
  userId,
  image,
  fallbackUrl,
}: {
  userId: string;
  image: SelectedProfileImage;
  fallbackUrl?: string;
}) => {
  if (!supabase) {
    throw new Error('Storage is unavailable right now. Please try again later.');
  }

  const normalizedFallback = normalizeAvatarStorageValue(fallbackUrl, null);

  const fileExtension = getFileExtension(
    image.fileName,
    image.mimeType,
    image.uri
  );
  const filePath = `${PROFILE_IMAGE_FOLDER}/${userId}-${Date.now()}.${fileExtension}`;
  const fileBody = await readFileAsArrayBuffer(image.uri);

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(filePath, fileBody, {
      contentType: image.mimeType || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('Profile image upload failed:', uploadError);
    throw new Error('Could not upload your photo. Please try again.');
  }

  return normalizeAvatarStorageValue(filePath, normalizedFallback || DEFAULT_AVATAR);
};
