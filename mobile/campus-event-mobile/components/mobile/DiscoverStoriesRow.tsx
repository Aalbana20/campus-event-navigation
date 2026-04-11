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
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Campus Pulse</Text>
          <Text style={styles.title}>Stories</Text>
        </View>
        <Text style={styles.note}>Hosts, friends, and suggestions.</Text>
      </View>

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
                {isCurrent ? 'Your Story' : item.name}
              </Text>
              <Text style={styles.storyMeta} numberOfLines={1}>
                {item.meta}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    panel: {
      borderRadius: 22,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 6,
    },
    heading: {
      gap: 2,
    },
    eyebrow: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    note: {
      flex: 1,
      maxWidth: 132,
      color: theme.textMuted,
      fontSize: 9,
      lineHeight: 12,
      textAlign: 'right',
    },
    track: {
      gap: 8,
      paddingRight: 2,
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
    storyMeta: {
      color: theme.textMuted,
      fontSize: 9,
      fontWeight: '600',
    },
  });
