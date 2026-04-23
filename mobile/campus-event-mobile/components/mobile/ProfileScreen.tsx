import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { getAvatarImageSource } from '@/lib/mobile-media';
import {
  pickProfileImage,
  type SelectedProfileImage,
} from '@/lib/mobile-profile-image';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventPrivacy, EventRecord } from '@/types/models';

import { AppScreen } from './AppScreen';
import { EventListCard } from './EventListCard';
import { PersonRowCard } from './PersonRowCard';
import { ProfileContentTabs } from './ProfileContentTabs';

type ProfileScreenProps = {
  username?: string;
};

type ActiveList = 'followers' | 'following' | 'created' | null;
type ProfileContentCounts = {
  posts: number;
};
type EditFormState = {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
};
type EditEventFormState = {
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  locationAddress: string;
  host: string;
  dressCode: string;
  tagsText: string;
  privacy: EventPrivacy;
  image: string;
};

const toEditEventForm = (event: EventRecord): EditEventFormState => ({
  title: event.title || '',
  description: event.description || '',
  eventDate: event.eventDate || '',
  startTime: event.startTime || '',
  endTime: event.endTime || '',
  locationName: event.locationName || '',
  locationAddress: event.locationAddress || '',
  host: event.host || event.organizer || '',
  dressCode: event.dressCode || '',
  tagsText: (event.tags || []).join(', '),
  privacy: event.privacy || 'public',
  image: event.image || '',
});

