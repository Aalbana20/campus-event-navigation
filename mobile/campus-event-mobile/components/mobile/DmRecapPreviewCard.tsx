import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DmRecapAttachmentPayload } from '@/lib/mobile-dm-content';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DmRecapPreviewCardProps = {
  recap: DmRecapAttachmentPayload['recap'];
  onPress: () => void;
};

export function DmRecapPreviewCard({ recap, onPress }: DmRecapPreviewCardProps) {
  const previewUri = recap.thumbnailUrl || recap.mediaUrl || recap.eventImage || '';
  const creatorLabel = recap.authorUsername
    ? `@${recap.authorUsername}`
    : recap.authorName || 'Campus';
  const caption = (recap.caption || '').trim();

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {previewUri ? (
        <ImageBackground
          source={{ uri: previewUri }}
          style={styles.image}
          imageStyle={styles.imageStyle}>
          <RecapCardContent
            recap={recap}
            creatorLabel={creatorLabel}
            caption={caption}
          />
        </ImageBackground>
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <RecapCardContent
            recap={recap}
            creatorLabel={creatorLabel}
            caption={caption}
          />
        </View>
      )}
    </Pressable>
  );
}

function RecapCardContent({
  recap,
  creatorLabel,
  caption,
}: {
  recap: DmRecapAttachmentPayload['recap'];
  creatorLabel: string;
  caption: string;
}) {
  return (
    <>
      <View style={styles.overlay} pointerEvents="none" />

      <View style={styles.topContent}>
        <View style={styles.creatorPill}>
          <ProfileAvatarLink
            profile={{
              id: recap.authorId || '',
              username: recap.authorUsername,
              name: recap.authorName || creatorLabel,
              avatar: recap.authorAvatar,
            }}
            style={styles.creatorAvatar}
          />
          <Text style={styles.creatorName} numberOfLines={1}>
            {creatorLabel}
          </Text>
        </View>
      </View>

      <View style={styles.bottomContent}>
        {recap.eventTitle ? (
          <View style={styles.eventPill}>
            <Ionicons name="pricetag-outline" size={12} color="rgba(255,255,255,0.94)" />
            <Text style={styles.eventPillText} numberOfLines={1}>
              {recap.eventTitle}
            </Text>
          </View>
        ) : null}
        {caption ? (
          <View style={styles.titlePill}>
            <Text style={styles.title} numberOfLines={2}>
              {caption}
            </Text>
          </View>
        ) : null}
        <View style={styles.infoPill}>
          <Ionicons name="images-outline" size={12} color="rgba(255,255,255,0.92)" />
          <Text style={styles.infoPillText} numberOfLines={1}>
            Recap
          </Text>
        </View>
      </View>
    </>
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
  imageFallback: {
    backgroundColor: '#111316',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.34)',
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
    alignItems: 'flex-start',
    gap: 5,
  },
  titlePill: {
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
  eventPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  eventPillText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 11,
    fontWeight: '700',
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
