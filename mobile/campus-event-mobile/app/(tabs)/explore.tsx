import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

import { AppScreen } from '@/components/mobile/AppScreen';
import { DiscoverPostsImmersiveFeed } from '@/components/mobile/DiscoverPostsImmersiveFeed';
import { EventListCard } from '@/components/mobile/EventListCard';
import { ExploreEventDetailModal } from '@/components/mobile/ExploreEventDetailModal';
import { ProfileAvatarLink } from '@/components/mobile/ProfileAvatarLink';
import {
  loadDiscoverPosts,
  togglePostLike,
  togglePostSave,
  type DiscoverPostRecord,
} from '@/lib/mobile-discover-posts';
import {
  formatViewCount,
  getPlaceholderViewCount,
  recordContentView,
} from '@/lib/mobile-content-views';
import { getEventImageSource } from '@/lib/mobile-media';
import { useMobileApp } from '@/providers/mobile-app-provider';
import { useShareSheet } from '@/providers/mobile-share-provider';
import type { EventRecord, ProfileRecord } from '@/types/models';

type ExploreTab = 'forYou' | 'media' | 'events';
type MediaFilter = 'all' | 'videos' | 'pictures';
type EventScope = 'nearby' | 'state' | 'country';
type OpenDropdown = 'media' | 'events' | null;
type SearchResultsTab = 'for-you' | 'profiles' | 'events' | 'places';

type ExploreItem =
  | {
      kind: 'video';
      id: string;
      mediaUrl: string;
      thumbnailUrl?: string;
      viewCount: number;
      raw: DiscoverPostRecord;
    }
  | {
      kind: 'picture';
      id: string;
      mediaUrl: string;
      viewCount: number;
      raw: DiscoverPostRecord;
    }
  | {
      kind: 'event';
      id: string;
      image: string;
      title: string;
      viewCount: number;
      raw: EventRecord;
    };

// Mock fallback media so the grid is always full on a fresh DB or during dev
// disconnects. These all use stable public Unsplash URLs.
const MOCK_MEDIA: { kind: 'video' | 'picture'; mediaUrl: string }[] = [
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1495563381401-ecfbcaaa60f2?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1508264165352-258a6ecbfdfd?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1472653431158-6364773b2a56?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=800&q=80' },
  { kind: 'picture', mediaUrl: 'https://images.unsplash.com/photo-1488378472345-e7912a503ead?auto=format&fit=crop&w=800&q=80' },
  { kind: 'video',   mediaUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80' },
];

const MOCK_AUTHORS = [
  { id: 'mock-author-1', username: 'campuslive',      name: 'Campus Live'    },
  { id: 'mock-author-2', username: 'umesevents',      name: 'UMES Events'    },
  { id: 'mock-author-3', username: 'friday.presents', name: 'Friday Presents'},
  { id: 'mock-author-4', username: 'springfest',      name: 'Spring Fest'    },
  { id: 'mock-author-5', username: 'campusnightlife', name: 'Campus Nightlife'},
];

const MOCK_CAPTIONS = [
  'Tonight only ✨',
  "Don't miss it",
  "Who's coming with me?",
  'Campus vibes',
  'Linked up with the team 🔥',
  'This weekend is going to be crazy',
  'Tag someone who needs to see this',
  '',
];

const timeRank = (value?: string | null) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const interleave = (buckets: ExploreItem[][]) => {
  const queue: ExploreItem[] = [];
  const max = Math.max(...buckets.map((bucket) => bucket.length), 0);
  for (let i = 0; i < max; i += 1) {
    for (const bucket of buckets) {
      if (bucket[i]) queue.push(bucket[i]);
    }
  }
  return queue;
};

const filterEventsByScope = (events: EventRecord[], scope: EventScope) => {
  // State + country are broader scopes — until real geo filtering lands they
  // return the full set. Nearby keeps the Princess Anne / campus-keyword bias
  // the old Explore had.
  if (scope !== 'nearby') return events;

  const nearby = events.filter((event) => {
    const haystack = [event.location, event.locationName, event.locationAddress]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /princess anne|campus|umes|maryland|eastern shore/.test(haystack);
  });
  return nearby.length > 0 ? nearby : events;
};

const buildMockDiscoverRecord = (
  entry: { kind: 'video' | 'picture'; mediaUrl: string },
  index: number
): DiscoverPostRecord => {
  const author = MOCK_AUTHORS[index % MOCK_AUTHORS.length];
  const caption = MOCK_CAPTIONS[index % MOCK_CAPTIONS.length];
  return {
    id: `mock-${entry.kind}-${index}`,
    authorId: author.id,
    mediaUrl: entry.mediaUrl,
    mediaType: entry.kind === 'video' ? 'video' : 'image',
    thumbnailUrl: entry.mediaUrl,
    durationSeconds: entry.kind === 'video' ? 18 : null,
    mediaWidth: null,
    mediaHeight: null,
    caption,
    createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    onGrid: true,
    eventId: null,
    authorName: author.name,
    authorUsername: author.username,
    authorAvatar: '',
    likeCount: 12 + ((index * 37) % 400),
    commentCount: (index * 3) % 40,
    repostCount: (index * 2) % 20,
    shareCount: index % 10,
    isLikedByCurrentUser: false,
    isRepostedByCurrentUser: false,
  };
};

const TILE_GAP = 2;
// Target density — tiles keep cycling until we hit this many rows (3 cols).
const MIN_GRID_ITEMS = 30;
const RECENT_SEARCHES_KEY = 'discover-search:recent';
const SEARCH_RESULT_TABS: { id: SearchResultsTab; label: string }[] = [
  { id: 'for-you', label: 'For You' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'events', label: 'Events' },
  { id: 'places', label: 'Places' },
];

const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

const includesSearchQuery = (values: (string | null | undefined)[], query: string) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return false;
  return values.filter(Boolean).some((value) =>
    normalizeSearchValue(String(value)).includes(normalizedQuery)
  );
};

