import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { StoryHighlightRecord } from '@/lib/mobile-story-highlights';

type ProfileHighlightsRowProps = {
  highlights: StoryHighlightRecord[];
  isOwner: boolean;
  onPressHighlight: (highlight: StoryHighlightRecord) => void;
  onPressNew: () => void;
  onLongPressHighlight?: (highlight: StoryHighlightRecord) => void;
};

// Rounded squares — NOT circles — at roughly Instagram highlight size (~72pt).
// Soft 18pt radius so corners read as "squircle" rather than sharp.
const TILE_SIZE = 72;
const TILE_RADIUS = 18;

export function ProfileHighlightsRow({
  highlights,
  isOwner,
  onPressHighlight,
  onPressNew,
  onLongPressHighlight,
}: ProfileHighlightsRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  if (!isOwner && highlights.length === 0) {
    // Nothing to show on someone else's empty profile — collapse the row.
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {isOwner ? (
        <Pressable
          style={styles.tileWrap}
          onPress={onPressNew}
          accessibilityLabel="Create a new highlight">
          <View style={[styles.tile, styles.newTile]}>
            <Ionicons name="add" size={30} color={theme.text} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            New
          </Text>
        </Pressable>
      ) : null}

      {highlights.map((highlight) => (
        <Pressable
          key={highlight.id}
          style={styles.tileWrap}
          onPress={() => onPressHighlight(highlight)}
          onLongPress={
            onLongPressHighlight ? () => onLongPressHighlight(highlight) : undefined
          }
          accessibilityLabel={`Open ${highlight.title} highlight`}>
          <View style={styles.tile}>
            {highlight.coverUrl ? (
              <ExpoImage
                source={{ uri: highlight.coverUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.tileFallback]}>
                <Ionicons name="image-outline" size={26} color={theme.textMuted} />
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {highlight.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const isDark = theme.background === '#05070b' || theme.background === '#000000';
  const surfaceAlt = isDark ? '#1a1a1c' : theme.surfaceAlt;
  const border = isDark ? 'rgba(255,255,255,0.12)' : theme.border;

  return StyleSheet.create({
    row: {
      gap: 14,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    tileWrap: {
      width: TILE_SIZE,
      alignItems: 'center',
      gap: 6,
    },
    tile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: TILE_RADIUS,
      overflow: 'hidden',
      backgroundColor: surfaceAlt,
      borderWidth: 1,
      borderColor: border,
    },
    newTile: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surfaceAlt,
      borderStyle: 'dashed',
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : theme.border,
    },
    tileFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surfaceAlt,
    },
    label: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '700',
      maxWidth: TILE_SIZE + 8,
      textAlign: 'center',
    },
  });
};
