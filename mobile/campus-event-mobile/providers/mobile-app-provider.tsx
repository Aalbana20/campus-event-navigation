import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AuthActionResult,
  CreateEventInput,
  CreatePersonalCalendarItemInput,
  EventRecord,
  FollowRelationship,
  PersonalCalendarItem,
  ProfileRecord,
  SignInInput,
  SignUpInput,
  TaggedMoment,
} from '@/types/models';
import { normalizeAvatarStorageValue } from '@/lib/avatar-storage';
import {
  DEFAULT_PROFILE_BIO,
  EMPTY_PROFILE,
  buildRsvpMap,
  createProfileFromAuthUser,
  enrichEventWithCreator,
  ensureCurrentUserInProfiles,
  normalizeEventRow,
  normalizeFollowRow,
  normalizeProfiles,
  normalizeUsername,
} from '@/lib/mobile-backend';
import { getEventImageUri, sanitizeMediaUrl } from '@/lib/mobile-media';
import {
  type SelectedProfileImage,
  uploadProfileImage,
} from '@/lib/mobile-profile-image';
import { sendPushToUser } from '@/lib/mobile-push';
import { SUPABASE_CONFIG_ERROR, supabase } from '@/lib/supabase';
import { buildProfileSummary, sanitizePhoneNumber } from '@/lib/signup-data';
import {
  loadGridPostsForAuthor,
  setDiscoverPostGridVisibility,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import {
  hasUserRepostedPost,
  loadRepostsForUser,
  repostPost as repostPostRequest,
  unrepostPost as unrepostPostRequest,
  type RepostRecord,
} from '@/lib/mobile-profile-reposts';
import {
  addContentTag,
  loadPostsTaggingUser,
  loadTagsForPost,
  removeContentTag,
  type ContentTagRecord,
  type TaggedPostSummary,
} from '@/lib/mobile-content-tags';
import {
  deleteEventMemory,
  loadEventMemoriesForEvent,
  loadEventMemoriesForUser,
  uploadEventMemory,
  userAttendedEvent as userAttendedEventRequest,
  type EventMemoryRecord,
} from '@/lib/mobile-event-memories';
import type { SelectedStoryMedia } from '@/lib/mobile-story-composer';

type MobileAppContextValue = {
  session: Session | null;
  isReady: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  currentUser: ProfileRecord;
  profiles: ProfileRecord[];
  events: EventRecord[];
  savedEventIds: string[];
  discoverDismissedIds: string[];
  personalCalendarItems: PersonalCalendarItem[];
  recentDmPeople: ProfileRecord[];
  followingProfiles: ProfileRecord[];
  followRelationships: FollowRelationship[];
  refreshData: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<AuthActionResult>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  updateProfile: (input: {
    name: string;
    username: string;
    bio: string;
    avatarUrl?: string;
    avatarImage?: SelectedProfileImage | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  createEvent: (input: CreateEventInput) => Promise<EventRecord | null>;
  updateEvent: (
    eventId: string,
    input: CreateEventInput
  ) => Promise<EventRecord | null>;
  addPersonalCalendarItem: (
    input: CreatePersonalCalendarItemInput
  ) => Promise<PersonalCalendarItem | null>;
  deletePersonalCalendarItem: (itemId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  loadEventRegistrations: (eventId: string) => Promise<ProfileRecord[]>;
  loadEventInvitees: (eventId: string) => Promise<ProfileRecord[]>;
  toggleSaveEvent: (eventId: string) => Promise<void>;
  acceptDiscoverEvent: (eventId: string) => void;
  rejectDiscoverEvent: (eventId: string) => void;
  resetDiscoverDeck: () => void;
  repostEvent: (eventId: string) => Promise<void>;
  unrepostEvent: (eventId: string) => Promise<void>;
  repostedEventIds: Set<string>;
  followProfile: (profileId: string) => Promise<void>;
  unfollowProfile: (profileId: string) => Promise<void>;
  getEventById: (eventId: string) => EventRecord | undefined;
  getProfileById: (profileId: string) => ProfileRecord | undefined;
  getProfileByUsername: (username: string) => ProfileRecord | undefined;
  getCreatedEventsForProfile: (profileId: string) => EventRecord[];
  getGoingEventsForProfile: (profileId: string) => EventRecord[];
  getCalendarEventsForProfile: (profileId: string) => EventRecord[];
  getPersonalCalendarItemsForProfile: (profileId: string) => PersonalCalendarItem[];
  getRepostedEventsForProfile: (profileId: string) => EventRecord[];
  getTaggedMomentsForProfile: (profileId: string) => TaggedMoment[];
  getFollowersForProfile: (profileId: string) => ProfileRecord[];
  getFollowingForProfile: (profileId: string) => ProfileRecord[];
  isFollowingProfile: (profileId: string) => boolean;
  // Phase 1: profile unification data layer
  setPostGridVisibility: (
    postId: string,
    onGrid: boolean
  ) => Promise<DiscoverPostRecord | null>;
  loadGridPostsForAuthor: (
    authorId: string,
    options?: { currentUserId?: string }
  ) => Promise<DiscoverPostRecord[]>;
  repostPost: (postId: string) => Promise<RepostRecord | null>;
  unrepostPost: (postId: string) => Promise<void>;
  hasRepostedPost: (postId: string) => Promise<boolean>;
  loadAllRepostsForCurrentUser: () => Promise<RepostRecord[]>;
  tagUserInPost: (input: {
    postId: string;
    taggedUserId: string;
  }) => Promise<ContentTagRecord | null>;
  untagUserInPost: (input: {
    postId: string;
    taggedUserId: string;
  }) => Promise<void>;
  loadPostsTaggingUser: (userId: string) => Promise<TaggedPostSummary[]>;
  loadTagsForPost: (postId: string) => Promise<ContentTagRecord[]>;
  postEventMemory: (input: {
    eventId: string;
    media: SelectedStoryMedia;
    caption?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<unknown>;
  deleteEventMemory: (memoryId: string) => Promise<void>;
  loadEventMemoriesForEvent: (eventId: string) => Promise<EventMemoryRecord[]>;
  loadEventMemoriesForUser: (userId: string) => Promise<EventMemoryRecord[]>;
  currentUserAttendedEvent: (eventId: string) => Promise<boolean>;
};

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))];

const normalizeEventImageUrls = (input: CreateEventInput) => {
  const coverImage = sanitizeMediaUrl(input.image?.trim(), '');
  const galleryImages = (input.imageUrls || [])
    .map((imageUrl) => sanitizeMediaUrl(imageUrl, ''))
    .filter(Boolean);

  return uniqueValues([coverImage, ...galleryImages]);
};

const formatDateLabel = (value: string) => {
  if (!value) return 'TBD';

  const parsedDate = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
};

const createProfilePayload = (
  userId: string,
  fullName: string,
  username: string,
  avatarUrl: string,
  extra: Record<string, unknown> = {}
) => ({
  id: userId,
  name: fullName || username,
  username,
  bio: DEFAULT_PROFILE_BIO,
  avatar_url: normalizeAvatarStorageValue(avatarUrl, null) || null,
  updated_at: new Date().toISOString(),
  ...extra,
});

const isNotFoundError = (error: { code?: string | null } | null) =>
  error?.code === 'PGRST116';

const REQUEST_TIMEOUT_MS = 7000;
const SESSION_TIMEOUT_MS = 5000;
const STARTUP_CACHE_VERSION = 2;
const STARTUP_CACHE_PREFIX = `mobileAppStartup:v${STARTUP_CACHE_VERSION}`;

type StartupCache = {
  profiles?: ProfileRecord[];
  events?: EventRecord[];
  followRelationships?: FollowRelationship[];
  savedEventIds?: string[];
  recentDmProfileIds?: string[];
  repostedEventIds?: string[];
  updatedAt?: string;
};

const getStartupCacheKey = (userId: string) =>
  `${STARTUP_CACHE_PREFIX}:${userId}`;

const logStartup = (step: string, details?: Record<string, unknown>) => {
  if (details) {
    console.info(`[mobile-app/startup] ${step}`, details);
    return;
  }

  console.info(`[mobile-app/startup] ${step}`);
};

class StartupTimeoutError extends Error {
  readonly label: string;

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'StartupTimeoutError';
    this.label = label;
  }
}

const createStartupError = (label: string, error: unknown) => {
  if (error instanceof Error) return error;
  return new Error(`${label} failed`);
};

const withTimeout = async <T,>(
  label: string,
  promise: PromiseLike<T>,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new StartupTimeoutError(label, timeoutMs));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

type QueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string | null } | null;
  didTimeout?: boolean;
};

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const runStartupQuery = async <T,>(
  label: string,
  query: PromiseLike<QueryResult<T>>
): Promise<QueryResult<T>> => {
  const started = now();
  logStartup(`${label}:start`);

  try {
    const result = await withTimeout(label, query);
    const durationMs = Math.round(now() - started);

    if (result.error) {
      console.warn(`[mobile-app/startup] ${label}:query-error`, {
        durationMs,
        error: result.error,
      });
    } else {
      logStartup(`${label}:done`, { durationMs });
    }

    return result;
  } catch (error) {
    const durationMs = Math.round(now() - started);
    const startupError = createStartupError(label, error);
    const didTimeout = startupError instanceof StartupTimeoutError;

    console.warn(`[mobile-app/startup] ${label}:failed`, {
      durationMs,
      kind: didTimeout ? 'timeout' : 'error',
      message: startupError.message,
    });

    return {
      data: null,
      error: {
        message: startupError.message,
      },
      didTimeout,
    };
  }
};

