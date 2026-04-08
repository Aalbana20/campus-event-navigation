import React, { createContext, useContext, useMemo, useState } from 'react';

import {
  CURRENT_USER_ID,
  mockEvents,
  mockFollowRelationships,
  mockProfiles,
  mockSavedEventIds,
  mockTaggedMoments,
} from '@/data/mock-data';
import { CreateEventInput, EventRecord, FollowRelationship, ProfileRecord, TaggedMoment } from '@/types/models';

type MobileAppContextValue = {
  currentUser: ProfileRecord;
  profiles: ProfileRecord[];
  events: EventRecord[];
  savedEventIds: string[];
  discoverDismissedIds: string[];
  recentDmPeople: ProfileRecord[];
  followingProfiles: ProfileRecord[];
  createEvent: (input: CreateEventInput) => EventRecord;
  deleteEvent: (eventId: string) => void;
  toggleSaveEvent: (eventId: string) => void;
  acceptDiscoverEvent: (eventId: string) => void;
  rejectDiscoverEvent: (eventId: string) => void;
  resetDiscoverDeck: () => void;
  repostEvent: (eventId: string) => void;
  followProfile: (profileId: string) => void;
  unfollowProfile: (profileId: string) => void;
  getEventById: (eventId: string) => EventRecord | undefined;
  getProfileById: (profileId: string) => ProfileRecord | undefined;
  getProfileByUsername: (username: string) => ProfileRecord | undefined;
  getCreatedEventsForProfile: (profileId: string) => EventRecord[];
  getGoingEventsForProfile: (profileId: string) => EventRecord[];
  getRepostedEventsForProfile: (profileId: string) => EventRecord[];
  getTaggedMomentsForProfile: (profileId: string) => TaggedMoment[];
  getFollowersForProfile: (profileId: string) => ProfileRecord[];
  getFollowingForProfile: (profileId: string) => ProfileRecord[];
  isFollowingProfile: (profileId: string) => boolean;
};

const MobileAppContext = createContext<MobileAppContextValue | null>(null);

const normalizeTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-');

