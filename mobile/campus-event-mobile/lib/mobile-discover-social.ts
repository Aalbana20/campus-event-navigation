import { normalizeUsername } from '@/lib/mobile-backend';
import type { EventRecord, ProfileRecord } from '@/types/models';

export type MobileDiscoverStoryItem = {
  id: string;
  profileId?: string;
  routeKey?: string;
  name: string;
  username: string;
  avatar: string;
  kind: 'current' | 'story' | 'suggested';
  meta: string;
  seen: boolean;
  isPlaceholder: boolean;
};

export type MobileDiscoverFriendCard = {
  id: string;
  profileId?: string;
  routeKey?: string;
  name: string;
  username: string;
  avatar: string;
  badge: string;
  headline: string;
  context: string;
  metaItems: string[];
  canToggleFollow: boolean;
  featured: boolean;
  isPlaceholder: boolean;
};

const FRIEND_CARD_MIN_ITEMS = 6;

const PLACEHOLDER_PEOPLE = [
  {
    id: 'suggested-alina-brooks',
    name: 'Alina Brooks',
    username: 'alinaafterclass',
    bio: 'Finds gallery nights, film screenings, and the best post-event coffee plans.',
    location: 'Arts Hall',
  },
  {
    id: 'suggested-omar-ellis',
    name: 'Omar Ellis',
    username: 'omaroncampus',
    bio: 'Keeps track of creator showcases, welcome mixers, and low-key campus hangs.',
    location: 'Student Center',
  },
  {
    id: 'suggested-camille-west',
    name: 'Camille West',
    username: 'camillecollects',
    bio: 'Good follow for club launches, rooftop socials, and late-night culture picks.',
    location: 'North Quad',
  },
  {
    id: 'suggested-hudson-lee',
    name: 'Hudson Lee',
    username: 'hudsonhosts',
    bio: 'Usually close to wellness plans, intramurals, and social momentum around campus.',
    location: 'Rec Center',
  },
  {
    id: 'suggested-priya-hale',
    name: 'Priya Hale',
    username: 'priyaplans',
    bio: 'Always knows who is creating something interesting and where the crowd is heading.',
    location: 'Campus Green',
  },
  {
    id: 'suggested-sienna-cruz',
    name: 'Sienna Cruz',
    username: 'siennastudies',
    bio: 'Good eye for launch parties, art happenings, and after-class linkups.',
    location: 'Library Lawn',
  },
  {
    id: 'suggested-eli-porter',
    name: 'Eli Porter',
    username: 'eliinvites',
    bio: 'Usually near sports energy, club pop-ups, and who is actually showing up.',
    location: 'South Quad',
  },
  {
    id: 'suggested-nia-frost',
    name: 'Nia Frost',
    username: 'niaafterdark',
    bio: 'Tracks social calendars, creator events, and the best night-of-campus plans.',
    location: 'Residence Row',
  },
];

const STORY_RING_COLORS = [
  ['#2563eb', '#7c3aed'],
  ['#0f766e', '#22c55e'],
  ['#ea580c', '#f59e0b'],
  ['#db2777', '#8b5cf6'],
  ['#0891b2', '#38bdf8'],
];

type PersonRelation = 'following' | 'creator' | 'campus' | 'suggested';

type BaseDiscoverPerson = {
  id: string;
  profileId: string;
  routeKey: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  relation: PersonRelation;
  createdCount: number;
  totalGoing: number;
  featuredTitle: string;
  featuredMeta: string;
};

const toTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const pickDisplayName = (input: { name?: unknown; username?: unknown }) =>
  toTrimmedString(input.name) ||
  normalizeUsername(toTrimmedString(input.username)) ||
  'Campus User';

const encodeSvg = (value: string) => `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;

const buildGeneratedAvatar = (label: string, seedIndex = 0) => {
  const safeLabel = pickDisplayName({ name: label });
  const initials =
    safeLabel
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'CU';
  const [startColor, endColor] =
    STORY_RING_COLORS[seedIndex % STORY_RING_COLORS.length];

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="36" fill="url(#bg)" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        fill="white"
        font-family="SF Pro Display, Inter, Arial, sans-serif"
        font-size="42"
        font-weight="700"
      >${initials}</text>
    </svg>
  `);
};

const resolveAvatar = (avatar: unknown, label: string, seedIndex = 0) => {
  const trimmed = toTrimmedString(avatar);

  if (!trimmed) {
    return buildGeneratedAvatar(label, seedIndex);
  }

  if (trimmed.startsWith('blob:') || trimmed.startsWith('file:')) {
    return buildGeneratedAvatar(label, seedIndex);
  }

  return trimmed;
};

const getPersonKey = (person: Partial<BaseDiscoverPerson>) =>
  String(person.profileId || person.id || person.username || person.name || '');

