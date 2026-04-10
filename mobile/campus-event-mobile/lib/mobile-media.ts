import type { ImageSourcePropType } from 'react-native';

import { resolveAvatarUrl } from '@/lib/avatar-storage';
import { DEFAULT_AVATAR, DEFAULT_EVENT_IMAGE } from '@/lib/mobile-backend';

export const sanitizeMediaUrl = (
  url: string | null | undefined,
  fallback = ''
): string => {
  if (!url || typeof url !== 'string') return fallback;

  const trimmed = url.trim();

  if (!trimmed) return fallback;
  if (trimmed.startsWith('blob:')) return fallback;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('file://') || trimmed.startsWith('data:image/')) return trimmed;

  return fallback;
};

export const getAvatarImageUri = (url: string | null | undefined) =>
  resolveAvatarUrl(url, DEFAULT_AVATAR);

export const getEventImageUri = (url: string | null | undefined) =>
  sanitizeMediaUrl(url, DEFAULT_EVENT_IMAGE);

export const getAvatarImageSource = (
  url: string | null | undefined
): ImageSourcePropType => ({
  uri: getAvatarImageUri(url),
});

export const getEventImageSource = (
  url: string | null | undefined
): ImageSourcePropType => ({
  uri: getEventImageUri(url),
});
