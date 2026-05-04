import React, { useMemo } from 'react';
import {
  Image,
  Text,
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
  onOpenCreateStory?: () => void;
};

const getStoryAvatarUri = (value: string) =>
  value.startsWith('data:image/') ? value : getAvatarImageUri(value);

export function DiscoverStoriesRow({
  items,
  onOpenStory,
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

          return (
            <View key={item.id} style={styles.storyItem}>
              <Pressable
                style={styles.storyPressable}
                onPress={() => {
                  if (isCurrent && item.stories.length === 0) {
                    onOpenCreateStory?.();
                    return;
                  }

                  onOpenStory?.(item);
                }}>
                <View
                  style={[
                    styles.storyTile,
                    item.seen && styles.storyTileSeen,
                    isCurrent && styles.storyTileCurrent,
                  ]}>
                  <Image
                    source={{ uri: getStoryAvatarUri(item.avatar) }}
                    style={styles.storyImage}
                  />
                  {isCurrent && item.stories.length === 0 ? (
                    <View style={styles.storyPlusBadge}>
                      <Text style={styles.storyPlusText}>+</Text>
                    </View>
                  ) : null}
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
      gap: 11,
      paddingHorizontal: 16,
    },
    storyItem: {
      width: 58,
      alignItems: 'center',
    },
    storyPressable: {
      alignItems: 'center',
    },
    storyTile: {
      width: 56,
      height: 56,
      borderRadius: 15,
      padding: 2,
      backgroundColor: theme.accent,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    storyTileSeen: {
      backgroundColor: theme.surfaceAlt,
      borderColor: theme.border,
      shadowOpacity: 0,
    },
    storyTileCurrent: {
      backgroundColor: theme.surface,
      borderColor: theme.accent,
    },
    storyImage: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.surface,
    },
    storyPlusBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      borderWidth: 2,
      borderColor: theme.background,
    },
    storyPlusText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 17,
    },
  });
