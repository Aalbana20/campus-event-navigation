import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';

import { getEventCreatorLabel } from '@/lib/mobile-backend';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';

type EventCardStickerEvent = Pick<
  EventRecord,
  | 'title'
  | 'image'
  | 'date'
  | 'time'
  | 'host'
  | 'organizer'
  | 'creatorAvatar'
  | 'creatorName'
  | 'creatorUsername'
  | 'locationName'
>;

type EventCardStickerProps = {
  event: EventCardStickerEvent;
  width: number;
};

export function EventCardSticker({ event, width }: EventCardStickerProps) {
  const height = width * 1.35;
  const radius = Math.max(24, width * 0.085);
  const horizontalPad = Math.max(14, width * 0.043);
  const titleFontSize = Math.max(18, width * 0.058);
  const metaFontSize = Math.max(12, width * 0.035);
  const creatorFontSize = Math.max(12, width * 0.035);

  const creatorLabel = getEventCreatorLabel(event as EventRecord);
  const creatorFirstName = creatorLabel.split(' ')[0] || creatorLabel;
  const eventTitle = event.title || 'Campus Event';
  const eventDate = event.date || 'Date TBA';
  const eventTime = event.time || 'Time TBA';

  return (
    <View style={[styles.shell, { width, height, borderRadius: radius }]}>
      <ImageBackground
        source={getEventImageSource(event.image)}
        style={styles.image}
        imageStyle={{ borderRadius: radius }}>
        <View style={styles.overlay} pointerEvents="none" />

        <View style={[styles.topContent, { paddingTop: horizontalPad, paddingHorizontal: horizontalPad }]}>
          <View style={styles.topRow}>
            <View style={styles.creatorCluster}>
              <View style={styles.creatorPill}>
                <Image
                  source={getAvatarImageSource(event.creatorAvatar)}
                  style={styles.creatorAvatar}
                />
                <Text
                  style={[styles.creatorName, { fontSize: creatorFontSize }]}
                  numberOfLines={1}>
                  {creatorFirstName}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.bottomContent,
            { left: horizontalPad, right: horizontalPad, bottom: Math.max(18, width * 0.06) },
          ]}>
          <View style={styles.infoPills}>
            <View style={[styles.titlePill, { borderRadius: Math.max(16, width * 0.045) }]}>
              <Text
                style={[styles.title, { fontSize: titleFontSize, lineHeight: titleFontSize * 1.16 }]}
                numberOfLines={2}>
                {eventTitle}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.infoPill}>
                <Ionicons
                  name="calendar-outline"
                  size={Math.max(14, width * 0.04)}
                  color="rgba(255,255,255,0.92)"
                />
                <Text
                  style={[styles.infoPillText, { fontSize: metaFontSize }]}
                  numberOfLines={1}>
                  {eventDate}
                </Text>
              </View>

              <View style={styles.infoPill}>
                <Ionicons
                  name="time-outline"
                  size={Math.max(14, width * 0.04)}
                  color="rgba(255,255,255,0.92)"
                />
                <Text
                  style={[styles.infoPillText, { fontSize: metaFontSize }]}
                  numberOfLines={1}>
                  {eventTime}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#0b0b0d',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 24,
  },
  image: {
    flex: 1,
    justifyContent: 'space-between',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Matches the real feed card's soft darkening so pills stay readable.
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  topContent: {
    zIndex: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    gap: 10,
  },
  creatorCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  creatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 11, 16, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '72%',
  },
  creatorAvatar: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
  },
  creatorName: {
    color: '#ffffff',
    fontWeight: '700',
    flexShrink: 1,
  },
  bottomContent: {
    position: 'absolute',
    zIndex: 2,
  },
  infoPills: {
    maxWidth: '78%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  titlePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#ffffff',
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoPillText: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '700',
  },
});
