import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { EventCommentsSheet } from '@/components/mobile/EventCommentsSheet';
import { RecapPostCard } from '@/components/mobile/RecapPostCard';
import { ProfileMutualsSheet } from '@/components/mobile/ProfileMutualsSheet';
import { useAppTheme } from '@/lib/app-theme';
import { getAvatarImageSource } from '@/lib/mobile-media';
import {
  buildMutualFollowedByLabel,
  getMutualFollowersFor,
} from '@/lib/mobile-mutuals';
import {
  addRecapComment,
  deleteRecapComment,
  loadRecapComments,
  loadRecapCommentsForUser,
  loadRecapPostsForUser,
  toggleRecapLike,
  toggleRecapRepost,
  type BackendRecapComment,
  type BackendRecapPost,
  type BackendRecapProfileComment,
} from '@/lib/mobile-recaps-backend';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useShareSheet } from '@/providers/mobile-share-provider';
import type { ProfileRecord } from '@/types/models';

import { ProfileAvatarLink } from './ProfileAvatarLink';

type RecapProfileScreenProps = {
  userId: string;
};

type RecapTab = 'recaps' | 'comments' | 'videos' | 'photos';
type RelationshipList = 'followers' | 'following';

const RECAP_TABS: { id: RecapTab; label: string; emptyText: string }[] = [
  { id: 'recaps', label: 'Recaps', emptyText: 'No recaps yet.' },
  { id: 'comments', label: 'Comments', emptyText: 'No comments yet.' },
  { id: 'videos', label: 'Videos', emptyText: 'No video recaps yet.' },
  { id: 'photos', label: 'Photos', emptyText: 'No photo recaps yet.' },
];

const formatRelativeTime = (value: string) => {
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return 'Now';

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - dateValue.getTime()) / 1000)
  );
  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
};

