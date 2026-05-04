import * as ImagePicker from 'expo-image-picker';

import type { RecapComposerPhoto } from '@/providers/mobile-recap-composer';

const MAX_RECAP_MEDIA_BYTES = 120 * 1024 * 1024;

const buildPickerError = (message: string) => {
  const error = new Error(message);
  error.name = 'RecapPhotoPickerError';
  return error;
};

const inferMimeType = (asset: ImagePicker.ImagePickerAsset) => {
  if (asset.mimeType) return asset.mimeType;
  const lower = (asset.uri || '').toLowerCase();
  if (asset.type === 'video') {
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.webm')) return 'video/webm';
    return 'video/mp4';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
};

const inferMediaType = (asset: ImagePicker.ImagePickerAsset): 'image' | 'video' => {
  if (asset.type === 'video') return 'video';
  if (asset.mimeType?.startsWith('video/')) return 'video';
  const lower = (asset.uri || '').toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
    return 'video';
  }
  return 'image';
};

export const pickRecapMediaFromLibrary = async (
  remainingSlots: number
): Promise<RecapComposerPhoto[]> => {
  if (remainingSlots <= 0) return [];

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw buildPickerError(
      'Allow media library access to choose recap media.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 1,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, Math.min(remainingSlots, 10)),
  });

  if (result.canceled) return [];

  const assets = (result.assets || []).filter((asset) => Boolean(asset?.uri));
  const media: RecapComposerPhoto[] = [];

  for (const asset of assets) {
    if (asset.fileSize && asset.fileSize > MAX_RECAP_MEDIA_BYTES) {
      throw buildPickerError('Each media item must be smaller than 120 MB.');
    }

    media.push({
      uri: asset.uri,
      mediaType: inferMediaType(asset),
      mimeType: inferMimeType(asset),
      fileName: asset.fileName || undefined,
      fileSize: asset.fileSize,
      width: asset.width ?? null,
      height: asset.height ?? null,
    });
  }

  return media;
};
