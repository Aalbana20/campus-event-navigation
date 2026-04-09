import React, { useMemo } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { EventRecord } from '@/types/models';

type ExploreEventTileProps = {
  event: EventRecord;
  onPress: () => void;
};

export function ExploreEventTile({ event, onPress }: ExploreEventTileProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <ImageBackground source={{ uri: event.image }} style={styles.media} imageStyle={styles.image}>
        <View style={styles.overlay} />
        <View style={styles.copy}>
          <Text style={styles.tag}>#{event.tags[0] || 'Explore'}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[event.date, event.locationName].filter(Boolean).join(' • ') || 'Campus Event'}
          </Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    tile: {
      width: '48.5%',
      aspectRatio: 0.82,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    media: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 12,
    },
    image: {
      borderRadius: 22,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.cardImageOverlay,
    },
    copy: {
      gap: 6,
    },
    tag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: 'hidden',
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
      backgroundColor: 'rgba(8, 11, 16, 0.72)',
    },
    title: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 19,
    },
    meta: {
      color: 'rgba(255, 255, 255, 0.88)',
      fontSize: 11,
      fontWeight: '600',
    },
  });
