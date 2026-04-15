import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const WINDOW_HEIGHT = Dimensions.get('window').height;

import { useAppTheme } from '@/lib/app-theme';
import { formatRelativeTime } from '@/lib/mobile-backend';
import { getAvatarImageSource } from '@/lib/mobile-media';
import type { MobileStoryStripItem } from '@/lib/mobile-stories';
import type { ProfileRecord, StoryRecord, StoryViewerRecord } from '@/types/models';

type StoryViewerModalProps = {
  visible: boolean;
  items: MobileStoryStripItem[];
  initialItemId: string | null;
  currentUserId: string;
  followingProfiles: ProfileRecord[];
  recentDmPeople: ProfileRecord[];
  reactedStoryIds: Set<string>;
  onClose: () => void;
  onStoryOpen: (story: StoryRecord) => void;
  onToggleHeart: (story: StoryRecord) => Promise<void>;
  onReplyToStory: (story: StoryRecord, message: string) => Promise<void>;
  onShareStory: (story: StoryRecord, recipient: ProfileRecord) => Promise<void>;
  onLoadViewers: (story: StoryRecord) => Promise<StoryViewerRecord[]>;
};

const STORY_DURATION_MS = 5000;

const toTrimmedString = (value: string | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const getUniqueProfiles = (profiles: ProfileRecord[]) => {
  const seen = new Set<string>();

  return profiles.filter((profile) => {
    const key = String(profile.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function StoryViewerModal({
  visible,
  items,
  initialItemId,
  currentUserId,
  followingProfiles,
  recentDmPeople,
  reactedStoryIds,
  onClose,
  onStoryOpen,
  onToggleHeart,
  onReplyToStory,
  onShareStory,
  onLoadViewers,
}: StoryViewerModalProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReplySheetVisible, setIsReplySheetVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplySending, setIsReplySending] = useState(false);
  const [isShareSheetVisible, setIsShareSheetVisible] = useState(false);
  const [isShareSending, setIsShareSending] = useState(false);
  const [shareQuery, setShareQuery] = useState('');
  const [isViewersSheetVisible, setIsViewersSheetVisible] = useState(false);
  const [isViewersLoading, setIsViewersLoading] = useState(false);
  const [viewersByStoryId, setViewersByStoryId] = useState<Record<string, StoryViewerRecord[]>>(
    {}
  );
  const autoAdvancedStoryIdRef = useRef<string | null>(null);
  const viewersSheetTranslate = useRef(new Animated.Value(WINDOW_HEIGHT)).current;
  const viewersBackdropOpacity = useRef(new Animated.Value(0)).current;
  const loadedViewerStoryIdsRef = useRef<Set<string>>(new Set());

  const activeItems = useMemo(
    () => items.filter((item) => !item.isPlaceholder && item.stories.length > 0),
    [items]
  );

  useEffect(() => {
    if (!visible || activeItems.length === 0) return;

    const nextGroupIndex = Math.max(
      activeItems.findIndex((item) => item.id === initialItemId),
      0
    );

    setGroupIndex(nextGroupIndex);
    setStoryIndex(0);
    setProgress(0);
    setIsPaused(false);
    setIsReplySheetVisible(false);
    setReplyText('');
    setIsShareSheetVisible(false);
    setShareQuery('');
    setIsViewersSheetVisible(false);
  }, [activeItems, initialItemId, visible]);

  useEffect(() => {
    if (!visible || !currentItem || !currentUserId) return;
    
    const story = currentItem.stories[storyIndex];
    if (!story || String(story.authorId) !== String(currentUserId)) return;

    const storyId = String(story.id);
    if (loadedViewerStoryIdsRef.current.has(storyId)) return;

    let isActive = true;
    const fetchViewers = async () => {
      try {
        const viewers = await onLoadViewers(story);
        if (!isActive) return;
        setViewersByStoryId((currentValue) => ({ ...currentValue, [storyId]: viewers }));
        loadedViewerStoryIdsRef.current.add(storyId);
      } catch {}
    };
    void fetchViewers();
    return () => { isActive = false; };
  }, [currentItem, currentUserId, onLoadViewers, storyIndex, visible]);

  const currentItem = activeItems[groupIndex] || null;
  const currentStory = currentItem?.stories[storyIndex] || null;
  const isOwnStory = Boolean(
    currentStory && String(currentStory.authorId) === String(currentUserId)
  );
  const hasHeart = Boolean(currentStory && reactedStoryIds.has(String(currentStory.id)));
  const currentViewers = currentStory ? viewersByStoryId[currentStory.id] || [] : [];

  const recipientProfiles = useMemo(() => {
    const allPeople = getUniqueProfiles([...recentDmPeople, ...followingProfiles]);
    const normalizedQuery = shareQuery.trim().toLowerCase();

    return allPeople
      .filter((profile) => String(profile.id) !== String(currentUserId))
      .filter((profile) =>
        normalizedQuery
          ? `${profile.name} ${profile.username}`.toLowerCase().includes(normalizedQuery)
          : true
      );
  }, [currentUserId, followingProfiles, recentDmPeople, shareQuery]);

  const advanceStory = useCallback(() => {
    if (!currentItem) {
      onClose();
      return;
    }

    if (storyIndex < currentItem.stories.length - 1) {
      setStoryIndex((currentValue) => currentValue + 1);
      setProgress(0);
      return;
    }

    if (groupIndex < activeItems.length - 1) {
      setGroupIndex((currentValue) => currentValue + 1);
      setStoryIndex(0);
      setProgress(0);
      return;
    }

    onClose();
  }, [activeItems.length, currentItem, groupIndex, onClose, storyIndex]);

  const rewindStory = useCallback(() => {
    if (!currentItem) {
      onClose();
      return;
    }

    if (storyIndex > 0) {
      setStoryIndex((currentValue) => currentValue - 1);
      setProgress(0);
      return;
    }

    if (groupIndex > 0) {
      const previousItem = activeItems[groupIndex - 1];
      setGroupIndex((currentValue) => currentValue - 1);
      setStoryIndex(Math.max(previousItem.stories.length - 1, 0));
      setProgress(0);
      return;
    }

    onClose();
  }, [activeItems, currentItem, groupIndex, onClose, storyIndex]);

  useEffect(() => {
    if (!visible || !currentStory) return;

    autoAdvancedStoryIdRef.current = null;
    onStoryOpen(currentStory);
    setProgress(0);
  }, [currentStory, onStoryOpen, visible]);

  useEffect(() => {
    if (
      !visible ||
      !currentStory ||
      isPaused ||
      isViewersSheetVisible ||
      isReplySheetVisible ||
      isShareSheetVisible
    )
      return;

    const interval = setInterval(() => {
      setProgress((currentValue) => Math.min(currentValue + 50 / STORY_DURATION_MS, 1));
    }, 50);

    return () => clearInterval(interval);
  }, [
    currentStory,
    isPaused,
    isReplySheetVisible,
    isShareSheetVisible,
    isViewersSheetVisible,
    visible,
  ]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(viewersSheetTranslate, {
        toValue: isViewersSheetVisible ? 0 : WINDOW_HEIGHT,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(viewersBackdropOpacity, {
        toValue: isViewersSheetVisible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isViewersSheetVisible, viewersBackdropOpacity, viewersSheetTranslate]);

  useEffect(() => {
    if (!visible || !currentStory || progress < 1) return;

    const currentStoryId = String(currentStory.id);

    if (autoAdvancedStoryIdRef.current === currentStoryId) {
      return;
    }

    autoAdvancedStoryIdRef.current = currentStoryId;
    advanceStory();
  }, [advanceStory, currentStory, progress, visible]);

  const handleToggleHeart = async () => {
    if (!currentStory || isOwnStory) return;

    try {
      await onToggleHeart(currentStory);
    } catch {
      Alert.alert('Story', 'Could not update the heart right now.');
    }
  };

  const handleSendReply = async () => {
    if (!currentStory) return;

    const trimmedReply = toTrimmedString(replyText);
    if (!trimmedReply) return;

    setIsReplySending(true);

    try {
      await onReplyToStory(currentStory, trimmedReply);
      setReplyText('');
      setIsReplySheetVisible(false);
      Alert.alert('Sent', 'Your reply was sent.');
    } catch {
      Alert.alert('Story', 'Could not send your reply right now.');
    } finally {
      setIsReplySending(false);
    }
  };

  const handleOpenViewers = async () => {
    if (!currentStory || !isOwnStory) return;

    setIsViewersSheetVisible(true);
    setIsViewersLoading(true);

    try {
      if (loadedViewerStoryIdsRef.current.has(currentStory.id)) {
        // Already loaded via auto-load
        return;
      }
      const viewers = await onLoadViewers(currentStory);
      setViewersByStoryId((currentValue) => ({
        ...currentValue,
        [currentStory.id]: viewers,
      }));
      loadedViewerStoryIdsRef.current.add(currentStory.id);
    } finally {
      setIsViewersLoading(false);
    }
  };

  const handleShareToProfile = async (recipient: ProfileRecord) => {
    if (!currentStory) return;

    setIsShareSending(true);

    try {
      await onShareStory(currentStory, recipient);
      setIsShareSheetVisible(false);
      setShareQuery('');
      Alert.alert(
        'Sent',
        `Story sent to ${
          recipient.name || (recipient.username ? `@${recipient.username}` : 'that user')
        }.`
      );
    } catch {
      Alert.alert('Story', 'Could not share that story right now.');
    } finally {
      setIsShareSending(false);
    }
  };

  if (!visible || !currentStory || !currentItem) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.header}>
            <View style={styles.progressRow}>
              {currentItem.stories.map((story, index) => {
                const fill =
                  index < storyIndex ? 1 : index === storyIndex ? progress : 0;

                return (
                  <View key={story.id} style={styles.progressTrack}>
                    <View style={[styles.progressFill, { flex: fill }]} />
                    {fill < 1 ? <View style={{ flex: 1 - fill }} /> : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.identityRow}>
              <View style={styles.identityBlock}>
                <Image
                  source={getAvatarImageSource(currentStory.authorAvatar)}
                  style={styles.identityAvatar}
                />
                <View style={styles.identityCopy}>
                  <Text style={styles.identityName}>
                    {currentStory.authorUsername || currentStory.authorName}
                  </Text>
                  <Text style={styles.identityMeta}>
                    {formatRelativeTime(currentStory.createdAt)}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={22} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.mediaStage}>
            {currentStory.mediaType === 'image' ? (
              <Image source={{ uri: currentStory.mediaUrl }} style={styles.media} />
            ) : (
              <View style={styles.videoFallback}>
                <Ionicons name="videocam" size={42} color="#ffffff" />
                <Text style={styles.videoFallbackText}>Video story</Text>
              </View>
            )}

            {currentStory.caption ? (
              <View style={styles.captionWrap}>
                <Text style={styles.captionText}>{currentStory.caption}</Text>
              </View>
            ) : null}

            <View style={styles.tapZones} pointerEvents="box-none">
              <Pressable
                style={styles.tapZone}
                onPress={rewindStory}
                onPressIn={() => setIsPaused(true)}
                onPressOut={() => setIsPaused(false)}
              />
              <Pressable
                style={styles.tapZone}
                onPress={advanceStory}
                onPressIn={() => setIsPaused(true)}
                onPressOut={() => setIsPaused(false)}
              />
            </View>
          </View>

          <View style={styles.bottomBar}>
            {isOwnStory ? (
              <>
                <Pressable style={styles.viewsButton} onPress={() => void handleOpenViewers()}>
                  <View style={styles.viewsAvatarStack}>
                    {currentViewers.slice(0, 3).length > 0 ? (
                      currentViewers.slice(0, 3).map((viewer, index) => (
                        <Image
                          key={viewer.id}
                          source={getAvatarImageSource(viewer.avatar)}
                          style={[styles.viewsAvatar, index > 0 && styles.viewsAvatarOverlap]}
                        />
                      ))
                    ) : (
                      <View style={styles.viewsAvatarEmpty}>
                        <Ionicons name="eye-outline" size={14} color="#ffffff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.viewsText}>
                    {currentViewers.length > 0 ? `${currentViewers.length} Views` : 'Views'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.iconAction}
                  onPress={() => setIsShareSheetVisible(true)}>
                  <Ionicons name="paper-plane-outline" size={20} color="#ffffff" />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.replyButton}
                  onPress={() => setIsReplySheetVisible(true)}>
                  <Text style={styles.replyButtonText}>Send message</Text>
                </Pressable>

                <View style={styles.otherActions}>
                  <Pressable style={styles.iconAction} onPress={() => void handleToggleHeart()}>
                    <Ionicons
                      name={hasHeart ? 'heart' : 'heart-outline'}
                      size={22}
                      color={hasHeart ? '#ff5a7a' : '#ffffff'}
                    />
                  </Pressable>

                  <Pressable
                    style={styles.iconAction}
                    onPress={() => setIsShareSheetVisible(true)}>
                    <Ionicons name="paper-plane-outline" size={20} color="#ffffff" />
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <Animated.View
            pointerEvents={isViewersSheetVisible ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, { opacity: viewersBackdropOpacity }]}>
            <Pressable
              style={styles.inlineSheetBackdrop}
              onPress={() => setIsViewersSheetVisible(false)}
            />
          </Animated.View>

          <Animated.View
            pointerEvents={isViewersSheetVisible ? 'auto' : 'none'}
            style={[
              styles.inlineSheet,
              { transform: [{ translateY: viewersSheetTranslate }] },
            ]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {currentViewers.length > 0
                ? `${currentViewers.length} ${currentViewers.length === 1 ? 'view' : 'views'}`
                : 'Views'}
            </Text>

            {isViewersLoading ? (
              <View style={styles.sheetState}>
                <ActivityIndicator color={theme.text} />
              </View>
            ) : currentViewers.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {currentViewers.map((viewer) => {
                  const primaryLabel =
                    viewer.username
                      ? `@${viewer.username}`
                      : viewer.name
                        ? viewer.name
                        : 'Viewer';

                  const showSubtitle = Boolean(
                    viewer.username && viewer.name && viewer.name !== viewer.username
                  );

                  return (
                    <View key={viewer.id} style={styles.viewerRow}>
                      <Pressable
                        style={styles.viewerIdentityPressable}
                        onPress={() => {
                          onClose();
                          router.push({
                            pathname: '/profile/[username]',
                            params: { username: viewer.username || viewer.viewerId },
                          });
                        }}
                      >
                        <Image
                          source={getAvatarImageSource(viewer.avatar)}
                          style={styles.viewerAvatar}
                        />
                        <View style={styles.viewerCopy}>
                          <Text style={styles.viewerName} numberOfLines={1}>
                            {primaryLabel}
                          </Text>
                          {showSubtitle ? (
                            <Text style={styles.viewerUsername} numberOfLines={1}>
                              {viewer.name}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                      <Text style={styles.viewerTime}>
                        {viewer.viewedAt ? formatRelativeTime(viewer.viewedAt) : 'Recently'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.sheetState}>
                <Text style={styles.sheetEmptyTitle}>No views yet.</Text>
                <Text style={styles.sheetEmptyCopy}>
                  People who open this story will appear here.
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={isReplySheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReplySheetVisible(false)}>
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setIsReplySheetVisible(false)}>
          <Pressable
            style={styles.sheet}
            onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Reply to story</Text>
            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Send message"
              placeholderTextColor={theme.textMuted}
              style={styles.replyInput}
              multiline
            />
            <Pressable
              style={[styles.primarySheetButton, isReplySending && styles.buttonDisabled]}
              disabled={isReplySending}
              onPress={() => void handleSendReply()}>
              <Text style={styles.primarySheetButtonText}>
                {isReplySending ? 'Sending...' : 'Send'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isShareSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsShareSheetVisible(false)}>
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setIsShareSheetVisible(false)}>
          <Pressable
            style={styles.sheet}
            onPress={(eventPress) => eventPress.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Send story</Text>
            <TextInput
              value={shareQuery}
              onChangeText={setShareQuery}
              placeholder="Search people"
              placeholderTextColor={theme.textMuted}
              style={styles.replyInput}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {recipientProfiles.map((profile) => (
                <Pressable
                  key={profile.id}
                  style={styles.viewerRow}
                  disabled={isShareSending}
                  onPress={() => void handleShareToProfile(profile)}>
                  <Image
                    source={getAvatarImageSource(profile.avatar)}
                    style={styles.viewerAvatar}
                  />
                  <View style={styles.viewerCopy}>
                    <Text style={styles.viewerName}>{profile.name}</Text>
                    <Text style={styles.viewerUsername}>
                      {profile.username ? `@${profile.username}` : 'Campus User'}
                    </Text>
                  </View>
                  <Ionicons name="paper-plane-outline" size={18} color={theme.textMuted} />
                </Pressable>
              ))}

              {recipientProfiles.length === 0 ? (
                <View style={styles.sheetState}>
                  <Text style={styles.sheetEmptyTitle}>No people matched.</Text>
                  <Text style={styles.sheetEmptyCopy}>
                    Following and recent DM contacts will appear here.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: '#05070c',
      justifyContent: 'space-between',
    },
    header: {
      paddingTop: 54,
      paddingHorizontal: 12,
      gap: 10,
      zIndex: 3,
    },
    progressRow: {
      flexDirection: 'row',
      gap: 6,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.2)',
      flexDirection: 'row',
    },
    progressFill: {
      backgroundColor: '#ffffff',
      borderRadius: 999,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    identityBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    identityAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    identityCopy: {
      flexShrink: 1,
      gap: 2,
    },
    identityName: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    identityMeta: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 11,
      fontWeight: '600',
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    mediaStage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    media: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    videoFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10141e',
      gap: 10,
    },
    videoFallbackText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
    },
    captionWrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 98,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: 'rgba(5, 7, 12, 0.42)',
    },
    captionText: {
      color: '#ffffff',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    tapZones: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
    },
    tapZone: {
      flex: 1,
    },
    bottomBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      zIndex: 4,
    },
    viewsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 6,
      paddingRight: 16,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: 'rgba(5, 7, 12, 0.42)',
    },
    viewsAvatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewsAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: '#10141e',
    },
    viewsAvatarOverlap: {
      marginLeft: -10,
    },
    viewsAvatarEmpty: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#10141e',
    },
    viewsText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
    },
    iconAction: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 7, 12, 0.42)',
    },
    replyButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 999,
      paddingHorizontal: 16,
      alignItems: 'flex-start',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    replyButtonText: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 14,
      fontWeight: '700',
    },
    otherActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    sheet: {
      maxHeight: '72%',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 28,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.surface,
      gap: 14,
    },
    inlineSheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    inlineSheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '72%',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 34,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: theme.surface,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 24,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    sheetTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '800',
    },
    sheetState: {
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    sheetEmptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    sheetEmptyCopy: {
      color: theme.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    viewerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    viewerIdentityPressable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    viewerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surfaceAlt,
    },
    viewerCopy: {
      flex: 1,
      gap: 2,
    },
    viewerName: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    viewerUsername: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    viewerTime: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    replyInput: {
      minHeight: 52,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: theme.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    primarySheetButton: {
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    primarySheetButtonText: {
      color: theme.background,
      fontSize: 14,
      fontWeight: '800',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