const runStartupStep = async (label: string, step: PromiseLike<void>) => {
  const started = now();
  logStartup(`${label}:start`);

  try {
    await withTimeout(label, step);
    logStartup(`${label}:done`, { durationMs: Math.round(now() - started) });
    return null;
  } catch (error) {
    const durationMs = Math.round(now() - started);
    const startupError = createStartupError(label, error);
    const didTimeout = startupError instanceof StartupTimeoutError;

    console.warn(`[mobile-app/startup] ${label}:failed`, {
      durationMs,
      kind: didTimeout ? 'timeout' : 'error',
      message: startupError.message,
    });
    return startupError;
  }
};

const shouldRefreshForAuthEvent = (event: string) =>
  event === 'SIGNED_IN' || event === 'USER_UPDATED';

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(SUPABASE_CONFIG_ERROR);
  const [profilesState, setProfilesState] = useState<ProfileRecord[]>([]);
  const [eventsState, setEventsState] = useState<EventRecord[]>([]);
  const [followRelationships, setFollowRelationships] = useState<FollowRelationship[]>([]);
  const [savedEventIds, setSavedEventIds] = useState<string[]>([]);
  const [recentDmProfileIds, setRecentDmProfileIds] = useState<string[]>([]);
  const [discoverDismissedIds, setDiscoverDismissedIds] = useState<string[]>([]);
  const [personalCalendarItems, setPersonalCalendarItems] = useState<PersonalCalendarItem[]>([]);
  const [localRepostsByEventId, setLocalRepostsByEventId] = useState<Record<string, string[]>>({});
  const [repostedEventIds, setRepostedEventIds] = useState<Set<string>>(new Set());
  const [taggedMoments] = useState<TaggedMoment[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const startupCacheRef = useRef<StartupCache>({});
  const pushRegistrationAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const applyStartupCache = useCallback((cache: StartupCache, source: string) => {
    if (Array.isArray(cache.profiles)) setProfilesState(cache.profiles);
    if (Array.isArray(cache.events)) setEventsState(cache.events);
    if (Array.isArray(cache.followRelationships)) {
      setFollowRelationships(cache.followRelationships);
    }
    if (Array.isArray(cache.savedEventIds)) setSavedEventIds(cache.savedEventIds);
    if (Array.isArray(cache.recentDmProfileIds)) {
      setRecentDmProfileIds(cache.recentDmProfileIds);
    }
    if (Array.isArray(cache.repostedEventIds)) {
      setRepostedEventIds(new Set(cache.repostedEventIds));
    }

    logStartup('startupCache:applied', {
      source,
      profiles: cache.profiles?.length || 0,
      events: cache.events?.length || 0,
      follows: cache.followRelationships?.length || 0,
      savedEvents: cache.savedEventIds?.length || 0,
      messages: cache.recentDmProfileIds?.length || 0,
      reposts: cache.repostedEventIds?.length || 0,
    });
  }, []);

  const hydrateStartupCache = useCallback(
    async (userId: string) => {
      if (!userId) return false;

      try {
        const raw = await AsyncStorage.getItem(getStartupCacheKey(userId));
        if (!raw) {
          startupCacheRef.current = {};
          logStartup('startupCache:miss', { userId });
          return false;
        }

        const cache = JSON.parse(raw) as StartupCache;
        startupCacheRef.current = cache || {};
        applyStartupCache(startupCacheRef.current, 'async-storage');
        return true;
      } catch (error) {
        startupCacheRef.current = {};
        console.warn('[mobile-app/startup] startupCache:failed', error);
        return false;
      }
    },
    [applyStartupCache]
  );

  const persistStartupCache = useCallback(
    async (userId: string, patch: StartupCache) => {
      if (!userId) return;

      const nextCache: StartupCache = {
        ...startupCacheRef.current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      startupCacheRef.current = nextCache;

      try {
        await AsyncStorage.setItem(
          getStartupCacheKey(userId),
          JSON.stringify(nextCache)
        );
      } catch (error) {
        console.warn('[mobile-app/startup] startupCache:persist-failed', error);
      }
    },
    []
  );

  const resetRuntimeData = useCallback(() => {
    setProfilesState([]);
    setEventsState([]);
    setFollowRelationships([]);
    setSavedEventIds([]);
    setRecentDmProfileIds([]);
    setDiscoverDismissedIds([]);
    setPersonalCalendarItems([]);
    setLocalRepostsByEventId({});
    setRepostedEventIds(new Set());
    startupCacheRef.current = {};
  }, []);

  const currentUser = useMemo(() => {
    if (!session?.user) return EMPTY_PROFILE;

    return (
      profilesState.find((profile) => profile.id === session.user.id) ||
      createProfileFromAuthUser(session.user)
    );
  }, [profilesState, session?.user]);

  const profiles = useMemo(
    () => ensureCurrentUserInProfiles(profilesState, currentUser),
    [currentUser, profilesState]
  );

  const events = useMemo(
    () =>
      eventsState.map((event) =>
        enrichEventWithCreator(
          {
            ...event,
            image: getEventImageUri(event.image),
            repostedByIds: uniqueValues([
              ...(event.repostedByIds || []),
              ...(localRepostsByEventId[event.id] || []),
            ]),
          },
          profiles
        )
      ),
    [eventsState, localRepostsByEventId, profiles]
  );

  const ensureProfileRowForUser = useCallback(async (user: User) => {
    if (!supabase) return;

    const fallbackProfile = createProfileFromAuthUser(user);
    const preferredUsername =
      normalizeUsername(fallbackProfile.username) || `user-${user.id.slice(0, 8)}`;
    const metadata = user.user_metadata || {};
    const accountType =
      fallbackProfile.accountType === 'student' ||
      fallbackProfile.accountType === 'organization' ||
      fallbackProfile.accountType === 'regular'
        ? fallbackProfile.accountType
        : 'regular';
    const profileExtra = {
      bio:
        fallbackProfile.bio ||
        buildProfileSummary({
          accountType,
          firstName: fallbackProfile.firstName,
          organizationName: fallbackProfile.organizationName,
          interests: fallbackProfile.interests || [],
        }),
      email: user.email || '',
      phone: fallbackProfile.phoneNumber || '',
      phone_number: fallbackProfile.phoneNumber || '',
      interests: fallbackProfile.interests || [],
      account_type: accountType,
      first_name: fallbackProfile.firstName || null,
      last_name: fallbackProfile.lastName || null,
      birth_month: fallbackProfile.birthMonth || null,
      birth_year: fallbackProfile.birthYear || null,
      gender: fallbackProfile.gender || null,
      school: fallbackProfile.school || null,
      school_id: fallbackProfile.schoolId || null,
      student_verified: Boolean(metadata.student_verified),
      verification_status: String(metadata.verification_status || 'unverified'),
      organization_name: fallbackProfile.organizationName || null,
      organization_type: fallbackProfile.organizationType || null,
      organization_description: fallbackProfile.organizationDescription || null,
      organization_website: fallbackProfile.organizationWebsite || null,
      parent_organization_name: fallbackProfile.parentOrganizationName || null,
      logo_url: normalizeAvatarStorageValue(fallbackProfile.logoUrl || '', null) || null,
    };

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfileError && !isNotFoundError(existingProfileError)) {
      throw existingProfileError;
    }

    if (existingProfile?.id) {
      return;
    }

    let nextUsername = preferredUsername;

    const { data: usernameMatch, error: usernameMatchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', preferredUsername)
      .maybeSingle();

    if (usernameMatchError && !isNotFoundError(usernameMatchError)) {
      throw usernameMatchError;
    }

    if (usernameMatch?.id && String(usernameMatch.id) !== String(user.id)) {
      nextUsername = `${preferredUsername}_${user.id.slice(0, 6)}`;
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        createProfilePayload(
          user.id,
          fallbackProfile.name || nextUsername,
          nextUsername,
          String(user.user_metadata?.avatar_url || ''),
          profileExtra
        ),
        { onConflict: 'id' }
      );

    if (upsertError) {
      throw upsertError;
    }
  }, []);

  const refreshData = useCallback(
    async (nextUserId?: string, nextUser?: User) => {
      if (!supabase) {
        setAuthError(SUPABASE_CONFIG_ERROR);
        resetRuntimeData();
        setIsReady(true);
        return;
      }

      const activeSession = sessionRef.current;
      const userId = nextUserId || activeSession?.user?.id;
      logStartup('refreshData:entered', {
        hasUserId: Boolean(userId),
        nextUserId: nextUserId || null,
        sessionUserId: activeSession?.user?.id || null,
      });

      if (!userId) {
        resetRuntimeData();
        setAuthError(null);
        setIsReady(true);
        logStartup('refreshData:no-user');
        return;
      }

      const client = supabase;
      setIsReady(true);

      const authUser = nextUser || activeSession?.user;
      const fallbackCurrentUser = authUser ? createProfileFromAuthUser(authUser) : null;
      const taskResults: Record<string, boolean> = {};
      const markTask = (key: string, ok: boolean) => {
        taskResults[key] = ok;
        if (ok) setAuthError(null);
      };

      if (authUser) {
        void runStartupStep(
          'refreshData.ensureProfileRow',
          ensureProfileRowForUser(authUser)
        );
      }

      const loadProfiles = async () => {
        const result = await runStartupQuery(
          'refreshData.profiles',
          client
            .from('profiles')
            .select('*')
            .order('updated_at', { ascending: false })
        );

        if (result.error) {
          logStartup('refreshData:profiles:preserved-prev', {
            didTimeout: Boolean(result.didTimeout),
          });
          markTask('profiles', false);
          return;
        }

        const normalizedProfiles = normalizeProfiles(
          ((result.data || []) as Array<{
            id: string;
            name?: string | null;
            username?: string | null;
            bio?: string | null;
            avatar_url?: string | null;
            phone?: string | null;
            phone_number?: string | null;
            birthday?: string | null;
            interests?: string[] | string | null;
            email?: string | null;
          }>)
        );
        const nextProfiles = fallbackCurrentUser
          ? ensureCurrentUserInProfiles(normalizedProfiles, fallbackCurrentUser)
          : normalizedProfiles;

        setProfilesState(nextProfiles);
        await persistStartupCache(userId, { profiles: nextProfiles });
        markTask('profiles', true);
        logStartup('refreshData:profiles:applied', { count: nextProfiles.length });
      };

      const loadEvents = async () => {
        const result = await runStartupQuery(
          'refreshData.events',
          client
            .from('events')
            .select('*, event_comments(count)')
            .order('created_at', { ascending: false })
        );

        if (result.error) {
          logStartup('refreshData:events:preserved-prev', {
            didTimeout: Boolean(result.didTimeout),
          });
          markTask('events', false);
          return;
        }

        const normalizedEvents = (((result.data || []) as Array<{ id: string }>))
          .map((row) => normalizeEventRow(row as Parameters<typeof normalizeEventRow>[0]))
          .map((event) => ({
            ...event,
            image: getEventImageUri(event.image),
          }));

        setEventsState(normalizedEvents);
        await persistStartupCache(userId, { events: normalizedEvents });
        markTask('events', true);
        logStartup('refreshData:events:applied', { count: normalizedEvents.length });
      };

      const loadRsvps = async () => {
        const allRsvpsResult = await runStartupQuery(
          'refreshData.rsvps',
          client.from('rsvps').select('*')
        );
        let rsvpRows: Array<{ user_id: string; event_id: string }> | null = null;
        let hasAllRsvps = false;

        if (!allRsvpsResult.error) {
          rsvpRows = (allRsvpsResult.data || []) as Array<{
            user_id: string;
            event_id: string;
          }>;
          hasAllRsvps = true;
        } else {
          const currentUserRsvpsResult = await runStartupQuery(
            'refreshData.currentUserRsvps',
            client.from('rsvps').select('*').eq('user_id', userId)
          );

          if (!currentUserRsvpsResult.error) {
            rsvpRows = (currentUserRsvpsResult.data || []) as Array<{
              user_id: string;
              event_id: string;
            }>;
          }
        }

        if (rsvpRows === null) {
          logStartup('refreshData:savedEvents:preserved-prev', {
            didTimeout: Boolean(allRsvpsResult.didTimeout),
          });
          markTask('rsvps', false);
          return;
        }

        const nextSavedEventIds = uniqueValues(
          rsvpRows
            .filter((row) => String(row.user_id) === String(userId))
            .map((row) => String(row.event_id))
        );

        setSavedEventIds(nextSavedEventIds);
        if (hasAllRsvps) {
          const rsvpMap = buildRsvpMap(rsvpRows);
          setEventsState((currentEvents) =>
            currentEvents.map((event) => {
              const attendees = rsvpMap[String(event.id)] || [];
              return {
                ...event,
                attendees,
                goingCount: attendees.length || event.goingCount,
              };
            })
          );
        }

        await persistStartupCache(userId, { savedEventIds: nextSavedEventIds });
        markTask('rsvps', true);
        logStartup('refreshData:savedEvents:applied', {
          count: nextSavedEventIds.length,
          hasAllRsvps,
        });
      };

      const loadMessages = async () => {
        const result = await runStartupQuery(
          'refreshData.messages',
          client
            .from('messages')
            .select('sender_id, recipient_id, created_at')
            .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
            .order('created_at', { ascending: false })
        );

        if (result.error) {
          logStartup('refreshData:messages:preserved-prev', {
            didTimeout: Boolean(result.didTimeout),
          });
          markTask('messages', false);
          return;
        }

        const dmProfileIds = uniqueValues(
          ((result.data || []) as Array<{
            sender_id: string;
            recipient_id: string;
          }>).map((message) =>
            message.sender_id === userId ? message.recipient_id : message.sender_id
          )
        );

        setRecentDmProfileIds(dmProfileIds);
        await persistStartupCache(userId, { recentDmProfileIds: dmProfileIds });
        markTask('messages', true);
        logStartup('refreshData:messages:applied', { count: dmProfileIds.length });
      };

      const loadFollows = async () => {
        const followsResult = await runStartupQuery(
          'refreshData.follows',
          client.from('follows').select('*')
        );
        let followRows: Array<{
          follower_id: string;
          following_id: string;
          created_at?: string | null;
        }> | null = null;

        if (!followsResult.error) {
          followRows = (followsResult.data || []) as Array<{
            follower_id: string;
            following_id: string;
            created_at?: string | null;
          }>;
        } else {
          const followingResult = await runStartupQuery(
            'refreshData.followingForUser',
            client.from('follows').select('*').eq('follower_id', userId)
          );
          const followerResult = await runStartupQuery(
            'refreshData.followersForUser',
            client.from('follows').select('*').eq('following_id', userId)
          );

          if (!followingResult.error || !followerResult.error) {
            followRows = uniqueValues([
              ...((followingResult.data || []) as Array<{
                follower_id: string;
                following_id: string;
                created_at?: string | null;
              }>).map((row) => JSON.stringify(row)),
              ...((followerResult.data || []) as Array<{
                follower_id: string;
                following_id: string;
                created_at?: string | null;
              }>).map((row) => JSON.stringify(row)),
            ]).map((row) => JSON.parse(row));
          }
        }

        if (followRows === null) {
          logStartup('refreshData:follows:preserved-prev', {
            didTimeout: Boolean(followsResult.didTimeout),
          });
          markTask('follows', false);
          return;
        }

        const normalizedFollows = followRows.map((row) => normalizeFollowRow(row));
        setFollowRelationships(normalizedFollows);
        await persistStartupCache(userId, { followRelationships: normalizedFollows });
        markTask('follows', true);
        logStartup('refreshData:follows:applied', { count: normalizedFollows.length });
      };

      const loadReposts = async () => {
        const result = await runStartupQuery(
          'refreshData.reposts',
          client
            .from('reposts')
            .select('event_id')
            .eq('user_id', userId)
            .eq('target_type', 'event')
        );

        if (result.error) {
          logStartup('refreshData:reposts:preserved-prev', {
            didTimeout: Boolean(result.didTimeout),
          });
          markTask('reposts', false);
          return;
        }

        const nextRepostedEventIds = ((result.data || []) as Array<{
          event_id: string | null;
        }>)
          .map((r) => r.event_id)
          .filter(Boolean)
          .map(String);

        setRepostedEventIds(new Set(nextRepostedEventIds));
        await persistStartupCache(userId, { repostedEventIds: nextRepostedEventIds });
        markTask('reposts', true);
        logStartup('refreshData:reposts:applied', {
          count: nextRepostedEventIds.length,
        });
      };

      const loadPersonalItems = async () => {
        const result = await runStartupQuery(
          'refreshData.personalItems',
          client
            .from('personal_calendar_items')
            .select('*')
            .eq('owner_id', userId)
            .order('item_date', { ascending: true })
        );

        if (result.error) {
          markTask('personalItems', false);
          return;
        }

        const rows = (result.data || []) as Array<{
          id: string;
          owner_id: string;
          title: string;
          note: string | null;
          item_date: string;
          item_time: string | null;
        }>;

        const items: PersonalCalendarItem[] = rows.map((row) => ({
          id: String(row.id),
          ownerId: String(row.owner_id),
          title: String(row.title),
          note: row.note ? String(row.note) : undefined,
          date: String(row.item_date),
          time: row.item_time ? String(row.item_time) : undefined,
        }));

        setPersonalCalendarItems(items);
        markTask('personalItems', true);
      };

      const taskSettledResults = await Promise.allSettled([
        loadProfiles(),
        loadEvents(),
        loadRsvps(),
        loadMessages(),
        loadFollows(),
        loadReposts(),
        loadPersonalItems(),
      ]);

      taskSettledResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn('[mobile-app/startup] refreshData task crashed', {
            index,
            reason: result.reason,
          });
        }
      });

      logStartup('refreshData:completed', {
        anyQuerySucceeded: Object.values(taskResults).some(Boolean),
        profilesOk: Boolean(taskResults.profiles),
        eventsOk: Boolean(taskResults.events),
        rsvpsOk: Boolean(taskResults.rsvps),
        messagesOk: Boolean(taskResults.messages),
        followsOk: Boolean(taskResults.follows),
        repostsOk: Boolean(taskResults.reposts),
      });
      logStartup('refreshData:ready');
    },
    [
      ensureProfileRowForUser,
      persistStartupCache,
      resetRuntimeData,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      if (!supabase) {
        logStartup('initializeSession:no-supabase');
        setIsReady(true);
        return;
      }

      try {
        logStartup('initializeSession:getSession:start');
        const {
          data: { session: restoredSession },
          error,
        } = await withTimeout(
          'auth.getSession',
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS
        );

        if (error) throw error;
        if (!isMounted) return;

        logStartup('initializeSession:getSession:done', {
          hasSession: Boolean(restoredSession),
          userId: restoredSession?.user?.id || null,
        });
        sessionRef.current = restoredSession;
        setSession(restoredSession);

        if (restoredSession?.user?.id) {
          await hydrateStartupCache(restoredSession.user.id);
          setIsReady(true);
          void refreshData(restoredSession.user.id, restoredSession.user);
          return;
        }

        resetRuntimeData();
        setIsReady(true);
        logStartup('initializeSession:no-session');
      } catch (error) {
        if (!isMounted) return;

        // A timeout here is recoverable: Supabase may still resolve the session
        // shortly after, and onAuthStateChange will refresh data once it does.
        // Treat only truly invalid/errored sessions as fatal — otherwise continue
        // booting in a safe signed-out-ready state without wiping runtime data.
        const isTimeout = error instanceof StartupTimeoutError;

        if (isTimeout) {
          const knownSession = sessionRef.current;
          console.warn(
            '[mobile-app/startup] auth.getSession timed out — continuing without blocking UI:',
            error instanceof Error ? error.message : error
          );
          if (knownSession?.user?.id) {
            setSession(knownSession);
            await hydrateStartupCache(knownSession.user.id);
            void refreshData(knownSession.user.id, knownSession.user);
          }
          setIsReady(true);
          logStartup('initializeSession:timeout', {
            message: error instanceof Error ? error.message : 'Session restore timed out',
            preservedKnownSession: Boolean(knownSession?.user?.id),
          });
          return;
        }

        console.error('Unable to restore mobile Supabase session:', error);
        resetRuntimeData();
        setAuthError(
          error instanceof Error
            ? error.message
            : 'Unable to restore your mobile session.'
        );
        setIsReady(true);
        logStartup('initializeSession:error', {
          message: error instanceof Error ? error.message : 'Unknown session restore error',
        });
      }
    };

    void initializeSession();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      logStartup('authStateChange', {
        event: _event,
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id || null,
      });
      sessionRef.current = nextSession;
      setSession(nextSession);

      if (_event === 'INITIAL_SESSION') {
        if (nextSession?.user?.id) {
          void hydrateStartupCache(nextSession.user.id);
          setIsReady(true);
        }
        logStartup('authStateChange:initial-session', { event: _event });
        return;
      }

      if (_event === 'TOKEN_REFRESHED' || _event === 'PASSWORD_RECOVERY') {
        logStartup('authStateChange:session-updated', { event: _event });
        return;
      }

      if (nextSession?.user?.id) {
        void hydrateStartupCache(nextSession.user.id);
        setIsReady(true);
        if (shouldRefreshForAuthEvent(_event)) {
          void refreshData(nextSession.user.id, nextSession.user);
        }
        return;
      }

      sessionRef.current = null;
      resetRuntimeData();
      setIsReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hydrateStartupCache, refreshData, resetRuntimeData]);

  const getProfileById = useCallback(
    (profileId: string) =>
      profiles.find((profile) => String(profile.id) === String(profileId)),
    [profiles]
  );

  const getProfileByUsername = useCallback(
    (username: string) =>
      profiles.find(
        (profile) =>
          profile.username === normalizeUsername(username) || String(profile.id) === String(username)
      ),
    [profiles]
  );

  const getFollowersForProfile = useCallback(
    (profileId: string) =>
      followRelationships
        .filter((relationship) => relationship.followingId === profileId)
        .map((relationship) => getProfileById(relationship.followerId))
        .filter(Boolean) as ProfileRecord[],
    [followRelationships, getProfileById]
  );

  const getFollowingForProfile = useCallback(
    (profileId: string) =>
      followRelationships
        .filter((relationship) => relationship.followerId === profileId)
        .map((relationship) => getProfileById(relationship.followingId))
        .filter(Boolean) as ProfileRecord[],
    [followRelationships, getProfileById]
  );

  const isFollowingProfile = useCallback(
    (profileId: string) =>
      followRelationships.some(
        (relationship) =>
          relationship.followerId === currentUser.id &&
          relationship.followingId === profileId
      ),
    [currentUser.id, followRelationships]
  );

  const followingProfiles = useMemo(
    () => getFollowingForProfile(currentUser.id),
    [currentUser.id, getFollowingForProfile]
  );

  const recentDmPeople = useMemo(() => {
    const dmPeople = recentDmProfileIds
      .map((profileId) => getProfileById(profileId))
      .filter(Boolean) as ProfileRecord[];

    return dmPeople.length > 0 ? dmPeople : followingProfiles.slice(0, 5);
  }, [followingProfiles, getProfileById, recentDmProfileIds]);

  const getEventById = useCallback(
    (eventId: string) => events.find((event) => String(event.id) === String(eventId)),
    [events]
  );

  const getCreatedEventsForProfile = useCallback(
    (profileId: string) =>
      events.filter((event) => String(event.createdBy) === String(profileId)),
    [events]
  );

  const getGoingEventsForProfile = useCallback(
    (profileId: string) =>
      events.filter(
        (event) =>
          event.attendees.includes(profileId) ||
          (profileId === currentUser.id && savedEventIds.includes(event.id))
      ),
    [currentUser.id, events, savedEventIds]
  );

  const getCalendarEventsForProfile = useCallback(
    (profileId: string) => {
      const combinedEvents = [
        ...getGoingEventsForProfile(profileId),
        ...getCreatedEventsForProfile(profileId),
      ];
      const seen = new Set<string>();

      return combinedEvents.filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      });
    },
    [getCreatedEventsForProfile, getGoingEventsForProfile]
  );

  const getPersonalCalendarItemsForProfile = useCallback(
    (profileId: string) =>
      personalCalendarItems.filter((item) => item.ownerId === profileId),
    [personalCalendarItems]
  );

  const getRepostedEventsForProfile = useCallback(
    (profileId: string) =>
      events.filter((event) => event.repostedByIds.includes(profileId)),
    [events]
  );

  const getTaggedMomentsForProfile = useCallback(
    (profileId: string) =>
      taggedMoments.filter((moment) => moment.profileId === profileId),
    [taggedMoments]
  );

  const updateProfile = useCallback(
    async (input: {
      name: string;
      username: string;
      bio: string;
      avatarUrl?: string;
      avatarImage?: SelectedProfileImage | null;
    }) => {
      if (!supabase || !currentUser.id) return { ok: false, error: 'Not authenticated' };

      const cleanUsername = normalizeUsername(input.username);
      if (!cleanUsername) return { ok: false, error: 'Username is required' };

      if (cleanUsername !== currentUser.username) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (existing && String(existing.id) !== String(currentUser.id)) {
          return { ok: false, error: 'That username is already taken.' };
        }
      }

      let nextAvatarUrl =
        normalizeAvatarStorageValue(input.avatarUrl, currentUser.avatar) || '';

      if (input.avatarImage?.uri) {
        try {
          nextAvatarUrl = await uploadProfileImage({
            userId: currentUser.id,
            image: input.avatarImage,
            fallbackUrl: nextAvatarUrl,
          });
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : 'Could not upload your photo. Please try again.',
          };
        }
      }

      const payload = {
        id: currentUser.id,
        name: input.name.trim() || cleanUsername,
        username: cleanUsername,
        bio: input.bio.trim(),
        avatar_url: nextAvatarUrl || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Failed to update profile:', error);
        return { ok: false, error: error.message };
      }

      // Keep Auth Session metadata in sync
      await supabase.auth.updateUser({
        data: {
          name: payload.name,
          username: payload.username,
          avatar_url: payload.avatar_url,
        },
      });

      setProfilesState((current) =>
        current.map((p) =>
          p.id === currentUser.id
            ? {
                ...p,
                name: payload.name,
                username: payload.username,
                bio: payload.bio,
                avatar: payload.avatar_url || '',
              }
            : p
        )
      );

      return { ok: true };
    },
    [currentUser.avatar, currentUser.id, currentUser.username]
  );

  const createEvent = useCallback(
    async (input: CreateEventInput) => {
      if (!supabase || !currentUser.id) return null;

      const title = input.title.trim() || 'New Campus Event';
      const description =
        input.description.trim() || 'A new event just dropped on campus.';
      const locationName = input.locationName.trim() || 'Campus Event Space';
      const locationAddress = input.locationAddress.trim() || locationName;
      const host =
        input.host?.trim() ||
        input.organizer?.trim() ||
        currentUser.name ||
        currentUser.username ||
        'Campus Host';
      const dressCode = input.dressCode?.trim() || '';
      const sanitizedImageUrls = normalizeEventImageUrls(input);
      const sanitizedImage = sanitizedImageUrls[0] || '';
      const price = input.eventType === 'Paid' ? '$10' : 'Free';
      const normalizedCapacity = input.capacity?.trim()
        ? Number.parseInt(input.capacity.trim(), 10)
        : null;

      const payload = {
        title,
        description,
        location: locationName,
        location_address: locationAddress,
        date: input.date || formatDateLabel(input.eventDate),
        event_date: input.eventDate,
        start_time: input.startTime,
        end_time: input.endTime,
        location_coordinates: input.locationCoordinates || null,
        organizer: host,
        dress_code: dressCode,
        image: sanitizedImage || null,
        image_urls: sanitizedImageUrls,
        price,
        capacity: Number.isFinite(normalizedCapacity) ? normalizedCapacity : null,
        tags: input.tags,
        created_by: currentUser.id,
        creator_username: currentUser.username,
        going_count: 0,
        privacy: input.privacy,
      };

      const { data, error } = await supabase
        .from('events')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        console.error('Unable to create event:', error);
        return null;
      }

      const rawEvent = normalizeEventRow(data);
      rawEvent.image = getEventImageUri(rawEvent.image);
      const createdEvent = enrichEventWithCreator(rawEvent, profiles);

      const inviteeIds = (input.inviteeIds || [])
        .map((id) => String(id).trim())
        .filter((id) => id && id !== currentUser.id);

      if (input.privacy === 'private' && inviteeIds.length > 0) {
        const inviteeRows = inviteeIds.map((userId) => ({
          event_id: String(createdEvent.id),
          user_id: userId,
          invited_by: currentUser.id,
        }));

        const { error: inviteError } = await supabase
          .from('event_invitees')
          .insert(inviteeRows);

        if (inviteError) {
          console.error('Unable to save event invitees:', inviteError);
        }
      }

      setEventsState((currentEvents) => [createdEvent, ...currentEvents]);

      return createdEvent;
    },
    [currentUser.id, currentUser.name, currentUser.username, profiles]
  );

  const updateEvent = useCallback(
    async (eventId: string, input: CreateEventInput) => {
      if (!supabase || !currentUser.id) return null;

      const title = input.title.trim() || 'New Campus Event';
      const description =
        input.description.trim() || 'A new event just dropped on campus.';
      const locationName = input.locationName.trim() || 'Campus Event Space';
      const locationAddress = input.locationAddress.trim() || locationName;
      const host =
        input.host?.trim() ||
        input.organizer?.trim() ||
        currentUser.name ||
        currentUser.username ||
        'Campus Host';
      const dressCode = input.dressCode?.trim() || '';
      const sanitizedImageUrls = normalizeEventImageUrls(input);
      const sanitizedImage = sanitizedImageUrls[0] || '';
      const price = input.eventType === 'Paid' ? '$10' : 'Free';
      const normalizedCapacity = input.capacity?.trim()
        ? Number.parseInt(input.capacity.trim(), 10)
        : null;

      const payload = {
        title,
        description,
        location: locationName,
        location_address: locationAddress,
        date: input.date || formatDateLabel(input.eventDate),
        event_date: input.eventDate,
        start_time: input.startTime,
        end_time: input.endTime,
        location_coordinates: input.locationCoordinates || null,
        organizer: host,
        dress_code: dressCode,
        image: sanitizedImage || null,
        image_urls: sanitizedImageUrls,
        price,
        capacity: Number.isFinite(normalizedCapacity) ? normalizedCapacity : null,
        tags: input.tags,
        privacy: input.privacy,
      };

      const previousEvent = eventsState.find((ev) => ev.id === eventId);

      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', eventId)
        .eq('created_by', currentUser.id)
        .select('*')
        .single();

      if (error || !data) {
        console.error('Unable to update event:', error);
        return null;
      }

      const rawEvent = normalizeEventRow(
        data,
        previousEvent?.attendees || [],
        previousEvent?.repostedByIds || []
      );
      rawEvent.image = getEventImageUri(rawEvent.image);
      const updatedEvent = enrichEventWithCreator(rawEvent, profiles);

      setEventsState((currentEvents) =>
        currentEvents.map((ev) => (ev.id === eventId ? updatedEvent : ev))
      );

      // Notify every user who RSVP'd (excluding the editor/creator) that the
      // event changed. Reuses the same push helper as RSVP/comment pings.
      const recipientIds = (updatedEvent.attendees || []).filter(
        (attendeeId) => attendeeId && attendeeId !== currentUser.id
      );

      for (const recipientId of recipientIds) {
        void sendPushToUser(
          recipientId,
          'Event updated',
          `${updatedEvent.title} was updated`
        );
      }

      if (Array.isArray(input.inviteeIds)) {
        const desiredInvitees = new Set(
          input.inviteeIds
            .map((id) => String(id).trim())
            .filter((id) => id && id !== currentUser.id)
        );

        const { data: existingInviteeRows } = await supabase
          .from('event_invitees')
          .select('user_id')
          .eq('event_id', eventId);

        const existingInvitees = new Set(
          ((existingInviteeRows || []) as Array<{ user_id: string }>).map(
            (row) => String(row.user_id)
          )
        );

        const toAdd = [...desiredInvitees].filter(
          (id) => !existingInvitees.has(id)
        );
        const toRemove = [...existingInvitees].filter(
          (id) => !desiredInvitees.has(id)
        );

        if (toAdd.length > 0) {
          const { error: addError } = await supabase
            .from('event_invitees')
            .insert(
              toAdd.map((userId) => ({
                event_id: eventId,
                user_id: userId,
                invited_by: currentUser.id,
              }))
            );
          if (addError) {
            console.error('Unable to add event invitees:', addError);
          }
        }

        if (toRemove.length > 0) {
          const { error: removeError } = await supabase
            .from('event_invitees')
            .delete()
            .eq('event_id', eventId)
            .in('user_id', toRemove);
          if (removeError) {
            console.error('Unable to remove event invitees:', removeError);
          }
        }
      }

      return updatedEvent;
    },
    [currentUser.id, currentUser.name, eventsState, profiles]
  );

  const addPersonalCalendarItem = useCallback(
    async (input: CreatePersonalCalendarItemInput) => {
      if (!currentUser.id) return null;

      const optimisticItem: PersonalCalendarItem = {
        id: `personal-${Date.now()}`,
        ownerId: currentUser.id,
        date: input.date,
        title: input.title.trim() || 'New personal item',
        note: input.note?.trim(),
        time: input.time?.trim(),
      };

      setPersonalCalendarItems((currentItems) => [optimisticItem, ...currentItems]);

      if (!supabase) return optimisticItem;

      const { data, error } = await supabase
        .from('personal_calendar_items')
        .insert({
          owner_id: currentUser.id,
          title: optimisticItem.title,
          note: optimisticItem.note || null,
          item_date: optimisticItem.date,
          item_time: optimisticItem.time || null,
        })
        .select('*')
        .single();

      if (error || !data) {
        console.error('Unable to save personal item:', error);
        setPersonalCalendarItems((currentItems) =>
          currentItems.filter((item) => item.id !== optimisticItem.id)
        );
        return null;
      }

      const persistedItem: PersonalCalendarItem = {
        id: String(data.id),
        ownerId: String(data.owner_id),
        date: String(data.item_date),
        title: String(data.title),
        note: data.note ? String(data.note) : undefined,
        time: data.item_time ? String(data.item_time) : undefined,
      };

      setPersonalCalendarItems((currentItems) =>
        currentItems.map((item) =>
          item.id === optimisticItem.id ? persistedItem : item
        )
      );

      return persistedItem;
    },
    [currentUser.id]
  );

  const deletePersonalCalendarItem = useCallback(
    async (itemId: string) => {
      const previousItems = personalCalendarItems;
      setPersonalCalendarItems((currentItems) =>
        currentItems.filter((item) => item.id !== itemId)
      );

      if (!supabase || !currentUser.id) return;

      const { error } = await supabase
        .from('personal_calendar_items')
        .delete()
        .eq('id', itemId)
        .eq('owner_id', currentUser.id);

      if (error) {
        console.error('Unable to delete personal item:', error);
        setPersonalCalendarItems(previousItems);
      }
    },
    [currentUser.id, personalCalendarItems]
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      const previousEvents = eventsState;
      const previousSavedIds = savedEventIds;
      const previousDismissedIds = discoverDismissedIds;

      setEventsState((currentEvents) =>
        currentEvents.filter((event) => event.id !== eventId)
      );
      setSavedEventIds((currentIds) => currentIds.filter((id) => id !== eventId));
      setDiscoverDismissedIds((currentIds) =>
        currentIds.filter((id) => id !== eventId)
      );

      if (!supabase || !currentUser.id) return;

      try {
        const { error: rsvpDeleteError } = await supabase
          .from('rsvps')
          .delete()
          .eq('event_id', eventId);

        if (rsvpDeleteError) {
          throw rsvpDeleteError;
        }

        const { error: eventDeleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
          .eq('created_by', currentUser.id);

        if (eventDeleteError) {
          throw eventDeleteError;
        }
      } catch (error) {
        console.error('Unable to delete event:', error);
        setEventsState(previousEvents);
        setSavedEventIds(previousSavedIds);
        setDiscoverDismissedIds(previousDismissedIds);
      }
    },
    [currentUser.id, discoverDismissedIds, eventsState, savedEventIds]
  );

  const toggleSaveEvent = useCallback(
    async (eventId: string) => {
      if (!supabase || !currentUser.id) return;

      const isSaved = savedEventIds.includes(eventId);
      const previousSavedIds = savedEventIds;
      const previousEvents = eventsState;

      const nextEvents = eventsState.map((event) => {
        if (event.id !== eventId) return event;

        const attendees = isSaved
          ? event.attendees.filter((attendeeId) => attendeeId !== currentUser.id)
          : uniqueValues([currentUser.id, ...event.attendees]);

        return {
          ...event,
          attendees,
          goingCount: attendees.length,
        };
      });

      setEventsState(nextEvents);
      setSavedEventIds(
        isSaved
          ? previousSavedIds.filter((id) => id !== eventId)
          : [eventId, ...previousSavedIds]
      );

      try {
        if (isSaved) {
          const { error } = await supabase
            .from('rsvps')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('event_id', eventId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('rsvps')
            .insert({ user_id: currentUser.id, event_id: eventId });

          if (error && error.code !== '23505') throw error;
        }

        const updatedEvent = nextEvents.find((event) => event.id === eventId);

        if (updatedEvent) {
          const { error: countError } = await supabase
            .from('events')
            .update({ going_count: updatedEvent.goingCount })
            .eq('id', eventId);

          if (countError) {
            console.error('Unable to sync going count:', countError);
          }
        }

        // Notify the event creator when someone RSVPs (not when they cancel)
        if (!isSaved && updatedEvent?.createdBy && updatedEvent.createdBy !== currentUser.id) {
          void sendPushToUser(
            updatedEvent.createdBy,
            'New RSVP',
            `${currentUser.name || currentUser.username} is going to ${updatedEvent.title}`
          );
        }
      } catch (error) {
        console.error('Unable to update RSVP state:', error);
        setEventsState(previousEvents);
        setSavedEventIds(previousSavedIds);
      }
    },
    [currentUser.id, currentUser.name, currentUser.username, eventsState, savedEventIds]
  );

  const acceptDiscoverEvent = useCallback(
    (eventId: string) => {
      setDiscoverDismissedIds((currentIds) =>
        currentIds.includes(eventId) ? currentIds : [...currentIds, eventId]
      );
      void toggleSaveEvent(eventId);
    },
    [toggleSaveEvent]
  );

  const rejectDiscoverEvent = useCallback((eventId: string) => {
    setDiscoverDismissedIds((currentIds) =>
      currentIds.includes(eventId) ? currentIds : [...currentIds, eventId]
    );
  }, []);

  const resetDiscoverDeck = useCallback(() => {
    setDiscoverDismissedIds([]);
  }, []);

  const repostEvent = useCallback(
    async (eventId: string) => {
      if (!supabase || !currentUser.id) return;

      setRepostedEventIds((current) => new Set([...current, eventId]));
      setLocalRepostsByEventId((currentMap) => ({
        ...currentMap,
        [eventId]: uniqueValues([...(currentMap[eventId] || []), currentUser.id]),
      }));

      const { error } = await supabase
        .from('reposts')
        .insert({ user_id: currentUser.id, event_id: eventId, target_type: 'event' });

      if (error && error.code !== '23505') {
        console.error('Unable to repost event:', error);
        setRepostedEventIds((current) => {
          const next = new Set(current);
          next.delete(eventId);
          return next;
        });
      }
    },
    [currentUser.id]
  );

  const unrepostEvent = useCallback(
    async (eventId: string) => {
      if (!supabase || !currentUser.id) return;

      setRepostedEventIds((current) => {
        const next = new Set(current);
        next.delete(eventId);
        return next;
      });

      const { error } = await supabase
        .from('reposts')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('target_type', 'event')
        .eq('event_id', eventId);

      if (error) {
        console.error('Unable to unrepost event:', error);
        setRepostedEventIds((current) => new Set([...current, eventId]));
      }
    },
    [currentUser.id]
  );

  // Phase 1: profile unification data layer bindings.
  const setPostGridVisibility = useCallback(
    (postId: string, onGrid: boolean) =>
      setDiscoverPostGridVisibility(postId, onGrid),
    []
  );

  const loadGridPostsForAuthorBound = useCallback(
    (authorId: string, options?: { currentUserId?: string }) =>
      loadGridPostsForAuthor(authorId, options),
    []
  );

  const repostPost = useCallback(
    async (postId: string) => {
      if (!currentUser.id || !postId) return null;
      return repostPostRequest({ userId: currentUser.id, postId });
    },
    [currentUser.id]
  );

  const unrepostPost = useCallback(
    async (postId: string) => {
      if (!currentUser.id || !postId) return;
      return unrepostPostRequest({ userId: currentUser.id, postId });
    },
    [currentUser.id]
  );

  const hasRepostedPost = useCallback(
    async (postId: string) => {
      if (!currentUser.id || !postId) return false;
      return hasUserRepostedPost({ userId: currentUser.id, postId });
    },
    [currentUser.id]
  );

  const loadAllRepostsForCurrentUser = useCallback(async () => {
    if (!currentUser.id) return [];
    return loadRepostsForUser(currentUser.id);
  }, [currentUser.id]);

  const tagUserInPost = useCallback(
    async ({
      postId,
      taggedUserId,
    }: {
      postId: string;
      taggedUserId: string;
    }) => {
      if (!currentUser.id || !postId || !taggedUserId) return null;
      return addContentTag({
        postId,
        taggedUserId,
        taggerId: currentUser.id,
      });
    },
    [currentUser.id]
  );

  const untagUserInPost = useCallback(
    async ({
      postId,
      taggedUserId,
    }: {
      postId: string;
      taggedUserId: string;
    }) => removeContentTag({ postId, taggedUserId }),
    []
  );

  const loadPostsTaggingUserBound = useCallback(
    (userId: string) => loadPostsTaggingUser(userId),
    []
  );

  const loadTagsForPostBound = useCallback(
    (postId: string) => loadTagsForPost(postId),
    []
  );

  const currentUserAttendedEvent = useCallback(
    async (eventId: string) => {
      if (!currentUser.id || !eventId) return false;
      return userAttendedEventRequest({
        userId: currentUser.id,
        eventId,
      });
    },
    [currentUser.id]
  );

  const loadEventRegistrations = useCallback(
    async (eventId: string) => {
      if (!supabase || !eventId) return [];

      const { data, error } = await supabase
        .from('rsvps')
        .select('user_id, rsvp_date')
        .eq('event_id', eventId)
        .order('rsvp_date', { ascending: false });

      if (error) {
        console.error('Unable to load event registrations:', error);
        return [];
      }

      const userIds = ((data || []) as Array<{ user_id: string | null }>)
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id));

      if (userIds.length === 0) return [];

      const fromCache = userIds
        .map((id) => profiles.find((profile) => profile.id === id))
        .filter((profile): profile is ProfileRecord => Boolean(profile));

      if (fromCache.length === userIds.length) return fromCache;

      const missingIds = userIds.filter(
        (id) => !profiles.some((profile) => profile.id === id)
      );

      const { data: missingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', missingIds);

      const fetched = normalizeProfiles((missingProfiles || []) as never);
      const orderedIds = userIds;

      return orderedIds
        .map((id) =>
          profiles.find((profile) => profile.id === id) ||
          fetched.find((profile) => profile.id === id)
        )
        .filter((profile): profile is ProfileRecord => Boolean(profile));
    },
    [profiles]
  );

  const loadEventInvitees = useCallback(
    async (eventId: string) => {
      if (!supabase || !eventId) return [];

      const { data, error } = await supabase
        .from('event_invitees')
        .select('user_id')
        .eq('event_id', eventId);

      if (error) {
        console.error('Unable to load event invitees:', error);
        return [];
      }

      const userIds = ((data || []) as Array<{ user_id: string }>).map((row) =>
        String(row.user_id)
      );
      if (userIds.length === 0) return [];

      const fromCache = userIds
        .map((id) => profiles.find((profile) => profile.id === id))
        .filter((profile): profile is ProfileRecord => Boolean(profile));

      if (fromCache.length === userIds.length) return fromCache;

      const missingIds = userIds.filter(
        (id) => !profiles.some((profile) => profile.id === id)
      );

      const { data: missingProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', missingIds);

      const fetched = normalizeProfiles((missingProfiles || []) as never);

      return userIds
        .map((id) =>
          profiles.find((profile) => profile.id === id) ||
          fetched.find((profile) => profile.id === id)
        )
        .filter((profile): profile is ProfileRecord => Boolean(profile));
    },
    [profiles]
  );

  const postEventMemory = useCallback(
    async ({
      eventId,
      media,
      caption,
      metadata,
    }: {
      eventId: string;
      media: SelectedStoryMedia;
      caption?: string;
      metadata?: Record<string, unknown>;
    }) => {
      if (!currentUser.id || !eventId || !media) return null;
      return uploadEventMemory({
        authorId: currentUser.id,
        eventId,
        media,
        caption,
        metadata,
      });
    },
    [currentUser.id]
  );

  const deleteEventMemoryBound = useCallback(
    (memoryId: string) => deleteEventMemory(memoryId),
    []
  );

  const loadEventMemoriesForEventBound = useCallback(
    (eventId: string) => loadEventMemoriesForEvent(eventId),
    []
  );

  const loadEventMemoriesForUserBound = useCallback(
    (userId: string) => loadEventMemoriesForUser(userId),
    []
  );

  const followProfile = useCallback(
    async (profileId: string) => {
      if (!supabase || !currentUser.id) return;
      if (profileId === currentUser.id || isFollowingProfile(profileId)) return;

      const optimisticRelationship: FollowRelationship = {
        followerId: currentUser.id,
        followingId: profileId,
        createdAt: new Date().toISOString(),
      };

      setFollowRelationships((currentRelationships) => [
        ...currentRelationships,
        optimisticRelationship,
      ]);

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: currentUser.id, following_id: profileId });

      if (error && error.code !== '23505') {
        console.error('Unable to follow profile:', error);
        setFollowRelationships((currentRelationships) =>
          currentRelationships.filter(
            (relationship) =>
              !(
                relationship.followerId === currentUser.id &&
                relationship.followingId === profileId
              )
          )
        );
      }
    },
    [currentUser.id, isFollowingProfile]
  );

  const unfollowProfile = useCallback(
    async (profileId: string) => {
      if (!supabase || !currentUser.id) return;

      const previousRelationships = followRelationships;

      setFollowRelationships((currentRelationships) =>
        currentRelationships.filter(
          (relationship) =>
            !(
              relationship.followerId === currentUser.id &&
              relationship.followingId === profileId
            )
        )
      );

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', profileId);

      if (error) {
        console.error('Unable to unfollow profile:', error);
        setFollowRelationships(previousRelationships);
      }
    },
    [currentUser.id, followRelationships]
  );

  const signIn = useCallback(
    async ({ email, password }: SignInInput) => {
      if (!supabase) {
        return {
          ok: false,
          error: SUPABASE_CONFIG_ERROR || 'Supabase is not configured.',
        };
      }

      setIsReady(false);
      setAuthError(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setIsReady(true);
        return {
          ok: false,
          error: error.message,
        };
      }

      setSession(data.session);
      sessionRef.current = data.session;
      setIsReady(true);

      if (data.session?.user?.id) {
        void hydrateStartupCache(data.session.user.id);
        void refreshData(data.session.user.id, data.session.user);
      }

      return { ok: true };
    },
    [hydrateStartupCache, refreshData]
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      if (!supabase) {
        return {
          ok: false,
          error: SUPABASE_CONFIG_ERROR || 'Supabase is not configured.',
        };
      }

      setIsReady(false);
      setAuthError(null);

      const accountType = input.accountType || 'regular';
      const cleanUsername = normalizeUsername(input.username);
      const cleanEmail = input.email.trim().toLowerCase();
      const cleanFirstName = String(input.firstName || '').trim();
      const cleanLastName = String(input.lastName || '').trim();
      const cleanOrganizationName = String(input.organizationName || '').trim();
      const cleanFullName =
        String(input.fullName || '').trim() ||
        cleanOrganizationName ||
        [cleanFirstName, cleanLastName].filter(Boolean).join(' ') ||
        cleanUsername;
      const cleanPhoneNumber = sanitizePhoneNumber(String(input.phoneNumber || ''));
      const cleanInterests = Array.isArray(input.interests)
        ? input.interests.map((interest) => String(interest).trim()).filter(Boolean)
        : [];
      const cleanCategories = Array.isArray(input.categories)
        ? input.categories.map((category) => String(category).trim()).filter(Boolean)
        : [];
      const avatarUrl = normalizeAvatarStorageValue(input.avatar, null) || '';
      const birthMonth = input.birthMonth ? Number(input.birthMonth) : null;
      const birthDay = input.birthDay ? Number(input.birthDay) : null;
      const birthYear = input.birthYear ? Number(input.birthYear) : null;
      const profileBio = buildProfileSummary({
        accountType,
        firstName: cleanFirstName,
        organizationName: cleanOrganizationName,
        interests: cleanInterests,
      });

      if (!cleanUsername) {
        setIsReady(true);
        return { ok: false, error: 'Username is required.' };
      }

      const { data: existingProfile, error: usernameLookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (usernameLookupError && usernameLookupError.code !== 'PGRST116') {
        setIsReady(true);
        return {
          ok: false,
          error: 'We could not validate that username. Please try again.',
        };
      }

      if (existingProfile) {
        setIsReady(true);
        return {
          ok: false,
          error: 'That username is already taken.',
        };
      }

      // The handle_new_auth_user trigger (SECURITY DEFINER) reads this
      // metadata blob and writes the full profiles row on auth.users INSERT.
      // Snake-case keys here map 1:1 onto profiles columns — do not rename
      // without updating the trigger.
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: input.password,
        options: {
          data: {
            name: cleanFullName,
            username: cleanUsername,
            email: cleanEmail,
            phone: cleanPhoneNumber,
            phone_number: cleanPhoneNumber,
            interests: cleanInterests,
            categories: cleanCategories,
            bio: profileBio,
            account_type: accountType,
            college_status:
              accountType === 'organization'
                ? null
                : input.collegeStatus || (accountType === 'student' ? 'in_college' : null),
            first_name: accountType === 'organization' ? null : cleanFirstName,
            last_name: accountType === 'organization' ? null : cleanLastName,
            birth_month: birthMonth,
            birth_day: birthDay,
            birth_year: birthYear,
            gender: input.gender || null,
            school: input.school || null,
            school_name: input.school || null,
            school_id: input.schoolId || null,
            school_email: input.schoolEmail || null,
            student_verified: false,
            verification_status: 'unverified',
            organization_name: cleanOrganizationName || null,
            organization_type: input.organizationType || null,
            organization_description: input.organizationDescription || null,
            organization_website: input.organizationWebsite || null,
            parent_organization_name: input.parentOrganizationName || null,
            logo_url: avatarUrl || null,
            avatar_url: avatarUrl || null,
          },
        },
      });

      if (error) {
        setIsReady(true);
        return {
          ok: false,
          error: error.message,
        };
      }

      if (!data.user) {
        setIsReady(true);
        return {
          ok: false,
          error: 'Unable to create your account right now.',
        };
      }

      // The auth.users insert trigger has already populated every column on
      // the profiles row from the metadata above. No client-side upsert is
      // needed — attempting one when email confirmation is on would also fail
      // RLS because there is no session yet.
      if (data.session) {
        setSession(data.session);
        sessionRef.current = data.session;
        setIsReady(true);
        void hydrateStartupCache(data.session.user.id);
        void refreshData(data.session.user.id, data.session.user);
      } else {
        setIsReady(true);
      }

      return {
        ok: true,
        message: data.session
          ? 'Account created.'
          : 'Account created. Check your email and then sign in.',
        requiresEmailConfirmation: !data.session,
      };
    },
    [hydrateStartupCache, refreshData]
  );

  // Realtime — keep events in sync when other users create/update/delete.
  // Requires the events table to have Realtime enabled in Supabase Dashboard → Database → Replication.
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;

    const client = supabase;
    const channel = client
      .channel(`mobile-events-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        () => void refreshData()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        () => void refreshData()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'events' },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) {
            setEventsState((currentEvents) =>
              currentEvents.filter((event) => event.id !== deletedId)
            );
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [session?.user?.id, refreshData]);

  // Push notifications — register device token after sign-in.
  const registerPushToken = useCallback(async (userId: string) => {
    if (!supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      const { Platform } = require('react-native') as typeof import('react-native');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants').default as typeof import('expo-constants').default;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (
        !projectId ||
        String(projectId).includes('YOUR_EAS_PROJECT_ID') ||
        String(projectId).trim().length < 10
      ) {
        console.info(
          '[push] Push token registration skipped — add a real expo.extra.eas.projectId outside Expo Go/dev placeholders.'
        );
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.info('[push] Permission not granted — skipping token registration.');
        return;
      }

      const tokenData = await withTimeout(
        'push.getExpoPushToken',
        Notifications.getExpoPushTokenAsync({ projectId }),
        REQUEST_TIMEOUT_MS
      );
      const token = tokenData.data;

      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          { user_id: userId, token, platform: Platform.OS },
          { onConflict: 'user_id,token', ignoreDuplicates: true }
        );

      if (error) console.error('Unable to store push token:', error);
    } catch (error) {
      console.info('[push] Push notification setup failed:', error);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !session?.user?.id) return;
    if (pushRegistrationAttemptedRef.current === session.user.id) return;

    pushRegistrationAttemptedRef.current = session.user.id;
    const timeoutId = setTimeout(() => {
      void registerPushToken(session.user.id);
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [isReady, session?.user?.id, registerPushToken]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      resetRuntimeData();
      setSession(null);
      setIsReady(true);
      return;
    }

    await supabase.auth.signOut();
    sessionRef.current = null;
    resetRuntimeData();
    setSession(null);
    setIsReady(true);
  }, [resetRuntimeData]);

  const value = useMemo<MobileAppContextValue>(
    () => ({
      session,
      isReady,
      isAuthenticated: Boolean(session?.user),
      authError,
      currentUser,
      profiles,
      events,
      savedEventIds,
      discoverDismissedIds,
      personalCalendarItems,
      recentDmPeople,
      followingProfiles,
      followRelationships,
      refreshData: () => refreshData(),
      signIn,
      signUp,
      signOut,
      updateProfile,
      createEvent,
      updateEvent,
      addPersonalCalendarItem,
      deletePersonalCalendarItem,
      deleteEvent,
      loadEventRegistrations,
      loadEventInvitees,
      toggleSaveEvent,
      acceptDiscoverEvent,
      rejectDiscoverEvent,
      resetDiscoverDeck,
      repostEvent,
      unrepostEvent,
      repostedEventIds,
      followProfile,
      unfollowProfile,
      getEventById,
      getProfileById,
      getProfileByUsername,
      getCreatedEventsForProfile,
      getGoingEventsForProfile,
      getCalendarEventsForProfile,
      getPersonalCalendarItemsForProfile,
      getRepostedEventsForProfile,
      getTaggedMomentsForProfile,
      getFollowersForProfile,
      getFollowingForProfile,
      isFollowingProfile,
      setPostGridVisibility,
      loadGridPostsForAuthor: loadGridPostsForAuthorBound,
      repostPost,
      unrepostPost,
      hasRepostedPost,
      loadAllRepostsForCurrentUser,
      tagUserInPost,
      untagUserInPost,
      loadPostsTaggingUser: loadPostsTaggingUserBound,
      loadTagsForPost: loadTagsForPostBound,
      postEventMemory,
      deleteEventMemory: deleteEventMemoryBound,
      loadEventMemoriesForEvent: loadEventMemoriesForEventBound,
      loadEventMemoriesForUser: loadEventMemoriesForUserBound,
      currentUserAttendedEvent,
    }),
    [
      acceptDiscoverEvent,
      setPostGridVisibility,
      loadGridPostsForAuthorBound,
      repostPost,
      unrepostPost,
      hasRepostedPost,
      loadAllRepostsForCurrentUser,
      tagUserInPost,
      untagUserInPost,
      loadPostsTaggingUserBound,
      loadTagsForPostBound,
      postEventMemory,
      deleteEventMemoryBound,
      loadEventMemoriesForEventBound,
      loadEventMemoriesForUserBound,
      currentUserAttendedEvent,
      addPersonalCalendarItem,
      deletePersonalCalendarItem,
      loadEventRegistrations,
      loadEventInvitees,
      authError,
      createEvent,
      updateEvent,
      currentUser,
      deleteEvent,
      discoverDismissedIds,
      events,
      followProfile,
      followRelationships,
      followingProfiles,
      getCalendarEventsForProfile,
      getCreatedEventsForProfile,
      getEventById,
      getFollowersForProfile,
      getFollowingForProfile,
      getGoingEventsForProfile,
      getPersonalCalendarItemsForProfile,
      getProfileById,
      getProfileByUsername,
      getRepostedEventsForProfile,
      getTaggedMomentsForProfile,
      isFollowingProfile,
      isReady,
      personalCalendarItems,
      profiles,
      recentDmPeople,
      refreshData,
      rejectDiscoverEvent,
      repostEvent,
      unrepostEvent,
      repostedEventIds,
      resetDiscoverDeck,
      savedEventIds,
      session,
      signIn,
      signOut,
      signUp,
      updateProfile,
      toggleSaveEvent,
      unfollowProfile,
    ]
  );

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp() {
  const context = useContext(MobileAppContext);

  if (!context) {
    throw new Error('useMobileApp must be used within a MobileAppProvider');
  }

  return context;
}
