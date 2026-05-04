import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { RecapProfileScreen } from '@/components/mobile/RecapProfileScreen';

export default function RecapProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <RecapProfileScreen userId={userId ? String(userId) : ''} />;
}
