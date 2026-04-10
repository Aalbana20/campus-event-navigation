import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import {
  pickProfileImage,
  type SelectedProfileImage,
} from '@/lib/mobile-profile-image';
import { useMobileApp } from '@/providers/mobile-app-provider';

import { AppScreen } from './AppScreen';
import { EventListCard } from './EventListCard';
import { PersonRowCard } from './PersonRowCard';

type ProfileScreenProps = {
  username?: string;
};

type ActiveList = 'followers' | 'following' | 'created' | null;
type ProfileTab = 'grid' | 'reposts' | 'tagged';
type EditFormState = {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
};

function StatButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={styles.statCard} onPress={onPress}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ProfileTabButton({
  active,
  icon,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);

  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Ionicons name={icon} size={22} color={active ? theme.text : theme.textMuted} />
      {active ? <View style={styles.tabIndicator} /> : null}
    </Pressable>
  );
}

export function ProfileScreen({ username }: ProfileScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    currentUser,
    getProfileByUsername,
    getFollowersForProfile,
    getFollowingForProfile,
    getCreatedEventsForProfile,
    getGoingEventsForProfile,
    getRepostedEventsForProfile,
    getTaggedMomentsForProfile,
    isFollowingProfile,
    followProfile,
    unfollowProfile,
    deleteEvent,
    updateProfile,
  } = useMobileApp();
  const [activeList, setActiveList] = useState<ActiveList>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [selectedAvatarImage, setSelectedAvatarImage] =
    useState<SelectedProfileImage | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    username: '',
    bio: '',
    avatarUrl: '',
  });

  const isOwnProfile = !username || username === currentUser.username;

  if (username && username === currentUser.username) {
    return <Redirect href="/(tabs)/profile" />;
  }

  const profile = isOwnProfile ? currentUser : getProfileByUsername(username || '');

  if (!profile) {
    return (
      <AppScreen>
        <View style={styles.centeredState}>
          <Text style={styles.centeredTitle}>Profile not found.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const followers = getFollowersForProfile(profile.id);
  const following = getFollowingForProfile(profile.id);
  const createdEvents = getCreatedEventsForProfile(profile.id);
  const repostedEvents = getRepostedEventsForProfile(profile.id);
  const taggedMoments = getTaggedMomentsForProfile(profile.id);
  const gridEvents = isOwnProfile ? getGoingEventsForProfile(profile.id) : createdEvents;

  const handleOpenProfile = (targetUsername: string) => {
    if (targetUsername === currentUser.username) {
      router.push('/(tabs)/profile');
      return;
    }

    router.push({
      pathname: '/profile/[username]',
      params: { username: targetUsername },
    });
  };

  const handleToggleFollow = () => {
    if (isFollowingProfile(profile.id)) {
      unfollowProfile(profile.id);
      return;
    }

    followProfile(profile.id);
  };

  const handleOpenEdit = () => {
    setEditForm({
      name: profile.name,
      username: profile.username,
      bio: profile.bio || '',
      avatarUrl: profile.avatar || '',
    });
    setSelectedAvatarImage(null);
    setIsEditing(true);
  };

  const handleCloseEdit = () => {
    if (isSaving) return;
    setIsEditing(false);
    setSelectedAvatarImage(null);
  };

  const handlePickAvatar = async () => {
    if (isSaving || isPickingAvatar) return;

    try {
      setIsPickingAvatar(true);
      const pickedImage = await pickProfileImage();

      if (!pickedImage) return;

      setSelectedAvatarImage(pickedImage);
    } catch (error) {
      Alert.alert(
        'Photo unavailable',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsPickingAvatar(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    const result = await updateProfile({
      ...editForm,
      avatarImage: selectedAvatarImage,
    });
    setIsSaving(false);
    if (result.ok) {
      setSelectedAvatarImage(null);
      setIsEditing(false);
    } else {
      Alert.alert('Unable to save', result.error || 'Please try again.');
    }
  };

  const editAvatarSource = selectedAvatarImage
    ? { uri: selectedAvatarImage.uri }
    : getAvatarImageSource(editForm.avatarUrl || profile.avatar);

  const renderEventTiles = () => {
    if (activeTab === 'tagged') {
      if (taggedMoments.length === 0) {
        return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Tagged moments will land here.</Text>
            <Text style={styles.emptyCopy}>
              Photos and videos from events you attend will appear here.
            </Text>
          </View>
        );
      }

      return (
        <View style={styles.mediaGrid}>
          {taggedMoments.map((moment) => (
            <View key={moment.id} style={styles.mediaTile}>
              <Image source={getEventImageSource(moment.image)} style={styles.mediaTileImage} />
              <View style={styles.mediaTileOverlay}>
                <Text style={styles.mediaTileTitle}>{moment.title}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    }

    const eventsToRender = activeTab === 'grid' ? gridEvents : repostedEvents;
    const emptyCopy =
      activeTab === 'grid'
        ? isOwnProfile
          ? 'Events you RSVP to will show up here.'
          : 'Public events by this user will show up here.'
        : 'Events this user reposts will show up here.';

    if (eventsToRender.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {activeTab === 'grid' ? 'Nothing here yet.' : 'No reposts yet.'}
          </Text>
          <Text style={styles.emptyCopy}>{emptyCopy}</Text>
        </View>
      );
    }

    return (
      <View style={styles.mediaGrid}>
        {eventsToRender.map((event) => (
          <Pressable
            key={event.id}
            style={styles.mediaTile}
            onPress={() =>
              router.push({
                pathname: '/event/[id]',
                params: { id: event.id },
              })
            }>
            <Image source={getEventImageSource(event.image)} style={styles.mediaTileImage} />
            <View style={styles.mediaTileOverlay}>
              <Text style={styles.mediaTileTitle} numberOfLines={1}>{event.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Image source={getAvatarImageSource(event.creatorAvatar)} style={{ width: 16, height: 16, borderRadius: 8 }} />
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                  {event.creatorName || event.organizer || 'Campus User'}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Image source={getAvatarImageSource(profile.avatar)} style={styles.avatar} />

            <View style={styles.headerCopy}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatButton label="Following" value={following.length} onPress={() => setActiveList('following')} />
            <StatButton label="Followers" value={followers.length} onPress={() => setActiveList('followers')} />
            <StatButton label="Events" value={createdEvents.length} onPress={() => setActiveList('created')} />
          </View>

          <View style={styles.actionRow}>
            {isOwnProfile ? (
              <>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleOpenEdit}>
                  <Text style={styles.secondaryButtonText}>Edit Profile</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => Alert.alert('Share Profile', `@${profile.username}`)}>
                  <Text style={styles.secondaryButtonText}>Share Profile</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryIconButton}
                  onPress={() => router.push('/settings')}>
                  <Ionicons name="settings-outline" size={18} color={theme.text} />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.primaryButton} onPress={handleToggleFollow}>
                  <Text style={styles.primaryButtonText}>
                    {isFollowingProfile(profile.id) ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/messages',
                      params: { dm: profile.id },
                    })
                  }>
                  <Text style={styles.secondaryButtonText}>Message</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.tabBar}>
          <ProfileTabButton
            active={activeTab === 'grid'}
            icon="grid-outline"
            onPress={() => setActiveTab('grid')}
          />
          <ProfileTabButton
            active={activeTab === 'reposts'}
            icon="repeat-outline"
            onPress={() => setActiveTab('reposts')}
          />
          <ProfileTabButton
            active={activeTab === 'tagged'}
            icon="camera-outline"
            onPress={() => setActiveTab('tagged')}
          />
        </View>

        {renderEventTiles()}
      </ScrollView>

      <Modal visible={activeList !== null} transparent animationType="slide" onRequestClose={() => setActiveList(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setActiveList(null)}>
          <Pressable style={styles.modalSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {activeList === 'followers'
                ? 'Followers'
                : activeList === 'following'
                  ? 'Following'
                  : 'Created Events'}
            </Text>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {activeList === 'followers' &&
                followers.map((follower) => (
                  <PersonRowCard
                    key={follower.id}
                    profile={follower}
                    actionLabel="Open"
                    onPress={() => handleOpenProfile(follower.username)}
                    onActionPress={() => handleOpenProfile(follower.username)}
                  />
                ))}

              {activeList === 'following' &&
                following.map((followingProfile) => (
                  <PersonRowCard
                    key={followingProfile.id}
                    profile={followingProfile}
                    actionLabel="Open"
                    onPress={() => handleOpenProfile(followingProfile.username)}
                    onActionPress={() => handleOpenProfile(followingProfile.username)}
                  />
                ))}

              {activeList === 'created' &&
                createdEvents.map((event) => (
                  <EventListCard
                    key={event.id}
                    event={event}
                    actionLabel={isOwnProfile ? 'Delete' : 'Open'}
                    actionTone={isOwnProfile ? 'danger' : 'muted'}
                    onPress={() =>
                      router.push({
                        pathname: '/event/[id]',
                        params: { id: event.id },
                      })
                    }
                    onActionPress={() => {
                      if (!isOwnProfile) {
                        router.push({
                          pathname: '/event/[id]',
                          params: { id: event.id },
                        });
                        return;
                      }

                      Alert.alert('Delete Event', `Delete "${event.title}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => deleteEvent(event.id),
                        },
                      ]);
                    }}
                  />
                ))}

              {activeList === 'followers' && followers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No followers yet.</Text>
                </View>
              ) : null}

              {activeList === 'following' && following.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Not following anyone yet.</Text>
                </View>
              ) : null}

              {activeList === 'created' && createdEvents.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No created events yet.</Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isEditing} transparent animationType="slide" onRequestClose={handleCloseEdit}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseEdit}>
          <Pressable style={styles.modalSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.avatarEditorCard}>
                <Image source={editAvatarSource} style={styles.editAvatarPreview} />

                <View style={styles.avatarEditorCopy}>
                  <Text style={styles.editLabel}>Profile Photo</Text>
                  <Text style={styles.avatarHelperText}>
                    {selectedAvatarImage
                      ? 'New photo selected. Save to update your profile.'
                      : 'Choose a photo from your device. Your current picture stays unless you save a new one.'}
                  </Text>
                  <Text style={styles.avatarMetaText}>Square crop, image files up to 8 MB.</Text>
                </View>
              </View>

              <View style={styles.avatarActionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => void handlePickAvatar()}
                  disabled={isSaving || isPickingAvatar}>
                  <Text style={styles.secondaryButtonText}>
                    {isPickingAvatar
                      ? 'Opening Photos...'
                      : selectedAvatarImage
                        ? 'Change Photo'
                        : 'Upload Photo'}
                  </Text>
                </Pressable>

                {selectedAvatarImage ? (
                  <Pressable
                    style={styles.tertiaryButton}
                    onPress={() => setSelectedAvatarImage(null)}
                    disabled={isSaving || isPickingAvatar}>
                    <Text style={styles.tertiaryButtonText}>Keep Current</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.editLabel}>Name</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.name}
                onChangeText={(text) => setEditForm((f) => ({ ...f, name: text }))}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={styles.editLabel}>Username</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.username}
                onChangeText={(text) => setEditForm((f) => ({ ...f, username: text }))}
                autoCapitalize="none"
                placeholder="username"
                placeholderTextColor={theme.textMuted}
              />

              <Text style={styles.editLabel}>Bio</Text>
              <TextInput
                style={[styles.editInput, styles.editTextarea]}
                value={editForm.bio}
                onChangeText={(text) => setEditForm((f) => ({ ...f, bio: text }))}
                multiline
                textAlignVertical="top"
                placeholder="A short bio..."
                placeholderTextColor={theme.textMuted}
              />

              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryButton} onPress={handleCloseEdit}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={handleSaveEdit} disabled={isSaving}>
                  <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    scrollContent: {
      padding: 18,
      gap: 18,
      paddingBottom: 120,
    },
    headerCard: {
      padding: 18,
      borderRadius: 28,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 18,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 28,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    name: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
    },
    username: {
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: '700',
    },
    bio: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 20,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 18,
      backgroundColor: theme.accent,
    },
    primaryButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryIconButton: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    tabButton: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 10,
      minWidth: 74,
    },
    tabIndicator: {
      width: 28,
      height: 2,
      borderRadius: 999,
      backgroundColor: theme.text,
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    mediaTile: {
      width: '48%',
      height: 176,
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: theme.surface,
    },
    mediaTileImage: {
      width: '100%',
      height: '100%',
    },
    mediaTileOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      padding: 12,
      backgroundColor: 'rgba(10, 14, 22, 0.28)',
    },
    mediaTileTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    mediaTileMeta: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    emptyCard: {
      padding: 22,
      borderRadius: 24,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
      alignItems: 'center',
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    centeredState: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    centeredTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    modalSheet: {
      maxHeight: '80%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.surface,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 24,
    },
    modalHandle: {
      alignSelf: 'center',
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 14,
    },
    modalContent: {
      gap: 12,
      paddingBottom: 22,
    },
    avatarEditorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 22,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    editAvatarPreview: {
      width: 84,
      height: 84,
      borderRadius: 28,
      backgroundColor: theme.background,
    },
    avatarEditorCopy: {
      flex: 1,
      gap: 6,
    },
    avatarHelperText: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    avatarMetaText: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    avatarActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 4,
    },
    editLabel: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 6,
    },
    editInput: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 14,
    },
    editTextarea: {
      minHeight: 96,
      paddingTop: 14,
    },
    tertiaryButton: {
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: theme.dangerSoft,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tertiaryButtonText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
  });
