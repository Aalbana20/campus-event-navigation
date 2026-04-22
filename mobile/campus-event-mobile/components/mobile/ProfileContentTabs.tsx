import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme, type AppTheme } from '@/lib/app-theme';
import {
  loadDiscoverPostsByIds,
  loadDiscoverPostsForAuthor,
  resolveDiscoverPostMediaUrl,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import type { EventMemoryRecord } from '@/lib/mobile-event-memories';
import { getAvatarImageSource, getEventImageSource } from '@/lib/mobile-media';
import { loadRepostsForUser, type RepostRecord } from '@/lib/mobile-profile-reposts';
import { useMobileApp } from '@/providers/mobile-app-provider';
import type { EventRecord } from '@/types/models';

type ProfileContentTabsProps = {
  profileId: string;
  isOwner: boolean;
  onContentCountsChange?: (counts: { posts: number }) => void;
};

type ProfileTab = 'grid' | 'posts' | 'reposts' | 'tags';
type PostMode = 'grid' | 'list';
type TagFilter = 'all' | 'posts' | 'event-tags';

const tabs: { id: ProfileTab; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'posts', label: 'Posts / Videos' },
  { id: 'reposts', label: 'Reposts' },
  { id: 'tags', label: 'Tags' },
];

const tagFilters: { id: TagFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'posts', label: 'Posts' },
  { id: 'event-tags', label: 'Event Tags' },
];

const toTime = (value?: string | null) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPostDate = (value?: string | null) => {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return '';

  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
};

function PostMedia({
  post,
  style,
}: {
  post: DiscoverPostRecord;
  style: object;
}) {
  const isVideo = post.mediaType === 'video';
  const player = useVideoPlayer(isVideo ? post.mediaUrl : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  if (isVideo) {
    return (
      <VideoView
        player={player}
        style={style}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    );
  }

  return <Image source={{ uri: post.mediaUrl }} style={style} />;
}

function MemoryMedia({
  memory,
  style,
}: {
  memory: EventMemoryRecord;
  style: object;
}) {
  if (memory.mediaType === 'video') {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="play-circle-outline" size={34} color="rgba(255,255,255,0.9)" />
      </View>
    );
  }

  return <Image source={{ uri: memory.mediaUrl }} style={style} />;
}