const buildCreatorStatMap = (events: EventRecord[]) => {
  const statsByKey = new Map<
    string,
    { createdCount: number; totalGoing: number; featuredTitle: string; featuredMeta: string }
  >();

  events.forEach((event) => {
    const keys = [
      event.createdBy ? `id:${event.createdBy}` : '',
      event.creatorUsername ? `username:${normalizeUsername(event.creatorUsername)}` : '',
    ].filter(Boolean);

    if (keys.length === 0) return;

    const nextStat = {
      createdCount: 1,
      totalGoing: Number(event.goingCount || 0),
      featuredTitle: toTrimmedString(event.title),
      featuredMeta: [event.date, event.locationName || event.location].filter(Boolean).join(' • '),
    };

    keys.forEach((key) => {
      const current = statsByKey.get(key);

      if (!current) {
        statsByKey.set(key, nextStat);
        return;
      }

      statsByKey.set(key, {
        createdCount: current.createdCount + 1,
        totalGoing: current.totalGoing + nextStat.totalGoing,
        featuredTitle: current.featuredTitle || nextStat.featuredTitle,
        featuredMeta: current.featuredMeta || nextStat.featuredMeta,
      });
    });
  });

  return statsByKey;
};

const getStatsForPerson = (
  person: Pick<BaseDiscoverPerson, 'profileId' | 'username'>,
  statMap: ReturnType<typeof buildCreatorStatMap>
) =>
  statMap.get(`id:${person.profileId}`) ||
  statMap.get(`username:${person.username}`) || {
    createdCount: 0,
    totalGoing: 0,
    featuredTitle: '',
    featuredMeta: '',
  };

const mergeRelation = (current: PersonRelation, next: PersonRelation): PersonRelation => {
  if (current === 'following' || next === 'following') return 'following';
  if (current === 'creator' || next === 'creator') return 'creator';
  if (current === 'campus' || next === 'campus') return 'campus';
  return next;
};

const buildBasePerson = (
  person: {
    id?: unknown;
    profileId?: unknown;
    routeKey?: unknown;
    name?: unknown;
    username?: unknown;
    avatar?: unknown;
    bio?: unknown;
  },
  index: number,
  relation: PersonRelation,
  statMap: ReturnType<typeof buildCreatorStatMap>
): BaseDiscoverPerson => {
  const username = normalizeUsername(toTrimmedString(person.username));
  const profileId = toTrimmedString(person.profileId) || toTrimmedString(person.id);
  const name = pickDisplayName({ name: person.name, username });

  const basePerson = {
    id: toTrimmedString(person.id) || profileId || username || `person-${index}`,
    profileId,
    routeKey:
      toTrimmedString(person.routeKey) || username || profileId || toTrimmedString(person.id),
    name,
    username,
    avatar: resolveAvatar(person.avatar, name, index),
    bio: toTrimmedString(person.bio),
    relation,
    createdCount: 0,
    totalGoing: 0,
    featuredTitle: '',
    featuredMeta: '',
  };

  return {
    ...basePerson,
    ...getStatsForPerson(basePerson, statMap),
  };
};

const addOrMergePerson = (
  collection: Map<string, BaseDiscoverPerson>,
  person: {
    id?: unknown;
    profileId?: unknown;
    routeKey?: unknown;
    name?: unknown;
    username?: unknown;
    avatar?: unknown;
    bio?: unknown;
  },
  relation: PersonRelation,
  statMap: ReturnType<typeof buildCreatorStatMap>
) => {
  const base = buildBasePerson(person, collection.size, relation, statMap);
  const key = getPersonKey(base);

  if (!key) return;

  const current = collection.get(key);
  if (!current) {
    collection.set(key, base);
    return;
  }

  collection.set(key, {
    ...current,
    ...base,
    relation: mergeRelation(current.relation, relation),
    createdCount: Math.max(current.createdCount, base.createdCount),
    totalGoing: Math.max(current.totalGoing, base.totalGoing),
    featuredTitle: current.featuredTitle || base.featuredTitle,
    featuredMeta: current.featuredMeta || base.featuredMeta,
    bio: current.bio || base.bio,
    avatar: current.avatar || base.avatar,
  });
};

