import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getEventCreatorLabel } from '@/lib/mobile-backend';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import type { EventRecord } from '@/types/models';

type DiscoverVideoFeedProps = {
  events: EventRecord[];
  savedIds: Set<string>;
  onPressHeart: (event: EventRecord) => void;
  onPressComment: (event: EventRecord) => void;
  onPressRepost: (event: EventRecord) => void;
  onPressShare: (event: EventRecord) => void;
};

export function DiscoverVideoFeed({
  events,
  savedIds,
  onPressHeart,
  onPressComment,
  onPressRepost,
  onPressShare,
}: DiscoverVideoFeedProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [feedHeight, setFeedHeight] = useState(0);

  if (!events || events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No videos right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={(e) => setFeedHeight(e.nativeEvent.layout.height)}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        renderItem={({ item }) => (
          <DiscoverVideoItem
            event={item}
            height={feedHeight}
            isSaved={savedIds.has(String(item.id))}
            onPressHeart={onPressHeart}
            onPressComment={onPressComment}
            onPressRepost={onPressRepost}
            onPressShare={onPressShare}
            styles={styles}
          />
        )}
      />
    </View>
  );
}

function DiscoverVideoItem({
  event,
  height,
  isSaved,
  onPressHeart,
  onPressComment,
  onPressRepost,
  onPressShare,
  styles,
}: {
  event: EventRecord;
  height: number;
  isSaved: boolean;
  onPressHeart: (event: EventRecord) => void;
  onPressComment: (event: EventRecord) => void;
  onPressRepost: (event: EventRecord) => void;
  onPressShare: (event: EventRecord) => void;
  styles: any;
}) {
  return (
    <View style={[{ height, width: '100%' }]}>
      <ImageBackground
        source={getEventImageSource(event.image)}
        style={styles.media}
        imageStyle={styles.mediaImage}
      >
        <View style={styles.gradientOverlay} />

        {/* Right Social Rail */}
        <View style={styles.rightRail}>
          <Pressable style={styles.actionButton} onPress={() => onPressHeart(event)}>
            <Ionicons name={isSaved ? "heart" : "heart-outline"} size={32} color={isSaved ? "#ff3b30" : "#ffffff"} />
            <Text style={styles.actionText}>{isSaved ? '1' : '0'}</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => onPressComment(event)}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#ffffff" />
            <Text style={styles.actionText}>0</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => onPressRepost(event)}>
            <Ionicons name="repeat" size={32} color="#ffffff" />
            <Text style={styles.actionText}>0</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => onPressShare(event)}>
            <Ionicons name="paper-plane-outline" size={30} color="#ffffff" />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
        </View>

        {/* Bottom Content/Meta Zone */}
        <View style={styles.bottomArea}>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              <Image source={getAvatarImageSource(event.creatorAvatar)} style={styles.avatar} />
              <View style={styles.followBadge}>
                <Ionicons name="add" size={12} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.creatorName}>{getEventCreatorLabel(event)}</Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
          {event.description ? (
            <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
          ) : null}

          <View style={styles.audioRow}>
            <Ionicons name="musical-note" size={14} color="#ffffff" />
            <Text style={styles.audioText} numberOfLines={1}>
              Original Audio - {getEventCreatorLabel(event)}
            </Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    emptyContainer: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 16,
      fontWeight: '600',
    },
    media: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    mediaImage: {
      resizeMode: 'cover',
    },
    gradientOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    rightRail: {
      position: 'absolute',
      right: 12,
      bottom: 90,
      alignItems: 'center',
      gap: 22,
      zIndex: 10,
    },
    actionButton: {
      alignItems: 'center',
      gap: 4,
    },
    actionText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    bottomArea: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingRight: 70,
      gap: 12,
      zIndex: 10,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: '#ffffff',
    },
    followBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: '#ff3b30',
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#ffffff',
    },
    creatorName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    title: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 22,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    description: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      lineHeight: 20,
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    audioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      marginTop: 4,
    },
    audioText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600',
    },
  });