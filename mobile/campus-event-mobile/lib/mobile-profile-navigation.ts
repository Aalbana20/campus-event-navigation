import type { Router } from 'expo-router';

import type { ProfileRecord } from '@/types/models';

type ProfileLike = Partial<Pick<ProfileRecord, 'id' | 'username' | 'name'>> | null | undefined;

export const openMobileProfile = ({
  router,
  currentUser,
  profile,
}: {
  router: Router;
  currentUser?: ProfileLike;
  profile?: ProfileLike;
}) => {
  const profileId = profile?.id ? String(profile.id) : '';
  const username = profile?.username ? String(profile.username) : '';
  const currentUserId = currentUser?.id ? String(currentUser.id) : '';
  const currentUsername = currentUser?.username ? String(currentUser.username) : '';

  if (!profileId && !username) return;

  if (
    (profileId && currentUserId && profileId === currentUserId) ||
    (username && currentUsername && username === currentUsername)
  ) {
    router.push('/(tabs)/profile');
    return;
  }

  router.push({
    pathname: '/profile/[username]',
    params: { username: username || profileId },
  });
};