export function ProfileContentTabs({
  profileId,
  isOwner,
  onContentCountsChange,
}: ProfileContentTabsProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const {
    currentUser,
    getEventById,
    repostPost,
    setPostGridVisibility,
    loadGridPostsForAuthor,
    loadPostsTaggingUser,
    loadEventMemoriesForUser,
  } = useMobileApp();

  const [activeTab, setActiveTab] = useState<ProfileTab>('grid');
  const [postMode, setPostMode] = useState<PostMode>('grid');
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [gridPosts, setGridPosts] = useState<DiscoverPostRecord[]>([]);
  const [authorPosts, setAuthorPosts] = useState<DiscoverPostRecord[]>([]);
  const [reposts, setReposts] = useState<RepostRecord[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<DiscoverPostRecord[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<DiscoverPostRecord[]>([]);
  const [eventMemories, setEventMemories] = useState<EventMemoryRecord[]>([]);
  const [selectedPost, setSelectedPost] = useState<DiscoverPostRecord | null>(null);
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);

  const loadProfileContent = useCallback(async () => {
    if (!profileId) return;

    setIsLoading(true);
    try {
      const [nextGrid, nextAuthorPosts, nextReposts, nextTagged, nextMemories] =
        await Promise.all([
          loadGridPostsForAuthor(profileId),
          loadDiscoverPostsForAuthor(profileId),
          loadRepostsForUser(profileId),
          loadPostsTaggingUser(profileId),
          loadEventMemoriesForUser(profileId),
        ]);

      const postIds = nextReposts
        .filter((row) => row.targetType === 'post' && row.postId)
        .map((row) => row.postId as string);
      const nextRepostedPosts = await loadDiscoverPostsByIds(postIds);
      const normalizedTaggedPosts = nextTagged
        .map((row) =>
          row.post
            ? ({
                ...row.post,
                mediaUrl: resolveDiscoverPostMediaUrl(row.post.mediaUrl),
                authorName: '',
                authorUsername: '',
                authorAvatar: '',
              } as DiscoverPostRecord)
            : null
        )
        .filter(Boolean) as DiscoverPostRecord[];

      setGridPosts(nextGrid);
      setAuthorPosts(nextAuthorPosts);
      setReposts(nextReposts);
      setRepostedPosts(nextRepostedPosts);
      setTaggedPosts(normalizedTaggedPosts);
      setEventMemories(nextMemories);
    } finally {
      setIsLoading(false);
    }
  }, [
    loadEventMemoriesForUser,
    loadGridPostsForAuthor,
    loadPostsTaggingUser,
    profileId,
  ]);

  useEffect(() => {
    void loadProfileContent();
  }, [loadProfileContent]);

  useEffect(() => {
    onContentCountsChange?.({ posts: authorPosts.length });
  }, [authorPosts.length, onContentCountsChange]);

  const handleToggleGrid = async (post: DiscoverPostRecord, onGrid: boolean) => {
    const updated = await setPostGridVisibility(post.id, onGrid);
    const nextPost = updated || { ...post, onGrid };

    setAuthorPosts((posts) =>
      posts.map((item) => (item.id === post.id ? { ...item, onGrid } : item))
    );
    setGridPosts((posts) =>
      onGrid
        ? [nextPost, ...posts.filter((item) => item.id !== post.id)]
        : posts.filter((item) => item.id !== post.id)
    );
    setSelectedPost((currentPost) =>
      currentPost?.id === post.id ? { ...currentPost, onGrid } : currentPost
    );
  };

  const handleOpenPost = (post: DiscoverPostRecord) => {
    setIsPostMenuOpen(false);
    setSelectedPost(post);
  };

  const handleClosePost = () => {
    setIsPostMenuOpen(false);
    setSelectedPost(null);
  };

  const handlePostLike = () => {
    Alert.alert('Likes coming soon', 'Post likes are not wired to the backend yet.');
  };

  const handlePostComment = () => {
    Alert.alert('Comments coming soon', 'Post comments are not wired to the backend yet.');
  };

  const handlePostRepost = async () => {
    if (!selectedPost) return;

    try {
      await repostPost(selectedPost.id);
      Alert.alert('Reposted', 'This post was added to your reposts.');
    } catch (error) {
      Alert.alert(
        'Repost unavailable',
        error instanceof Error ? error.message : 'Could not repost right now.'
      );
    }
  };

  const handlePostShare = async () => {
    if (!selectedPost) return;

    try {
      await Share.share({
        message: [selectedPost.caption, selectedPost.mediaUrl].filter(Boolean).join('\n'),
      });
    } catch (error) {
      Alert.alert(
        'Share unavailable',
        error instanceof Error ? error.message : 'Could not open the share sheet.'
      );
    }
  };

  const handlePostReport = () => {
    setIsPostMenuOpen(false);
    Alert.alert('Reported', 'Thanks for reporting this post. We will review it.');
  };

  const handleOwnerGridMenuAction = () => {
    if (!selectedPost) return;

    const nextOnGrid = !selectedPost.onGrid;
    setIsPostMenuOpen(false);
    void handleToggleGrid(selectedPost, nextOnGrid);
  };

  const repostItems = useMemo(() => {
    const postLookup = new Map(repostedPosts.map((post) => [post.id, post]));

    return reposts
      .map((row) => {
        if (row.targetType === 'event' && row.eventId) {
          const event = getEventById(row.eventId);
          return event
            ? { id: row.id, type: 'event' as const, createdAt: row.createdAt, event }
            : null;
        }

        if (row.targetType === 'post' && row.postId) {
          const post = postLookup.get(row.postId);
          return post
            ? { id: row.id, type: 'post' as const, createdAt: row.createdAt, post }
            : null;
        }

        return null;
      })
      .filter(
        (
          item
        ): item is
          | { id: string; type: 'event'; createdAt: string; event: EventRecord }
          | { id: string; type: 'post'; createdAt: string; post: DiscoverPostRecord } =>
          Boolean(item)
      )
      .sort((a, b) => toTime(b?.createdAt) - toTime(a?.createdAt));
  }, [getEventById, repostedPosts, reposts]);

  const tagItems = useMemo(() => {
    const postItems = taggedPosts.map((post) => ({
      id: `post-${post.id}`,
      type: 'post' as const,
      createdAt: post.createdAt,
      post,
    }));
    const memoryItems = eventMemories.map((memory) => ({
      id: `memory-${memory.id}`,
      type: 'memory' as const,
      createdAt: memory.createdAt,
      memory,
      event: getEventById(memory.eventId),
    }));

    if (tagFilter === 'posts') return postItems;
    if (tagFilter === 'event-tags') return memoryItems;

    return [...postItems, ...memoryItems].sort(
      (a, b) => toTime(b.createdAt) - toTime(a.createdAt)
    );
  }, [eventMemories, getEventById, tagFilter, taggedPosts]);

  const renderPostTile = (post: DiscoverPostRecord) => (
    <View key={post.id} style={styles.postTileWrap}>
      <Pressable style={styles.mediaTile} onPress={() => handleOpenPost(post)}>
        <PostMedia post={post} style={styles.mediaTileImage} />
        {post.mediaType === 'video' ? (
          <View style={styles.mediaTileIcon}>
            <Ionicons name="play" size={13} color="#ffffff" />
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  const renderPostListItem = (post: DiscoverPostRecord) => (
    <View key={post.id} style={styles.postListItem}>
      <Pressable style={styles.postListThumb} onPress={() => handleOpenPost(post)}>
        <PostMedia post={post} style={styles.postListImage} />
      </Pressable>
      <View style={styles.postListCopy}>
        <Text style={styles.postListKicker}>
          {post.mediaType === 'video' ? 'Video' : 'Post'}
        </Text>
        <Text style={styles.postListTitle} numberOfLines={2}>
          {post.caption || 'Untitled post'}
        </Text>
        <Text style={styles.postListMeta}>
          {new Date(post.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  const renderEventRepost = (event: EventRecord, rowId: string) => (
    <Pressable
      key={rowId}
      style={styles.postListItem}
      onPress={() =>
        router.push({
          pathname: '/event/[id]',
          params: { id: event.id },
        })
      }>
      <Image source={getEventImageSource(event.image)} style={styles.postListImage} />
      <View style={styles.postListCopy}>
        <Text style={styles.postListKicker}>Reposted Event</Text>
        <Text style={styles.postListTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.postListMeta}>
          {[event.eventDate, event.startTime].filter(Boolean).join(' · ') || 'Campus event'}
        </Text>
      </View>
    </Pressable>
  );

  const renderGrid = (posts: DiscoverPostRecord[]) => {
    if (!posts.length) return null;

    return <View style={styles.mediaGrid}>{posts.map(renderPostTile)}</View>;
  };

  const renderEmpty = (title: string, copy: string) => (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );

  const renderGridTab = () =>
    gridPosts.length
      ? renderGrid(gridPosts)
      : renderEmpty(
          'No grid posts yet.',
          isOwner
            ? 'Add posts to your curated Grid from Posts / Videos.'
            : 'This profile has not curated a Grid yet.'
        );

  const renderPostsTab = () => (
    <View>
      <View style={styles.modeSwitch}>
        {(['grid', 'list'] as PostMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeButton, postMode === mode && styles.modeButtonActive]}
            onPress={() => setPostMode(mode)}>
            <Text
              style={[
                styles.modeButtonText,
                postMode === mode && styles.modeButtonTextActive,
              ]}>
              {mode === 'grid' ? 'Grid' : 'List'}
            </Text>
          </Pressable>
        ))}
      </View>

      {authorPosts.length
        ? postMode === 'grid'
          ? renderGrid(authorPosts)
          : authorPosts.map(renderPostListItem)
        : renderEmpty('No posts yet.', 'Posts and videos will appear here.')}
    </View>
  );

  const renderRepostsTab = () =>
    repostItems.length ? (
      <View style={styles.listStack}>
        {repostItems.map((item) =>
          item?.type === 'event'
            ? renderEventRepost(item.event, item.id)
            : item?.post
              ? renderPostListItem(item.post)
              : null
        )}
      </View>
    ) : (
      renderEmpty('No reposts yet.', 'Reposted events and posts will appear here.')
    );

  const renderTagsTab = () => (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {tagFilters.map((filter) => (
          <Pressable
            key={filter.id}
            style={[styles.filterChip, tagFilter === filter.id && styles.filterChipActive]}
            onPress={() => setTagFilter(filter.id)}>
            <Text
              style={[
                styles.filterChipText,
                tagFilter === filter.id && styles.filterChipTextActive,
              ]}>
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {tagItems.length ? (
        <View style={styles.mediaGrid}>
          {tagItems.map((item) =>
            item.type === 'post' ? (
              renderPostTile(item.post)
            ) : (
              <View key={item.id} style={styles.postTileWrap}>
                <View style={styles.mediaTile}>
                  <MemoryMedia memory={item.memory} style={styles.mediaTileImage} />
                  <View style={styles.mediaTilePill}>
                    <Text style={styles.mediaTilePillText}>Event Tag</Text>
                  </View>
                </View>
                <Text style={styles.memoryTitle} numberOfLines={1}>
                  {item.event?.title || 'Event memory'}
                </Text>
              </View>
            )
          )}
        </View>
      ) : (
        renderEmpty('No tagged content yet.', 'Tagged posts and event memories will appear here.')
      )}
    </View>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCopy}>Loading profile content...</Text>
        </View>
      );
    }

    if (activeTab === 'grid') return renderGridTab();
    if (activeTab === 'posts') return renderPostsTab();
    if (activeTab === 'reposts') return renderRepostsTab();
    return renderTagsTab();
  };

  const selectedPostIsOwner =
    Boolean(selectedPost && currentUser.id) &&
    String(selectedPost?.authorId) === String(currentUser.id);
  const selectedPostDate = formatPostDate(selectedPost?.createdAt);

  return (
    <View style={styles.wrap}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={styles.tabButton}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.id }}
            onPress={() => setActiveTab(tab.id)}>
            {tab.id === 'tags' ? (
              <View style={styles.tagsIcon}>
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={activeTab === tab.id ? theme.text : theme.textMuted}
                />
              </View>
            ) : (
              <Ionicons
                name={
                  tab.id === 'grid'
                    ? 'grid-outline'
                    : tab.id === 'posts'
                      ? 'camera-outline'
                      : 'repeat-outline'
                }
                size={22}
                color={activeTab === tab.id ? theme.text : theme.textMuted}
              />
            )}
            {activeTab === tab.id ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>

      {renderContent()}

      <Modal
        visible={Boolean(selectedPost)}
        transparent
        animationType="slide"
        onRequestClose={handleClosePost}>
        <View style={styles.viewerScreen}>
          <View style={styles.viewerTopBar}>
            <Pressable style={styles.viewerIconButton} onPress={handleClosePost}>
              <Ionicons name="chevron-back" size={30} color="#ffffff" />
            </Pressable>
            <View style={styles.viewerTitleStack}>
              <Text style={styles.viewerTitle}>Posts</Text>
              <Text style={styles.viewerSubtitle} numberOfLines={1}>
                {selectedPost?.authorUsername || selectedPost?.authorName || 'Campus'}
              </Text>
            </View>
            <Pressable
              style={styles.viewerIconButton}
              onPress={() => setIsPostMenuOpen((open) => !open)}>
              <Ionicons name="ellipsis-horizontal" size={25} color="#ffffff" />
            </Pressable>
          </View>

          {isPostMenuOpen && selectedPost ? (
            <Pressable style={styles.viewerMenuScrim} onPress={() => setIsPostMenuOpen(false)}>
              <Pressable style={styles.viewerMenu} onPress={(event) => event.stopPropagation()}>
                {selectedPostIsOwner ? (
                  <Pressable style={styles.viewerMenuItem} onPress={handleOwnerGridMenuAction}>
                    <Ionicons
                      name={selectedPost.onGrid ? 'grid-outline' : 'add-circle-outline'}
                      size={18}
                      color="#ffffff"
                    />
                    <Text style={styles.viewerMenuItemText}>
                      {selectedPost.onGrid ? 'Remove from Grid' : 'Post to Grid'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.viewerMenuItem} onPress={handlePostReport}>
                    <Ionicons name="flag-outline" size={18} color="#ff7a7a" />
                    <Text style={[styles.viewerMenuItemText, styles.viewerMenuItemDanger]}>
                      Report
                    </Text>
                  </Pressable>
                )}
              </Pressable>
            </Pressable>
          ) : null}

          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerContent}
            showsVerticalScrollIndicator={false}>
            {selectedPost ? (
              <>
                <View style={styles.viewerAuthorRow}>
                  <Image
                    source={getAvatarImageSource(selectedPost.authorAvatar)}
                    style={styles.viewerAvatar}
                  />
                  <View style={styles.viewerAuthorCopy}>
                    <Text style={styles.viewerAuthorName} numberOfLines={1}>
                      {selectedPost.authorUsername
                        ? `@${selectedPost.authorUsername}`
                        : selectedPost.authorName || 'Campus User'}
                    </Text>
                    <Text style={styles.viewerAuthorMeta} numberOfLines={1}>
                      {selectedPost.mediaType === 'video' ? 'Video post' : 'Post'}
                    </Text>
                  </View>
                </View>

                <PostMedia post={selectedPost} style={styles.viewerMedia} />

                <View style={styles.viewerActionsRow}>
                  <View style={styles.viewerLeftActions}>
                    <Pressable style={styles.viewerActionButton} onPress={handlePostLike}>
                      <Ionicons name="heart-outline" size={31} color="#ffffff" />
                    </Pressable>
                    <Pressable style={styles.viewerActionButton} onPress={handlePostComment}>
                      <Ionicons name="chatbubble-outline" size={29} color="#ffffff" />
                    </Pressable>
                    <Pressable style={styles.viewerActionButton} onPress={handlePostRepost}>
                      <Ionicons name="repeat-outline" size={30} color="#ffffff" />
                    </Pressable>
                    <Pressable style={styles.viewerActionButton} onPress={handlePostShare}>
                      <Ionicons name="paper-plane-outline" size={29} color="#ffffff" />
                    </Pressable>
                  </View>
                </View>

                {selectedPost.caption ? (
                  <Text style={styles.viewerCaption}>
                    <Text style={styles.viewerCaptionAuthor}>
                      {selectedPost.authorUsername || selectedPost.authorName || 'Campus'}{' '}
                    </Text>
                    {selectedPost.caption}
                  </Text>
                ) : null}
                {selectedPostDate ? (
                  <Text style={styles.viewerDate}>{selectedPostDate}</Text>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const buildStyles = (theme: AppTheme) => {
  const isDark = theme.background === '#05070b' || theme.background === '#000000';
  const profileSurface = isDark ? '#101010' : theme.surface;
  const profileSurfaceAlt = isDark ? '#1a1a1c' : theme.surfaceAlt;
  const profileBorder = isDark ? 'rgba(255,255,255,0.10)' : theme.border;
  const profileText = isDark ? '#ffffff' : theme.text;
  const profileMutedText = isDark ? '#c7c7cc' : theme.textMuted;

  return StyleSheet.create({
    wrap: {
      gap: 14,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: profileBorder,
      marginTop: 4,
    },
    tabButton: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      width: 36,
      height: 2,
      borderRadius: 999,
      backgroundColor: profileText,
    },
    tagsIcon: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.7,
      borderColor: profileMutedText,
      transform: [{ rotate: '45deg' }],
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 1,
      marginHorizontal: -18,
    },
    postTileWrap: {
      width: '33.1%',
      gap: 0,
    },
    mediaTile: {
      aspectRatio: 1,
      overflow: 'hidden',
      borderRadius: 0,
      backgroundColor: '#050505',
      position: 'relative',
    },
    mediaTileImage: {
      width: '100%',
      height: '100%',
      backgroundColor: '#050505',
    },
    mediaTileIcon: {
      position: 'absolute',
      right: 8,
      top: 8,
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.36)',
    },
    emptyCard: {
      borderRadius: 0,
      padding: 24,
      backgroundColor: 'transparent',
      borderWidth: 0,
      alignItems: 'center',
    },
    emptyTitle: {
      color: profileText,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 6,
    },
    emptyCopy: {
      color: profileMutedText,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    modeSwitch: {
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 999,
      backgroundColor: profileSurface,
      borderWidth: 1,
      borderColor: profileBorder,
      marginBottom: 14,
    },
    modeButton: {
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    modeButtonActive: {
      backgroundColor: profileText,
    },
    modeButtonText: {
      color: profileMutedText,
      fontSize: 13,
      fontWeight: '800',
    },
    modeButtonTextActive: {
      color: isDark ? '#000000' : theme.background,
    },
    listStack: {
      gap: 12,
    },
    postListItem: {
      flexDirection: 'row',
      gap: 12,
      borderRadius: 22,
      padding: 10,
      backgroundColor: profileSurface,
      borderWidth: 1,
      borderColor: profileBorder,
      marginBottom: 12,
    },
    postListThumb: {
      width: 92,
      height: 92,
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: profileSurfaceAlt,
    },
    postListImage: {
      width: 92,
      height: 92,
      borderRadius: 16,
      backgroundColor: profileSurfaceAlt,
    },
    postListCopy: {
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
    },
    postListKicker: {
      color: profileMutedText,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    postListTitle: {
      color: profileText,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 4,
    },
    postListMeta: {
      color: profileMutedText,
      fontSize: 12,
      marginTop: 4,
    },
    filterRow: {
      gap: 8,
      paddingBottom: 14,
    },
    filterChip: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: profileSurface,
      borderWidth: 1,
      borderColor: profileBorder,
    },
    filterChipActive: {
      backgroundColor: profileText,
      borderColor: profileText,
    },
    filterChipText: {
      color: profileMutedText,
      fontSize: 12,
      fontWeight: '800',
    },
    filterChipTextActive: {
      color: isDark ? '#000000' : theme.background,
    },
    memoryTitle: {
      color: profileMutedText,
      fontSize: 11,
      fontWeight: '700',
    },
    viewerScreen: {
      flex: 1,
      backgroundColor: '#000000',
      paddingTop: 44,
    },
    viewerTopBar: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
      zIndex: 4,
    },
    viewerIconButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerTitleStack: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 0,
    },
    viewerTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
    viewerSubtitle: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
      maxWidth: 180,
    },
    viewerMenuScrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 8,
      paddingTop: 98,
      paddingRight: 12,
      alignItems: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    viewerMenu: {
      minWidth: 190,
      borderRadius: 18,
      padding: 8,
      backgroundColor: 'rgba(18,18,20,0.98)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    viewerMenuItem: {
      minHeight: 44,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
    },
    viewerMenuItemText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
    },
    viewerMenuItemDanger: {
      color: '#ff7a7a',
    },
    viewerScroll: {
      flex: 1,
    },
    viewerContent: {
      paddingBottom: 34,
    },
    viewerAuthorRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
    },
    viewerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor: '#1a1a1c',
    },
    viewerAuthorCopy: {
      flex: 1,
      minWidth: 0,
    },
    viewerAuthorName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '900',
    },
    viewerAuthorMeta: {
      color: 'rgba(255,255,255,0.58)',
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    viewerMedia: {
      width: '100%',
      height: 520,
      backgroundColor: '#050505',
    },
    viewerActionsRow: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
    },
    viewerLeftActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 17,
    },
    viewerActionButton: {
      minWidth: 30,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerCaption: {
      color: 'rgba(255,255,255,0.92)',
      paddingHorizontal: 16,
      paddingTop: 2,
      fontSize: 15,
      lineHeight: 22,
    },
    viewerCaptionAuthor: {
      color: '#ffffff',
      fontWeight: '900',
    },
    viewerDate: {
      color: 'rgba(255,255,255,0.48)',
      paddingHorizontal: 16,
      paddingTop: 12,
      fontSize: 13,
      fontWeight: '600',
    },
  });
};
