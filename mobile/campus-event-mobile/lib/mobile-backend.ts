import type { User } from '@supabase/supabase-js';

import {
  EventPrivacy,
  EventRecord,
  FollowRelationship,
  ProfileRecord,
} from '@/types/models';

const DEFAULT_AVATAR_SVG = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1d4ed8" />
        <stop offset="55%" stop-color="#2563eb" />
        <stop offset="100%" stop-color="#f97316" />
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="36" fill="url(#bg)" />
    <circle cx="64" cy="48" r="24" fill="rgba(255,255,255,0.92)" />
    <path d="M28 108c6-22 23-34 36-34s30 12 36 34" fill="rgba(255,255,255,0.88)" />
  </svg>
`);

const DEFAULT_EVENT_IMAGE_SVG = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" fill="none">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#111827" />
        <stop offset="45%" stop-color="#2563eb" />
        <stop offset="100%" stop-color="#ec4899" />
      </linearGradient>
    </defs>
    <rect width="960" height="720" rx="42" fill="url(#bg)" />
    <circle cx="760" cy="176" r="124" fill="rgba(255,255,255,0.11)" />
    <circle cx="176" cy="612" r="148" fill="rgba(255,255,255,0.08)" />
    <rect x="104" y="116" width="752" height="488" rx="40" fill="rgba(8,11,16,0.18)" stroke="rgba(255,255,255,0.18)" />
    <rect x="164" y="188" width="236" height="38" rx="19" fill="rgba(255,255,255,0.22)" />
    <rect x="164" y="262" width="430" height="142" rx="28" fill="rgba(255,255,255,0.16)" />
    <rect x="626" y="262" width="174" height="142" rx="28" fill="rgba(255,255,255,0.14)" />
    <rect x="164" y="444" width="232" height="24" rx="12" fill="rgba(255,255,255,0.2)" />
    <rect x="164" y="490" width="184" height="24" rx="12" fill="rgba(255,255,255,0.16)" />
    <rect x="164" y="548" width="160" height="46" rx="23" fill="rgba(255,255,255,0.18)" />
  </svg>
`);

export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,${DEFAULT_AVATAR_SVG}`;
export const DEFAULT_EVENT_IMAGE = `data:image/svg+xml;utf8,${DEFAULT_EVENT_IMAGE_SVG}`;
export const DEFAULT_PROFILE_BIO = 'Exploring campus events and new people.';

export const EMPTY_PROFILE: ProfileRecord = {
  id: '',
  name: 'Campus User',
  username: 'guest',
  bio: DEFAULT_PROFILE_BIO,
  avatar: DEFAULT_AVATAR,
  interests: [],
  phoneNumber: '',
  birthday: '',
  email: '',
};

type ProfileRow = {
  id: string;
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  birthday?: string | null;
  interests?: string[] | string | null;
  email?: string | null;
};

type EventRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  date?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_address?: string | null;
  organizer?: string | null;
  dress_code?: string | null;
  image?: string | null;
  tags?: string[] | string | null;
  created_by?: string | null;
  creator_username?: string | null;
  going_count?: number | null;
  privacy?: EventPrivacy | null;
  is_private?: boolean | null;
  created_at?: string | null;
};

type FollowRow = {
  follower_id: string;
  following_id: string;
  created_at?: string | null;
};

type RsvpRow = {
  user_id: string;
  event_id: string;
  created_at?: string | null;
};

const toStringValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const normalizeUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .replace(/^[._]+|[._]+$/g, '');

const normalizeTags = (value: EventRow['tags']) => {
  if (Array.isArray(value)) {
    return value
      .map((tag) => toStringValue(tag))
      .filter(Boolean)
      .map((tag) => tag.replace(/^#/, '').toLowerCase());
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => toStringValue(tag))
      .filter(Boolean)
      .map((tag) => tag.replace(/^#/, '').toLowerCase());
  }

  return [];
};

const normalizeInterests = (value: ProfileRow['interests']) => {
  if (Array.isArray(value)) {
    return value
      .map((interest) => toStringValue(interest))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((interest) => toStringValue(interest))
      .filter(Boolean);
  }

  return [];
};

export const formatTimeToAmPm = (rawTime?: string | null) => {
  if (!rawTime) return '';

  const trimmed = String(rawTime).trim();

  if (!trimmed) return '';
  if (/[AaPp][Mm]/.test(trimmed)) {
    return trimmed.toUpperCase().replace(/\s+/g, ' ');
  }

  const parts = trimmed.split(':');
  if (parts.length < 2) return trimmed;

  let hours = Number(parts[0]);
  const minutes = parts[1];

  if (Number.isNaN(hours)) return trimmed;

  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${suffix}`;
};

export const buildTimeLabel = (
  startTime?: string | null,
  endTime?: string | null
) => {
  const formattedStart = formatTimeToAmPm(startTime);
  const formattedEnd = formatTimeToAmPm(endTime);

  if (formattedStart && formattedEnd) return `${formattedStart} - ${formattedEnd}`;
  if (formattedStart) return formattedStart;
  if (formattedEnd) return formattedEnd;
  return '';
};

const formatEventDateLabel = (
  eventDate?: string | null,
  fallbackDate?: string | null
) => {
  if (toStringValue(fallbackDate)) return toStringValue(fallbackDate);
  if (!eventDate) return 'TBD';

  const parsedDate = new Date(eventDate);
  if (Number.isNaN(parsedDate.getTime())) return eventDate;

  return parsedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
};

