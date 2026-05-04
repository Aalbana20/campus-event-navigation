import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { MobileDiscoverFriendCard } from '@/lib/mobile-discover-social';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type DiscoverFriendsPanelProps = {
  items: MobileDiscoverFriendCard[];
  followingIds: Set<string>;
  onOpenPerson: (person: MobileDiscoverFriendCard) => void;
  onToggleFollow: (person: MobileDiscoverFriendCard, isFollowing: boolean) => void;
};

export function DiscoverFriendsPanel({
  items,
  followingIds,
  onOpenPerson,
  onToggleFollow,
}: DiscoverFriendsPanelProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Social Discovery</Text>
          <Text style={styles.title}>Friends</Text>
        </View>
        <Text style={styles.note}>
          People shaping campus plans, reposting energy, and worth following next.
        </Text>
      </View>

      <View style={styles.list}>
        {items.map((person) => {
          const isFollowing =
            person.canToggleFollow && followingIds.has(String(person.profileId));

          return (
            <View
              key={person.id}
              style={[styles.card, person.featured && styles.cardFeatured]}>
              <Pressable
                style={styles.cardMain}
                onPress={() => onOpenPerson(person)}
                disabled={!person.routeKey}>
                <View style={styles.cardTop}>
                  <View style={styles.identity}>
                    <ProfileAvatarLink
                      profile={{
                        id: person.profileId,
                        username: person.username,
                        name: person.name,
                        avatar: person.avatar,
                      }}
                      style={styles.avatar}
                    />

                    <View style={styles.nameWrap}>
                      <Text style={styles.name}>{person.name}</Text>
                      {person.username ? (
                        <Text style={styles.username}>@{person.username}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{person.badge}</Text>
                  </View>
                </View>

                <Text style={styles.headline}>{person.headline}</Text>
                <Text style={styles.context}>{person.context}</Text>

                <View style={styles.metaRow}>
                  {person.metaItems.map((item) => (
                    <View key={`${person.id}-${item}`} style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.actionButton,
                  isFollowing && styles.actionButtonActive,
                  !person.canToggleFollow && styles.actionButtonDisabled,
                ]}
                onPress={() => onToggleFollow(person, isFollowing)}
                disabled={!person.canToggleFollow}>
                <Text
                  style={[
                    styles.actionButtonText,
                    isFollowing && styles.actionButtonTextActive,
                    !person.canToggleFollow && styles.actionButtonTextDisabled,
                  ]}>
                  {person.canToggleFollow
                    ? isFollowing
                      ? 'Following'
                      : 'Follow'
                    : 'Suggested'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    panel: {
      gap: 16,
    },
    header: {
      gap: 10,
    },
    headerCopy: {
      gap: 4,
    },
    eyebrow: {
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    note: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    list: {
      gap: 14,
      paddingBottom: 12,
    },
    card: {
      borderRadius: 28,
      padding: 18,
      gap: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 2,
    },
    cardFeatured: {
      backgroundColor: theme.surface,
    },
    cardMain: {
      gap: 14,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.surfaceAlt,
    },
    nameWrap: {
      flex: 1,
      gap: 3,
    },
    name: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    username: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    badge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.accentSoft,
    },
    badgeText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: '800',
    },
    headline: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    context: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaPill: {
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 8,
      backgroundColor: theme.surfaceAlt,
    },
    metaPillText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    actionButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    actionButtonActive: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonDisabled: {
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonText: {
      color: theme.background,
      fontSize: 13,
      fontWeight: '800',
    },
    actionButtonTextActive: {
      color: theme.text,
    },
    actionButtonTextDisabled: {
      color: theme.textMuted,
    },
  });