export function MobileAppProvider({ children }: { children: React.ReactNode }) {
  const [profiles] = useState(mockProfiles);
  const [events, setEvents] = useState(mockEvents);
  const [followRelationships, setFollowRelationships] =
    useState<FollowRelationship[]>(mockFollowRelationships);
  const [savedEventIds, setSavedEventIds] = useState<string[]>(mockSavedEventIds);
  const [discoverDismissedIds, setDiscoverDismissedIds] = useState<string[]>([]);
  const [taggedMoments] = useState<TaggedMoment[]>(mockTaggedMoments);

  const currentUser = useMemo(() => {
    const fallback = profiles[0];
    return profiles.find((profile) => profile.id === CURRENT_USER_ID) || fallback;
  }, [profiles]);

  const getProfileById = (profileId: string) =>
    profiles.find((profile) => profile.id === profileId);

  const getProfileByUsername = (username: string) =>
    profiles.find((profile) => profile.username === username);

  const getFollowersForProfile = (profileId: string) =>
    followRelationships
      .filter((relationship) => relationship.followingId === profileId)
      .map((relationship) => getProfileById(relationship.followerId))
      .filter(Boolean) as ProfileRecord[];

  const getFollowingForProfile = (profileId: string) =>
    followRelationships
      .filter((relationship) => relationship.followerId === profileId)
      .map((relationship) => getProfileById(relationship.followingId))
      .filter(Boolean) as ProfileRecord[];

  const isFollowingProfile = (profileId: string) =>
    followRelationships.some(
      (relationship) =>
        relationship.followerId === currentUser.id && relationship.followingId === profileId
    );

  const followingProfiles = getFollowingForProfile(currentUser.id);
  const recentDmPeople = followingProfiles.slice(0, 5);

  const getEventById = (eventId: string) => events.find((event) => event.id === eventId);

  const getCreatedEventsForProfile = (profileId: string) =>
    events.filter((event) => event.createdBy === profileId);

  const getGoingEventsForProfile = (profileId: string) =>
    events.filter(
      (event) => savedEventIds.includes(event.id) || event.attendees.includes(profileId)
    );

  const getRepostedEventsForProfile = (profileId: string) =>
    events.filter((event) => event.repostedByIds.includes(profileId));

  const getTaggedMomentsForProfile = (profileId: string) =>
    taggedMoments.filter((moment) => moment.profileId === profileId);

  const toggleSaveEvent = (eventId: string) => {
    setSavedEventIds((currentIds) =>
      currentIds.includes(eventId)
        ? currentIds.filter((id) => id !== eventId)
        : [eventId, ...currentIds]
    );
  };

  const acceptDiscoverEvent = (eventId: string) => {
    setSavedEventIds((currentIds) =>
      currentIds.includes(eventId) ? currentIds : [eventId, ...currentIds]
    );
    setDiscoverDismissedIds((currentIds) =>
      currentIds.includes(eventId) ? currentIds : [...currentIds, eventId]
    );
  };

  const rejectDiscoverEvent = (eventId: string) => {
    setDiscoverDismissedIds((currentIds) =>
      currentIds.includes(eventId) ? currentIds : [...currentIds, eventId]
    );
  };

  const resetDiscoverDeck = () => {
    setDiscoverDismissedIds([]);
  };

  const repostEvent = (eventId: string) => {
    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id !== eventId || event.repostedByIds.includes(currentUser.id)
          ? event
          : {
              ...event,
              repostedByIds: [currentUser.id, ...event.repostedByIds],
            }
      )
    );
  };

  const followProfile = (profileId: string) => {
    if (profileId === currentUser.id || isFollowingProfile(profileId)) return;

    setFollowRelationships((currentRelationships) => [
      ...currentRelationships,
      {
        followerId: currentUser.id,
        followingId: profileId,
      },
    ]);
  };

  const unfollowProfile = (profileId: string) => {
    setFollowRelationships((currentRelationships) =>
      currentRelationships.filter(
        (relationship) =>
          !(
            relationship.followerId === currentUser.id &&
            relationship.followingId === profileId
          )
      )
    );
  };

  const createEvent = (input: CreateEventInput) => {
    const title = input.title.trim() || 'New Campus Event';
    const description = input.description.trim() || 'A new event just dropped on campus.';
    const locationName = input.locationName.trim() || 'Campus Event Space';
    const locationAddress = input.locationAddress.trim() || locationName;
    const organizer = input.organizer.trim() || currentUser.name;
    const dressCode = input.dressCode.trim() || 'Open';

    const nextEvent: EventRecord = {
      id: `event-${Date.now()}`,
      title,
      description,
      date: input.date,
      eventDate: input.eventDate,
      startTime: input.startTime,
      endTime: input.endTime,
      time:
        input.startTime && input.endTime
          ? `${input.startTime} - ${input.endTime}`
          : input.startTime || 'TBA',
      location: locationName,
      locationName,
      locationAddress,
      organizer,
      dressCode,
      image:
        input.image?.trim() ||
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
      tags: input.tags.map(normalizeTag).filter(Boolean),
      createdBy: currentUser.id,
      creatorUsername: currentUser.username,
      goingCount: 1,
      privacy: input.privacy,
      isPrivate: input.privacy === 'private',
      attendees: [currentUser.id],
      repostedByIds: [],
    };

    setEvents((currentEvents) => [nextEvent, ...currentEvents]);
    setSavedEventIds((currentIds) =>
      currentIds.includes(nextEvent.id) ? currentIds : [nextEvent.id, ...currentIds]
    );

    return nextEvent;
  };

  const deleteEvent = (eventId: string) => {
    setEvents((currentEvents) => currentEvents.filter((event) => event.id !== eventId));
    setSavedEventIds((currentIds) => currentIds.filter((id) => id !== eventId));
    setDiscoverDismissedIds((currentIds) => currentIds.filter((id) => id !== eventId));
  };

  const value = useMemo<MobileAppContextValue>(
    () => ({
      currentUser,
      profiles,
      events,
      savedEventIds,
      discoverDismissedIds,
      recentDmPeople,
      followingProfiles,
      createEvent,
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
      getRepostedEventsForProfile,
      getTaggedMomentsForProfile,
      getFollowersForProfile,
      getFollowingForProfile,
      isFollowingProfile,
    }),
    [currentUser, profiles, events, savedEventIds, discoverDismissedIds, recentDmPeople, followingProfiles]
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
