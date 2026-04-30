import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageUri } from '@/lib/mobile-media';
import type { MobileStoryStripItem } from '@/lib/mobile-stories';

type DiscoverStoriesRowProps = {
  items: MobileStoryStripItem[];
  onOpenStory?: (item: MobileStoryStripItem) => void;
  onOpenSuggestion?: (item: MobileStoryStripItem) => void;
  onOpenCreateStory?: () => void;
};

const getStoryAvatarUri = (value: string) =>
  value.startsWith('data:image/') ? value : getAvatarImageUri(value);

export function DiscoverStoriesRow({
  items,
  onOpenStory,
  onOpenSuggestion,
  onOpenCreateStory,
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
            <View key={item.id} style={styles.storyItem}>
              <Pressable
                style={styles.storyPressable}
                onPress={() => {
                  if (isSuggested) {
                    onOpenSuggestion?.(item);
                    return;
                  }

                  if (isCurrent && item.stories.length === 0) {
                    onOpenCreateStory?.();
                    return;
                  }

                  onOpenStory?.(item);
                }}>
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

              </Pressable>

            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    panel: {
      paddingTop: 2,
      paddingBottom: 0,
      width: '100%',
    },
    track: {
      gap: 10,
      paddingHorizontal: 16,
    },
    storyItem: {
      width: 56,
      alignItems: 'center',
    },
    storyPressable: {
      alignItems: 'center',
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
  });
