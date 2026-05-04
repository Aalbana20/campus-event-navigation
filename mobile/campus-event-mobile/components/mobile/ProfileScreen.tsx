import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ExpoLinking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/lib/app-theme';
import { normalizeProfileRow } from '@/lib/mobile-backend';
import { getAvatarImageSource } from '@/lib/mobile-media';
import {
  buildMutualFollowedByLabel,
  getMutualFollowersFor,
} from '@/lib/mobile-mutuals';
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
import { supabase } from '@/lib/supabase';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventPrivacy, EventRecord, ProfileRecord } from '@/types/models';

import { AppScreen } from './AppScreen';
import { EventListCard } from './EventListCard';
import { GlobalCreateMenu, type GlobalCreateOptionKey } from './GlobalCreateMenu';
import { PersonRowCard } from './PersonRowCard';
import { ProfileContentTabs } from './ProfileContentTabs';
import { ProfileHighlightsRow } from './ProfileHighlightsRow';
import { ProfileMutualsSheet } from './ProfileMutualsSheet';
import { StoryHighlightPicker } from './StoryHighlightPicker';
import { StoryViewerModal } from './StoryViewerModal';

type ProfileScreenProps = {
  username?: string;
};

type ActiveList = 'followers' | 'following' | 'created' | null;
type ProfileContentCounts = {
  posts: number;
};
type ProfileActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'danger';
};
type NotificationActionItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
};
type CommunityQuickAddItem = {
  key: string;
  label: string;
};
type ProfileSheet = 'about' | 'shared_activity' | 'report_topic' | 'report_reason' | null;
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
  tagsText: (event.tags || []).join(', '),
  privacy: event.privacy || 'public',
  image: event.image || '',
});