export const formatRelativeTime = (rawDate?: string | null) => {
  if (!rawDate) return 'recent';

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return 'recent';

  const diffMs = Date.now() - parsedDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes <= 0) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w`;

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const getDaysUntilDate = (eventDate?: string | null) => {
  if (!eventDate) return null;

  const parsedDate = new Date(`${eventDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.floor((parsedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const createProfileFromAuthUser = (user: User): ProfileRecord => {
  const username =
    normalizeUsername(
      toStringValue(user.user_metadata?.username || user.email?.split('@')[0] || '')
    ) || `user-${user.id.slice(0, 8)}`;

  return {
    id: user.id,
    name:
      toStringValue(user.user_metadata?.name) ||
      toStringValue(user.user_metadata?.full_name) ||
      username,
    username,
    bio: toStringValue(user.user_metadata?.bio) || DEFAULT_PROFILE_BIO,
    avatar: toStringValue(user.user_metadata?.avatar_url) || DEFAULT_AVATAR,
    interests: normalizeInterests(user.user_metadata?.interests),
    phoneNumber: toStringValue(user.user_metadata?.phone_number),
    birthday: toStringValue(user.user_metadata?.birthday),
    email: toStringValue(user.email),
  };
};

export const normalizeProfileRow = (row: ProfileRow): ProfileRecord => ({
  id: row.id,
  name: toStringValue(row.name) || toStringValue(row.username) || 'Campus User',
  username:
    normalizeUsername(toStringValue(row.username)) ||
    `user-${String(row.id).slice(0, 8)}`,
  bio: toStringValue(row.bio) || DEFAULT_PROFILE_BIO,
  avatar: toStringValue(row.avatar_url) || DEFAULT_AVATAR,
  interests: normalizeInterests(row.interests),
  phoneNumber: toStringValue(row.phone_number),
  birthday: toStringValue(row.birthday),
  email: toStringValue(row.email),
});

export const normalizeProfiles = (rows: ProfileRow[]) => {
  const seen = new Set<string>();

  return rows.reduce<ProfileRecord[]>((collection, row) => {
    if (!row?.id || seen.has(row.id)) return collection;
    seen.add(row.id);
    collection.push(normalizeProfileRow(row));
    return collection;
  }, []);
};

export const buildRsvpMap = (rows: RsvpRow[]) =>
  rows.reduce<Record<string, string[]>>((collection, row) => {
    const eventId = String(row.event_id);
    const userId = String(row.user_id);

    if (!collection[eventId]) {
      collection[eventId] = [];
    }

    if (!collection[eventId].includes(userId)) {
      collection[eventId].push(userId);
    }

    return collection;
  }, {});

export const normalizeEventRow = (
  row: EventRow,
  attendeeIds: string[] = [],
  repostedByIds: string[] = []
): EventRecord => {
  const privacy =
    row.privacy === 'private' || row.is_private ? 'private' : 'public';
  const startTime = toStringValue(row.start_time);
  const endTime = toStringValue(row.end_time);

  return {
    id: String(row.id),
    title: toStringValue(row.title) || 'Campus Event',
    description:
      toStringValue(row.description) ||
      'Something worth checking out just popped up on campus.',
    date: formatEventDateLabel(row.event_date, row.date),
    eventDate: toStringValue(row.event_date),
    startTime,
    endTime,
    time: buildTimeLabel(startTime, endTime),
    location: toStringValue(row.location) || 'Campus Event Space',
    locationName: toStringValue(row.location) || 'Campus Event Space',
    locationAddress:
      toStringValue(row.location_address) ||
      toStringValue(row.location) ||
      'Campus Event Space',
    organizer: toStringValue(row.organizer) || 'Campus Event Navigation',
    dressCode: toStringValue(row.dress_code) || 'Open',
    image: toStringValue(row.image) || DEFAULT_EVENT_IMAGE,
    tags: normalizeTags(row.tags),
    createdBy: toStringValue(row.created_by),
    creatorUsername:
      normalizeUsername(toStringValue(row.creator_username)) ||
      'campus-host',
    goingCount: Math.max(Number(row.going_count || 0), attendeeIds.length),
    privacy,
    isPrivate: privacy === 'private',
    attendees: attendeeIds,
    repostedByIds,
    createdAt: toStringValue(row.created_at),
  };
};

export const enrichEventWithCreator = (
  event: EventRecord,
  profiles: ProfileRecord[]
): EventRecord => {
  const normalizedCreatorUsername = normalizeUsername(event.creatorUsername || '');
  const creatorProfile = profiles.find(
    (profile) =>
      (event.createdBy && String(profile.id) === String(event.createdBy)) ||
      (normalizedCreatorUsername && profile.username === normalizedCreatorUsername)
  );

  return {
    ...event,
    creatorName:
      creatorProfile?.name ||
      event.creatorName ||
      event.organizer ||
      event.creatorUsername ||
      'Campus User',
    creatorAvatar:
      creatorProfile?.avatar ||
      event.creatorAvatar ||
      DEFAULT_AVATAR,
  };
};

export const normalizeFollowRow = (row: FollowRow): FollowRelationship => ({
  followerId: String(row.follower_id),
  followingId: String(row.following_id),
  createdAt: toStringValue(row.created_at),
});

export const ensureCurrentUserInProfiles = (
  profiles: ProfileRecord[],
  currentUser: ProfileRecord
) => {
  if (!currentUser.id) return profiles;
  if (profiles.some((profile) => profile.id === currentUser.id)) return profiles;
  return [currentUser, ...profiles];
};
