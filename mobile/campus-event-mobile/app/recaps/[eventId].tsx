import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { AppScreen } from '@/components/mobile/AppScreen';
import { useAppTheme } from '@/lib/app-theme';
import { formatRelativeTime, getEventCreatorLabel } from '@/lib/mobile-backend';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import {
  createRecapPost,
  loadRecapPostsForEvent,
  type RecapMediaItem,
  type RecapPostRecord,
} from '@/lib/mobile-recaps';
import {
  pickStoryMediaFromLibrary,
  type SelectedStoryMedia,
} from '@/lib/mobile-story-composer';
import { supabase } from '@/lib/supabase';
import { useMobileApp } from '@/providers/mobile-app-provider';

type FeedTab = 'all' | 'following';

function RecapMediaSlide({
  item,
  width,
  onPress,
  styles,
}: {
  item: RecapMediaItem;
  width: number;
  onPress: () => void;
  styles: any;
}) {
  const isVideo = item.mediaType === 'video';
  const [aspectRatio, setAspectRatio] = useState(4 / 5);
  const player = useVideoPlayer(isVideo ? item.url : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });
  const slideHeight = Math.round(
    width / Math.min(1.55, Math.max(0.68, aspectRatio))
  );

  useEffect(() => {
    if (isVideo || !item.url) {
      setAspectRatio(4 / 5);
      return;
    }

    Image.getSize(
      item.url,
      (imageWidth, imageHeight) => {
        if (imageWidth > 0 && imageHeight > 0) {
          setAspectRatio(imageWidth / imageHeight);
        }
      },
      () => setAspectRatio(4 / 5)
    );
  }, [isVideo, item.url]);

  return (
    <Pressable style={[styles.mediaSlide, { width, height: slideHeight }]} onPress={onPress}>
      {isVideo ? (
        <>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls
            allowsFullscreen
            allowsPictureInPicture={false}
          />
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={12} color="#ffffff" />
            <Text style={styles.videoBadgeText}>Video</Text>
          </View>
        </>
      ) : (
        <Image
          source={{ uri: item.url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}
    </Pressable>
  );
}

function RecapMediaCarousel({
  postId,
  media,
  width,
  showMenu,
  onToggleMenu,
  onOpenOptions,
  styles,
}: {
  postId: string;
  media: RecapMediaItem[];
  width: number;
  showMenu: boolean;
  onToggleMenu: () => void;
  onOpenOptions: () => void;
  styles: any;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleMedia = media.slice(0, 4);
  if (visibleMedia.length === 0) return null;
  const mediaWidth = Math.max(280, width);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / mediaWidth);
    setActiveIndex(Math.max(0, Math.min(nextIndex, visibleMedia.length - 1)));
  };

  return (
    <View style={styles.mediaCarousel}>
      <ScrollView
        horizontal
        pagingEnabled
        nestedScrollEnabled
        bounces={false}
        decelerationRate="fast"
        snapToInterval={mediaWidth}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}>
        {visibleMedia.map((item) => (
          <RecapMediaSlide
            key={`${postId}-${item.id}`}
            item={item}
            width={mediaWidth}
            onPress={onToggleMenu}
            styles={styles}
          />
        ))}
      </ScrollView>

      {showMenu ? (
        <Pressable style={styles.mediaOptionsButton} onPress={onOpenOptions}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#ffffff" />
        </Pressable>
      ) : null}

      {visibleMedia.length > 1 ? (
        <View style={styles.mediaCountPill}>
          <Text style={styles.mediaCountText}>
            {activeIndex + 1}/{visibleMedia.length}
          </Text>
        </View>
      ) : null}

      {visibleMedia.length > 1 ? (
        <View style={styles.paginationDots}>
          {visibleMedia.map((item, index) => (
            <View
              key={`${postId}-${item.id}-dot`}
              style={[styles.paginationDot, index === activeIndex && styles.paginationDotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RecapCaption({
  name,
  caption,
  styles,
}: {
  name: string;
  caption: string;
  styles: any;
}) {
  if (!caption) return null;
  return (
    <Text style={styles.captionText}>
      <Text style={styles.captionAuthor}>{name}: </Text>
      {caption}
    </Text>
  );
}

function TextOnlyRecapCard({
  name,
  caption,
  styles,
}: {
  name: string;
  caption: string;
  styles: any;
}) {
  if (!caption) return null;
  return (
    <View style={styles.textOnlyCard}>
      <RecapCaption name={name} caption={caption} styles={styles} />
    </View>
  );
}

function RecapPostCard({
  post,
  eventImage,
  eventTitle,
  isLiked,
  isReposted,
  isSaved,
  mediaWidth,
  styles,
  theme,
  onPressAuthor,
  onOpenEvent,
  onLike,
  onComment,
  onRepost,
  onShare,
  onSave,
}: {
  post: RecapPostRecord;
  eventImage: string;
  eventTitle: string;
  isLiked: boolean;
  isReposted: boolean;
  isSaved: boolean;
  mediaWidth: number;
  styles: any;
  theme: ReturnType<typeof useAppTheme>;
  onPressAuthor: (post: RecapPostRecord) => void;
  onOpenEvent: () => void;
  onLike: () => void;
  onComment: () => void;
  onRepost: () => void;
  onShare: () => void;
  onSave: () => void;
}) {
  const hasMedia = post.media.length > 0;
  const [showMediaMenu, setShowMediaMenu] = useState(false);

  return (
    <View style={styles.postCard}>
      <View style={styles.postUserRow}>
        <Pressable style={styles.postAuthorTapArea} onPress={() => onPressAuthor(post)}>
          <Image
            source={getAvatarImageSource(post.authorAvatar)}
            style={styles.postAvatar}
          />
          <View style={styles.postUserCopy}>
            <View style={styles.postHeader}>
              <Text style={styles.postName} numberOfLines={1}>
                {post.authorName}
              </Text>
              {post.authorUsername ? (
                <Text style={styles.postMeta} numberOfLines={1}>
                  @{post.authorUsername}
                </Text>
              ) : null}
              <Text style={styles.postMeta}>· {formatRelativeTime(post.createdAt)}</Text>
            </View>
          </View>
        </Pressable>
        <Pressable
          style={styles.eventThumbButton}
          accessibilityRole="button"
          accessibilityLabel={eventTitle ? `Open ${eventTitle} recap` : 'Open event recap'}
          onPress={onOpenEvent}>
          <Image source={getEventImageSource(eventImage)} style={styles.eventThumbImage} />
        </Pressable>
      </View>

      {hasMedia ? (
        <RecapMediaCarousel
          postId={post.id}
          media={post.media}
          width={mediaWidth}
          showMenu={showMediaMenu}
          onToggleMenu={() => setShowMediaMenu((visible) => !visible)}
          onOpenOptions={() => Alert.alert('Recap options', 'Post options are coming soon.')}
          styles={styles}
        />
      ) : (
        <TextOnlyRecapCard
          name={post.authorUsername || post.authorName}
          caption={post.caption}
          styles={styles}
        />
      )}

      {hasMedia ? (
        <RecapCaption
          name={post.authorUsername || post.authorName}
          caption={post.caption}
          styles={styles}
        />
      ) : null}

      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={onLike}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={25}
            color={isLiked ? theme.accent : theme.text}
          />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onComment}>
          <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onRepost}>
          <Ionicons
            name="repeat-outline"
            size={25}
            color={isReposted ? theme.accent : theme.text}
          />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={24} color={theme.text} />
        </Pressable>
        <Pressable style={[styles.actionButton, styles.saveActionButton]} onPress={onSave}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={25}
            color={isSaved ? theme.accent : theme.text}
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function EventRecapFeedScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    currentUser,
    followRelationships,
    getEventById,
    getProfileById,
    currentUserAttendedEvent,
  } = useMobileApp();
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [recapPosts, setRecapPosts] = useState<RecapPostRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canPostRecap, setCanPostRecap] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [selectedImages, setSelectedImages] = useState<SelectedStoryMedia[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [repostedIds, setRepostedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const event = eventId ? getEventById(String(eventId)) : undefined;
  const hostProfile = event?.createdBy ? getProfileById(event.createdBy) : undefined;
  const mediaWidth = Math.max(300, screenWidth - 28);
  const handleOpenCurrentEventRecap = useCallback(() => {
    if (!event?.id) return;
    router.push({
      pathname: '/recaps/[eventId]',
      params: { eventId: event.id },
    });
  }, [event?.id, router]);

  const followingAuthorIds = useMemo(
    () =>
      new Set(
        followRelationships
          .filter((relationship) => relationship.followerId === currentUser.id)
          .map((relationship) => String(relationship.followingId))
      ),
    [currentUser.id, followRelationships]
  );

  const allPosts = useMemo(
    () =>
      [...recapPosts].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [recapPosts]
  );

  const visiblePosts = useMemo(
    () =>
      activeTab === 'following'
        ? allPosts.filter((post) => followingAuthorIds.has(String(post.authorId)))
        : allPosts,
    [activeTab, allPosts, followingAuthorIds]
  );

  const refreshRecaps = useCallback(async () => {
    if (!event?.id) return;

    setIsLoading(true);
    const [posts, eligible] = await Promise.all([
      loadRecapPostsForEvent(event.id),
      currentUserAttendedEvent(event.id),
    ]);
    setRecapPosts(posts);
    setCanPostRecap(Boolean(eligible || event.createdBy === currentUser.id));
    setIsLoading(false);
  }, [currentUser.id, currentUserAttendedEvent, event?.createdBy, event?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      void refreshRecaps().finally(() => {
        if (!isActive) return;
      });

      const channel =
        event?.id && supabase
          ? supabase
              .channel(`mobile-recaps-${event.id}`)
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'recap_posts',
                  filter: `event_id=eq.${event.id}`,
                },
                () => {
                  void refreshRecaps();
                }
              )
              .on(
                'postgres_changes',
                {
                  event: '*',
                  schema: 'public',
                  table: 'recap_media',
                },
                () => {
                  void refreshRecaps();
                }
              )
              .subscribe()
          : null;

      return () => {
        isActive = false;
        if (channel && supabase) {
          void supabase.removeChannel(channel);
        }
      };
    }, [event?.id, refreshRecaps])
  );

  const resetComposer = () => {
    setDraftText('');
    setSelectedImages([]);
    setComposerVisible(false);
  };

  const handleOpenComposer = () => {
    if (!event) return;
    if (!canPostRecap) {
      Alert.alert(
        'Recaps',
        "Recaps are limited to people who attended or RSVP'd to this event."
      );
      return;
    }
    setComposerVisible(true);
  };

  const handleAddImage = async () => {
    if (selectedImages.length >= 4) {
      Alert.alert('Add images', 'Recaps support up to 4 images for now.');
      return;
    }

    try {
      const media = await pickStoryMediaFromLibrary();
      if (!media) return;
      if (media.mediaType !== 'image') {
        Alert.alert('Add images', 'This first recap version supports images only.');
        return;
      }
      setSelectedImages((current) => [...current, media].slice(0, 4));
    } catch (error) {
      Alert.alert(
        'Add images',
        error instanceof Error ? error.message : 'Could not choose that image.'
      );
    }
  };

  const handlePostRecap = async () => {
    if (!event?.id || isPosting) return;

    const trimmedText = draftText.trim();
    if (!trimmedText && selectedImages.length === 0) {
      Alert.alert('Add Recap', 'Write something or add at least one image.');
      return;
    }

    setIsPosting(true);

    try {
      if (selectedImages.length === 0) {
        await createRecapPost({
          eventId: event.id,
          userId: currentUser.id,
          body: trimmedText,
          media: [],
        });
        await refreshRecaps();
        resetComposer();
        return;
      }

      await createRecapPost({
        eventId: event.id,
        userId: currentUser.id,
        body: trimmedText,
        media: selectedImages,
      });
      await refreshRecaps();
      resetComposer();
    } catch (error) {
      Alert.alert(
        'Post Recap',
        error instanceof Error ? error.message : 'Could not post this recap right now.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  const toggleSetEntry = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    postId: string
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleSharePost = async (post: RecapPostRecord) => {
    await Share.share({
      message: `${post.authorName} posted a recap from ${event?.title || 'an event'}: ${post.caption}`,
    });
  };

  const handleOpenAuthor = (post: RecapPostRecord) => {
    if (post.authorId === currentUser.id) {
      router.push('/(tabs)/profile');
      return;
    }

    if (post.authorUsername) {
      router.push({
        pathname: '/profile/[username]',
        params: { username: post.authorUsername },
      });
      return;
    }

    Alert.alert('Profile', 'This profile is not available yet.');
  };

  if (!event) {
    return (
      <AppScreen>
        <View style={styles.centeredState}>
          <Text style={styles.emptyTitle}>Event not found.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={styles.headerButtonPlaceholder} />
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: 'all' as const, label: 'All' },
            { key: 'following' as const, label: 'Following' },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={styles.tabButton}
                onPress={() => setActiveTab(tab.key)}>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {isActive ? <View style={styles.tabIndicator} /> : null}
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.feedContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.hostCard}
          onPress={() =>
            Alert.alert(
              'Host rating',
              'Host and event rating will live here in the next Recaps pass.'
            )
          }>
          <Image
            source={getAvatarImageSource(hostProfile?.avatar || event.creatorAvatar)}
            style={styles.hostAvatar}
          />
          <View style={styles.hostCopy}>
            <Text style={styles.hostLabel}>Host</Text>
            <Text style={styles.hostName} numberOfLines={1}>
              {hostProfile?.name || getEventCreatorLabel(event)}
            </Text>
          </View>
          <Ionicons name="star-outline" size={20} color={theme.accent} />
        </Pressable>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.loadingText}>Loading recaps...</Text>
          </View>
        ) : visiblePosts.length > 0 ? (
          visiblePosts.map((post) => (
            <RecapPostCard
              key={post.id}
              post={post}
              eventImage={event.image}
              eventTitle={event.title}
              isLiked={likedIds.has(post.id)}
              isReposted={repostedIds.has(post.id)}
              isSaved={savedIds.has(post.id)}
              mediaWidth={mediaWidth}
              styles={styles}
              theme={theme}
              onPressAuthor={handleOpenAuthor}
              onOpenEvent={handleOpenCurrentEventRecap}
              onLike={() => toggleSetEntry(setLikedIds, post.id)}
              onComment={() => Alert.alert('Comments', 'Recap comments are next.')}
              onRepost={() => toggleSetEntry(setRepostedIds, post.id)}
              onShare={() => void handleSharePost(post)}
              onSave={() => toggleSetEntry(setSavedIds, post.id)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No recaps yet</Text>
            <Text style={styles.emptyCopy}>
              Be the first to add a recap from this event.
            </Text>
          </View>
        )}
        </ScrollView>

        <Pressable style={styles.addRecapButton} onPress={handleOpenComposer}>
          <Ionicons name="add" size={18} color={theme.accentText} />
          <Text style={styles.addRecapText}>Add Recap</Text>
        </Pressable>
      </KeyboardAvoidingView>

      <Modal visible={composerVisible} transparent animationType="slide" onRequestClose={resetComposer}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalScrim}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.composerCard}>
                <View style={styles.composerHeader}>
                  <Pressable onPress={resetComposer}>
                    <Text style={styles.composerCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.composerTitle}>Add Recap</Text>
                  <Pressable disabled={isPosting} onPress={() => void handlePostRecap()}>
                    <Text style={[styles.composerPost, isPosting && styles.composerPostDisabled]}>
                      {isPosting ? 'Posting' : 'Post'}
                    </Text>
                  </Pressable>
                </View>

                <TextInput
                  value={draftText}
                  onChangeText={setDraftText}
                  placeholder="What happened at the event?"
                  placeholderTextColor={theme.textMuted}
                  style={styles.composerInput}
                  multiline
                  textAlignVertical="top"
                />

                {selectedImages.length > 0 ? (
                  <View style={styles.selectedImagesRow}>
                    {selectedImages.map((image, index) => (
                      <View key={`${image.uri}-${index}`} style={styles.selectedImageWrap}>
                        <Image source={{ uri: image.uri }} style={styles.selectedImage} />
                        <Pressable
                          style={styles.removeImageButton}
                          onPress={() =>
                            setSelectedImages((current) =>
                              current.filter((_, imageIndex) => imageIndex !== index)
                            )
                          }>
                          <Ionicons name="close" size={13} color="#ffffff" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable style={styles.addImageButton} onPress={() => void handleAddImage()}>
                  <Ionicons name="images-outline" size={18} color={theme.accent} />
                  <Text style={styles.addImageText}>Add images</Text>
                  <Text style={styles.addImageCount}>{selectedImages.length}/4</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const buildStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    header: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 10,
    },
    headerButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerButtonPlaceholder: {
      width: 38,
      height: 38,
    },
    headerTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 17,
      fontWeight: '900',
      textAlign: 'center',
    },
    tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabButton: {
      flex: 1,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabText: {
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: '800',
    },
    tabTextActive: {
      color: theme.text,
    },
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      width: 92,
      height: 3,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    feedContent: {
      paddingBottom: 112,
    },
    hostCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    hostAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.surfaceAlt,
    },
    hostCopy: {
      flex: 1,
      gap: 2,
    },
    hostLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    hostName: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '900',
    },
    postCard: {
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
      gap: 11,
    },
    postUserRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    postAuthorTapArea: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    postAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.surfaceAlt,
    },
    postUserCopy: {
      flex: 1,
      minWidth: 0,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
    },
    postName: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '900',
      maxWidth: 116,
    },
    postMeta: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '700',
      maxWidth: 106,
    },
    eventThumbButton: {
      width: 42,
      height: 50,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    eventThumbImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    mediaCarousel: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 22,
      backgroundColor: 'transparent',
    },
    mediaSlide: {
      overflow: 'hidden',
      borderRadius: 22,
      backgroundColor: 'transparent',
    },
    mediaOptionsButton: {
      position: 'absolute',
      right: 12,
      top: 12,
      width: 42,
      height: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.54)',
    },
    videoBadge: {
      position: 'absolute',
      left: 12,
      top: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    videoBadgeText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '900',
    },
    mediaCountPill: {
      position: 'absolute',
      left: 12,
      top: 12,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    mediaCountText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '900',
    },
    paginationDots: {
      position: 'absolute',
      bottom: 9,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.34)',
    },
    paginationDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: 'rgba(255,255,255,0.42)',
    },
    paginationDotActive: {
      backgroundColor: theme.accent,
    },
    captionText: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
    },
    captionAuthor: {
      color: theme.text,
      fontWeight: '900',
    },
    textOnlyCard: {
      paddingTop: 2,
      paddingBottom: 1,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 19,
      paddingTop: 2,
    },
    actionButton: {
      width: 30,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveActionButton: {
      marginLeft: 'auto',
    },
    loadingState: {
      minHeight: 280,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyState: {
      minHeight: 320,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
      gap: 8,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyCopy: {
      color: theme.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    centeredState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 16,
    },
    primaryButton: {
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: theme.accent,
    },
    primaryButtonText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '900',
    },
    addRecapButton: {
      position: 'absolute',
      right: 18,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: theme.accent,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 8,
    },
    addRecapText: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '900',
    },
    modalScrim: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    modalKeyboardAvoider: {
      flex: 1,
    },
    modalScrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    composerCard: {
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    composerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    composerCancel: {
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: '800',
    },
    composerTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '900',
    },
    composerPost: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '900',
    },
    composerPostDisabled: {
      color: theme.textMuted,
    },
    composerInput: {
      minHeight: 118,
      color: theme.text,
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '600',
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedImagesRow: {
      flexDirection: 'row',
      gap: 8,
    },
    selectedImageWrap: {
      width: 68,
      height: 68,
    },
    selectedImage: {
      width: 68,
      height: 68,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
    },
    removeImageButton: {
      position: 'absolute',
      right: -5,
      top: -5,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    addImageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addImageText: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      fontWeight: '900',
    },
    addImageCount: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: '800',
    },
  });
