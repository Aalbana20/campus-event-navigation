import { Stack } from 'expo-router';
import React from 'react';

import { StoryComposerScreen } from '@/components/mobile/StoryComposerScreen';

export default function StoryCreateRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <StoryComposerScreen />
    </>
  );
}
