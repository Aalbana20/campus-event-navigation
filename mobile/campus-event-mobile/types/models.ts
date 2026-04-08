export type EventPrivacy = 'public' | 'private';

export type EventRecord = {
  id: string;
  title: string;
  description: string;
  date: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  time: string;
  location: string;
  locationName: string;
  locationAddress: string;
  organizer: string;
  dressCode: string;
  image: string;
  tags: string[];
  createdBy: string;
  creatorUsername: string;
  goingCount: number;
  privacy: EventPrivacy;
  isPrivate: boolean;
  attendees: string[];
  repostedByIds: string[];
};

export type ProfileRecord = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
};

export type FollowRelationship = {
  followerId: string;
  followingId: string;
};

export type TaggedMoment = {
  id: string;
  profileId: string;
  eventId: string;
  title: string;
  image: string;
};

export type CreateEventInput = {
  title: string;
  description: string;
  date: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  organizer: string;
  dressCode: string;
  tags: string[];
  privacy: EventPrivacy;
  image?: string;
};
