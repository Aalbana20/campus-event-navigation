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
        <View>
          <Text style={styles.eyebrow}>Campus Pulse</Text>
          <Text style={styles.title}>Stories</Text>
        </View>
        <Text style={styles.note}>People, hosts, and suggestions worth checking between events.</Text>
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
      borderRadius: 28,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
    },
    eyebrow: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      color: theme.text,
      fontSize: 23,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    note: {
      flex: 1,
      maxWidth: 190,
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'right',
    },
    track: {
      gap: 14,
      paddingRight: 6,
    },
    storyItem: {
      width: 78,
      alignItems: 'center',
      gap: 7,
    },
    storyRing: {
      width: 74,
      height: 74,
      borderRadius: 37,
      padding: 3,
      backgroundColor: '#2563eb',
      shadowColor: theme.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 7 },
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
      right: 2,
      top: 52,
      width: 24,
      height: 24,
      borderRadius: 12,
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
      fontSize: 13,
      fontWeight: '800',
    },
    storyLabel: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
      maxWidth: 80,
    },
    storyMeta: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
  });