const parseEditEventTags = (value: string): string[] =>
  value
    .split(',')
    .map((tag) => tag.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'))
    .filter(Boolean);

const profileActionItems: ProfileActionItem[] = [
  { key: 'report', label: 'Report', icon: 'flag-outline', tone: 'danger' },
  { key: 'mute', label: 'Mute', icon: 'volume-mute-outline' },
  { key: 'block', label: 'Block', icon: 'ban-outline' },
  { key: 'about', label: 'About this account', icon: 'information-circle-outline' },
  { key: 'shared_activity', label: 'See shared activity', icon: 'people-outline' },
  { key: 'hide_story', label: 'Hide your story', icon: 'eye-off-outline' },
  { key: 'remove_follower', label: 'Remove follower', icon: 'person-remove-outline' },
  { key: 'copy_url', label: 'Copy profile URL', icon: 'link-outline' },
  { key: 'share_profile', label: 'Share this profile', icon: 'paper-plane-outline' },
];

const communityQuickAddItems: CommunityQuickAddItem[] = [
  { key: 'group', label: 'Add Group' },
  { key: 'school', label: 'Add School' },
  { key: 'work', label: 'Add Work' },
];

const notificationCategoryItems: NotificationActionItem[] = [
  { key: 'events', label: 'Events', subtitle: 'Most relevant', icon: 'calendar-outline' },
  { key: 'stories', label: 'Stories', subtitle: 'Most relevant', icon: 'ellipse-outline' },
  { key: 'posts', label: 'Posts', subtitle: 'Most relevant', icon: 'image-outline' },
  { key: 'videos', label: 'Videos', subtitle: 'Most relevant', icon: 'videocam-outline' },
  { key: 'live', label: 'Live', subtitle: 'Most relevant', icon: 'radio-outline' },
];

const reportTopicItems = [
  'A specific post',
  'A recent message they sent you',
  'Something about this account',
];

const reportReasonItems = [
  'They are pretending to be someone else',
  'They may be under the minimum age',
  'This account may have been hacked',
  'Something else',
];

const formatProfileDate = (value?: string | null) => {
  if (!value) return null;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

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
    followRelationships,
    recentDmPeople,
    getProfileByUsername,
    getFollowersForProfile,
    getFollowingForProfile,
    getCreatedEventsForProfile,
    isFollowingProfile,
    followProfile,
    unfollowProfile,
    refreshData,
    updateEvent,
    updateProfile,
  } = useMobileApp();
  const [activeList, setActiveList] = useState<ActiveList>(null);
  const [isMutualsSheetVisible, setIsMutualsSheetVisible] = useState(false);
  const [mutualFollowers, setMutualFollowers] = useState<ProfileRecord[]>([]);

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
  const [isProfileActionsVisible, setIsProfileActionsVisible] = useState(false);
  const [isNotificationSheetVisible, setIsNotificationSheetVisible] = useState(false);
  const [activeProfileSheet, setActiveProfileSheet] = useState<ProfileSheet>(null);
  const [selectedReportReason, setSelectedReportReason] = useState<string | null>(null);
  const [mutedProfileIds, setMutedProfileIds] = useState<Set<string>>(new Set());
  const [blockedProfileIds, setBlockedProfileIds] = useState<Set<string>>(new Set());
  const [storyHiddenProfileIds, setStoryHiddenProfileIds] = useState<Set<string>>(new Set());
  const [profileToast, setProfileToast] = useState<string | null>(null);
  const profileToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const flashProfileToast = useCallback((message: string) => {
    if (profileToastTimerRef.current) {
      clearTimeout(profileToastTimerRef.current);
    }

    setProfileToast(message);
    profileToastTimerRef.current = setTimeout(() => {
      setProfileToast(null);
      profileToastTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(
    () => () => {
      if (profileToastTimerRef.current) {
        clearTimeout(profileToastTimerRef.current);
      }
    },
    []
  );

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

  const loadProfileMutualFollowers = useCallback(async () => {
    if (!resolvedProfileId || !currentUser.id || isOwnProfile) {
      setMutualFollowers([]);
      return;
    }

    const logMutuals = (payload: {
      source: string;
      followingIdsCount: number;
      targetFollowerIdsCount: number;
      mutualIdsCount: number;
      mutualProfilesCount: number;
      mutualIds?: string[];
    }) => {
      if (!__DEV__) return;
      console.debug('[mutuals:mobile] ProfileScreen', {
        currentUserId: currentUser.id,
        viewedProfileId: resolvedProfileId,
        ...payload,
      });
    };

    const applyProviderFallback = (source: string) => {
      const providerMutuals = getMutualFollowersFor({
        profileId: resolvedProfileId,
        currentUserId: currentUser.id,
        followingProfiles,
        followRelationships,
      });
      setMutualFollowers(providerMutuals);
      logMutuals({
        source,
        followingIdsCount: followingProfiles.length,
        targetFollowerIdsCount: followRelationships.filter(
          (relation) => relation.followingId === resolvedProfileId
        ).length,
        mutualIdsCount: providerMutuals.length,
        mutualProfilesCount: providerMutuals.length,
        mutualIds: providerMutuals.map((person) => person.id).slice(0, 6),
      });
    };

    if (!supabase) {
      applyProviderFallback('provider-no-supabase');
      return;
    }

    const { data: myFollowingRows, error: myFollowingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    if (myFollowingError) {
      console.error('[mutuals:mobile] my-following query failed:', myFollowingError);
      applyProviderFallback('provider-after-my-following-error');
      return;
    }

    const followingIds = (myFollowingRows || [])
      .map((row) => String(row.following_id || ''))
      .filter(Boolean);

    if (followingIds.length === 0) {
      setMutualFollowers([]);
      logMutuals({
        source: 'supabase-direct',
        followingIdsCount: 0,
        targetFollowerIdsCount: 0,
        mutualIdsCount: 0,
        mutualProfilesCount: 0,
      });
      return;
    }

    const { data: targetFollowerRows, error: targetFollowerError } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', resolvedProfileId);

    if (targetFollowerError) {
      console.error('[mutuals:mobile] target-followers query failed:', targetFollowerError);
      applyProviderFallback('provider-after-target-followers-error');
      return;
    }

    const followingIdSet = new Set(followingIds);
    const targetFollowerIds = (targetFollowerRows || [])
      .map((row) => String(row.follower_id || ''))
      .filter(Boolean);
    const mutualIds = targetFollowerIds.filter((id) => followingIdSet.has(id));

    if (mutualIds.length === 0) {
      setMutualFollowers([]);
      logMutuals({
        source: 'supabase-direct',
        followingIdsCount: followingIds.length,
        targetFollowerIdsCount: targetFollowerIds.length,
        mutualIdsCount: 0,
        mutualProfilesCount: 0,
      });
      return;
    }

    const { data: mutualProfileRows, error: mutualProfilesError } = await supabase
      .from('profiles')
      .select('id, name, username, bio, avatar_url, account_type, student_verified, verification_status')
      .in('id', mutualIds);

    if (mutualProfilesError) {
      console.error('[mutuals:mobile] mutual profiles query failed:', mutualProfilesError);
      setMutualFollowers([]);
      logMutuals({
        source: 'supabase-direct-profile-error',
        followingIdsCount: followingIds.length,
        targetFollowerIdsCount: targetFollowerIds.length,
        mutualIdsCount: mutualIds.length,
        mutualProfilesCount: 0,
        mutualIds: mutualIds.slice(0, 6),
      });
      return;
    }

    const profileMap = new Map(
      (mutualProfileRows || []).map((row) => {
        const profile = normalizeProfileRow(row);
        return [profile.id, profile] as const;
      })
    );
    const orderedMutuals = mutualIds
      .map((id) => profileMap.get(id))
      .filter(Boolean) as ProfileRecord[];

    setMutualFollowers(orderedMutuals);
    logMutuals({
      source: 'supabase-direct',
      followingIdsCount: followingIds.length,
      targetFollowerIdsCount: targetFollowerIds.length,
      mutualIdsCount: mutualIds.length,
      mutualProfilesCount: orderedMutuals.length,
      mutualIds: mutualIds.slice(0, 6),
    });
  }, [
    currentUser.id,
    followRelationships,
    followingProfiles,
    isOwnProfile,
    resolvedProfileId,
  ]);

  useEffect(() => {
    void loadProfileMutualFollowers();
  }, [loadProfileMutualFollowers]);

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
  const mutualLabel = buildMutualFollowedByLabel(
    mutualFollowers,
    mutualFollowers.length
  );
  const shouldShowFirstCreatePrompt =
    isOwnProfile && createdEvents.length === 0 && profileContentCounts.posts === 0;
  const isVerifiedProfile =
    profile.verificationStatus === 'verified' ||
    Boolean(profile.studentVerified) ||
    profile.accountType === 'organization';
  const profileDisplayName = profile.username || profile.name || 'this account';
  const profileUsernameLabel = profile.username || profile.id;
  const profileUrl = ExpoLinking.createURL(`/profile/${profile.username || profile.id}`);
  const profileDynamicFields = profile as ProfileRecord & {
    createdAt?: string;
    created_at?: string;
    location?: string;
    country?: string;
  };
  const joinedDateLabel =
    formatProfileDate(profileDynamicFields.createdAt || profileDynamicFields.created_at) ||
    'Joined date unavailable';
  const locationLabel =
    profileDynamicFields.country ||
    profileDynamicFields.location ||
    profile.school ||
    'Location unavailable';
  const followedYouAt =
    formatProfileDate(
      followRelationships.find(
        (relationship) =>
          relationship.followerId === profile.id &&
          relationship.followingId === currentUser.id
      )?.createdAt
    ) || 'Date unavailable';
  const youFollowAt =
    formatProfileDate(
      followRelationships.find(
        (relationship) =>
          relationship.followerId === currentUser.id &&
          relationship.followingId === profile.id
      )?.createdAt
    ) || 'Date unavailable';
  const isProfileMuted = mutedProfileIds.has(profile.id);
  const isProfileBlocked = blockedProfileIds.has(profile.id);
  const isStoryHiddenFromProfile = storyHiddenProfileIds.has(profile.id);

  const handleProfileAction = async (actionKey: string) => {
    if (actionKey === 'copy_url') {
      await Clipboard.setStringAsync(profileUrl);
      setIsProfileActionsVisible(false);
      flashProfileToast('Profile URL copied');
      return;
    }

    if (actionKey === 'share_profile') {
      try {
        await Share.share({
          title: profileDisplayName,
          message: `${profileDisplayName}\n${profileUrl}`,
          url: profileUrl,
        });
      } catch (error) {
        console.log('Profile share unavailable:', error);
        flashProfileToast('Native share unavailable');
      } finally {
        setIsProfileActionsVisible(false);
      }
      return;
    }

    if (actionKey === 'report') {
      setIsProfileActionsVisible(false);
      setSelectedReportReason(null);
      setActiveProfileSheet('report_topic');
      return;
    }

    if (actionKey === 'about') {
      setIsProfileActionsVisible(false);
      setActiveProfileSheet('about');
      return;
    }

    if (actionKey === 'shared_activity') {
      setIsProfileActionsVisible(false);
      setActiveProfileSheet('shared_activity');
      return;
    }

    if (actionKey === 'mute') {
      const nextMutedState = !isProfileMuted;
      setMutedProfileIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (nextMutedState) {
          nextIds.add(profile.id);
        } else {
          nextIds.delete(profile.id);
        }
        return nextIds;
      });
      setIsProfileActionsVisible(false);
      flashProfileToast(
        `${nextMutedState ? 'Muted' : 'Unmuted'} ${profileUsernameLabel}`
      );
      console.log('Mute placeholder toggled:', profile.id, nextMutedState);
      return;
    }

    if (actionKey === 'block') {
      const nextBlockedState = !isProfileBlocked;
      setBlockedProfileIds((currentIds) => {
        const nextIds = new Set(currentIds);
        if (nextBlockedState) {
          nextIds.add(profile.id);
        } else {
          nextIds.delete(profile.id);
        }
        return nextIds;
      });
      setIsProfileActionsVisible(false);
      flashProfileToast(
        `${nextBlockedState ? 'Blocked' : 'Unblocked'} ${profileUsernameLabel}`
      );
      console.log('Block placeholder toggled:', profile.id, nextBlockedState);
      return;
    }

    if (actionKey === 'hide_story') {
      setStoryHiddenProfileIds((currentIds) => new Set(currentIds).add(profile.id));
      setIsProfileActionsVisible(false);
      flashProfileToast(`Story hidden from ${profileUsernameLabel}`);
      console.log('Hide story placeholder selected:', profile.id);
      return;
    }

    if (actionKey === 'remove_follower') {
      setIsProfileActionsVisible(false);

      if (!supabase) {
        console.log('Remove follower placeholder selected:', profile.id);
        flashProfileToast('Remove follower ready for backend');
        return;
      }

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', profile.id)
        .eq('following_id', currentUser.id);

      if (error) {
        console.error('Unable to remove follower:', error);
        flashProfileToast('Could not remove follower');
        return;
      }

      await refreshData();
      flashProfileToast(`Removed ${profileUsernameLabel} as a follower`);
      return;
    }

    console.log('Profile action selected:', actionKey, profile.id);
    setIsProfileActionsVisible(false);
    flashProfileToast('Action ready for backend');
  };

  const handleNotificationAction = (actionKey: string) => {
    console.log('Profile notification action selected:', actionKey, profile.id);
    setIsNotificationSheetVisible(false);
  };

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
    if (isProfileBlocked) {
      setBlockedProfileIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(profile.id);
        return nextIds;
      });
      flashProfileToast(`Unblocked ${profileUsernameLabel}`);
      return;
    }

    if (isFollowingProfile(profile.id)) {
      unfollowProfile(profile.id);
      return;
    }

    followProfile(profile.id);
  };

  const handleCreateOption = (option: GlobalCreateOptionKey) => {
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
      router.push('/create-event');
    }
  };

  const handleOpenStoryShortcut = () => {
    router.push({ pathname: '/story/create', params: { mode: 'story' } });
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

  const handleCommunityQuickAdd = (item: CommunityQuickAddItem) => {
    Alert.alert(item.label, `${item.label.replace('Add ', '')} affiliations are coming soon.`);
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

          {isOwnProfile ? (
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
          ) : (
            <View style={styles.usernameMenuButton}>
              <Text style={styles.topUsername} numberOfLines={1}>
                {profile.username || profile.name}
              </Text>
            </View>
          )}

          {isOwnProfile ? (
            <Pressable
              style={styles.topBarIconButton}
              onPress={() => router.push('/settings')}
              accessibilityLabel="Open settings">
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
            </Pressable>
          ) : (
            <View style={styles.publicHeaderActions}>
              <Pressable
                style={styles.topBarIconButton}
                onPress={() => setIsNotificationSheetVisible(true)}
                accessibilityLabel={`Notification options for ${profileDisplayName}`}>
                <Ionicons name="notifications-outline" size={21} color={theme.text} />
              </Pressable>
              <Pressable
                style={styles.topBarIconButton}
                onPress={() => setIsProfileActionsVisible(true)}
                accessibilityLabel={`More options for ${profileDisplayName}`}>
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.avatarWrap}>
              <Image source={getAvatarImageSource(profile.avatar)} style={styles.avatar} />
              {isOwnProfile ? (
                <Pressable
                  style={styles.avatarStoryAddButton}
                  onPress={handleOpenStoryShortcut}
                  accessibilityRole="button"
                  accessibilityLabel="Create a story">
                  <Ionicons name="add" size={17} color="#ffffff" />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.headerCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
                {isVerifiedProfile ? (
                  <View style={styles.verifiedBadge}>
                    <View style={styles.verifiedBadgeBurst} />
                    <Ionicons name="checkmark" size={12} color={theme.verifiedText} />
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatButton label="Followers" value={followers.length} onPress={() => setActiveList('followers')} />
            <StatButton label="Following" value={following.length} onPress={() => setActiveList('following')} />
            <StatButton label="Host" value={createdEvents.length} onPress={() => setActiveList('created')} />
            <StatButton label="Posts" value={profileContentCounts.posts} />
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {isOwnProfile ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communityQuickAddContent}
              style={styles.communityQuickAddRow}>
              {communityQuickAddItems.map((item) => (
                <Pressable
                  key={item.key}
                  style={styles.communityQuickAddChip}
                  onPress={() => handleCommunityQuickAdd(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}>
                  <View style={styles.communityQuickAddIcon}>
                    <Ionicons name="add" size={16} color={theme.accent} />
                  </View>
                  <Text style={styles.communityQuickAddText}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <ProfileHighlightsRow
            highlights={highlights}
            isOwner={isOwnProfile}
            onPressHighlight={handleOpenHighlight}
            onPressNew={() => setIsHighlightPickerVisible(true)}
            onLongPressHighlight={handleLongPressHighlight}
          />

          {!isOwnProfile && mutualLabel ? (
            <Pressable
              style={styles.mutualRow}
              onPress={() => setIsMutualsSheetVisible(true)}>
              <View style={styles.mutualAvatars}>
                {mutualFollowers.slice(0, 3).map((person, index) => (
                  <Image
                    key={person.id}
                    source={getAvatarImageSource(person.avatar)}
                    style={[
                      styles.mutualAvatar,
                      { marginLeft: index > 0 ? -10 : 0, zIndex: 3 - index },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.mutualLabel} numberOfLines={2}>
                {mutualLabel}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.actionRow}>
            {isOwnProfile ? (
              <>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    styles.profileActionButton,
                    styles.ownProfileActionButton,
                  ]}
                  onPress={handleOpenEdit}>
                  <Ionicons name="pencil-outline" size={14} color={theme.accent} />
                  <Text style={styles.secondaryButtonText}>Edit Profile</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    styles.profileActionButton,
                    styles.ownProfileActionButton,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/video-posts',
                      params: { view: 'recaps', recapCategory: 'for-you' },
                    })
                  }>
                  <Ionicons name="chatbubbles-outline" size={14} color={theme.accent} />
                  <Text style={styles.secondaryButtonText}>Recaps</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={[
                    styles.primaryButton,
                    styles.profileActionButton,
                    styles.publicActionButton,
                    isProfileBlocked && styles.blockedActionButton,
                  ]}
                  onPress={handleToggleFollow}>
                  <Text
                    style={[
                      styles.profileActionButtonText,
                      isProfileBlocked && styles.blockedActionButtonText,
                    ]}>
                    {isProfileBlocked
                      ? 'Blocked'
                      : isFollowingProfile(profile.id)
                        ? 'Following'
                        : 'Follow'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.profileActionButton, styles.publicActionButton]}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/messages',
                      params: { dm: profile.id },
                    })
                  }>
                  <Text style={styles.secondaryButtonText}>Message</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.profileActionButton, styles.publicActionButton]}
                  onPress={() =>
                    router.push({
                      pathname: '/recap-profile/[userId]',
                      params: { userId: profile.id },
                    })
                  }>
                  <Text style={styles.secondaryButtonText}>Recap</Text>
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

        <ProfileContentTabs
          profileId={resolvedProfileId}
          isOwner={isOwnProfile}
          onContentCountsChange={handleProfileContentCountsChange}
        />
      </ScrollView>

      <ProfileMutualsSheet
        visible={isMutualsSheetVisible}
        profiles={mutualFollowers}
        onClose={() => setIsMutualsSheetVisible(false)}
        onPressProfile={(person) => {
          setIsMutualsSheetVisible(false);
          if (person.username === currentUser.username) {
            router.push('/(tabs)/profile');
            return;
          }
          router.push({
            pathname: '/profile/[username]',
            params: { username: person.username || person.id },
          });
        }}
        onPressMessage={(person) => {
          setIsMutualsSheetVisible(false);
          router.push({
            pathname: '/(tabs)/messages',
            params: { dm: person.id },
          });
        }}
      />

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

      <GlobalCreateMenu
        visible={isCreateMenuVisible}
        onClose={() => setIsCreateMenuVisible(false)}
        onSelect={handleCreateOption}
      />

      <Modal
        visible={isProfileActionsVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsProfileActionsVisible(false)}>
        <Pressable
          style={styles.profileActionOverlay}
          onPress={() => setIsProfileActionsVisible(false)}>
          <Pressable style={styles.profileActionSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.profileActionHandle} />
            <View style={styles.profileActionList}>
              {profileActionItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.profileActionRow,
                    index > 0 && styles.profileActionRowDivider,
                  ]}
                  accessibilityState={{
                    selected:
                      (item.key === 'mute' && isProfileMuted) ||
                      (item.key === 'block' && isProfileBlocked) ||
                      (item.key === 'hide_story' && isStoryHiddenFromProfile),
                  }}
                  onPress={() => void handleProfileAction(item.key)}>
                  <View
                    style={[
                      styles.profileActionIconShell,
                      item.tone === 'danger' && styles.profileActionDangerIconShell,
                    ]}>
                    <Ionicons
                      name={item.icon}
                      size={21}
                      color={item.tone === 'danger' ? theme.danger : theme.text}
                    />
                  </View>
                  <Text
                    style={[
                      styles.profileActionLabel,
                      item.tone === 'danger' && styles.profileActionDangerLabel,
                    ]}>
                    {item.key === 'mute'
                      ? `${isProfileMuted ? 'Unmute' : 'Mute'} ${profileUsernameLabel}`
                      : item.key === 'block'
                        ? `${isProfileBlocked ? 'Unblock' : 'Block'} ${profileUsernameLabel}`
                        : item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.profileActionCancel}
              onPress={() => setIsProfileActionsVisible(false)}>
              <Text style={styles.profileActionCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={activeProfileSheet !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setActiveProfileSheet(null)}>
        <Pressable
          style={styles.profileSheetOverlay}
          onPress={() => setActiveProfileSheet(null)}>
          <Pressable style={styles.profileDetailSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.profileActionHandle} />

            {activeProfileSheet === 'about' ? (
              <ScrollView
                contentContainerStyle={styles.profileDetailContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.profileSheetHeaderRow}>
                  <Text style={styles.profileSheetTitle}>About this account</Text>
                  <Pressable
                    style={styles.profileSheetCloseButton}
                    onPress={() => setActiveProfileSheet(null)}
                    accessibilityLabel="Close about this account">
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </Pressable>
                </View>

                <View style={styles.aboutIdentityCard}>
                  <Image source={getAvatarImageSource(profile.avatar)} style={styles.aboutAvatar} />
                  <View style={styles.aboutIdentityCopy}>
                    <Text style={styles.aboutName}>{profile.name || profileUsernameLabel}</Text>
                    <Text style={styles.aboutUsername}>{profileUsernameLabel}</Text>
                  </View>
                </View>

                <View style={styles.profileInfoList}>
                  <View style={styles.profileInfoRow}>
                    <View style={styles.profileInfoIcon}>
                      <Ionicons name="calendar-outline" size={20} color={theme.text} />
                    </View>
                    <View style={styles.profileInfoCopy}>
                      <Text style={styles.profileInfoLabel}>Date joined VeroVite</Text>
                      <Text style={styles.profileInfoValue}>{joinedDateLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.profileInfoRow}>
                    <View style={styles.profileInfoIcon}>
                      <Ionicons name="location-outline" size={20} color={theme.text} />
                    </View>
                    <View style={styles.profileInfoCopy}>
                      <Text style={styles.profileInfoLabel}>Based in</Text>
                      <Text style={styles.profileInfoValue}>{locationLabel}</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            ) : null}

            {activeProfileSheet === 'shared_activity' ? (
              <ScrollView
                contentContainerStyle={styles.sharedDetailContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.profileSheetHeaderRow}>
                  <Pressable
                    style={styles.profileSheetBackButton}
                    onPress={() => setActiveProfileSheet(null)}
                    accessibilityLabel="Close shared activity">
                    <Ionicons name="chevron-back" size={22} color="#ffffff" />
                  </Pressable>
                  <Text style={styles.profileSheetTitle}>Shared activity</Text>
                  <View style={styles.profileSheetHeaderSpacer} />
                </View>

                <View style={styles.sharedPeopleRow}>
                  <View style={styles.sharedPerson}>
                    <Image
                      source={getAvatarImageSource(currentUser.avatar)}
                      style={styles.sharedAvatar}
                    />
                    <Text style={styles.sharedName} numberOfLines={1}>
                      {currentUser.name || currentUser.username}
                    </Text>
                    <Text style={styles.sharedUsername} numberOfLines={1}>
                      {currentUser.username}
                    </Text>
                  </View>

                  <View style={styles.sharedLinkBadge}>
                    <Ionicons name="link-outline" size={24} color="#4d8dff" />
                  </View>

                  <View style={styles.sharedPerson}>
                    <Image
                      source={getAvatarImageSource(profile.avatar)}
                      style={styles.sharedAvatar}
                    />
                    <Text style={styles.sharedName} numberOfLines={1}>
                      {profile.name || profileUsernameLabel}
                    </Text>
                    <Text style={styles.sharedUsername} numberOfLines={1}>
                      {profileUsernameLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.sharedSection}>
                  <View style={styles.sharedActivityCard}>
                    <View style={styles.sharedActivityIconBlue}>
                      <Ionicons name="person-add-outline" size={25} color="#4d8dff" />
                    </View>
                    <View style={styles.sharedActivityCopy}>
                      <Text style={styles.sharedActivityTitle}>{profileUsernameLabel} followed you</Text>
                      <Text style={styles.sharedActivitySubtitle}>
                        {profileUsernameLabel} follows your profile.
                      </Text>
                    </View>
                    <Text style={styles.sharedActivityDate}>{followedYouAt}</Text>
                  </View>

                  <View style={styles.sharedActivityCard}>
                    <View style={styles.sharedActivityIconBlue}>
                      <Ionicons name="checkmark-circle-outline" size={25} color="#4d8dff" />
                    </View>
                    <View style={styles.sharedActivityCopy}>
                      <Text style={styles.sharedActivityTitle}>You follow {profileUsernameLabel}</Text>
                      <Text style={styles.sharedActivitySubtitle}>
                        You follow {profileUsernameLabel}.
                      </Text>
                    </View>
                    <Text style={styles.sharedActivityDate}>{youFollowAt}</Text>
                  </View>
                </View>

                <View style={styles.sharedDivider} />

                <View style={styles.sharedSection}>
                  <View style={styles.sharedActivityCard}>
                    <View style={styles.sharedActivityIconPink}>
                      <Ionicons name="heart-outline" size={27} color="#ff4d78" />
                    </View>
                    <View style={styles.sharedActivityCopy}>
                      <Text style={styles.sharedActivityTitle}>Likes</Text>
                      <Text style={styles.sharedActivitySubtitle}>
                        Posts from {profileUsernameLabel} that you liked: 0{'\n'}
                        Posts from you that {profileUsernameLabel} liked: 0
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </View>

                  <View style={styles.sharedActivityCard}>
                    <View style={styles.sharedActivityIconPurple}>
                      <Ionicons name="chatbubble-outline" size={25} color="#c678ff" />
                    </View>
                    <View style={styles.sharedActivityCopy}>
                      <Text style={styles.sharedActivityTitle}>Comments</Text>
                      <Text style={styles.sharedActivitySubtitle}>
                        Comments you made on their posts: 0{'\n'}
                        Comments they made on your posts: 0
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </View>

                  <View style={styles.sharedActivityCard}>
                    <View style={styles.sharedActivityIconGreen}>
                      <Ionicons name="pricetag-outline" size={25} color="#36c77f" />
                    </View>
                    <View style={styles.sharedActivityCopy}>
                      <Text style={styles.sharedActivityTitle}>Tags</Text>
                      <Text style={styles.sharedActivitySubtitle}>
                        Tags involving you and {profileUsernameLabel}: 0
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </View>
                </View>

                <Text style={styles.sharedFootnote}>
                  These placeholders are ready for shared activity data when the backend is wired.
                </Text>
              </ScrollView>
            ) : null}

            {activeProfileSheet === 'report_topic' ? (
              <View style={styles.profileDetailContent}>
                <View style={styles.profileSheetHeaderRow}>
                  <Text style={styles.profileSheetTitle}>What do you want to report?</Text>
                  <Pressable
                    style={styles.profileSheetCloseButton}
                    onPress={() => setActiveProfileSheet(null)}
                    accessibilityLabel="Close report flow">
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </Pressable>
                </View>
                <Text style={styles.reportSafetyText}>
                  Reports are kept private. If there is an immediate safety concern, contact local emergency services right away.
                </Text>

                <View style={styles.reportOptionList}>
                  {reportTopicItems.map((item) => (
                    <Pressable
                      key={item}
                      style={styles.reportOptionRow}
                      onPress={() => {
                        if (item === 'Something about this account') {
                          setActiveProfileSheet('report_reason');
                          return;
                        }

                        flashProfileToast('Report step ready for backend');
                        console.log('Report topic placeholder selected:', item, profile.id);
                      }}>
                      <Text style={styles.reportOptionText}>{item}</Text>
                      <Ionicons name="chevron-forward" size={19} color={theme.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {activeProfileSheet === 'report_reason' ? (
              <View style={styles.profileDetailContent}>
                <View style={styles.profileSheetHeaderRow}>
                  <Pressable
                    style={styles.profileSheetBackButton}
                    onPress={() => setActiveProfileSheet('report_topic')}
                    accessibilityLabel="Back to report topics">
                    <Ionicons name="chevron-back" size={22} color="#ffffff" />
                  </Pressable>
                  <Text style={styles.profileSheetTitle}>Why are you reporting this profile?</Text>
                  <Pressable
                    style={styles.profileSheetCloseButton}
                    onPress={() => setActiveProfileSheet(null)}
                    accessibilityLabel="Close report flow">
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </Pressable>
                </View>

                <View style={styles.reportOptionList}>
                  {reportReasonItems.map((item) => {
                    const isSelected = selectedReportReason === item;

                    return (
                      <Pressable
                        key={item}
                        style={[
                          styles.reportOptionRow,
                          isSelected && styles.reportOptionRowSelected,
                        ]}
                        onPress={() => {
                          setSelectedReportReason(item);
                          flashProfileToast('Report reason selected');
                          console.log('Report reason placeholder selected:', item, profile.id);
                        }}>
                        <Text style={styles.reportOptionText}>{item}</Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isNotificationSheetVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsNotificationSheetVisible(false)}>
        <Pressable
          style={styles.profileActionOverlay}
          onPress={() => setIsNotificationSheetVisible(false)}>
          <Pressable style={styles.notificationSheet} onPress={(eventPress) => eventPress.stopPropagation()}>
            <Pressable
              style={styles.notificationWideRow}
              onPress={() => handleNotificationAction('all_following')}>
              <View style={styles.profileActionIconShell}>
                <Ionicons name="options-outline" size={21} color={theme.text} />
              </View>
              <Text style={styles.profileActionLabel}>All accounts you follow</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Pressable>

            <View style={styles.notificationDivider} />

            {notificationCategoryItems.map((item) => (
              <Pressable
                key={item.key}
                style={styles.notificationCategoryRow}
                onPress={() => handleNotificationAction(item.key)}>
                <View style={styles.notificationCategoryIcon}>
                  <Ionicons name={item.icon} size={23} color={theme.text} />
                </View>
                <View style={styles.notificationCategoryCopy}>
                  <Text style={styles.notificationCategoryLabel}>{item.label}</Text>
                  {item.subtitle ? (
                    <Text style={styles.notificationCategorySubtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={19} color={theme.text} />
              </Pressable>
            ))}

            <View style={styles.notificationDivider} />

            <Pressable
              style={styles.notificationWideRow}
              onPress={() => handleNotificationAction('profile_notifications')}>
              <View style={styles.profileActionIconShell}>
                <Ionicons name="notifications-outline" size={21} color={theme.textMuted} />
              </View>
              <Text style={styles.profileActionLabel} numberOfLines={1}>
                Notifications from {profileDisplayName}
              </Text>
            </Pressable>
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
                    actionLabel={isOwnProfile ? 'Manage' : 'Open'}
                    actionTone="muted"
                    secondaryActionLabel={isOwnProfile ? 'Edit' : undefined}
                    secondaryActionTone="muted"
                    onPress={() =>
                      isOwnProfile
                        ? router.push({
                            pathname: '/event/manage/[id]',
                            params: { id: event.id },
                          })
                        : router.push({
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

                      router.push({
                        pathname: '/event/manage/[id]',
                        params: { id: event.id },
                      });
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

      {profileToast ? (
        <View pointerEvents="none" style={styles.profileToast}>
          <Text style={styles.profileToastText}>{profileToast}</Text>
        </View>
      ) : null}
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
    publicHeaderActions: {
      width: 92,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
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
      gap: 15,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 16,
    },
    avatarWrap: {
      position: 'relative',
      width: 88,
      height: 88,
      overflow: 'visible',
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 999,
      borderWidth: isDark ? 1 : 0,
      borderColor: profileBorder,
    },
    avatarStoryAddButton: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      borderWidth: 3,
      borderColor: screenBackground,
      shadowColor: theme.shadow,
      shadowOpacity: isDark ? 0 : 0.14,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
      paddingBottom: 2,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 7,
    },
    name: {
      flexShrink: 1,
      color: profileText,
      fontSize: 24,
      fontWeight: '800',
    },
    verifiedBadge: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.verified,
      shadowOpacity: 0.22,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      marginLeft: 1,
    },
    verifiedBadgeBurst: {
      position: 'absolute',
      width: 17,
      height: 17,
      borderRadius: 5,
      backgroundColor: theme.verified,
      transform: [{ rotate: '45deg' }],
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
    communityQuickAddRow: {
      marginTop: -6,
      marginBottom: -7,
    },
    communityQuickAddContent: {
      gap: 8,
      paddingRight: 6,
    },
    communityQuickAddChip: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 9,
      paddingRight: 11,
      borderRadius: 999,
      backgroundColor: profileSurface,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    communityQuickAddIcon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    communityQuickAddText: {
      color: profileText,
      fontSize: 12,
      fontWeight: '600',
    },
    mutualRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      marginTop: 8,
      marginBottom: 10,
      paddingVertical: 4,
    },
    mutualAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    mutualAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.surface,
      backgroundColor: theme.surfaceAlt,
    },
    mutualLabel: {
      flex: 1,
      color: profileMutedText,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 17,
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
      color: theme.accent,
      fontSize: 18,
      fontWeight: '800',
    },
    statLabel: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '700',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-start',
      alignItems: 'center',
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minWidth: 138,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 11,
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    profileActionButton: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    profileActionButtonText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '800',
    },
    ownProfileActionButton: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 11,
      borderRadius: 12,
    },
    // Override min-width / fixed sizing so the three public-profile action
    // buttons (Following, Message, Recap) split the row evenly.
    publicActionButton: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 8,
      paddingVertical: 11,
      borderRadius: 12,
    },
    blockedActionButton: {
      backgroundColor: theme.dangerSoft,
      borderColor: theme.danger,
    },
    blockedActionButtonText: {
      color: theme.danger,
    },
    actionSquareButton: {
      width: 42,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    secondaryButtonText: {
      color: theme.accent,
      fontSize: 13,
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
    modalContent: {
      gap: 12,
      paddingBottom: 22,
    },
    profileActionOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingBottom: 22,
      backgroundColor: 'rgba(0, 0, 0, 0.62)',
    },
    profileActionSheet: {
      gap: 10,
    },
    profileActionHandle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.20)',
      marginBottom: 2,
    },
    profileActionList: {
      overflow: 'hidden',
      borderRadius: 24,
      backgroundColor: 'rgba(28, 31, 36, 0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    profileActionRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: 18,
      backgroundColor: 'rgba(255,255,255,0.015)',
    },
    profileActionRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.10)',
    },
    profileActionIconShell: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileActionDangerIconShell: {
      shadowColor: theme.danger,
      shadowOpacity: 0.28,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    profileActionLabel: {
      flex: 1,
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    profileActionDangerLabel: {
      color: theme.danger,
    },
    profileActionCancel: {
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      backgroundColor: 'rgba(28, 31, 36, 0.98)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    profileActionCancelText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
    },
    notificationSheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 430,
      overflow: 'hidden',
      borderRadius: 26,
      backgroundColor: 'rgba(28, 31, 36, 0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.11)',
      paddingVertical: 8,
      shadowColor: '#000000',
      shadowOpacity: 0.36,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    notificationWideRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingHorizontal: 20,
    },
    notificationDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.14)',
      marginVertical: 4,
    },
    notificationCategoryRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 20,
    },
    notificationCategoryIcon: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationCategoryCopy: {
      flex: 1,
      gap: 2,
    },
    notificationCategoryLabel: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '800',
    },
    notificationCategorySubtitle: {
      color: 'rgba(255,255,255,0.62)',
      fontSize: 13,
      fontWeight: '600',
    },
    profileSheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
    },
    profileDetailSheet: {
      maxHeight: '92%',
      minHeight: '48%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: '#050506',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
      paddingTop: 10,
      paddingBottom: 22,
    },
    profileDetailContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
      gap: 16,
    },
    sharedDetailContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 18,
      gap: 10,
    },
    profileSheetHeaderRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    profileSheetTitle: {
      flex: 1,
      color: '#ffffff',
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
    },
    profileSheetCloseButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    profileSheetBackButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    profileSheetHeaderSpacer: {
      width: 42,
      height: 42,
    },
    aboutIdentityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    aboutAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    aboutIdentityCopy: {
      flex: 1,
      gap: 4,
    },
    aboutName: {
      color: '#ffffff',
      fontSize: 19,
      fontWeight: '900',
    },
    aboutUsername: {
      color: 'rgba(255,255,255,0.64)',
      fontSize: 14,
      fontWeight: '700',
    },
    profileInfoList: {
      overflow: 'hidden',
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    profileInfoRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.10)',
    },
    profileInfoIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    profileInfoCopy: {
      flex: 1,
      gap: 3,
    },
    profileInfoLabel: {
      color: 'rgba(255,255,255,0.58)',
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    profileInfoValue: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
    },
    sharedPeopleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      paddingTop: 2,
      paddingBottom: 4,
    },
    sharedPerson: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
    },
    sharedAvatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    sharedName: {
      maxWidth: '100%',
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
    },
    sharedUsername: {
      maxWidth: '100%',
      color: 'rgba(255,255,255,0.60)',
      fontSize: 14,
      fontWeight: '700',
    },
    sharedLinkBadge: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 25,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    sharedSection: {
      gap: 8,
    },
    sharedActivityCard: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.055)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    sharedActivityIconBlue: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#4d8dff',
    },
    sharedActivityIconPink: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#ff4d78',
    },
    sharedActivityIconPurple: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#c678ff',
    },
    sharedActivityIconGreen: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#36c77f',
    },
    sharedActivityCopy: {
      flex: 1,
      gap: 2,
    },
    sharedActivityTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
    },
    sharedActivitySubtitle: {
      color: 'rgba(255,255,255,0.62)',
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    sharedActivityDate: {
      color: '#4d8dff',
      fontSize: 13,
      fontWeight: '800',
    },
    sharedDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    sharedFootnote: {
      color: 'rgba(255,255,255,0.52)',
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      fontWeight: '600',
    },
    reportSafetyText: {
      color: 'rgba(255,255,255,0.68)',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    reportOptionList: {
      overflow: 'hidden',
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.055)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.10)',
    },
    reportOptionRow: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.10)',
    },
    reportOptionRowSelected: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    reportOptionText: {
      flex: 1,
      color: '#ffffff',
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },
    profileToast: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 34,
      alignItems: 'center',
    },
    profileToastText: {
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: 'rgba(24, 26, 30, 0.96)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
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