const dedupePeople = (people: BaseDiscoverPerson[]) => {
  const seen = new Set<string>();

  return people.filter((person) => {
    const key = getPersonKey(person);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildPlaceholderPeople = (count: number, startIndex = 0): BaseDiscoverPerson[] =>
  PLACEHOLDER_PEOPLE.slice(0, count).map((person, index) => ({
    id: person.id,
    profileId: '',
    routeKey: '',
    name: person.name,
    username: person.username,
    avatar: buildGeneratedAvatar(person.name, startIndex + index),
    bio: person.bio,
    relation: 'suggested',
    createdCount: 0,
    totalGoing: 0,
    featuredTitle: '',
    featuredMeta: person.location,
  }));

const sortPeople = (people: BaseDiscoverPerson[]) => {
  const relationWeight = (relation: PersonRelation) => {
    switch (relation) {
      case 'following':
        return 4;
      case 'creator':
        return 3;
      case 'campus':
        return 2;
      default:
        return 1;
    }
  };

  return [...people].sort((left, right) => {
    if (relationWeight(right.relation) !== relationWeight(left.relation)) {
      return relationWeight(right.relation) - relationWeight(left.relation);
    }

    if (right.createdCount !== left.createdCount) {
      return right.createdCount - left.createdCount;
    }

    if (right.totalGoing !== left.totalGoing) {
      return right.totalGoing - left.totalGoing;
    }

    return left.name.localeCompare(right.name);
  });
};

const buildSocialPeople = ({
  currentUser,
  followingProfiles,
  profiles,
  events,
}: {
  currentUser: ProfileRecord;
  followingProfiles: ProfileRecord[];
  profiles: ProfileRecord[];
  events: EventRecord[];
}) => {
  const statMap = buildCreatorStatMap(events);
  const people = new Map<string, BaseDiscoverPerson>();
  const currentKey = String(currentUser.id || currentUser.username || '');

  followingProfiles.forEach((profile) =>
    addOrMergePerson(
      people,
      {
        id: profile.id,
        profileId: profile.id,
        routeKey: profile.username || profile.id,
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar,
        bio: profile.bio,
      },
      'following',
      statMap
    )
  );

  events.forEach((event) =>
    addOrMergePerson(
      people,
      {
        id: event.createdBy,
        profileId: event.createdBy,
        routeKey: event.creatorUsername || event.createdBy,
        name: event.creatorName,
        username: event.creatorUsername,
        avatar: event.creatorAvatar,
        bio: event.description,
      },
      'creator',
      statMap
    )
  );

  profiles.slice(0, 18).forEach((profile) => {
    if (!profile?.id || String(profile.id) === String(currentUser.id)) return;

    addOrMergePerson(
      people,
      {
        id: profile.id,
        profileId: profile.id,
        routeKey: profile.username || profile.id,
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar,
        bio: profile.bio,
      },
      'campus',
      statMap
    );
  });

  return sortPeople(dedupePeople([...people.values()])).filter(
    (person) => getPersonKey(person) !== currentKey
  );
};

export const buildMobileDiscoverStoryItems = ({
  currentUser,
}: {
  currentUser: ProfileRecord;
}): MobileDiscoverStoryItem[] => {
  const currentStory: MobileDiscoverStoryItem = {
    id: currentUser.id || 'current-user',
    profileId: currentUser.id,
    routeKey: currentUser.username || currentUser.id,
    name: currentUser.name || currentUser.username || 'Campus User',
    username: currentUser.username || '',
    avatar: resolveAvatar(currentUser.avatar, currentUser.name || currentUser.username || 'You', 0),
    kind: 'current',
    meta: 'Share',
    seen: false,
    isPlaceholder: false,
  };

  return [currentStory];
};

export const buildMobileDiscoverFriendCards = ({
  currentUser,
  followingProfiles,
  profiles,
  events,
}: {
  currentUser: ProfileRecord;
  followingProfiles: ProfileRecord[];
  profiles: ProfileRecord[];
  events: EventRecord[];
}): MobileDiscoverFriendCard[] => {
  const realCards = buildSocialPeople({
    currentUser,
    followingProfiles,
    profiles,
    events,
  }).map((person, index) => {
    const badge =
      person.relation === 'following'
        ? 'Following'
        : person.relation === 'creator'
          ? 'Campus Host'
          : 'Suggested';
    const headline =
      person.featuredTitle ||
      (person.createdCount > 0
        ? `${person.createdCount} event${person.createdCount > 1 ? 's' : ''} shaping campus`
        : 'Worth following for campus plans and social momentum');
    const context =
      person.bio ||
      (person.totalGoing > 0
        ? `${person.totalGoing} people are already showing interest around what they are sharing.`
        : 'A strong social signal for discovering who is creating, going, and showing up.');

    return {
      id: person.id,
      profileId: person.profileId,
      routeKey: person.routeKey,
      name: person.name,
      username: person.username,
      avatar: person.avatar,
      badge,
      headline,
      context,
      metaItems: [
        person.username ? `@${person.username}` : '',
        person.featuredMeta,
        person.relation === 'following' ? 'In your orbit' : '',
      ].filter(Boolean),
      canToggleFollow: Boolean(person.profileId),
      featured: index === 0,
      isPlaceholder: false,
    };
  });

  const placeholderCards = buildPlaceholderPeople(
    Math.max(FRIEND_CARD_MIN_ITEMS - realCards.length, 0),
    realCards.length + 2
  ).map((person, index) => ({
    id: person.id,
    profileId: '',
    routeKey: '',
    name: person.name,
    username: person.username,
    avatar: person.avatar,
    badge: 'Suggested',
    headline: person.featuredMeta || 'Campus pick',
    context: person.bio,
    metaItems: [person.username ? `@${person.username}` : '', 'Suggested account'].filter(Boolean),
    canToggleFollow: false,
    featured: realCards.length === 0 && index === 0,
    isPlaceholder: true,
  }));

  return [...realCards, ...placeholderCards];
};
