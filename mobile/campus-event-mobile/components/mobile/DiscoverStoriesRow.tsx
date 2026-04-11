import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { MobileDiscoverStoryItem } from '@/lib/mobile-discover-social';
import { getAvatarImageUri } from '@/lib/mobile-media';

type DiscoverStoriesRowProps = {
  items: MobileDiscoverStoryItem[];
  onOpenStory?: (item: MobileDiscoverStoryItem) => void;
  onOpenSuggestion?: (item: MobileDiscoverStoryItem) => void;
};

const getStoryAvatarUri = (value: string) =>
  value.startsWith('data:image/') ? value : getAvatarImageUri(value);

export function DiscoverStoriesRow({
  items,
  onOpenStory,
  onOpenSuggestion,
}: DiscoverStoriesRowProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <View style={styles.panel}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.track}>
        {items.map((item) => {
          const isCurrent = item.kind === 'current';
          const isSuggested = item.kind === 'suggested';

          return (
            <Pressable
              key={item.id}
              style={styles.storyItem}
              onPress={() =>
                isSuggested ? onOpenSuggestion?.(item) : onOpenStory?.(item)
              }>
              <View
                style={[
                  styles.storyRing,
                  item.seen && styles.storyRingSeen,
                  isSuggested && styles.storyRingSuggested,
                  isCurrent && styles.storyRingCurrent,
                ]}>
                <Image
                  source={{ uri: getStoryAvatarUri(item.avatar) }}
                  style={styles.storyAvatar}
                />
              </View>

              {isCurrent ? (
                <View style={[styles.storyBadge, styles.storyBadgeCurrent]}>
                  <Text style={styles.storyBadgeText}>+</Text>
                </View>
              ) : null}

              {isSuggested ? (
                <View style={[styles.storyBadge, styles.storyBadgeSuggested]}>
                  <Text style={styles.storyBadgeText}>↗</Text>
                </View>
              ) : null}

              <Text style={styles.storyLabel} numberOfLines={1}>
                {isCurrent ? 'Your Story' : (item.username || item.name)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    panel: {
      paddingVertical: 8,
      width: '100%',
    },
    track: {
      gap: 12,
      paddingHorizontal: 16,
    },
    storyItem: {
      width: 60,
      alignItems: 'center',
      gap: 4,
    },
    storyRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      padding: 3,
      backgroundColor: '#2563eb',
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    storyRingSeen: {
      backgroundColor: '#98a2b3',
      shadowOpacity: 0,
    },
    storyRingSuggested: {
      backgroundColor: '#0f766e',
    },
    storyRingCurrent: {
      backgroundColor: theme.text,
    },
    storyAvatar: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 3,
      borderColor: theme.surface,
    },
    storyBadge: {
      position: 'absolute',
      right: 0,
      top: 38,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.surface,
    },
    storyBadgeCurrent: {
      backgroundColor: '#2563eb',
    },
    storyBadgeSuggested: {
      backgroundColor: '#0f766e',
    },
    storyBadgeText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
    },
    storyLabel: {
      color: theme.text,
      fontSize: 10,
      fontWeight: '700',
      maxWidth: 62,
    },
  });
