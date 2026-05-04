import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import type { ProfileRecord } from '@/types/models';
import { ProfileAvatarLink } from './ProfileAvatarLink';

type ProfileMutualsSheetProps = {
  visible: boolean;
  profiles: ProfileRecord[];
  title?: string;
  emptyTitle?: string;
  emptyCopy?: string;
  currentUserId?: string;
  onClose: () => void;
  onPressProfile?: (profile: ProfileRecord) => void;
  onPressMessage?: (profile: ProfileRecord) => void;
  isFollowingProfile?: (profileId: string) => boolean;
  onPressFollow?: (profile: ProfileRecord) => void;
  onPressUnfollow?: (profile: ProfileRecord) => void;
};

export function ProfileMutualsSheet({
  visible,
  profiles,
  title,
  emptyTitle = 'No mutual followers yet.',
  emptyCopy = "Once you both follow people in common, they'll show up here.",
  currentUserId,
  onClose,
  onPressProfile,
  onPressMessage,
  isFollowingProfile,
  onPressFollow,
  onPressUnfollow,
}: ProfileMutualsSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const resolvedTitle = title || (profiles.length === 1 ? 'Mutual' : 'Mutuals');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{resolvedTitle}</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {profiles.length > 0 ? (
              profiles.map((profile) => {
                const profileId = String(profile.id);
                const canShowFollowAction =
                  Boolean(isFollowingProfile && onPressFollow && onPressUnfollow) &&
                  profileId !== String(currentUserId || '');
                const isFollowing =
                  canShowFollowAction && isFollowingProfile
                    ? isFollowingProfile(profileId)
                    : false;

                return (
                  <View key={profile.id} style={styles.row}>
                    <Pressable
                      style={styles.identityButton}
                      onPress={() => onPressProfile?.(profile)}>
                      <ProfileAvatarLink profile={profile} style={styles.avatar} />
                      <View style={styles.identity}>
                        <Text style={styles.name} numberOfLines={1}>
                          {profile.name || profile.username || 'Campus User'}
                        </Text>
                        <Text style={styles.username} numberOfLines={1}>
                          {profile.username
                            ? `@${profile.username}`
                            : 'Campus Friend'}
                        </Text>
                      </View>
                    </Pressable>
                    {canShowFollowAction ? (
                      <Pressable
                        style={[
                          styles.messageButton,
                          isFollowing && styles.followingButton,
                        ]}
                        onPress={() =>
                          isFollowing
                            ? onPressUnfollow?.(profile)
                            : onPressFollow?.(profile)
                        }>
                        <Text
                          style={[
                            styles.messageButtonText,
                            !isFollowing && styles.followButtonText,
                          ]}>
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </Pressable>
                    ) : onPressMessage ? (
                      <Pressable
                        style={styles.messageButton}
                        onPress={() => onPressMessage(profile)}>
                        <Text style={styles.messageButtonText}>Message</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyCopy}>{emptyCopy}</Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 42,
      backgroundColor: 'rgba(6, 9, 15, 0.6)',
    },
    sheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 560,
      maxHeight: '76%',
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
    },
    handle: {
      alignSelf: 'center',
      width: 46,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 12,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
      flex: 1,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      gap: 10,
      paddingBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    identityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    name: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    username: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    messageButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    messageButtonText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '700',
    },
    followingButton: {
      backgroundColor: theme.surface,
    },
    followButtonText: {
      color: theme.accent,
    },
    emptyState: {
      paddingVertical: 26,
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
  });
