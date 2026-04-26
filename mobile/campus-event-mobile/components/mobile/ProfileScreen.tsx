import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  buildStoryRecordsFromHighlightItems,
  deleteStoryHighlight,
  loadStoryHighlightsForUser,
  type StoryHighlightItemRecord,
  type StoryHighlightRecord,
} from '@/lib/mobile-story-highlights';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventPrivacy, EventRecord } from '@/types/models';

import { AppScreen } from './AppScreen';
import { EventListCard } from './EventListCard';
import { PersonRowCard } from './PersonRowCard';
import { ProfileContentTabs } from './ProfileContentTabs';
import { ProfileHighlightsRow } from './ProfileHighlightsRow';
import { StoryHighlightPicker } from './StoryHighlightPicker';
import { StoryViewerModal } from './StoryViewerModal';

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
type CreateOption = {
  key: 'post' | 'story' | 'event' | 'personal';
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CREATE_OPTIONS: CreateOption[] = [
  {
    key: 'post',
    label: 'Post',
    subtitle: 'Share a photo or video to your profile.',
    icon: 'grid-outline',
  },
  {
    key: 'story',
    label: 'Story',
    subtitle: 'Post a moment that disappears later.',
    icon: 'radio-button-on-outline',
  },
  {
    key: 'event',
    label: 'Event',
    subtitle: 'Create a campus event with RSVP details.',
    icon: 'calendar-clear-outline',
  },
  {
    key: 'personal',
    label: 'Personal',
    subtitle: 'Add a private calendar item.',
    icon: 'bookmark-outline',
  },
];

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
    followingProfiles,
    recentDmPeople,
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

  // Highlights state (owner sees "+ New"; visitors just see the grid).
  const [highlights, setHighlights] = useState<StoryHighlightRecord[]>([]);
  const [highlightItemsById, setHighlightItemsById] = useState<
    Map<string, StoryHighlightItemRecord[]>
  >(new Map());
  const [isHighlightPickerVisible, setIsHighlightPickerVisible] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

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
  const [isCreateMenuVisible, setIsCreateMenuVisible] = useState(false);
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

  const refreshHighlights = useCallback(async () => {
    if (!resolvedProfileId) return;
    const { highlights: nextHighlights, itemsByHighlightId } =
      await loadStoryHighlightsForUser(resolvedProfileId);
    setHighlights(nextHighlights);
    setHighlightItemsById(itemsByHighlightId);
  }, [resolvedProfileId]);

  useEffect(() => {
    void refreshHighlights();
  }, [refreshHighlights]);

  const handleOpenHighlight = useCallback((highlight: StoryHighlightRecord) => {
    setActiveHighlightId(highlight.id);
  }, []);

  const handleLongPressHighlight = useCallback(
    (highlight: StoryHighlightRecord) => {
      if (!isOwnProfile) return;
      Alert.alert(highlight.title, 'Delete this highlight?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteStoryHighlight(highlight.id);
            if (ok) void refreshHighlights();
          },
        },
      ]);
    },
    [isOwnProfile, refreshHighlights]
  );

  const activeHighlight = useMemo(
    () => highlights.find((h) => h.id === activeHighlightId) || null,
    [activeHighlightId, highlights]
  );

  const viewerItems = useMemo(() => {
    if (!activeHighlight || !resolvedProfile) return [];
    const items = highlightItemsById.get(activeHighlight.id) || [];
    const stories = buildStoryRecordsFromHighlightItems(items, resolvedProfile);
    if (stories.length === 0) return [];
    return [
      {
        id: `highlight-${activeHighlight.id}`,
        profileId: String(resolvedProfile.id),
        routeKey: resolvedProfile.username || String(resolvedProfile.id),
        name: resolvedProfile.name || resolvedProfile.username || 'Campus User',
        username: resolvedProfile.username || '',
        avatar: resolvedProfile.avatar || '',
        kind: 'story' as const,
        meta: activeHighlight.title,
        seen: true,
        isPlaceholder: false,
        stories,
        latestStoryAt: stories[stories.length - 1]?.createdAt,
      },
    ];
  }, [activeHighlight, highlightItemsById, resolvedProfile]);

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
  const shouldShowFirstCreatePrompt =
    isOwnProfile && createdEvents.length === 0 && profileContentCounts.posts === 0;
  const isVerifiedProfile =
    profile.verificationStatus === 'verified' ||
    Boolean(profile.studentVerified) ||
    profile.accountType === 'organization';

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

  const handleCreateOption = (option: CreateOption['key']) => {
    setIsCreateMenuVisible(false);

    if (option === 'post') {
      router.push({ pathname: '/story/create', params: { mode: 'post' } });
      return;
    }

    if (option === 'story') {
      router.push({ pathname: '/story/create', params: { mode: 'story' } });
      return;
    }

    if (option === 'event') {
      router.push({ pathname: '/(tabs)/events', params: { tab: 'create', createMode: 'event' } });
      return;
    }

    router.push({ pathname: '/(tabs)/events', params: { tab: 'create', createMode: 'personal' } });
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
        <View style={styles.profileTopBar}>
          {isOwnProfile ? (
            <Pressable
              style={styles.topBarIconButton}
              onPress={() => setIsCreateMenuVisible(true)}
              accessibilityLabel="Create">
              <Ionicons name="add" size={24} color={theme.text} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.topBarIconButton}
              onPress={() => router.back()}
              accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </Pressable>
          )}

          <Pressable
            style={styles.usernameMenuButton}
            onPress={() =>
              Alert.alert('Account switching', 'Account switching support is coming soon.')
            }>
            <Text style={styles.topUsername} numberOfLines={1}>
              {profile.username}
            </Text>
            <Ionicons name="chevron-down" size={15} color={theme.textMuted} />
          </Pressable>

          {isOwnProfile ? (
            <Pressable
              style={styles.topBarIconButton}
              onPress={() => router.push('/settings')}
              accessibilityLabel="Open settings">
              <Ionicons name="settings-outline" size={21} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.topBarIconButtonPlaceholder} />
          )}
        </View>

        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Image source={getAvatarImageSource(profile.avatar)} style={styles.avatar} />

            <View style={styles.headerCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
                {isVerifiedProfile ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={12} color={theme.accentText} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.profileRoleText}>
                {isOwnProfile ? 'Your campus profile' : 'Campus profile'}
              </Text>
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
                  <Ionicons name="pencil-outline" size={16} color={theme.accent} />
                  <Text style={styles.secondaryButtonText}>Edit Profile</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => Alert.alert('Share Profile', `@${profile.username}`)}>
                  <Ionicons name="share-outline" size={16} color={theme.accent} />
                  <Text style={styles.secondaryButtonText}>Share Profile</Text>
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

          {shouldShowFirstCreatePrompt ? (
            <Pressable
              style={styles.firstCreateCard}
              onPress={() => setIsCreateMenuVisible(true)}>
              <View style={styles.firstCreateIcon}>
                <Ionicons name="add" size={22} color="#000000" />
              </View>
              <View style={styles.firstCreateCopy}>
                <Text style={styles.firstCreateTitle}>Create your first post or event</Text>
                <Text style={styles.firstCreateSubtitle}>
                  Start your profile with a moment, story, or campus plan.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ProfileHighlightsRow
          highlights={highlights}
          isOwner={isOwnProfile}
          onPressHighlight={handleOpenHighlight}
          onPressNew={() => setIsHighlightPickerVisible(true)}
          onLongPressHighlight={handleLongPressHighlight}
        />

        <ProfileContentTabs
          profileId={resolvedProfileId}
          isOwner={isOwnProfile}
          onContentCountsChange={handleProfileContentCountsChange}
        />
      </ScrollView>

      <StoryHighlightPicker
        visible={isHighlightPickerVisible}
        userId={resolvedProfileId}
        onClose={() => setIsHighlightPickerVisible(false)}
        onCreated={() => {
          setIsHighlightPickerVisible(false);
          void refreshHighlights();
        }}
      />

      <StoryViewerModal
        visible={Boolean(activeHighlight) && viewerItems.length > 0}
        items={viewerItems}
        initialItemId={viewerItems[0]?.id || null}
        currentUserId={currentUser.id}
        followingProfiles={followingProfiles}
        recentDmPeople={recentDmPeople}
        reactedStoryIds={new Set()}
        onClose={() => setActiveHighlightId(null)}
        onStoryOpen={() => {}}
        onToggleHeart={async () => {}}
        onReplyToStory={async () => {}}
        onShareStory={async () => {}}
        onLoadViewers={async () => []}
      />

      <Modal
        visible={isCreateMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateMenuVisible(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsCreateMenuVisible(false)}>
          <Pressable
            style={styles.createMenuSheet}
            onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.createMenuTitle}>Create</Text>

            <View style={styles.createMenuList}>
              {CREATE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  style={styles.createMenuRow}
                  onPress={() => handleCreateOption(option.key)}>
                  <View style={styles.createMenuIcon}>
                    <Ionicons name={option.icon} size={21} color={theme.text} />
                  </View>
                  <View style={styles.createMenuCopy}>
                    <Text style={styles.createMenuLabel}>{option.label}</Text>
                    <Text style={styles.createMenuSubtitle}>{option.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
      paddingHorizontal: 18,
      paddingTop: 12,
      gap: 18,
      paddingBottom: 120,
      backgroundColor: screenBackground,
    },
    profileTopBar: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topBarIconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: profileSurface,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    topBarIconButtonPlaceholder: {
      width: 42,
      height: 42,
    },
    usernameMenuButton: {
      maxWidth: '68%',
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 12,
    },
    topUsername: {
      color: profileText,
      fontSize: 17,
      fontWeight: '900',
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
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    name: {
      flexShrink: 1,
      color: profileText,
      fontSize: 24,
      fontWeight: '800',
    },
    verifiedBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOpacity: 0.22,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    profileRoleText: {
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
      color: isDark ? '#000000' : theme.accentText,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    secondaryButtonText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '800',
    },
    firstCreateCard: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 20,
      backgroundColor: profileSurface,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    firstCreateIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    },
    firstCreateCopy: {
      flex: 1,
      gap: 4,
    },
    firstCreateTitle: {
      color: profileText,
      fontSize: 15,
      fontWeight: '900',
    },
    firstCreateSubtitle: {
      color: profileMutedText,
      fontSize: 13,
      lineHeight: 18,
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
    createMenuSheet: {
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: profileSurface,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 34,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    createMenuTitle: {
      color: profileText,
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 12,
    },
    createMenuList: {
      gap: 8,
    },
    createMenuRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: profileSurfaceAlt,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    createMenuIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : theme.surface,
    },
    createMenuCopy: {
      flex: 1,
      gap: 3,
    },
    createMenuLabel: {
      color: profileText,
      fontSize: 16,
      fontWeight: '900',
    },
    createMenuSubtitle: {
      color: profileMutedText,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
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
