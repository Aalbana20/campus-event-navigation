import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getEventImageSource } from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';

type EventCardStickerProps = {
  event: Pick<
    EventRecord,
    'title' | 'image' | 'date' | 'time' | 'host' | 'organizer' | 'locationName'
  >;
  width: number;
};

export function EventCardSticker({ event, width }: EventCardStickerProps) {
  const hostLabel = event.host || event.organizer || 'Campus';
  const meta = [event.date, event.time].filter(Boolean).join(' • ');

  // Aspect ratio for the card shell: height = width * 1.2 (portrait-ish).
  const height = width * 1.2;
  const imageHeight = width * 0.78;
  const radius = Math.max(18, width * 0.08);

  return (
    <View
      style={[
        styles.shell,
        { width, height, borderRadius: radius, padding: Math.max(10, width * 0.05) },
      ]}>
      <View style={styles.hostRow}>
        <Text numberOfLines={1} style={styles.hostText}>
          {hostLabel}
        </Text>
      </View>

      <Image
        source={getEventImageSource(event.image)}
        style={{
          width: '100%',
          height: imageHeight,
          borderRadius: radius * 0.65,
          marginTop: 6,
        }}
      />

      <Text numberOfLines={2} style={[styles.title, { fontSize: Math.max(14, width * 0.075) }]}>
        {event.title || 'Campus event'}
      </Text>

      {meta ? (
        <Text numberOfLines={1} style={[styles.meta, { fontSize: Math.max(11, width * 0.045) }]}>
          {meta}
        </Text>
      ) : null}

      {event.locationName ? (
        <Text numberOfLines={1} style={[styles.meta, { fontSize: Math.max(11, width * 0.045) }]}>
          {event.locationName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
    overflow: 'hidden',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontWeight: '800',
    marginTop: 10,
    lineHeight: undefined,
  },
  meta: {
    color: 'rgba(255,255,255,0.68)',
    fontWeight: '600',
    marginTop: 3,
  },
});
