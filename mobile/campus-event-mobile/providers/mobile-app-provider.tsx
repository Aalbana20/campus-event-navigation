import type { Session, User } from '@supabase/supabase-js';
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
  addPersonalCalendarItem: (
    input: CreatePersonalCalendarItemInput
  ) => PersonalCalendarItem;
  deleteEvent: (eventId: string) => Promise<void>;
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
};

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))];

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
  avatarUrl: string
) => ({
  id: userId,
  name: fullName || username,
  username,
  bio: DEFAULT_PROFILE_BIO,
  avatar_url: normalizeAvatarStorageValue(avatarUrl, null) || null,
  updated_at: new Date().toISOString(),
});

const isNotFoundError = (error: { code?: string | null } | null) =>
  error?.code === 'PGRST116';

const STARTUP_TIMEOUT_MS = 12000;

const logStartup = (step: string, details?: Record<string, unknown>) => {
  if (details) {
    console.info(`[mobile-app/startup] ${step}`, details);
    return;
  }

  console.info(`[mobile-app/startup] ${step}`);
};

const createStartupError = (label: string, error: unknown) => {
  if (error instanceof Error) return error;
  return new Error(`${label} failed`);
};

const withTimeout = async <T,>(
  label: string,
  promise: PromiseLike<T>,
  timeoutMs = STARTUP_TIMEOUT_MS
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
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
};

const runStartupQuery = async <T,>(
  label: string,
  query: PromiseLike<QueryResult<T>>
): Promise<QueryResult<T>> => {
  logStartup(`${label}:start`);

  try {
    const result = await withTimeout(label, query);

    if (result.error) {
      console.warn(`[mobile-app/startup] ${label}:query-error`, result.error);
    } else {
      logStartup(`${label}:done`);
    }

    return result;
  } catch (error) {
    const startupError = createStartupError(label, error);
    console.warn(`[mobile-app/startup] ${label}:failed`, startupError);
    return {
      data: null,
      error: {
        message: startupError.message,
      },
    };
  }
};

