import { supabase } from '@/lib/supabase';

export const PROFILE_IMAGE_BUCKET = 'profile-images';
export const PROFILE_IMAGE_FOLDER = 'avatars';

const PROFILE_IMAGE_PUBLIC_SEGMENT = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;

const toTrimmedString = (value: string | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const isRemoteUrl = (value: string) =>
  value.startsWith('http://') || value.startsWith('https://');

const normalizeProfileImagePath = (value: string) => {
  if (!value) return '';

  if (value.includes(PROFILE_IMAGE_PUBLIC_SEGMENT)) {
    const [, rawPath = ''] = value.split(PROFILE_IMAGE_PUBLIC_SEGMENT);
    return decodeURIComponent((rawPath.split('?')[0] || '').trim());
  }

  if (value.startsWith(`${PROFILE_IMAGE_BUCKET}/`)) {
    return value.slice(PROFILE_IMAGE_BUCKET.length + 1);
  }

  if (value.startsWith(`${PROFILE_IMAGE_FOLDER}/`)) {
    return value;
  }

  return '';
};

export const normalizeAvatarStorageValue = (
  value: string | null | undefined,
  fallback: string | null | undefined = null
) : string => {
  const fallbackValue: string =
    value === fallback ? '' : normalizeAvatarStorageValue(fallback, null);
  const trimmed = toTrimmedString(value);

  if (!trimmed) return fallbackValue;

  if (
    trimmed === '/default-avatar.png' ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')
  ) {
    return fallbackValue;
  }

  const storagePath = normalizeProfileImagePath(trimmed);
  if (storagePath) return storagePath;

  if (isRemoteUrl(trimmed)) {
    return trimmed;
  }

  return fallbackValue;
};

// Avatars appear all over (DM rows, story strip, comments, profile cards).
// Cache the public URL by storage path so repeated resolves are free and
// the returned string is referentially stable across renders.
const PROFILE_IMAGE_URL_CACHE = new Map<string, string>();

const resolveProfileImageUrl = (value: string) => {
  if (!value) return '';
  if (isRemoteUrl(value)) return value;
  if (!supabase) return '';

  const cached = PROFILE_IMAGE_URL_CACHE.get(value);
  if (cached) return cached;

  const { data } = supabase.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(value);
  const resolved = data?.publicUrl || '';
  if (resolved) PROFILE_IMAGE_URL_CACHE.set(value, resolved);
  return resolved;
};

export const resolveAvatarUrl = (
  value: string | null | undefined,
  fallback = ''
) => {
  const normalized = normalizeAvatarStorageValue(value, fallback || null);

  if (!normalized) {
    return fallback;
  }

  const resolved = resolveProfileImageUrl(normalized);
  return resolved || fallback;
};
