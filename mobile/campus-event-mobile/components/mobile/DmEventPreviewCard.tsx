import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { getEventCreatorLabel } from '@/lib/mobile-backend';
import { getEventImageSource } from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DmEventPreviewCardProps = {
  event: EventRecord;
  onPress: () => void;
};

export function DmEventPreviewCard({ event, onPress }: DmEventPreviewCardProps) {
  const creatorLabel = getEventCreatorLabel(event);
  const creatorFirstName = creatorLabel.split(' ')[0] || creatorLabel;
  const title = event.title || 'Campus Event';
  const date = event.date || 'Date TBA';
  const time = event.time || 'Time TBA';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <ImageBackground
        source={getEventImageSource(event.image)}
        style={styles.image}
        imageStyle={styles.imageStyle}>
        <View style={styles.overlay} pointerEvents="none" />

        <View style={styles.topContent}>
          <View style={styles.creatorPill}>
            <ProfileAvatarLink
              profile={{
                id: event.createdBy,
                username: event.creatorUsername,
                name: creatorLabel,
                avatar: event.creatorAvatar,
              }}
              style={styles.creatorAvatar}
            />
            <Text style={styles.creatorName} numberOfLines={1}>
              {creatorFirstName}
            </Text>
          </View>
        </View>

        <View style={styles.bottomContent}>
          <View style={styles.titlePill}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.infoPill}>
              <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.92)" />
              <Text style={styles.infoPillText} numberOfLines={1}>
                {date}
              </Text>
            </View>
            <View style={styles.infoPill}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.92)" />
              <Text style={styles.infoPillText} numberOfLines={1}>
                {time}
              </Text>
            </View>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const CARD_WIDTH = 224;
const CARD_HEIGHT = 300;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  image: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 10,
  },
  imageStyle: {
    borderRadius: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 4,
    paddingRight: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 11, 16, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '78%',
  },
  creatorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  creatorName: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomContent: {
    gap: 5,
  },
  titlePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoPillText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 11,
    fontWeight: '700',
  },
});
