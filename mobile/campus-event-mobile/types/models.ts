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
  creatorName?: string;
  creatorAvatar?: string;
  goingCount: number;
  commentCount: number;
  privacy: EventPrivacy;
  isPrivate: boolean;
  attendees: string[];
  repostedByIds: string[];
  createdAt?: string;
};

export type ProfileRecord = {
  id: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  interests?: string[];
  phoneNumber?: string;
  birthday?: string;
  email?: string;
};

export type FollowRelationship = {
  followerId: string;
  followingId: string;
  createdAt?: string;
};

export type TaggedMoment = {
  id: string;
  profileId: string;
  eventId: string;
  title: string;
  image: string;
};

export type StoryMediaType = 'image' | 'video';

export type StoryRecord = {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string;
  eventId?: string | null;
  createdAt: string;
  expiresAt: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
};

export type StoryViewerRecord = {
  id: string;
  storyId: string;
  viewerId: string;
  viewedAt: string;
  name: string;
  username: string;
  avatar: string;
};

export type PersonalCalendarItem = {
  id: string;
  ownerId: string;
  date: string;
  title: string;
  note?: string;
  time?: string;
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

export type CreatePersonalCalendarItemInput = {
  date: string;
  title: string;
  note?: string;
  time?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  avatar?: string;
  interests?: string[];
};

export type AuthActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
};
