import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { ProfileScreen } from '@/components/mobile/ProfileScreen';

export default function PublicProfileRoute() {
  const { username } = useLocalSearchParams<{ username: string }>();

  return <ProfileScreen username={username ? String(username) : undefined} />;
}