const profileMatchesSearch = (profile: ProfileRecord, query: string) =>
  includesSearchQuery(
    [profile.username, profile.name, profile.bio, profile.school, profile.organizationName],
    query
  );

const eventMatchesSearch = (event: EventRecord, query: string) =>
  includesSearchQuery(
    [
      event.title,
      event.description,
      event.locationName,
      event.location,
      event.host,
      event.organizer,
      ...(event.tags || []),
    ],
    query
  );

const exploreItemMatchesSearch = (item: ExploreItem, query: string) => {
  if (item.kind === 'event') return eventMatchesSearch(item.raw, query);
  return includesSearchQuery(
    [item.raw.caption, item.raw.authorName, item.raw.authorUsername],
    query
  );
};

const getProfileSubtitle = (profile: ProfileRecord) =>
  profile.school || profile.organizationName || profile.bio || '';

export default function ExploreScreen() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const {
    events: allEvents = [],
    currentUser,
    profiles,
    savedEventIds,
    toggleSaveEvent,
  } = useMobileApp();
  const { openShareSheet } = useShareSheet();

  const [primaryTab, setPrimaryTab] = useState<ExploreTab>('forYou');
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [eventScope, setEventScope] = useState<EventScope>('nearby');
  const [posts, setPosts] = useState<DiscoverPostRecord[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
  const [overlayQuery, setOverlayQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');
  const [searchResultsTab, setSearchResultsTab] = useState<SearchResultsTab>('for-you');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchOverlayProgress = useRef(new Animated.Value(0)).current;

  // In-page media viewer (opens when a media tile is tapped).
  const [viewerPosts, setViewerPosts] = useState<DiscoverPostRecord[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

  // Chip-row layout tracking, so the Media/Events dropdowns can anchor under
  // the correct pill regardless of horizontal scroll position.
  const [chipLayouts, setChipLayouts] = useState<Record<OpenDropdown & string, { x: number; width: number } | undefined>>({
    media: undefined,
    events: undefined,
  });
  const chipsScrollX = useRef(0);
  const [chipsScrollTick, setChipsScrollTick] = useState(0);

  const windowWidth = Dimensions.get('window').width;
  const tileSize = useMemo(
    () => (windowWidth - TILE_GAP * 2) / 3,
    [windowWidth]
  );

  useEffect(() => {
    let cancelled = false;
    loadDiscoverPosts({
      onData: (next) => {
        if (!cancelled) setPosts(next || []);
      },
    })
      .then((next) => {
        if (!cancelled) setPosts(next || []);
      })
      .catch(() => {
        /* swallow — we'll just fall back to mock media */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((stored) => {
      if (!mounted || !stored) return;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item) => typeof item === 'string').slice(0, 8));
        }
      } catch {
        setRecentSearches([]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const videoItems = useMemo<ExploreItem[]>(
    () =>
      posts
        .filter((post) => post.mediaType === 'video')
        .sort((a, b) => timeRank(b.createdAt) - timeRank(a.createdAt))
        .map((post) => ({
          kind: 'video' as const,
          id: String(post.id),
          mediaUrl: post.mediaUrl,
          thumbnailUrl: post.thumbnailUrl || undefined,
          viewCount: getPlaceholderViewCount(String(post.id)),
          raw: post,
        })),
    [posts]
  );

  const pictureItems = useMemo<ExploreItem[]>(
    () =>
      posts
        .filter((post) => post.mediaType !== 'video')
        .sort((a, b) => timeRank(b.createdAt) - timeRank(a.createdAt))
        .map((post) => ({
          kind: 'picture' as const,
          id: String(post.id),
          mediaUrl: post.mediaUrl,
          viewCount: getPlaceholderViewCount(String(post.id)),
          raw: post,
        })),
    [posts]
  );

  const mockItems = useMemo<ExploreItem[]>(
    () =>
      MOCK_MEDIA.map((entry, index) => {
        const record = buildMockDiscoverRecord(entry, index);
        return entry.kind === 'video'
          ? {
              kind: 'video' as const,
              id: record.id,
              mediaUrl: entry.mediaUrl,
              thumbnailUrl: entry.mediaUrl,
              viewCount: getPlaceholderViewCount(record.id),
              raw: record,
            }
          : {
              kind: 'picture' as const,
              id: record.id,
              mediaUrl: entry.mediaUrl,
              viewCount: getPlaceholderViewCount(record.id),
              raw: record,
            };
      }),
    []
  );

  const eventItems = useMemo<ExploreItem[]>(() => {
    const scoped = filterEventsByScope(allEvents, eventScope);
    return scoped
      .slice()
      .sort(
        (a, b) =>
          timeRank(b.createdAt || b.date) - timeRank(a.createdAt || a.date)
      )
      .map((event) => ({
        kind: 'event' as const,
        id: String(event.id),
        image: event.image || '',
        title: event.title || 'Campus event',
        viewCount: getPlaceholderViewCount(String(event.id)),
        raw: event,
      }));
  }, [allEvents, eventScope]);

  // Keeps the grid visually full. If the base set of real + mock + event
  // items is short, we cycle through them with fresh ids so each tile is a
  // distinct, tappable placeholder.
  const padToDensity = useCallback((items: ExploreItem[]): ExploreItem[] => {
    if (items.length === 0 || items.length >= MIN_GRID_ITEMS) return items;
    const padded: ExploreItem[] = [...items];
    let cycle = 0;
    while (padded.length < MIN_GRID_ITEMS) {
      const source = items[padded.length % items.length];
      const suffix = `-pad-${cycle}-${padded.length}`;
      if (source.kind === 'event') {
        padded.push({ ...source, id: `${source.id}${suffix}` });
      } else if (source.kind === 'video') {
        padded.push({
          ...source,
          id: `${source.id}${suffix}`,
          raw: { ...source.raw, id: `${source.raw.id}${suffix}` },
        });
      } else {
        padded.push({
          ...source,
          id: `${source.id}${suffix}`,
          raw: { ...source.raw, id: `${source.raw.id}${suffix}` },
        });
      }
      cycle += 1;
    }
    return padded;
  }, []);

  const gridItems = useMemo<ExploreItem[]>(() => {
    const blendedVideos =
      videoItems.length > 0 ? videoItems : mockItems.filter((item) => item.kind === 'video');
    const blendedPictures =
      pictureItems.length > 0 ? pictureItems : mockItems.filter((item) => item.kind === 'picture');

    let base: ExploreItem[];
    if (primaryTab === 'media') {
      if (mediaFilter === 'videos') base = blendedVideos;
      else if (mediaFilter === 'pictures') base = blendedPictures;
      else base = interleave([blendedVideos, blendedPictures]);
    } else if (primaryTab === 'events') {
      base = eventItems;
    } else {
      // For You = interleave media + events so the grid always has texture.
      base = interleave([blendedVideos, blendedPictures, eventItems]);
    }

    return padToDensity(base);
  }, [eventItems, mediaFilter, mockItems, padToDensity, pictureItems, primaryTab, videoItems]);

  const filteredItems = useMemo(() => {
    return gridItems;
  }, [gridItems]);

  // All media records currently visible in the grid (used to seed the viewer
  // feed when a user taps a tile, so they can swipe to adjacent posts).
  const viewerSourcePosts = useMemo<DiscoverPostRecord[]>(
    () =>
      filteredItems
        .filter((item) => item.kind !== 'event')
        .map((item) => item.raw as DiscoverPostRecord),
    [filteredItems]
  );

  const handlePrimaryTabPress = useCallback(
    (tabId: ExploreTab) => {
      const hasDropdown = tabId === 'media' || tabId === 'events';
      if (!hasDropdown) {
        setPrimaryTab(tabId);
        setOpenDropdown(null);
        return;
      }
      if (primaryTab !== tabId) {
        setPrimaryTab(tabId);
        setOpenDropdown(null);
        return;
      }
      setOpenDropdown((current) => (current === tabId ? null : tabId));
    },
    [primaryTab]
  );

  const handleOpenItem = useCallback(
    (item: ExploreItem) => {
      if (item.kind === 'event') {
        setSelectedEvent(item.raw);
        void recordContentView({
          contentType: 'event',
          contentId: item.id,
          userId: currentUser?.id,
        });
        return;
      }
      // Media tile → open the in-page post/video viewer. Seed with every
      // visible media record (starting at the tapped one) so the viewer
      // supports swiping through adjacent posts.
      const tappedId = String((item.raw as DiscoverPostRecord).id);
      const startIndex = Math.max(
        0,
        viewerSourcePosts.findIndex((post) => String(post.id) === tappedId)
      );
      const ordered = viewerSourcePosts.length
        ? viewerSourcePosts.slice(startIndex).concat(viewerSourcePosts.slice(0, startIndex))
        : [item.raw as DiscoverPostRecord];
      setViewerPosts(ordered);
      void recordContentView({
        contentType: item.kind === 'video' ? 'video' : 'post',
        contentId: item.id,
        userId: currentUser?.id,
      });
    },
    [currentUser?.id, viewerSourcePosts]
  );

  const renderTile = useCallback(
    ({ item }: { item: ExploreItem }) => {
      const imageSource =
        item.kind === 'event'
          ? getEventImageSource(item.image)
          : { uri: (item.kind === 'video' && item.thumbnailUrl) || item.mediaUrl };

      return (
        <Pressable
          style={{
            width: tileSize,
            height: tileSize,
            marginRight: TILE_GAP,
            marginBottom: TILE_GAP,
            backgroundColor: '#0f0f11',
            overflow: 'hidden',
            borderRadius: 2,
          }}
          onPress={() => handleOpenItem(item)}>
          <ExpoImage
            source={imageSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />

          {/* Type indicator (top-right) */}
          <View style={styles.tileTypeBadge} pointerEvents="none">
            <Ionicons
              name={
                item.kind === 'video'
                  ? 'play'
                  : item.kind === 'event'
                    ? 'location-sharp'
                    : 'copy-outline'
              }
              size={12}
              color="#ffffff"
            />
          </View>

          {/* Event tile title strip (bottom) */}
          {item.kind === 'event' ? (
            <View style={styles.eventTitleStrip} pointerEvents="none">
              <Text style={styles.eventTitleText} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          ) : null}

          {/* View count (bottom-left) */}
          <View style={styles.tileViewOverlay} pointerEvents="none">
            <Ionicons name="eye" size={11} color="#ffffff" />
            <Text style={styles.tileViewText}>{formatViewCount(item.viewCount)}</Text>
          </View>
        </Pressable>
      );
    },
    [handleOpenItem, tileSize]
  );

  const activeMediaLabel =
    mediaFilter === 'videos' ? 'Videos' : mediaFilter === 'pictures' ? 'Pictures' : 'Media';
  const activeEventLabel =
    eventScope === 'state' ? 'State' : eventScope === 'country' ? 'Country' : 'Nearby';
  const cleanOverlayQuery = overlayQuery.trim();
  const activeSearchQuery = submittedSearchQuery || cleanOverlayQuery;
  const isShowingSubmittedResults = Boolean(submittedSearchQuery);
  const suggestedSearches = useMemo(() => {
    const tags = allEvents.flatMap((event) => event.tags || []);
    const locations = allEvents.map((event) => event.locationName || event.location).filter(Boolean);
    return [...new Set([...tags, ...locations])]
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 6);
  }, [allEvents]);
  const liveProfileMatches = useMemo(
    () =>
      profiles
        .filter((profile) => profileMatchesSearch(profile, cleanOverlayQuery))
        .filter((profile) => profile.id !== currentUser?.id)
        .slice(0, 10),
    [cleanOverlayQuery, currentUser?.id, profiles]
  );
  const resultProfiles = useMemo(
    () =>
      profiles
        .filter((profile) => profileMatchesSearch(profile, activeSearchQuery))
        .filter((profile) => profile.id !== currentUser?.id),
    [activeSearchQuery, currentUser?.id, profiles]
  );
  const resultEvents = useMemo(
    () => allEvents.filter((event) => eventMatchesSearch(event, activeSearchQuery)),
    [activeSearchQuery, allEvents]
  );
  const resultGridItems = useMemo(
    () => gridItems.filter((item) => exploreItemMatchesSearch(item, activeSearchQuery)),
    [activeSearchQuery, gridItems]
  );
  const resultPlaces = useMemo(
    () =>
      [...new Set(resultEvents.map((event) => event.locationName || event.location).filter(Boolean))]
        .slice(0, 10),
    [resultEvents]
  );

  const openSearchOverlay = () => {
    setOpenDropdown(null);
    setOverlayQuery('');
    setSubmittedSearchQuery('');
    setSearchResultsTab('for-you');
    setSearchOverlayVisible(true);
    searchOverlayProgress.setValue(0);
    Animated.timing(searchOverlayProgress, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const closeSearchOverlay = () => {
    Animated.timing(searchOverlayProgress, {
      toValue: 0,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setSearchOverlayVisible(false);
      setOverlayQuery('');
      setSubmittedSearchQuery('');
      setSearchResultsTab('for-you');
    });
  };

  const saveRecentSearch = (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    setRecentSearches((current) => {
      const next = [cleanTerm, ...current.filter((item) =>
        normalizeSearchValue(item) !== normalizeSearchValue(cleanTerm)
      )].slice(0, 8);
      void AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeRecentSearch = (term: string) => {
    setRecentSearches((current) => {
      const next = current.filter((item) => item !== term);
      void AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const submitOverlaySearch = (term = cleanOverlayQuery) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    saveRecentSearch(cleanTerm);
    setOverlayQuery(cleanTerm);
    setSubmittedSearchQuery(cleanTerm);
    setSearchResultsTab('for-you');
  };

  const openSearchProfile = (profile: ProfileRecord) => {
    if (!profile.username) return;
    closeSearchOverlay();
    if (profile.username === currentUser?.username) {
      router.push('/(tabs)/profile');
      return;
    }
    router.push({ pathname: '/profile/[username]', params: { username: profile.username } });
  };

  const handleChipLayout = useCallback(
    (key: 'media' | 'events') => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      setChipLayouts((prev) => ({ ...prev, [key]: { x, width } }));
    },
    []
  );

  const handleChipsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      chipsScrollX.current = event.nativeEvent.contentOffset.x;
      // Force a re-render so the anchored dropdown follows the scroll. Only
      // matters while a dropdown is open — cheap to trigger either way.
      setChipsScrollTick((tick) => tick + 1);
    },
    []
  );

  const dropdownLeftForKey = (key: 'media' | 'events'): number => {
    const layout = chipLayouts[key];
    if (!layout) return 12;
    const CHIP_ROW_PADDING = 12;
    const MIN_DROPDOWN_WIDTH = 160;
    const anchorCenter = CHIP_ROW_PADDING + layout.x - chipsScrollX.current + layout.width / 2;
    const maxLeft = Math.max(12, windowWidth - MIN_DROPDOWN_WIDTH - 12);
    const proposed = anchorCenter - MIN_DROPDOWN_WIDTH / 2;
    return Math.min(Math.max(12, proposed), maxLeft);
  };

  // Read once per render so `chipsScrollTick` participates in the dependency
  // chain and keeps the dropdown anchored while the chip row scrolls.
  void chipsScrollTick;

  const handleViewerLike = useCallback(
    (post: DiscoverPostRecord) => {
      const postId = String(post.id);
      const isMock = postId.startsWith('mock-');
      const currentlyLiked = likedPostIds.has(postId);
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      setViewerPosts((prev) =>
        prev.map((p) =>
          String(p.id) === postId
            ? { ...p, likeCount: Math.max(0, p.likeCount + (currentlyLiked ? -1 : 1)) }
            : p
        )
      );
      if (isMock || !currentUser?.id) return;
      void togglePostLike({ postId, userId: currentUser.id, isLiked: currentlyLiked });
    },
    [currentUser?.id, likedPostIds]
  );

  const handleViewerSave = useCallback(
    (post: DiscoverPostRecord) => {
      const postId = String(post.id);
      const isMock = postId.startsWith('mock-');
      const currentlySaved = savedPostIds.has(postId);
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(postId);
        else next.add(postId);
        return next;
      });
      if (isMock || !currentUser?.id) return;
      void togglePostSave({ postId, userId: currentUser.id, isSaved: currentlySaved });
    },
    [currentUser?.id, savedPostIds]
  );

  const handleViewerShare = useCallback(
    (post: DiscoverPostRecord) => {
      openShareSheet({
        kind: post.mediaType === 'video' ? 'video' : 'post',
        post,
      });
    },
    [openShareSheet]
  );

  const handleViewerCreator = useCallback(
    (post: DiscoverPostRecord) => {
      if (!post.authorUsername) return;
      setViewerPosts([]);
      router.push({
        pathname: '/profile/[username]',
        params: { username: post.authorUsername },
      });
    },
    [router]
  );

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.stickyHeader}>
        <View style={styles.searchRow}>
          <Pressable
            style={styles.searchField}
            onPress={openSearchOverlay}
            accessibilityRole="button"
            accessibilityLabel="Open search">
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" />
            <Text style={styles.searchPlaceholder}>Search events or people</Text>
          </Pressable>
          <Pressable
            style={styles.searchAdjust}
            onPress={() => setOpenDropdown(null)}
            hitSlop={8}>
            <Ionicons name="options-outline" size={18} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleChipsScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.chipsRow}>
          <Chip
            label="For you"
            active={primaryTab === 'forYou'}
            onPress={() => handlePrimaryTabPress('forYou')}
          />
          <Chip
            label={primaryTab === 'media' ? activeMediaLabel : 'Media'}
            active={primaryTab === 'media'}
            chevronOpen={openDropdown === 'media'}
            hasChevron
            onPress={() => handlePrimaryTabPress('media')}
            onLayout={handleChipLayout('media')}
          />
          <Chip
            label={primaryTab === 'events' ? activeEventLabel : 'Events'}
            active={primaryTab === 'events'}
            chevronOpen={openDropdown === 'events'}
            hasChevron
            onPress={() => handlePrimaryTabPress('events')}
            onLayout={handleChipLayout('events')}
          />
          <Chip label="Apps" onPress={() => {}} />
          <Chip label="Startup" onPress={() => {}} />
          <Chip label="NBA" onPress={() => {}} />
        </ScrollView>
      </View>

      {/* Tap-to-dismiss scrim rendered below the sticky header, so tapping
          anywhere outside the floating dropdown closes it. */}
      {openDropdown ? (
        <Pressable
          style={styles.dropdownDismissLayer}
          onPress={() => setOpenDropdown(null)}
        />
      ) : null}

      {/* Floating, compact dropdowns anchored under their chip — mirrors the
          profile tab dropdown style. */}
      {openDropdown === 'media' ? (
        <View
          style={[styles.floatingDropdown, { left: dropdownLeftForKey('media') }]}>
          {(['all', 'videos', 'pictures'] as MediaFilter[]).map((option) => (
            <DropdownItem
              key={option}
              label={
                option === 'all' ? 'All media' : option === 'videos' ? 'Videos' : 'Pictures'
              }
              active={mediaFilter === option}
              onPress={() => {
                setMediaFilter(option);
                setPrimaryTab('media');
                setOpenDropdown(null);
              }}
            />
          ))}
        </View>
      ) : null}

      {openDropdown === 'events' ? (
        <View
          style={[styles.floatingDropdown, { left: dropdownLeftForKey('events') }]}>
          {(['nearby', 'state', 'country'] as EventScope[]).map((option) => (
            <DropdownItem
              key={option}
              label={option === 'nearby' ? 'Nearby' : option === 'state' ? 'State' : 'Country'}
              active={eventScope === option}
              onPress={() => {
                setEventScope(option);
                setPrimaryTab('events');
                setOpenDropdown(null);
              }}
            />
          ))}
        </View>
      ) : null}

      <FlatList
        data={filteredItems}
        keyExtractor={(item, index) => `${item.kind}-${item.id}-${index}`}
        renderItem={renderTile}
        numColumns={3}
        columnWrapperStyle={{ paddingLeft: TILE_GAP }}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing here yet.</Text>
            <Text style={styles.emptyCopy}>
              Events, posts and videos will land here.
            </Text>
          </View>
        }
      />

      <Pressable
        style={styles.globeButton}
        onPress={() => router.push('/map')}
        accessibilityLabel="Open event map">
        <Text style={styles.mapGlobeEmoji} allowFontScaling={false}>
          🌍
        </Text>
      </Pressable>

      <Modal
        visible={searchOverlayVisible}
        animationType="none"
        transparent
        onRequestClose={closeSearchOverlay}>
        <Animated.View
          style={[
            styles.searchOverlayScreen,
            {
              opacity: searchOverlayProgress,
              transform: [
                {
                  translateY: searchOverlayProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-36, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={styles.searchOverlayHeader}>
            <Pressable
              style={styles.searchOverlayBack}
              onPress={closeSearchOverlay}
              accessibilityLabel="Close search"
              accessibilityRole="button">
              <Ionicons name="chevron-back" size={30} color="#ffffff" />
            </Pressable>
            <View style={styles.searchOverlayInputWrap}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.55)" />
              <TextInput
                autoFocus
                value={overlayQuery}
                onChangeText={(value) => {
                  setOverlayQuery(value);
                  setSubmittedSearchQuery('');
                }}
                onSubmitEditing={() => submitOverlaySearch()}
                returnKeyType="search"
                placeholder="Search events or people"
                placeholderTextColor="rgba(255,255,255,0.5)"
                selectionColor="#32d74b"
                style={styles.searchOverlayInput}
              />
              {cleanOverlayQuery ? (
                <Pressable
                  style={styles.searchOverlayClear}
                  onPress={() => {
                    setOverlayQuery('');
                    setSubmittedSearchQuery('');
                  }}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button">
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.58)" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {!cleanOverlayQuery && !isShowingSubmittedResults ? (
            <ScrollView
              contentContainerStyle={styles.searchOverlayContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.searchOverlaySection}>
                <Text style={styles.searchOverlaySectionTitle}>Recent</Text>
                {recentSearches.length > 0 ? (
                  recentSearches.map((term) => (
                    <Pressable
                      key={term}
                      style={styles.compactSearchRow}
                      onPress={() => submitOverlaySearch(term)}
                      accessibilityRole="button">
                      <View style={styles.compactSearchIcon}>
                        <Ionicons name="time-outline" size={18} color="#ffffff" />
                      </View>
                      <Text style={styles.compactSearchTitle} numberOfLines={1}>
                        {term}
                      </Text>
                      <Pressable
                        style={styles.compactRemoveButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          removeRecentSearch(term);
                        }}
                        accessibilityLabel={`Remove ${term} from recent searches`}
                        accessibilityRole="button">
                        <Ionicons name="close-outline" size={20} color="rgba(255,255,255,0.55)" />
                      </Pressable>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.compactEmptyText}>No recent searches yet.</Text>
                )}
              </View>

              <View style={styles.searchOverlaySection}>
                <Text style={styles.searchOverlaySectionTitle}>Suggested</Text>
                {suggestedSearches.length > 0 ? (
                  suggestedSearches.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      style={styles.compactSearchRow}
                      onPress={() => submitOverlaySearch(suggestion)}
                      accessibilityRole="button">
                      <View style={styles.compactSearchIcon}>
                        <Ionicons name="search-outline" size={18} color="#ffffff" />
                      </View>
                      <Text style={styles.compactSearchTitle} numberOfLines={1}>
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.compactEmptyText}>Suggested searches will appear here.</Text>
                )}
              </View>
            </ScrollView>
          ) : null}

          {cleanOverlayQuery && !isShowingSubmittedResults ? (
            <ScrollView
              contentContainerStyle={styles.searchOverlayContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {cleanOverlayQuery.length >= 3 ? (
                <Pressable
                  style={styles.compactSearchRow}
                  onPress={() => submitOverlaySearch()}
                  accessibilityRole="button">
                  <View style={styles.compactSearchIcon}>
                    <Ionicons name="search-outline" size={18} color="#ffffff" />
                  </View>
                  <View style={styles.compactRowCopy}>
                    <Text style={styles.compactSearchTitle} numberOfLines={1}>
                      {cleanOverlayQuery}
                    </Text>
                    <Text style={styles.compactSearchSubtitle}>Search topic</Text>
                  </View>
                </Pressable>
              ) : null}

              {liveProfileMatches.length > 0 ? (
                liveProfileMatches.map((profile) => (
                  <Pressable
                    key={profile.id}
                    style={styles.compactSearchRow}
                    onPress={() => openSearchProfile(profile)}
                    accessibilityRole="button">
                    <ProfileAvatarLink profile={profile} style={styles.compactAvatar} />
                    <View style={styles.compactRowCopy}>
                      <Text style={styles.compactSearchTitle} numberOfLines={1}>
                        {profile.username || profile.name}
                      </Text>
                      {getProfileSubtitle(profile) ? (
                        <Text style={styles.compactSearchSubtitle} numberOfLines={1}>
                          {getProfileSubtitle(profile)}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.compactEmptyText}>No matching profiles yet.</Text>
              )}
            </ScrollView>
          ) : null}

          {isShowingSubmittedResults ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.searchResultsTabs}>
                {SEARCH_RESULT_TABS.map((tab) => {
                  const isActive = searchResultsTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      style={styles.searchResultTab}
                      onPress={() => setSearchResultsTab(tab.id)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}>
                      <Text style={[styles.searchResultTabText, isActive && styles.searchResultTabTextActive]}>
                        {tab.label}
                      </Text>
                      <View style={[styles.searchResultUnderline, isActive && styles.searchResultUnderlineActive]} />
                    </Pressable>
                  );
                })}
              </ScrollView>

              <ScrollView contentContainerStyle={styles.searchResultsContent} showsVerticalScrollIndicator={false}>
                {searchResultsTab === 'for-you' ? (
                  <View style={styles.overlayResultGrid}>
                    {resultGridItems.length > 0 ? (
                      resultGridItems.map((item, index) => {
                        const source =
                          item.kind === 'event'
                            ? getEventImageSource(item.image)
                            : { uri: (item.kind === 'video' && item.thumbnailUrl) || item.mediaUrl };
                        return (
                          <Pressable
                            key={`${item.kind}-${item.id}-${index}`}
                            style={styles.overlayResultTile}
                            onPress={() => {
                              closeSearchOverlay();
                              handleOpenItem(item);
                            }}
                            accessibilityRole="button">
                            <ExpoImage source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
                            <View style={styles.overlayTileBadge}>
                              <Ionicons
                                name={item.kind === 'video' ? 'play' : item.kind === 'event' ? 'location-sharp' : 'copy-outline'}
                                size={11}
                                color="#ffffff"
                              />
                            </View>
                            {item.kind === 'event' ? (
                              <Text style={styles.overlayTileTitle} numberOfLines={1}>
                                {item.title}
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.compactEmptyText}>Results will appear here.</Text>
                    )}
                  </View>
                ) : null}

                {searchResultsTab === 'profiles' ? (
                  <View style={styles.searchOverlaySection}>
                    {resultProfiles.length > 0 ? (
                      resultProfiles.map((profile) => (
                        <Pressable
                          key={profile.id}
                          style={styles.compactSearchRow}
                          onPress={() => openSearchProfile(profile)}
                          accessibilityRole="button">
                          <ProfileAvatarLink profile={profile} style={styles.compactAvatar} />
                          <View style={styles.compactRowCopy}>
                            <Text style={styles.compactSearchTitle} numberOfLines={1}>
                              {profile.username || profile.name}
                            </Text>
                            {getProfileSubtitle(profile) ? (
                              <Text style={styles.compactSearchSubtitle} numberOfLines={1}>
                                {getProfileSubtitle(profile)}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      ))
                    ) : (
                      <Text style={styles.compactEmptyText}>Profiles matching this search will appear here.</Text>
                    )}
                  </View>
                ) : null}

                {searchResultsTab === 'events' ? (
                  <View style={styles.overlayEventsList}>
                    {resultEvents.length > 0 ? (
                      resultEvents.map((event) => (
                        <EventListCard
                          key={event.id}
                          event={event}
                          onPress={() => {
                            closeSearchOverlay();
                            setSelectedEvent(event);
                          }}
                        />
                      ))
                    ) : (
                      <Text style={styles.compactEmptyText}>Events matching this search will appear here.</Text>
                    )}
                  </View>
                ) : null}

                {searchResultsTab === 'places' ? (
                  <View style={styles.searchOverlaySection}>
                    {resultPlaces.length > 0 ? (
                      resultPlaces.map((place) => (
                        <View key={place} style={styles.compactSearchRow}>
                          <View style={styles.compactSearchIcon}>
                            <Ionicons name="location-outline" size={18} color="#ffffff" />
                          </View>
                          <Text style={styles.compactSearchTitle} numberOfLines={1}>
                            {place}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.compactEmptyText}>Places related to this search will appear here.</Text>
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </Animated.View>
      </Modal>

      <ExploreEventDetailModal
        visible={Boolean(selectedEvent)}
        event={selectedEvent}
        actionLabel={
          selectedEvent && savedEventIds.includes(String(selectedEvent.id))
            ? 'Cancel'
            : "I'm Going"
        }
        actionActive={Boolean(
          selectedEvent && savedEventIds.includes(String(selectedEvent.id))
        )}
        onClose={() => setSelectedEvent(null)}
        onActionPress={() => {
          if (!selectedEvent) return;
          void toggleSaveEvent(String(selectedEvent.id));
        }}
      />

      <Modal
        visible={viewerPosts.length > 0}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerPosts([])}>
        <View style={styles.viewerScreen}>
          <DiscoverPostsImmersiveFeed
            posts={viewerPosts}
            likedPostIds={likedPostIds}
            savedPostIds={savedPostIds}
            isScreenFocused={isScreenFocused && viewerPosts.length > 0}
            onPressLike={handleViewerLike}
            onPressSave={handleViewerSave}
            onPressComment={() =>
              Alert.alert('Comments coming soon', 'Post comments are not wired up yet.')
            }
            onPressRepost={() =>
              Alert.alert('Repost', 'Reposting from explore is not wired up yet.')
            }
            onPressShare={handleViewerShare}
            onPressCreator={handleViewerCreator}
            currentUserId={currentUser?.id}
          />
          <Pressable
            style={styles.viewerCloseButton}
            onPress={() => setViewerPosts([])}
            accessibilityLabel="Close viewer">
            <Ionicons name="chevron-back" size={26} color="#ffffff" />
          </Pressable>
        </View>
      </Modal>
    </AppScreen>
  );
}

type ChipProps = {
  label: string;
  active?: boolean;
  hasChevron?: boolean;
  chevronOpen?: boolean;
  onPress: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};
function Chip({ label, active, hasChevron, chevronOpen, onPress, onLayout }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      onLayout={onLayout}>
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
        numberOfLines={1}>
        {label}
      </Text>
      {hasChevron ? (
        <Ionicons
          name={chevronOpen ? 'chevron-down' : 'chevron-forward'}
          size={11}
          color={active ? '#000000' : 'rgba(255,255,255,0.75)'}
          style={{ marginLeft: 4 }}
        />
      ) : null}
    </Pressable>
  );
}

type DropdownItemProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};
function DropdownItem({ label, active, onPress }: DropdownItemProps) {
  return (
    <Pressable style={styles.dropdownItem} onPress={onPress}>
      <Text
        style={[
          styles.dropdownItemText,
          active && styles.dropdownItemTextActive,
        ]}>
        {label}
      </Text>
      {active ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#050506',
  } as ViewStyle,
  stickyHeader: {
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#050506',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    zIndex: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchPlaceholder: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  searchAdjust: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#17171a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#000000',
  },
  dropdownDismissLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9,
    backgroundColor: 'transparent',
  },
  floatingDropdown: {
    position: 'absolute',
    // The sticky header is ~110 tall (search row + chips). This drops the
    // dropdown right under the chip row without pushing the grid.
    top: 108,
    minWidth: 160,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(16,16,18,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    zIndex: 10,
  },
  dropdownItem: {
    minHeight: 40,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dropdownItemText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '800',
  },
  dropdownItemTextActive: {
    color: '#ffffff',
  },
  gridContent: {
    paddingTop: TILE_GAP,
    paddingBottom: 120,
  },
  tileTypeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileViewOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tileViewText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  eventTitleStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  eventTitleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  emptyState: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCopy: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  globeButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  mapGlobeEmoji: {
    fontSize: 64,
    lineHeight: 66,
    textAlign: 'center',
    includeFontPadding: false,
  },
  searchOverlayScreen: {
    flex: 1,
    backgroundColor: '#05080c',
  },
  searchOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 54,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  searchOverlayBack: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchOverlayInputWrap: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    backgroundColor: '#242930',
  },
  searchOverlayInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchOverlayClear: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchOverlayContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 42,
    gap: 22,
  },
  searchOverlaySection: {
    gap: 8,
  },
  searchOverlaySectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  compactSearchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  compactSearchIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  compactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a1c',
  },
  compactRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactSearchTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  compactSearchSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  compactRemoveButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactEmptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    paddingVertical: 4,
  },
  searchResultsTabs: {
    minHeight: 44,
    alignItems: 'flex-end',
    gap: 26,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  searchResultTab: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  searchResultTabText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
  },
  searchResultTabTextActive: {
    color: '#ffffff',
  },
  searchResultUnderline: {
    width: '100%',
    height: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  searchResultUnderlineActive: {
    backgroundColor: '#32d74b',
  },
  searchResultsContent: {
    paddingBottom: 50,
  },
  overlayResultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  overlayResultTile: {
    width: '33%',
    aspectRatio: 0.78,
    overflow: 'hidden',
    backgroundColor: '#101012',
  },
  overlayTileBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayTileTitle: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },
  overlayEventsList: {
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  viewerScreen: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 52,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 20,
  },
});