const runStartupStep = async (label: string, step: PromiseLike<void>) => {
  logStartup(`${label}:start`);

  try {
    await withTimeout(label, step);
    logStartup(`${label}:done`);
    return null;
  } catch (error) {
    const startupError = createStartupError(label, error);
    console.warn(`[mobile-app/startup] ${label}:failed`, startupError);
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

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const resetRuntimeData = useCallback(() => {
    setProfilesState([]);
    setEventsState([]);
    setFollowRelationships([]);
    setSavedEventIds([]);
    setRecentDmProfileIds([]);
    setDiscoverDismissedIds([]);
    setPersonalCalendarItems([]);
    setLocalRepostsByEventId({});
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
          String(user.user_metadata?.avatar_url || '')
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

      try {
        const authUser = nextUser || activeSession?.user;

        if (authUser) {
          await runStartupStep(
            'refreshData.ensureProfileRow',
            ensureProfileRowForUser(authUser)
          );
        }

        const [
          profilesResult,
          eventsResult,
          allRsvpsResult,
          dmParticipantResult,
          followsResult,
          repostsResult,
        ] = await Promise.all([
          runStartupQuery(
            'refreshData.profiles',
            supabase
              .from('profiles')
              .select('*')
              .order('updated_at', { ascending: false })
          ),
          runStartupQuery(
            'refreshData.events',
            supabase
              .from('events')
              .select('*, event_comments(count)')
              .order('created_at', { ascending: false })
          ),
          runStartupQuery('refreshData.rsvps', supabase.from('rsvps').select('*')),
          runStartupQuery(
            'refreshData.messages',
            supabase
              .from('messages')
              .select('sender_id, recipient_id, created_at')
              .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
              .order('created_at', { ascending: false })
          ),
          runStartupQuery('refreshData.follows', supabase.from('follows').select('*')),
          runStartupQuery(
            'refreshData.reposts',
            supabase.from('reposts').select('event_id').eq('user_id', userId)
          ),
        ]);

        let rsvpRows = (allRsvpsResult.data || []) as Array<{
          user_id: string;
          event_id: string;
        }>;

        if (allRsvpsResult.error) {
          const currentUserRsvpsResult = await runStartupQuery(
            'refreshData.currentUserRsvps',
            supabase.from('rsvps').select('*').eq('user_id', userId)
          );

          const currentUserRsvps = currentUserRsvpsResult.data || [];
          rsvpRows = currentUserRsvps as Array<{
            user_id: string;
            event_id: string;
          }>;
        }

        let followRows = (followsResult.data || []) as Array<{
          follower_id: string;
          following_id: string;
          created_at?: string | null;
        }>;

        if (followsResult.error) {
          const [followingResult, followerResult] = await Promise.all([
            runStartupQuery(
              'refreshData.followingForUser',
              supabase.from('follows').select('*').eq('follower_id', userId)
            ),
            runStartupQuery(
              'refreshData.followersForUser',
              supabase.from('follows').select('*').eq('following_id', userId)
            ),
          ]);

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

        const normalizedProfiles = normalizeProfiles(
          ((profilesResult.data || []) as Array<{
            id: string;
            name?: string | null;
            username?: string | null;
            bio?: string | null;
            avatar_url?: string | null;
            phone_number?: string | null;
            birthday?: string | null;
            interests?: string[] | string | null;
            email?: string | null;
          }>)
        );

        const rsvpMap = buildRsvpMap(rsvpRows);
        const normalizedEvents = (((eventsResult.data || []) as Array<{
          id: string;
        }>)).map((row) =>
          normalizeEventRow(
            row as Parameters<typeof normalizeEventRow>[0],
            rsvpMap[String(row.id)] || []
          )
        ).map((event) => ({
          ...event,
          image: getEventImageUri(event.image),
        }));

        const dmProfileIds = uniqueValues(
          ((dmParticipantResult.data || []) as Array<{
            sender_id: string;
            recipient_id: string;
          }>).map((message) =>
            message.sender_id === userId ? message.recipient_id : message.sender_id
          )
        );

        const fallbackCurrentUser =
          nextUser || activeSession?.user
            ? createProfileFromAuthUser((nextUser || activeSession?.user) as User)
            : null;

        setProfilesState(
          fallbackCurrentUser
            ? ensureCurrentUserInProfiles(normalizedProfiles, fallbackCurrentUser)
            : normalizedProfiles
        );
        setEventsState(normalizedEvents);
        setFollowRelationships(
          followRows.map((row) => normalizeFollowRow(row))
        );
        setSavedEventIds(
          uniqueValues(
            rsvpRows
              .filter((row) => String(row.user_id) === String(userId))
              .map((row) => String(row.event_id))
          )
        );
        setRecentDmProfileIds(dmProfileIds);
        setRepostedEventIds(
          new Set(
            ((repostsResult.data || []) as Array<{ event_id: string }>).map((r) =>
              String(r.event_id)
            )
          )
        );
        setAuthError(null);
        logStartup('refreshData:completed', {
          profiles: normalizedProfiles.length,
          events: normalizedEvents.length,
          savedEvents: rsvpRows.filter((row) => String(row.user_id) === String(userId)).length,
          dmThreads: dmProfileIds.length,
          follows: followRows.length,
        });
      } catch (error) {
        console.error('Unable to refresh mobile backend data:', error);
      } finally {
        setIsReady(true);
        logStartup('refreshData:ready');
      }
    },
    [ensureProfileRowForUser, resetRuntimeData]
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
        } = await withTimeout('auth.getSession', supabase.auth.getSession());

        if (error) throw error;
        if (!isMounted) return;

        logStartup('initializeSession:getSession:done', {
          hasSession: Boolean(restoredSession),
          userId: restoredSession?.user?.id || null,
        });
        sessionRef.current = restoredSession;
        setSession(restoredSession);

        if (restoredSession?.user?.id) {
          await refreshData(restoredSession.user.id, restoredSession.user);
          return;
        }

        resetRuntimeData();
        setIsReady(true);
        logStartup('initializeSession:no-session');
      } catch (error) {
        if (!isMounted) return;

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
        logStartup('authStateChange:skip-refresh', { event: _event });
        return;
      }

      if (_event === 'TOKEN_REFRESHED' || _event === 'PASSWORD_RECOVERY') {
        logStartup('authStateChange:session-updated', { event: _event });
        return;
      }

      if (nextSession?.user?.id) {
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
  }, [refreshData, resetRuntimeData]);

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
      const organizer = input.organizer.trim() || currentUser.name;
      const dressCode = input.dressCode.trim() || 'Open';
      const sanitizedImage = sanitizeMediaUrl(input.image?.trim(), '');

      const payload = {
        title,
        description,
        location: locationName,
        location_address: locationAddress,
        date: input.date || formatDateLabel(input.eventDate),
        event_date: input.eventDate,
        start_time: input.startTime,
        end_time: input.endTime,
        organizer,
        dress_code: dressCode,
        image: sanitizedImage || null,
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

      setEventsState((currentEvents) => [createdEvent, ...currentEvents]);

      return createdEvent;
    },
    [currentUser.id, currentUser.name, currentUser.username, profiles]
  );

  const addPersonalCalendarItem = useCallback(
    (input: CreatePersonalCalendarItemInput) => {
      const nextItem: PersonalCalendarItem = {
        id: `personal-${Date.now()}`,
        ownerId: currentUser.id,
        date: input.date,
        title: input.title.trim() || 'New personal item',
        note: input.note?.trim(),
        time: input.time?.trim(),
      };

      setPersonalCalendarItems((currentItems) => [nextItem, ...currentItems]);
      return nextItem;
    },
    [currentUser.id]
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
          goingCount: Math.max(isSaved ? event.goingCount - 1 : event.goingCount + 1, 0),
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
        .insert({ user_id: currentUser.id, event_id: eventId });

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
        .eq('event_id', eventId);

      if (error) {
        console.error('Unable to unrepost event:', error);
        setRepostedEventIds((current) => new Set([...current, eventId]));
      }
    },
    [currentUser.id]
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

      return { ok: true };
    },
    []
  );

  const signUp = useCallback(
    async ({ fullName, username, email, password, avatar }: SignUpInput) => {
      if (!supabase) {
        return {
          ok: false,
          error: SUPABASE_CONFIG_ERROR || 'Supabase is not configured.',
        };
      }

      setIsReady(false);
      setAuthError(null);

      const cleanUsername = normalizeUsername(username);
      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim() || cleanUsername;
      const avatarUrl = normalizeAvatarStorageValue(avatar, null) || '';

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

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanFullName,
            username: cleanUsername,
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

      if (data.session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            createProfilePayload(
              data.user.id,
              cleanFullName,
              cleanUsername,
              avatarUrl
            ),
            { onConflict: 'id' }
          );

        if (profileError) {
          console.error('Unable to create profile row during mobile sign up:', profileError);
        }

        setSession(data.session);
        sessionRef.current = data.session;
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
    []
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
  // Run: npx expo install expo-notifications   (then restart the dev server)
  const registerPushToken = useCallback(async (userId: string) => {
    if (!supabase) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      const { Platform } = require('react-native') as typeof import('react-native');

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

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          { user_id: userId, token, platform: Platform.OS },
          { onConflict: 'user_id,token', ignoreDuplicates: true }
        );

      if (error) console.error('Unable to store push token:', error);
    } catch (error) {
      // expo-notifications not yet installed — safe to ignore until package is added
      console.info('[push] expo-notifications unavailable:', error);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    void registerPushToken(session.user.id);
  }, [session?.user?.id, registerPushToken]);

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
      addPersonalCalendarItem,
      deleteEvent,
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
    }),
    [
      acceptDiscoverEvent,
      addPersonalCalendarItem,
      authError,
      createEvent,
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
