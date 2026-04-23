import * as ExpoLinking from 'expo-linking';
import { Share } from 'react-native';

import type { EventRecord } from '@/types/models';

export const buildEventShareMessage = (event: EventRecord) => {
  const eventLink = ExpoLinking.createURL(`/event/${event.id}`);
  const metaLine = [event.date, event.time, event.locationName].filter(Boolean).join(' • ');
  const body = [event.title, metaLine, eventLink].filter(Boolean).join('\n');

  return {
    eventLink,
    body,
  };
};

export const shareEventRecord = async (event: EventRecord) => {
  const { body, eventLink } = buildEventShareMessage(event);

  await Share.share({
    title: event.title,
    message: body,
    url: eventLink,
  });
};
