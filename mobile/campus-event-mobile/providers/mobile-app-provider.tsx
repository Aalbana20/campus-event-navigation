import type { Session, User } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  DEFAULT_AVATAR,
  DEFAULT_PROFILE_BIO,
  EMPTY_PROFILE,
  buildRsvpMap,
  createProfileFromAuthUser,
  ensureCurrentUserInProfiles,
  normalizeEventRow,
  normalizeFollowRow,
  normalizeProfiles,
  normalizeUsername,
} from '@/lib/mobile-backend';
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
  createEvent: (input: CreateEventInput) => Promise<EventRecord | null>;
  addPersonalCalendarItem: (
    input: CreatePersonalCalendarItemInput
  ) => PersonalCalendarItem;
  deleteEvent: (eventId: string) => Promise<void>;
  toggleSaveEvent: (eventId: string) => Promise<void>;
  acceptDiscoverEvent: (eventId: string) => void;
  rejectDiscoverEvent: (eventId: string) => void;
  resetDiscoverDeck: () => void;
  repostEvent: (eventId: string) => void;
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
  avatar_url: avatarUrl || DEFAULT_AVATAR,
  updated_at: new Date().toISOString(),
});

const isNotFoundError = (error: { code?: string | null } | null) =>
  error?.code === 'PGRST116';

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
  const [taggedMoments] = useState<TaggedMoment[]>([]);

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
      eventsState.map((event) => ({
        ...event,
        repostedByIds: uniqueValues([
          ...(event.repostedByIds || []),
          ...(localRepostsByEventId[event.id] || []),
        ]),
      })),
    [eventsState, localRepostsByEventId]
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
          fallbackProfile.avatar || DEFAULT_AVATAR
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

      const userId = nextUserId || session?.user?.id;

      if (!userId) {
        resetRuntimeData();
        setAuthError(null);
        setIsReady(true);
        return;
      }

      try {
        const authUser = nextUser || session?.user;

        if (authUser) {
          await ensureProfileRowForUser(authUser);
        }

        const [
          profilesResult,
          eventsResult,
          allRsvpsResult,
          dmParticipantResult,
          followsResult,
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .order('updated_at', { ascending: false }),
          supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase.from('rsvps').select('*'),
          supabase
            .from('messages')
            .select('sender_id, recipient_id, created_at')
            .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
            .order('created_at', { ascending: false }),
          supabase.from('follows').select('*'),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (eventsResult.error) throw eventsResult.error;

        let rsvpRows = (allRsvpsResult.data || []) as Array<{
          user_id: string;
          event_id: string;
        }>;

        if (allRsvpsResult.error) {
          const { data: currentUserRsvps, error: currentUserRsvpsError } =
            await supabase.from('rsvps').select('*').eq('user_id', userId);

          if (currentUserRsvpsError) throw currentUserRsvpsError;
          rsvpRows = (currentUserRsvps || []) as Array<{
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
            supabase.from('follows').select('*').eq('follower_id', userId),
            supabase.from('follows').select('*').eq('following_id', userId),
          ]);

          if (followingResult.error) throw followingResult.error;
          if (followerResult.error) throw followerResult.error;

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
          (profilesResult.data || []) as Array<{
            id: string;
            name?: string | null;
            username?: string | null;
            bio?: string | null;
            avatar_url?: string | null;
            phone_number?: string | null;
            birthday?: string | null;
            interests?: string[] | string | null;
            email?: string | null;
          }>
        );

        const rsvpMap = buildRsvpMap(rsvpRows);
        const normalizedEvents = ((eventsResult.data || []) as Array<{
          id: string;
        }>).map((row) =>
          normalizeEventRow(
            row as Parameters<typeof normalizeEventRow>[0],
            rsvpMap[String(row.id)] || []
          )
        );

        const dmProfileIds = uniqueValues(
          ((dmParticipantResult.data || []) as Array<{
            sender_id: string;
            recipient_id: string;
          }>).map((message) =>
            message.sender_id === userId ? message.recipient_id : message.sender_id
          )
        );

        const fallbackCurrentUser =
          nextUser || session?.user
            ? createProfileFromAuthUser((nextUser || session?.user) as User)
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
        setAuthError(null);
      } catch (error) {
        console.error('Unable to refresh mobile backend data:', error);
      } finally {
        setIsReady(true);
      }
    },
    [ensureProfileRowForUser, resetRuntimeData, session?.user]
  );

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      if (!supabase) {
        setIsReady(true);
        return;
      }

      try {
        const {
          data: { session: restoredSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!isMounted) return;

        setSession(restoredSession);

        if (restoredSession?.user?.id) {
          await refreshData(restoredSession.user.id, restoredSession.user);
          return;
        }

        resetRuntimeData();
        setIsReady(true);
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
      setSession(nextSession);

      if (nextSession?.user?.id) {
        void refreshData(nextSession.user.id, nextSession.user);
        return;
      }

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
      profiles.find((profile) => profile.username === normalizeUsername(username)),
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
        image: input.image?.trim() || '',
        tags: input.tags,
        created_by: currentUser.id,
        creator_username: currentUser.username,
        going_count: 1,
        privacy: input.privacy,
        is_private: input.privacy === 'private',
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

      const createdEvent = normalizeEventRow(data, [currentUser.id]);

      setEventsState((currentEvents) => [createdEvent, ...currentEvents]);
      setSavedEventIds((currentIds) =>
        currentIds.includes(createdEvent.id)
          ? currentIds
          : [createdEvent.id, ...currentIds]
      );

      const { error: rsvpError } = await supabase
        .from('rsvps')
        .insert({ user_id: currentUser.id, event_id: createdEvent.id });

      if (rsvpError && rsvpError.code !== '23505') {
        console.error('Unable to create initial RSVP:', rsvpError);
      }

      return createdEvent;
    },
    [currentUser.id, currentUser.name, currentUser.username]
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
      } catch (error) {
        console.error('Unable to update RSVP state:', error);
        setEventsState(previousEvents);
        setSavedEventIds(previousSavedIds);
      }
    },
    [currentUser.id, eventsState, savedEventIds]
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
    (eventId: string) => {
      if (!currentUser.id) return;

      setLocalRepostsByEventId((currentMap) => ({
        ...currentMap,
        [eventId]: uniqueValues([
          ...(currentMap[eventId] || []),
          currentUser.id,
        ]),
      }));
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

      if (data.user?.id) {
        await refreshData(data.user.id, data.user);
      } else {
        setIsReady(true);
      }

      return { ok: true };
    },
    [refreshData]
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
      const avatarUrl = avatar || DEFAULT_AVATAR;

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
            avatar_url: avatarUrl,
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
        await refreshData(data.user.id, data.user);
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
    [refreshData]
  );

  const signOut = useCallback(async () => {
    if (!supabase) {
      resetRuntimeData();
      setSession(null);
      setIsReady(true);
      return;
    }

    await supabase.auth.signOut();
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
      createEvent,
      addPersonalCalendarItem,
      deleteEvent,
      toggleSaveEvent,
      acceptDiscoverEvent,
      rejectDiscoverEvent,
      resetDiscoverDeck,
      repostEvent,
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
      resetDiscoverDeck,
      savedEventIds,
      session,
      signIn,
      signOut,
      signUp,
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
