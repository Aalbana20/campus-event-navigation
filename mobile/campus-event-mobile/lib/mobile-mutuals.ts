import type { ProfileRecord } from '@/types/models';

const personDisplayName = (person: ProfileRecord | null | undefined): string =>
  person?.name || person?.username || '';

export function buildMutualGoingLabel(
  mutuals: ProfileRecord[] | null | undefined,
  totalGoing: number
): string {
  const known = (mutuals || []).filter(Boolean) as ProfileRecord[];
  if (known.length === 0) return '';

  const names = known.slice(0, 2).map(personDisplayName).filter(Boolean);
  if (names.length === 0) {
    return `${known.length} mutual${known.length === 1 ? '' : 's'} going`;
  }

  const remainingGoing = Math.max((totalGoing || 0) - names.length, 0);
  if (remainingGoing > 0) {
    return `Going with ${names.join(', ')} and ${remainingGoing} other${
      remainingGoing === 1 ? '' : 's'
    }`;
  }
  return `Going with ${names.join(' and ')}`;
}

export function buildMutualFollowedByLabel(
  mutuals: ProfileRecord[] | null | undefined,
  totalMutuals: number
): string {
  const known = (mutuals || []).filter(Boolean) as ProfileRecord[];
  const total = totalMutuals || known.length;
  if (total <= 0) return '';

  const names = known.slice(0, 2).map(personDisplayName).filter(Boolean);
  if (names.length === 0) {
    return `${total} mutual ${total === 1 ? 'follower' : 'followers'}`;
  }

  const remaining = Math.max(total - names.length, 0);
  if (remaining > 0) {
    return `Followed by ${names.join(', ')} and ${remaining} other${
      remaining === 1 ? '' : 's'
    }`;
  }
  return `Followed by ${names.join(' and ')}`;
}

export function getMutualFollowersFor(args: {
  profileId: string;
  currentUserId: string;
  followingProfiles: ProfileRecord[];
  followRelationships: { followerId: string; followingId: string }[];
}): ProfileRecord[] {
  const { profileId, currentUserId, followingProfiles, followRelationships } = args;
  if (!profileId || !currentUserId || profileId === currentUserId) return [];

  const followsTargetIds = new Set(
    followRelationships
      .filter((relation) => relation.followingId === profileId)
      .map((relation) => relation.followerId)
  );

  return followingProfiles.filter((profile) => followsTargetIds.has(profile.id));
}

export function getMutualGoingForEvent(args: {
  attendeeIds: string[];
  followingProfiles: ProfileRecord[];
}): ProfileRecord[] {
  const { attendeeIds, followingProfiles } = args;
  if (!attendeeIds || attendeeIds.length === 0) return [];
  const ids = new Set(attendeeIds);
  return followingProfiles.filter((profile) => ids.has(profile.id));
}
