import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { shareEventRecord } from '@/lib/mobile-event-share';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useMobileInbox } from '@/providers/mobile-inbox-provider';
import { EventRecord, ProfileRecord } from '@/types/models';

type EventActionSheetProps = {
  event: EventRecord;
  visible: boolean;
  onClose: () => void;
};

const getUniqueProfiles = (profiles: ProfileRecord[]) => {
  const seen = new Set<string>();

  return profiles.filter((profile) => {
    if (seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
};

export function EventActionSheet({ event, visible, onClose }: EventActionSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { followingProfiles, recentDmPeople, repostEvent } = useMobileApp();
  const { sendDmMessage } = useMobileInbox();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const eventLink = ExpoLinking.createURL(`/event/${event.id}`);
  const normalizedQuery = query.trim().toLowerCase();

  const allPeople = getUniqueProfiles([...recentDmPeople, ...followingProfiles]);

  const filteredRecent = recentDmPeople.filter((profile) =>
    `${profile.name} ${profile.username}`.toLowerCase().includes(normalizedQuery)
  );

  const filteredFollowing = followingProfiles.filter(
    (profile) =>
      !recentDmPeople.some((recentProfile) => recentProfile.id === profile.id) &&
      `${profile.name} ${profile.username}`.toLowerCase().includes(normalizedQuery)
  );

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(eventLink);
    onClose();
  };

  const handleShareTo = async () => {
    try {
      await shareEventRecord(event);
    } catch {
      Alert.alert('Share', 'The native share sheet is not available right now.');
    } finally {
      onClose();
    }
  };

  const handleMessage = () => {
    if (allPeople.length === 0) {
      onClose();
    }
    // People list is rendered below — tapping a person sends the event via handleSendToProfile
  };

  const handleRepost = () => {
    repostEvent(event.id);
    onClose();
  };

  const handleSendToProfile = async (profile: ProfileRecord) => {
    await sendDmMessage(
      profile.id,
      `Check out ${event.title}.\n${[event.date, event.time, event.locationName]
        .filter(Boolean)
        .join(' • ')}`
    );

    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(eventPress) => eventPress.stopPropagation()}>
          <View style={styles.handle} />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            placeholderTextColor={theme.textMuted}
            style={styles.searchInput}
          />

          <View style={styles.preview}>
            <Image source={getEventImageSource(event.image)} style={styles.previewImage} />
            <View style={styles.previewCopy}>
              <Text style={styles.previewTitle}>{event.title}</Text>
              <Text style={styles.previewMeta} numberOfLines={2}>
                {[event.date, event.locationName, event.host || event.organizer].filter(Boolean).join(' • ')}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.peopleBody} showsVerticalScrollIndicator={false}>
            {filteredRecent.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Recent</Text>
                <View style={styles.peopleGrid}>
                  {filteredRecent.map((profile) => (
                    <Pressable
                      key={`recent-${profile.id}`}
                      style={styles.personButton}
                      onPress={() => void handleSendToProfile(profile)}>
                      <Image source={getAvatarImageSource(profile.avatar)} style={styles.personAvatar} />
                      <Text style={styles.personName} numberOfLines={2}>
                        @{profile.username}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {filteredFollowing.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Following</Text>
                <View style={styles.peopleGrid}>
                  {filteredFollowing.map((profile) => (
                    <Pressable
                      key={`following-${profile.id}`}
                      style={styles.personButton}
                      onPress={() => void handleSendToProfile(profile)}>
                      <Image source={getAvatarImageSource(profile.avatar)} style={styles.personAvatar} />
                      <Text style={styles.personName} numberOfLines={2}>
                        @{profile.username}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {filteredRecent.length === 0 && filteredFollowing.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No people matched that search.</Text>
                <Text style={styles.emptyCopy}>Following and recent DM contacts will appear here.</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionButton} onPress={handleCopyLink}>
              <Text style={styles.actionButtonText}>Copy Link</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleShareTo}>
              <Text style={styles.actionButtonText}>Share to</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleMessage}>
              <Text style={styles.actionButtonText}>Message</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleRepost}>
              <Text style={styles.actionButtonText}>Repost</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
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
      backgroundColor: theme.overlay,
    },
    sheet: {
      maxHeight: '86%',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.surface,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 4,
    },
    searchInput: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 15,
      fontWeight: '500',
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 2,
    },
    previewImage: {
      width: 58,
      height: 58,
      borderRadius: 18,
    },
    previewCopy: {
      flex: 1,
      gap: 3,
    },
    previewTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    previewMeta: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    peopleBody: {
      maxHeight: 320,
    },
    section: {
      marginBottom: 16,
      gap: 12,
    },
    sectionLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    peopleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    personButton: {
      width: 76,
      alignItems: 'center',
      gap: 8,
    },
    personAvatar: {
      width: 62,
      height: 62,
      borderRadius: 31,
    },
    personName: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 16,
    },
    emptyState: {
      paddingVertical: 24,
      alignItems: 'center',
      gap: 6,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    actionButton: {
      flexGrow: 1,
      minWidth: '47%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    actionButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    cancelButton: {
      minWidth: '100%',
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    cancelButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '700',
    },
  });
