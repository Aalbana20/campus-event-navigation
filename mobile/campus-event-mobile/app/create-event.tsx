import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { AppScreen } from '@/components/mobile/AppScreen';
import { CalendarCreateSheet } from '@/components/mobile/CalendarCreateSheet';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { CreatePersonalCalendarItemInput } from '@/types/models';

export default function CreateEventScreen() {
  const router = useRouter();
  const { addPersonalCalendarItem } = useMobileApp();

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleAddPersonalItem = useCallback(
    (input: CreatePersonalCalendarItemInput) => {
      void addPersonalCalendarItem(input);
    },
    [addPersonalCalendarItem]
  );

  return (
    <AppScreen edges={[]}>
      <CalendarCreateSheet
        visible
        selectedDate={null}
        initialMode="event"
        onClose={handleClose}
        onAddPersonalItem={handleAddPersonalItem}
      />
    </AppScreen>
  );
}