const parseEditEventTags = (value: string): string[] =>
  value
    .split(',')
    .map((tag) => tag.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'))
    .filter(Boolean);

function StatButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const isInteractive = Boolean(onPress);

  return (
    <Pressable
      style={[styles.statCard, !isInteractive && styles.statCardStatic]}
      onPress={onPress}
      disabled={!isInteractive}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    isFollowingProfile,
    followProfile,
    unfollowProfile,
    deleteEvent,
    updateEvent,
    updateProfile,
  } = useMobileApp();
  const [activeList, setActiveList] = useState<ActiveList>(null);

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

  // Edit Event State (for Created Events → Edit)
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventForm, setEditEventForm] = useState<EditEventFormState | null>(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [profileContentCounts, setProfileContentCounts] =
    useState<ProfileContentCounts>({ posts: 0 });
  const handleProfileContentCountsChange = useCallback(
    (counts: Partial<ProfileContentCounts>) => {
      setProfileContentCounts((currentCounts) => ({
        ...currentCounts,
        ...counts,
      }));
    },
    []
  );

  const isOwnProfile = !username || username === currentUser.username;
  const resolvedProfile = isOwnProfile
    ? currentUser
    : getProfileByUsername(username || '');
  const resolvedProfileId = resolvedProfile?.id || '';

  if (username && username === currentUser.username) {
    return <Redirect href="/(tabs)/profile" />;
  }

  const profile = resolvedProfile;

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

  const handleOpenEditEvent = (event: EventRecord) => {
    setEditingEventId(event.id);
    setEditEventForm(toEditEventForm(event));
    setActiveList(null);
  };

  const handleCloseEditEvent = () => {
    if (isSavingEvent) return;
    setEditingEventId(null);
    setEditEventForm(null);
  };

  const handleSaveEditEvent = async () => {
    if (!editingEventId || !editEventForm) return;

    setIsSavingEvent(true);
    const result = await updateEvent(editingEventId, {
      title: editEventForm.title,
      description: editEventForm.description,
      date: '',
      eventDate: editEventForm.eventDate,
      startTime: editEventForm.startTime,
      endTime: editEventForm.endTime,
      locationName: editEventForm.locationName,
      locationAddress: editEventForm.locationAddress,
      host: editEventForm.host,
      dressCode: editEventForm.dressCode,
      tags: parseEditEventTags(editEventForm.tagsText),
      privacy: editEventForm.privacy,
      image: editEventForm.image,
    });
    setIsSavingEvent(false);

    if (!result) {
      Alert.alert('Unable to save', 'The event could not be updated right now.');
      return;
    }

    setEditingEventId(null);
    setEditEventForm(null);
    Alert.alert(
      'Event updated',
      'RSVP\u2019d guests will be notified of the changes.'
    );
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

  return (
    <AppScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Image source={getAvatarImageSource(profile.avatar)} style={styles.avatar} />

            <View style={styles.headerCopy}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatButton label="Followers" value={followers.length} onPress={() => setActiveList('followers')} />
            <StatButton label="Following" value={following.length} onPress={() => setActiveList('following')} />
            <StatButton label="Host" value={createdEvents.length} onPress={() => setActiveList('created')} />
            <StatButton label="Posts" value={profileContentCounts.posts} />
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

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

        <ProfileContentTabs
          profileId={resolvedProfileId}
          isOwner={isOwnProfile}
          onContentCountsChange={handleProfileContentCountsChange}
        />
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
                  : 'Hosted Events'}
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
                    secondaryActionLabel={isOwnProfile ? 'Edit' : undefined}
                    secondaryActionTone="muted"
                    onPress={() =>
                      router.push({
                        pathname: '/event/[id]',
                        params: { id: event.id },
                      })
                    }
                    onSecondaryActionPress={
                      isOwnProfile ? () => handleOpenEditEvent(event) : undefined
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

      <Modal
        visible={editingEventId !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEditEvent}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseEditEvent}>
          <Pressable style={styles.modalSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Event</Text>

            {editEventForm ? (
              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <Text style={styles.editLabel}>Title</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.title}
                  onChangeText={(text) =>
                    setEditEventForm((form) => (form ? { ...form, title: text } : form))
                  }
                  placeholder="Event title"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={styles.editLabel}>Description</Text>
                <TextInput
                  style={[styles.editInput, styles.editTextarea]}
                  value={editEventForm.description}
                  onChangeText={(text) =>
                    setEditEventForm((form) => (form ? { ...form, description: text } : form))
                  }
                  multiline
                  textAlignVertical="top"
                  placeholder="What's the vibe?"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={styles.editLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.eventDate}
                  onChangeText={(text) =>
                    setEditEventForm((form) => (form ? { ...form, eventDate: text } : form))
                  }
                  placeholder="2026-05-01"
                  placeholderTextColor={theme.textMuted}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>Start Time</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editEventForm.startTime}
                      onChangeText={(text) =>
                        setEditEventForm((form) =>
                          form ? { ...form, startTime: text } : form
                        )
                      }
                      placeholder="19:00"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editLabel}>End Time</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editEventForm.endTime}
                      onChangeText={(text) =>
                        setEditEventForm((form) =>
                          form ? { ...form, endTime: text } : form
                        )
                      }
                      placeholder="21:00"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                <Text style={styles.editLabel}>Location Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.locationName}
                  onChangeText={(text) =>
                    setEditEventForm((form) =>
                      form ? { ...form, locationName: text } : form
                    )
                  }
                  placeholder="Student Center Ballroom"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={styles.editLabel}>Address</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.locationAddress}
                  onChangeText={(text) =>
                    setEditEventForm((form) =>
                      form ? { ...form, locationAddress: text } : form
                    )
                  }
                  placeholder="Campus address"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={styles.editLabel}>Host</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.host}
                  onChangeText={(text) =>
                    setEditEventForm((form) =>
                      form ? { ...form, host: text } : form
                    )
                  }
                  placeholder="Host"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={styles.editLabel}>Dress Code</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.dressCode}
                  onChangeText={(text) =>
                    setEditEventForm((form) =>
                      form ? { ...form, dressCode: text } : form
                    )
                  }
                  placeholder="Casual"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={styles.editLabel}>Tags (comma separated)</Text>
                <TextInput
                  style={styles.editInput}
                  value={editEventForm.tagsText}
                  onChangeText={(text) =>
                    setEditEventForm((form) =>
                      form ? { ...form, tagsText: text } : form
                    )
                  }
                  autoCapitalize="none"
                  placeholder="music, social, campus"
                  placeholderTextColor={theme.textMuted}
                />

                <View style={styles.actionRow}>
                  <Pressable style={styles.secondaryButton} onPress={handleCloseEditEvent}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleSaveEditEvent}
                    disabled={isSavingEvent}>
                    <Text style={styles.primaryButtonText}>
                      {isSavingEvent ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const isDark = theme.background === '#05070b' || theme.background === '#000000';
  const screenBackground = isDark ? '#000000' : theme.background;
  const profileSurface = isDark ? '#101010' : theme.surface;
  const profileSurfaceAlt = isDark ? '#1a1a1c' : theme.surfaceAlt;
  const profileBorder = isDark ? 'rgba(255,255,255,0.10)' : theme.border;
  const profileText = isDark ? '#ffffff' : theme.text;
  const profileMutedText = isDark ? '#c7c7cc' : theme.textMuted;

  return StyleSheet.create({
    screen: {
      backgroundColor: screenBackground,
    },
    scrollContent: {
      padding: 18,
      gap: 18,
      paddingBottom: 120,
      backgroundColor: screenBackground,
    },
    headerCard: {
      paddingVertical: 8,
      paddingHorizontal: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      gap: 20,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 999,
      borderWidth: isDark ? 1 : 0,
      borderColor: profileBorder,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    name: {
      color: profileText,
      fontSize: 24,
      fontWeight: '800',
    },
    username: {
      color: profileMutedText,
      fontSize: 15,
      fontWeight: '700',
    },
    bio: {
      color: profileMutedText,
      fontSize: 14,
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 0,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: profileBorder,
    },
    statCard: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 2,
      borderRadius: 0,
      backgroundColor: 'transparent',
      alignItems: 'center',
      gap: 3,
    },
    statCardStatic: {
      opacity: 1,
    },
    statValue: {
      color: profileText,
      fontSize: 18,
      fontWeight: '800',
    },
    statLabel: {
      color: profileMutedText,
      fontSize: 11,
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
      borderRadius: 12,
      backgroundColor: isDark ? '#ffffff' : theme.accent,
    },
    primaryButtonText: {
      color: isDark ? '#000000' : theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: profileSurfaceAlt,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    secondaryButtonText: {
      color: profileText,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryIconButton: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: profileSurfaceAlt,
      borderWidth: 1,
      borderColor: profileBorder,
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
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      gap: 6,
      alignItems: 'center',
    },
    emptyTitle: {
      color: profileText,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyCopy: {
      color: profileMutedText,
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
      color: profileText,
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
      backgroundColor: profileSurface,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 24,
    },
    modalHandle: {
      alignSelf: 'center',
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: profileBorder,
      marginBottom: 12,
    },
    modalTitle: {
      color: profileText,
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
      backgroundColor: profileSurfaceAlt,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    editAvatarPreview: {
      width: 84,
      height: 84,
      borderRadius: 28,
      backgroundColor: screenBackground,
    },
    avatarEditorCopy: {
      flex: 1,
      gap: 6,
    },
    avatarHelperText: {
      color: profileMutedText,
      fontSize: 13,
      lineHeight: 18,
    },
    avatarMetaText: {
      color: profileMutedText,
      fontSize: 12,
      fontWeight: '700',
    },
    avatarActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 4,
    },
    editLabel: {
      color: profileText,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 6,
    },
    editInput: {
      borderWidth: 1,
      borderColor: profileBorder,
      backgroundColor: profileSurfaceAlt,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: profileText,
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
};
