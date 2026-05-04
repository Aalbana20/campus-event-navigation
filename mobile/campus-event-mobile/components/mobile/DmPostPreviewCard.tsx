import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DmPostAttachmentPayload } from '@/lib/mobile-dm-content';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DmPostPreviewCardProps = {
  post: DmPostAttachmentPayload['post'];
  onPress: () => void;
};

export function DmPostPreviewCard({ post, onPress }: DmPostPreviewCardProps) {
  const isVideo = post.mediaType === 'video';
  const previewUri = post.thumbnailUrl || post.mediaUrl || '';
  const creatorLabel = post.authorUsername
    ? `@${post.authorUsername}`
    : post.authorName || 'Campus';
  const caption = (post.caption || '').trim();

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <ImageBackground
        source={previewUri ? { uri: previewUri } : undefined}
        style={styles.image}
        imageStyle={styles.imageStyle}>
        <View style={styles.overlay} pointerEvents="none" />

        <View style={styles.topContent}>
          <View style={styles.creatorPill}>
            <ProfileAvatarLink
              profile={{
                id: post.authorId || '',
                username: post.authorUsername,
                name: post.authorName || creatorLabel,
                avatar: post.authorAvatar,
              }}
              style={styles.creatorAvatar}
            />
            <Text style={styles.creatorName} numberOfLines={1}>
              {creatorLabel}
            </Text>
          </View>
        </View>

        {isVideo ? (
          <View style={styles.playBadge} pointerEvents="none">
            <Ionicons name="play" size={22} color="#ffffff" />
          </View>
        ) : null}

        <View style={styles.bottomContent}>
          {caption ? (
            <View style={styles.titlePill}>
              <Text style={styles.title} numberOfLines={2}>
                {caption}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.infoPill}>
              <Ionicons
                name={isVideo ? 'videocam-outline' : 'image-outline'}
                size={12}
                color="rgba(255,255,255,0.92)"
              />
              <Text style={styles.infoPillText} numberOfLines={1}>
                {isVideo ? 'Video' : 'Post'}
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
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
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
