import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource } from '@/lib/mobile-media';
import type { ProfileRecord } from '@/types/models';

type EventMutualsSheetProps = {
  visible: boolean;
  title: string;
  profiles: ProfileRecord[];
  onClose: () => void;
};

export function EventMutualsSheet({
  visible,
  title,
  profiles,
  onClose,
}: EventMutualsSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Friends Going</Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <View key={profile.id} style={styles.row}>
                  <Image source={getAvatarImageSource(profile.avatar)} style={styles.avatar} />
                  <View style={styles.identity}>
                    <Text style={styles.name} numberOfLines={1}>
                      {profile.name || profile.username || 'Campus User'}
                    </Text>
                    <Text style={styles.username} numberOfLines={1}>
                      {profile.username ? `@${profile.username}` : 'Campus Friend'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No mutuals yet.</Text>
                <Text style={styles.emptyCopy}>
                  When friends RSVP, they will show up here.
                </Text>
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
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(6, 9, 15, 0.6)',
    },
    sheet: {
      maxHeight: '72%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
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
    headerCopy: {
      gap: 3,
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
    },
    headerMeta: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
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