export function RecapProfileScreen({ userId }: RecapProfileScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const { openShareSheet } = useShareSheet();
  const { width: windowWidth } = useWindowDimensions();
  const {
    currentUser,
    followingProfiles,
    followRelationships,
    getProfileById,
    getFollowersForProfile,
    getFollowingForProfile,
    isFollowingProfile,
    followProfile,
    unfollowProfile,
  } = useMobileApp();

  const [activeTab, setActiveTab] = useState<RecapTab>('recaps');
  const [isFollowBusy, setIsFollowBusy] = useState(false);
  const [isHeaderMenuVisible, setIsHeaderMenuVisible] = useState(false);
  const [activeRelationshipList, setActiveRelationshipList] =
    useState<RelationshipList | null>(null);
  const [tabRecaps, setTabRecaps] = useState<BackendRecapPost[]>([]);
  const [profileComments, setProfileComments] = useState<BackendRecapProfileComment[]>([]);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);
  const [activeCommentRecap, setActiveCommentRecap] = useState<BackendRecapPost | null>(null);
  const [recapCommentDraft, setRecapCommentDraft] = useState('');
  const [recapCommentsByRecapId, setRecapCommentsByRecapId] = useState<Record<string, BackendRecapComment[]>>({});
  const isSubmittingRecapCommentRef = useRef(false);
  const recapCardWidth = Math.max(260, windowWidth - 28);

  const isOwnProfile = userId === currentUser.id;
  const profile: ProfileRecord | undefined = isOwnProfile
    ? currentUser
    : getProfileById(userId);

  const followers = useMemo(
    () => (profile ? getFollowersForProfile(profile.id) : []),
    [getFollowersForProfile, profile]
  );
  const following = useMemo(
    () => (profile ? getFollowingForProfile(profile.id) : []),
    [getFollowingForProfile, profile]
  );

  const mutualFollowers = useMemo(() => {
    if (!profile || isOwnProfile) return [] as ProfileRecord[];
    return getMutualFollowersFor({
      profileId: profile.id,
      currentUserId: currentUser.id,
      followingProfiles,
      followRelationships,
    });
  }, [
    currentUser.id,
    followRelationships,
    followingProfiles,
    isOwnProfile,
    profile,
  ]);

  const mutualLabel = useMemo(
    () => buildMutualFollowedByLabel(mutualFollowers, mutualFollowers.length),
    [mutualFollowers]
  );

  const isFollowing = profile ? isFollowingProfile(profile.id) : false;

  useEffect(() => {
    let cancelled = false;

    const loadActiveTab = async () => {
      setIsTabLoading(true);
      setTabError(null);
      try {
        if (activeTab === 'comments') {
          const comments = await loadRecapCommentsForUser(userId);
          if (!cancelled) {
            setProfileComments(comments);
            setTabRecaps([]);
          }
          return;
        }

        const mediaType =
          activeTab === 'videos'
            ? 'video'
            : activeTab === 'photos'
              ? 'image'
              : undefined;
        const recaps = await loadRecapPostsForUser({
          userId,
          currentUserId: currentUser.id,
          mediaType,
        });
        if (!cancelled) {
          setTabRecaps(recaps);
          setProfileComments([]);
        }
      } catch (error) {
        console.error('Could not load recap profile tab:', error);
        if (!cancelled) setTabError('Could not load recaps.');
      } finally {
        if (!cancelled) setIsTabLoading(false);
      }
    };

    void loadActiveTab();

    return () => {
      cancelled = true;
    };
  }, [activeTab, currentUser.id, userId]);

  const handleToggleFollow = useCallback(async () => {
    if (!profile || isOwnProfile || isFollowBusy) return;
    setIsFollowBusy(true);
    try {
      if (isFollowing) {
        await unfollowProfile(profile.id);
      } else {
        await followProfile(profile.id);
      }
    } finally {
      setIsFollowBusy(false);
    }
  }, [followProfile, isFollowBusy, isFollowing, isOwnProfile, profile, unfollowProfile]);

  const handleOpenMessage = useCallback(() => {
    if (!profile) return;
    router.push({
      pathname: '/(tabs)/messages',
      params: { dm: profile.id },
    });
  }, [profile, router]);

  const handleOpenFullProfile = useCallback(() => {
    if (!profile) return;
    if (isOwnProfile) {
      router.push('/(tabs)/profile');
      return;
    }
    if (profile.username) {
      router.push({
        pathname: '/profile/[username]',
        params: { username: profile.username },
      });
    }
  }, [isOwnProfile, profile, router]);

  const updateRecapInTab = useCallback(
    (recapId: string, updater: (recap: BackendRecapPost) => BackendRecapPost) => {
      setTabRecaps((prev) =>
        prev.map((recap) => (recap.id === recapId ? updater(recap) : recap))
      );
      setActiveCommentRecap((prev) =>
        prev?.id === recapId ? updater(prev) : prev
      );
    },
    []
  );

  const handleToggleRecapLike = useCallback(
    async (recap: BackendRecapPost) => {
      if (!currentUser.id || currentUser.id === 'current-user') return;
      const wasLiked = recap.likedByMe;
      updateRecapInTab(recap.id, (item) => ({
        ...item,
        likedByMe: !wasLiked,
        likeCount: Math.max(0, item.likeCount + (wasLiked ? -1 : 1)),
      }));

      const ok = await toggleRecapLike({
        recapId: recap.id,
        userId: currentUser.id,
        isLiked: wasLiked,
      });
      if (!ok) {
        console.warn('[recaps] Like kept locally because recap_likes is unavailable.');
      }
    },
    [currentUser.id, updateRecapInTab]
  );

  const handleToggleRecapRepost = useCallback(
    async (recap: BackendRecapPost) => {
      if (!currentUser.id || currentUser.id === 'current-user') return;
      const wasReposted = recap.repostedByMe;
      updateRecapInTab(recap.id, (item) => ({
        ...item,
        repostedByMe: !wasReposted,
        repostCount: Math.max(0, item.repostCount + (wasReposted ? -1 : 1)),
      }));

      const ok = await toggleRecapRepost({
        recapId: recap.id,
        userId: currentUser.id,
        isReposted: wasReposted,
      });
      if (!ok) {
        console.warn('[recaps] Repost kept locally because recap_reposts is unavailable.');
      }
    },
    [currentUser.id, updateRecapInTab]
  );

  const handleOpenRecapComments = useCallback(
    async (recap: BackendRecapPost) => {
      setActiveCommentRecap(recap);
      const comments = await loadRecapComments(recap.id);
      setRecapCommentsByRecapId((prev) => ({ ...prev, [recap.id]: comments }));
    },
    []
  );

  const handleCloseRecapComments = useCallback(() => {
    setActiveCommentRecap(null);
    setRecapCommentDraft('');
  }, []);

  const handleShareRecap = useCallback((recap: BackendRecapPost) => {
    openShareSheet({ kind: 'recap', recap });
  }, [openShareSheet]);

  const handleSubmitRecapComment = useCallback(async (parentId: string | null = null) => {
    if (!activeCommentRecap || !recapCommentDraft.trim() || isSubmittingRecapCommentRef.current) return;
    if (!currentUser.id || currentUser.id === 'current-user') return;
    isSubmittingRecapCommentRef.current = true;

    const recapId = activeCommentRecap.id;
    const body = recapCommentDraft.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic: BackendRecapComment = {
      id: tempId,
      authorName: currentUser.name || currentUser.username || 'Campus User',
      authorUsername: currentUser.username || '',
      authorAvatar: currentUser.avatar || '',
      authorId: currentUser.id,
      body,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
      parentId,
    };

    setRecapCommentsByRecapId((prev) => ({
      ...prev,
      [recapId]: [...(prev[recapId] || []), optimistic],
    }));
    updateRecapInTab(recapId, (recap) => ({
      ...recap,
      commentCount: recap.commentCount + 1,
    }));
    setRecapCommentDraft('');

    const realId = await addRecapComment({
      recapId,
      userId: currentUser.id,
      body,
      parentId,
    });
    isSubmittingRecapCommentRef.current = false;

    if (!realId) {
      console.warn('[recaps] Comment kept locally because recap_comments is unavailable.');
      return;
    }

    setRecapCommentsByRecapId((prev) => {
      const list = prev[recapId] || [];
      return {
        ...prev,
        [recapId]: list.map((comment) =>
          comment.id === tempId ? { ...comment, id: realId } : comment
        ),
      };
    });
  }, [
    activeCommentRecap,
    currentUser.avatar,
    currentUser.id,
    currentUser.name,
    currentUser.username,
    recapCommentDraft,
    updateRecapInTab,
  ]);

  const handleDeleteRecapComment = useCallback(async (commentId: string) => {
    if (!activeCommentRecap || !currentUser.id || currentUser.id === 'current-user') return;
    const recapId = activeCommentRecap.id;

    setRecapCommentsByRecapId((prev) => ({
      ...prev,
      [recapId]: (prev[recapId] || []).filter(
        (comment) => comment.id !== commentId && comment.parentId !== commentId
      ),
    }));
    updateRecapInTab(recapId, (recap) => ({
      ...recap,
      commentCount: Math.max(0, recap.commentCount - 1),
    }));

    if (!commentId.startsWith('temp-')) {
      const ok = await deleteRecapComment({ commentId, userId: currentUser.id });
      if (!ok) {
        console.warn('[recaps] Comment delete kept locally because recap_comments is unavailable.');
      }
    }
  }, [activeCommentRecap, currentUser.id, updateRecapInTab]);

  const handleOpenRelationshipProfile = useCallback(
    (person: ProfileRecord) => {
      setActiveRelationshipList(null);
      router.push({
        pathname: '/recap-profile/[userId]',
        params: { userId: String(person.id) },
      });
    },
    [router]
  );

  const handleFollowFromRelationshipList = useCallback(
    (person: ProfileRecord) => {
      void followProfile(String(person.id));
    },
    [followProfile]
  );

  const handleUnfollowFromRelationshipList = useCallback(
    (person: ProfileRecord) => {
      void unfollowProfile(String(person.id));
    },
    [unfollowProfile]
  );

  if (!profile) {
    return (
      <AppScreen>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Recap</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredState}>
          <Text style={styles.centeredText}>Recap profile is unavailable.</Text>
        </View>
      </AppScreen>
    );
  }

  const headerMenuItems: { key: string; label: string; danger?: boolean }[] = isOwnProfile
    ? [{ key: 'share', label: 'Share profile' }]
    : [
        { key: 'share', label: 'Share profile' },
        { key: 'mute', label: 'Mute' },
        { key: 'report', label: 'Report', danger: true },
        { key: 'block', label: 'Block', danger: true },
      ];

  const displayName = profile.name || profile.username || 'Campus User';
  const usernameLabel = profile.username ? `@${profile.username}` : '';
  const activeEmpty =
    RECAP_TABS.find((tab) => tab.id === activeTab)?.emptyText || '';

  const renderRecapCard = (recap: BackendRecapPost) => (
    <RecapPostCard
      key={recap.id}
      width={recapCardWidth}
      creatorName={recap.creatorName}
      creatorUsername={recap.creatorUsername}
      creatorAvatar={recap.creatorAvatar}
      caption={recap.caption}
      photos={recap.photos}
      taggedEvent={recap.taggedEvent}
      likedByMe={recap.likedByMe}
      repostedByMe={recap.repostedByMe}
      onPressCreator={() =>
        router.push({
          pathname: '/recap-profile/[userId]',
          params: { userId: recap.creatorId },
        })
      }
      onPressEvent={
        recap.taggedEvent
          ? () =>
              router.push({
                pathname: '/event/[id]',
                params: { id: recap.taggedEvent?.id || '' },
              })
          : undefined
      }
      onPressLike={() => void handleToggleRecapLike(recap)}
      onPressComment={() => void handleOpenRecapComments(recap)}
      onPressRepost={() => void handleToggleRecapRepost(recap)}
      onPressShare={() => void handleShareRecap(recap)}
    />
  );

  const renderEmptyState = (message: string) => (
    <View style={styles.emptyState}>
      <Ionicons
        name={
          activeTab === 'videos'
            ? 'videocam-outline'
            : activeTab === 'photos'
              ? 'image-outline'
              : activeTab === 'comments'
                ? 'chatbubble-outline'
                : 'sparkles-outline'
        }
        size={28}
        color={theme.textMuted}
      />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderTabContent = () => {
    if (isTabLoading) {
      return <Text style={styles.stateText}>Loading recaps...</Text>;
    }

    if (tabError) {
      return renderEmptyState(tabError);
    }

    if (activeTab === 'comments') {
      if (profileComments.length === 0) return renderEmptyState(activeEmpty);
      return (
        <View style={styles.commentsList}>
          {profileComments.map((comment) => {
            const byline = comment.recapAuthorUsername
              ? `@${comment.recapAuthorUsername}`
              : comment.recapAuthorName;
            return (
              <View key={comment.id} style={styles.profileCommentCard}>
                <Text style={styles.profileCommentBody}>{comment.body}</Text>
                <Text style={styles.profileCommentMeta}>
                  {`Commented on ${byline}'s recap • ${formatRelativeTime(comment.createdAt)}`}
                </Text>
              </View>
            );
          })}
        </View>
      );
    }

    if (tabRecaps.length === 0) return renderEmptyState(activeEmpty);

    return <View style={styles.recapsList}>{tabRecaps.map(renderRecapCard)}</View>;
  };

  return (
    <AppScreen style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Recap</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => setIsHeaderMenuVisible(true)}
          accessibilityLabel="More options"
          accessibilityRole="button">
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.profileSection}>
          <Pressable onPress={handleOpenFullProfile} accessibilityRole="button">
            <Image
              source={getAvatarImageSource(profile.avatar)}
              style={styles.avatar}
            />
          </Pressable>

          <Pressable
            style={styles.identityBlock}
            onPress={handleOpenFullProfile}
            accessibilityRole="button">
            <Text style={styles.displayName} numberOfLines={1}>
              {displayName}
            </Text>
            {usernameLabel ? (
              <Text style={styles.usernameLabel} numberOfLines={1}>
                {usernameLabel}
              </Text>
            ) : null}
          </Pressable>

          <View style={styles.statsRow}>
            <Pressable
              style={styles.statCard}
              onPress={() => setActiveRelationshipList('followers')}
              accessibilityRole="button"
              accessibilityLabel="Open followers">
              <Text style={styles.statValue}>{followers.length}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable
              style={styles.statCard}
              onPress={() => setActiveRelationshipList('following')}
              accessibilityRole="button"
              accessibilityLabel="Open following">
              <Text style={styles.statValue}>{following.length}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          </View>

          {!isOwnProfile && mutualFollowers.length > 0 ? (
            <View style={styles.mutualsRow}>
              <View style={styles.mutualsAvatars}>
                {mutualFollowers.slice(0, 3).map((person, index) => (
                  <View
                    key={person.id}
                    style={[
                      styles.mutualAvatarWrapper,
                      index > 0 && styles.mutualAvatarOverlap,
                    ]}>
                    <ProfileAvatarLink
                      profile={person}
                      style={styles.mutualAvatar}
                    />
                  </View>
                ))}
              </View>
              {mutualLabel ? (
                <Text style={styles.mutualsLabel} numberOfLines={1}>
                  {mutualLabel}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!isOwnProfile ? (
            <View style={styles.actionsRow}>
              <Pressable
                style={[
                  styles.actionButton,
                  isFollowing ? styles.followingButton : styles.followButton,
                ]}
                onPress={handleToggleFollow}
                disabled={isFollowBusy}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.actionButtonText,
                    isFollowing
                      ? styles.followingButtonText
                      : styles.followButtonText,
                  ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.messageButton]}
                onPress={handleOpenMessage}
                accessibilityRole="button">
                <Text style={[styles.actionButtonText, styles.messageButtonText]}>
                  Message
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.tabsRow}>
          {RECAP_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={styles.tabButton}
                onPress={() => setActiveTab(tab.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}>
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                  ]}>
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.tabUnderline,
                    isActive && styles.tabUnderlineActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tabContent}>{renderTabContent()}</View>
      </ScrollView>

      <EventCommentsSheet
        visible={Boolean(activeCommentRecap)}
        event={null}
        title={activeCommentRecap?.caption?.trim() || `Recap by @${activeCommentRecap?.creatorUsername || 'campus'}`}
        comments={activeCommentRecap ? (recapCommentsByRecapId[activeCommentRecap.id] || []) : []}
        draft={recapCommentDraft}
        currentUserId={currentUser.id}
        onChangeDraft={setRecapCommentDraft}
        onClose={handleCloseRecapComments}
        onSubmit={handleSubmitRecapComment}
        onDeleteComment={handleDeleteRecapComment}
      />

      <ProfileMutualsSheet
        visible={activeRelationshipList !== null}
        profiles={activeRelationshipList === 'following' ? following : followers}
        title={activeRelationshipList === 'following' ? 'Following' : 'Followers'}
        emptyTitle={
          activeRelationshipList === 'following'
            ? 'No following yet.'
            : 'No followers yet.'
        }
        emptyCopy={
          activeRelationshipList === 'following'
            ? 'People this profile follows will show up here.'
            : 'Followers for this profile will show up here.'
        }
        currentUserId={currentUser.id}
        isFollowingProfile={isFollowingProfile}
        onPressFollow={handleFollowFromRelationshipList}
        onPressUnfollow={handleUnfollowFromRelationshipList}
        onPressProfile={handleOpenRelationshipProfile}
        onClose={() => setActiveRelationshipList(null)}
      />

      <Modal
        visible={isHeaderMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHeaderMenuVisible(false)}>
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setIsHeaderMenuVisible(false)}>
          <Pressable
            style={styles.menuSheet}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.menuHandle} />
            {headerMenuItems.map((item) => (
              <Pressable
                key={item.key}
                style={styles.menuRow}
                onPress={() => setIsHeaderMenuVisible(false)}>
                <Text
                  style={[
                    styles.menuRowText,
                    item.danger && styles.menuRowTextDanger,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.menuRow, styles.menuCancelRow]}
              onPress={() => setIsHeaderMenuVisible(false)}>
              <Text style={[styles.menuRowText, styles.menuCancelText]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '900',
    },
    headerSpacer: {
      width: 38,
      height: 38,
    },
    scrollContent: {
      paddingBottom: 80,
    },
    profileSection: {
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 12,
      gap: 10,
    },
    avatar: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    identityBlock: {
      alignItems: 'center',
      gap: 2,
    },
    displayName: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    usernameLabel: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      marginTop: 4,
    },
    statCard: {
      alignItems: 'center',
      minWidth: 80,
    },
    statValue: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    statLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.border,
    },
    mutualsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      maxWidth: '100%',
    },
    mutualsAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    mutualAvatarWrapper: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.surface,
      padding: 1,
    },
    mutualAvatarOverlap: {
      marginLeft: -8,
    },
    mutualAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    mutualsLabel: {
      flexShrink: 1,
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
      width: '100%',
    },
    actionButton: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingHorizontal: 14,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '800',
    },
    followButton: {
      backgroundColor: theme.accent,
    },
    followButtonText: {
      color: theme.accentText,
    },
    followingButton: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    followingButtonText: {
      color: theme.text,
    },
    messageButton: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    messageButtonText: {
      color: theme.text,
    },
    tabsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    tabButton: {
      flex: 1,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 6,
      paddingHorizontal: 4,
    },
    tabText: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 13,
      fontWeight: '600',
    },
    tabTextActive: {
      color: theme.text,
    },
    tabUnderline: {
      width: 28,
      height: 2,
      borderRadius: 999,
      backgroundColor: 'transparent',
    },
    tabUnderlineActive: {
      backgroundColor: theme.accent,
    },
    tabContent: {
      paddingHorizontal: 14,
      paddingTop: 18,
    },
    recapsList: {
      gap: 14,
      alignItems: 'center',
    },
    commentsList: {
      gap: 10,
      paddingHorizontal: 4,
    },
    profileCommentCard: {
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      paddingHorizontal: 13,
      gap: 6,
    },
    profileCommentBody: {
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    profileCommentMeta: {
      color: theme.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    stateText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: 34,
    },
    emptyState: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 32,
    },
    emptyText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    centeredText: {
      color: theme.textMuted,
      fontSize: 15,
      textAlign: 'center',
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    menuSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingTop: 8,
      paddingBottom: 24,
      paddingHorizontal: 8,
      gap: 2,
    },
    menuHandle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.border,
      marginBottom: 6,
    },
    menuRow: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 12,
    },
    menuRowText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
    },
    menuRowTextDanger: {
      color: theme.danger,
    },
    menuCancelRow: {
      marginTop: 6,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
    },
    menuCancelText: {
      color: theme.textMuted,
      fontWeight: '700',
    },
  });
