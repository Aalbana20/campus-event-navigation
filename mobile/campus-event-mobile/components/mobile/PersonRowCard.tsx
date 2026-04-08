import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { ProfileRecord } from '@/types/models';

type PersonRowCardProps = {
  profile: ProfileRecord;
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function PersonRowCard({
  profile,
  onPress,
  actionLabel,
  onActionPress,
}: PersonRowCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: profile.avatar }} style={styles.avatar} />

      <View style={styles.copy}>
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        <Text style={styles.bio} numberOfLines={2}>
          {profile.bio}
        </Text>
      </View>

      {actionLabel ? (
        <Pressable style={styles.actionButton} onPress={onActionPress}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    name: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    username: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    bio: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    actionButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    actionText: {
      color: theme.background,
      fontSize: 13,
      fontWeight: '700',
    },
  });
